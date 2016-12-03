'use strict';

var	async = require('async');
var winston = require('winston');
var _ = require('underscore');

var user = require('../user');
var utils = require('../../public/src/utils');
var plugins = require('../plugins');
var notifications = require('../notifications');
var db = require('../database');

var pubsub = require('../pubsub');
var LRU = require('lru-cache');

var cache = LRU({
	max: 40000,
	maxAge: 1000 * 60 * 60
});

module.exports = function (Groups) {

	Groups.cache = cache;

	Groups.join = function (groupName, uid, callback) {
		callback = callback || function () {};

		if (!groupName) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		async.waterfall([
			function (next) {
				Groups.isMember(uid, groupName, next);
			},
			function (isMember, next) {
				if (isMember) {
					return callback();
				}
				Groups.exists(groupName, next);
			},
			function (exists, next) {
				if (exists) {
					return next();
				}
				Groups.create({
					name: groupName,
					description: '',
					hidden: 1
				}, function (err) {
					if (err && err.message !== '[[error:group-already-exists]]') {
						winston.error('[groups.join] Could not create new hidden group: ' + err.message);
						return callback(err);
					}
					next();
				});
			},
			function (next) {
				async.parallel({
					isAdmin: function (next) {
						user.isAdministrator(uid, next);
					},
					isHidden: function (next) {
						Groups.isHidden(groupName, next);
					}
				}, next);
			},
			function (results, next) {
				var tasks = [
					async.apply(db.sortedSetAdd, 'group:' + groupName + ':members', Date.now(), uid),
					async.apply(db.incrObjectField, 'group:' + groupName, 'memberCount')
				];
				if (results.isAdmin) {
					tasks.push(async.apply(db.setAdd, 'group:' + groupName + ':owners', uid));
				}
				if (!results.isHidden) {
					tasks.push(async.apply(db.sortedSetIncrBy, 'groups:visible:memberCount', 1, groupName));
				}
				async.parallel(tasks, next);
			},
			function (results, next) {
				clearCache(uid, groupName);
				setGroupTitleIfNotSet(groupName, uid, next);
			},
			function (next) {
				plugins.fireHook('action:group.join', {
					groupName: groupName,
					uid: uid
				});
				next();
			}
		], callback);
	};

	function setGroupTitleIfNotSet(groupName, uid, callback) {
		if (groupName === 'registered-users' || Groups.isPrivilegeGroup(groupName)) {
			return callback();
		}

		db.getObjectField('user:' + uid, 'groupTitle', function (err, currentTitle) {
			if (err || (currentTitle || currentTitle === '')) {
				return callback(err);
			}

			user.setUserField(uid, 'groupTitle', groupName, callback);
		});
	}

	Groups.requestMembership = function (groupName, uid, callback) {
		async.waterfall([
			async.apply(inviteOrRequestMembership, groupName, uid, 'request'),
			function (next) {
				user.getUserField(uid, 'username', next);
			},
			function (username, next) {
				async.parallel({
					notification: function (next) {
						notifications.create({
							bodyShort: '[[groups:request.notification_title, ' + username + ']]',
							bodyLong: '[[groups:request.notification_text, ' + username + ', ' + groupName + ']]',
							nid: 'group:' + groupName + ':uid:' + uid + ':request',
							path: '/groups/' + utils.slugify(groupName),
							from: uid
						}, next);
					},
					owners: function (next) {
						Groups.getOwners(groupName, next);
					}
				}, next);
			},
			function (results, next) {
				if (!results.notification || !results.owners.length) {
					return next();
				}
				notifications.push(results.notification, results.owners, next);
			}
		], callback);
	};

	Groups.acceptMembership = function (groupName, uid, callback) {
		// Note: For simplicity, this method intentially doesn't check the caller uid for ownership!
		async.waterfall([
			async.apply(db.setRemove, 'group:' + groupName + ':pending', uid),
			async.apply(db.setRemove, 'group:' + groupName + ':invited', uid),
			async.apply(Groups.join, groupName, uid)
		], callback);
	};

	Groups.rejectMembership = function (groupName, uid, callback) {
		// Note: For simplicity, this method intentially doesn't check the caller uid for ownership!
		async.parallel([
			async.apply(db.setRemove, 'group:' + groupName + ':pending', uid),
			async.apply(db.setRemove, 'group:' + groupName + ':invited', uid)
		], callback);
	};

	Groups.invite = function (groupName, uid, callback) {
		async.waterfall([
			async.apply(inviteOrRequestMembership, groupName, uid, 'invite'),
			async.apply(notifications.create, {
				bodyShort: '[[groups:invited.notification_title, ' + groupName + ']]',
				bodyLong: '',
				nid: 'group:' + groupName + ':uid:' + uid + ':invite',
				path: '/groups/' + utils.slugify(groupName)
			}),
			function (notification, next) {
				notifications.push(notification, [uid], next);
			}
		], callback);
	};

	function inviteOrRequestMembership(groupName, uid, type, callback) {
		if (!parseInt(uid, 10)) {
			return callback(new Error('[[error:not-logged-in]]'));
		}
		var hookName = type === 'invite' ? 'action:group.inviteMember' : 'action:group.requestMembership';
		var set = type === 'invite' ? 'group:' + groupName + ':invited' : 'group:' + groupName + ':pending';

		async.waterfall([
			function (next) {
				async.parallel({
					exists: async.apply(Groups.exists, groupName),
					isMember: async.apply(Groups.isMember, uid, groupName),
					isPending: async.apply(Groups.isPending, uid, groupName),
					isInvited: async.apply(Groups.isInvited, uid, groupName)
				}, next);
			},
			function (checks, next) {
				if (!checks.exists) {
					return next(new Error('[[error:no-group]]'));
				} else if (checks.isMember) {
					return callback();
				} else if (type === 'invite' && checks.isInvited) {
					return callback();
				} else if (type === 'request' && checks.isPending) {
					return next(new Error('[[error:group-already-requested]]'));
				}

				db.setAdd(set, uid, next);
			},
			function (next) {
				plugins.fireHook(hookName, {
					groupName: groupName,
					uid: uid
				});
				next();
			}
		], callback);
	}

	Groups.leave = function (groupName, uid, callback) {
		callback = callback || function () {};

		async.waterfall([
			function (next) {
				Groups.isMember(uid, groupName, next);
			},
			function (isMember, next) {
				if (!isMember) {
					return callback();
				}

				Groups.exists(groupName, next);
			},
			function (exists, next) {
				if (!exists) {
					return callback();
				}
				async.parallel([
					async.apply(db.sortedSetRemove, 'group:' + groupName + ':members', uid),
					async.apply(db.setRemove, 'group:' + groupName + ':owners', uid),
					async.apply(db.decrObjectField, 'group:' + groupName, 'memberCount')
				], next);
			},
			function (results, next) {
				clearCache(uid, groupName);
				Groups.getGroupFields(groupName, ['hidden', 'memberCount'], next);
			},
			function (groupData, next) {
				if (!groupData) {
					return callback();
				}
				if (Groups.isPrivilegeGroup(groupName) && parseInt(groupData.memberCount, 10) === 0) {
					Groups.destroy(groupName, next);
				} else {
					if (parseInt(groupData.hidden, 10) !== 1) {
						db.sortedSetAdd('groups:visible:memberCount', groupData.memberCount, groupName, next);
					} else {
						next();
					}
				}
			},
			function (next) {
				plugins.fireHook('action:group.leave', {
					groupName: groupName,
					uid: uid
				});
				next();
			}
		], callback);
	};

	Groups.leaveAllGroups = function (uid, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRange('groups:createtime', 0, -1, next);
			},
			function (groups, next) {
				async.each(groups, function (groupName, next) {
					async.parallel([
						function (next) {
							Groups.isMember(uid, groupName, function (err, isMember) {
								if (!err && isMember) {
									Groups.leave(groupName, uid, next);
								} else {
									next();
								}
							});
						},
						function (next) {
							Groups.rejectMembership(groupName, uid, next);
						}
					], next);
				}, next);
			}
		], callback);
	};

	Groups.getMembers = function (groupName, start, stop, callback) {
		db.getSortedSetRevRange('group:' + groupName + ':members', start, stop, callback);
	};

	Groups.getMemberUsers = function (groupNames, start, stop, callback) {
		async.map(groupNames, function (groupName, next) {
			Groups.getMembers(groupName, start, stop, function (err, uids) {
				if (err) {
					return next(err);
				}

				user.getUsersFields(uids, ['uid', 'username', 'picture', 'userslug'], next);
			});
		}, callback);
	};

	Groups.getMembersOfGroups = function (groupNames, callback) {
		db.getSortedSetsMembers(groupNames.map(function (name) {
			return 'group:' + name + ':members';
		}), callback);
	};

	Groups.resetCache = function () {
		pubsub.publish('group:cache:reset');
		cache.reset();
	};

	pubsub.on('group:cache:reset', function () {
		cache.reset();
	});

	function clearCache(uid, groupName) {
		pubsub.publish('group:cache:del', {uid: uid, groupName: groupName});
		cache.del(uid + ':' + groupName);
	}

	pubsub.on('group:cache:del', function (data) {
		cache.del(data.uid + ':' + data.groupName);
	});

	Groups.isMember = function (uid, groupName, callback) {
		if (!uid || parseInt(uid, 10) <= 0) {
			return callback(null, false);
		}

		var cacheKey = uid + ':' + groupName;
		if (cache.has(cacheKey)) {
			return process.nextTick(callback, null, cache.get(cacheKey));
		}

		db.isSortedSetMember('group:' + groupName + ':members', uid, function (err, isMember) {
			if (err) {
				return callback(err);
			}

			cache.set(cacheKey, isMember);
			callback(null, isMember);
		});
	};

	Groups.isMembers = function (uids, groupName, callback) {
		if (!groupName || !uids.length) {
			return callback(null, uids.map(function () {return false;}));
		}

		var nonCachedUids = [];
		uids.forEach(function (uid) {
			if (!cache.has(uid + ':' + groupName)) {
				nonCachedUids.push(uid);
			}
		});

		if (!nonCachedUids.length) {
			var result = uids.map(function (uid) {
				return cache.get(uid + ':' + groupName);
			});
			return process.nextTick(callback, null, result);
		}

		db.isSortedSetMembers('group:' + groupName + ':members', nonCachedUids, function (err, isMembers) {
			if (err) {
				return callback(err);
			}

			nonCachedUids.forEach(function (uid, index) {
				cache.set(uid + ':' + groupName, isMembers[index]);
			});

			var result = uids.map(function (uid) {
				return cache.get(uid + ':' + groupName);
			});

			callback(null, result);
		});
	};

	Groups.isMemberOfGroups = function (uid, groups, callback) {
		if (!uid || parseInt(uid, 10) <= 0 || !groups.length) {
			return callback(null, groups.map(function () {return false;}));
		}

		var nonCachedGroups = [];

		groups.forEach(function (groupName) {
			if (!cache.has(uid + ':' + groupName)) {
				nonCachedGroups.push(groupName);
			}
		});

		// are they all cached?
		if (!nonCachedGroups.length) {
			var result = groups.map(function (groupName) {
				return cache.get(uid + ':' + groupName);
			});
			return process.nextTick(callback, null, result);
		}

		var nonCachedGroupsMemberSets = nonCachedGroups.map(function (groupName) {
			return 'group:' + groupName + ':members';
		});

		db.isMemberOfSortedSets(nonCachedGroupsMemberSets, uid, function (err, isMembers) {
			if (err) {
				return callback(err);
			}

			nonCachedGroups.forEach(function (groupName, index) {
				cache.set(uid + ':' + groupName, isMembers[index]);
			});

			var result = groups.map(function (groupName) {
				return cache.get(uid + ':' + groupName);
			});
			callback(null, result);
		});
	};

	Groups.getMemberCount = function (groupName, callback) {
		db.getObjectField('group:' + groupName, 'memberCount', function (err, count) {
			if (err) {
				return callback(err);
			}
			callback(null, parseInt(count, 10));
		});
	};

	Groups.isMemberOfGroupList = function (uid, groupListKey, callback) {
		db.getSortedSetRange('group:' + groupListKey + ':members', 0, -1, function (err, groupNames) {
			if (err) {
				return callback(err);
			}
			groupNames = Groups.internals.removeEphemeralGroups(groupNames);
			if (groupNames.length === 0) {
				return callback(null, false);
			}

			Groups.isMemberOfGroups(uid, groupNames, function (err, isMembers) {
				if (err) {
					return callback(err);
				}

				callback(null, isMembers.indexOf(true) !== -1);
			});
		});
	};

	Groups.isMemberOfGroupsList = function (uid, groupListKeys, callback) {
		var sets = groupListKeys.map(function (groupName) {
			return 'group:' + groupName + ':members';
		});

		db.getSortedSetsMembers(sets, function (err, members) {
			if (err) {
				return callback(err);
			}

			var uniqueGroups = _.unique(_.flatten(members));
			uniqueGroups = Groups.internals.removeEphemeralGroups(uniqueGroups);

			Groups.isMemberOfGroups(uid, uniqueGroups, function (err, isMembers) {
				if (err) {
					return callback(err);
				}

				var map = {};

				uniqueGroups.forEach(function (groupName, index) {
					map[groupName] = isMembers[index];
				});

				var result = members.map(function (groupNames) {
					for (var i = 0; i < groupNames.length; ++i) {
						if (map[groupNames[i]]) {
							return true;
						}
					}
					return false;
				});

				callback(null, result);
			});
		});
	};

	Groups.isMembersOfGroupList = function (uids, groupListKey, callback) {
		db.getSortedSetRange('group:' + groupListKey + ':members', 0, -1, function (err, groupNames) {
			if (err) {
				return callback(err);
			}

			var results = [];
			uids.forEach(function () {
				results.push(false);
			});

			groupNames = Groups.internals.removeEphemeralGroups(groupNames);
			if (groupNames.length === 0) {
				return callback(null, results);
			}

			async.each(groupNames, function (groupName, next) {
				Groups.isMembers(uids, groupName, function (err, isMembers) {
					if (err) {
						return next(err);
					}
					results.forEach(function (isMember, index) {
						if (!isMember && isMembers[index]) {
							results[index] = true;
						}
					});
					next();
				});
			}, function (err) {
				callback(err, results);
			});
		});
	};

	Groups.isInvited = function (uid, groupName, callback) {
		if (!uid) {
			return callback(null, false);
		}
		db.isSetMember('group:' + groupName + ':invited', uid, callback);
	};

	Groups.isPending = function (uid, groupName, callback) {
		if (!uid) {
			return callback(null, false);
		}
		db.isSetMember('group:' + groupName + ':pending', uid, callback);
	};

	Groups.getPending = function (groupName, callback) {
		if (!groupName) {
			return callback(null, []);
		}
		db.getSetMembers('group:' + groupName + ':pending', callback);
	};

	Groups.kick = function (uid, groupName, isOwner, callback) {
		if (isOwner) {
			// If the owners set only contains one member, error out!
			async.waterfall([
				function (next) {
					db.setCount('group:' + groupName + ':owners', next);
				},
				function (numOwners, next) {
					if (numOwners <= 1) {
						return next(new Error('[[error:group-needs-owner]]'));
					}
					Groups.leave(groupName, uid, next);
				}
			], callback);
		} else {
			Groups.leave(groupName, uid, callback);
		}
	};
};

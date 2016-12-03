
'use strict';

var async = require('async');
var _ = require('underscore');

var categories = require('../categories');
var user = require('../user');
var groups = require('../groups');
var helpers = require('./helpers');
var plugins = require('../plugins');

module.exports = function (privileges) {

	privileges.categories = {};

	privileges.categories.list = function (cid, callback) {
		// Method used in admin/category controller to show all users/groups with privs in that given cid

		var privilegeLabels = [
			{name: 'Find Category'},
			{name: 'Access Category'},
			{name: 'Access Topics'},
			{name: 'Create Topics'},
			{name: 'Reply to Topics'},
			{name: 'Edit Posts'},
			{name: 'Delete Posts'},
			{name: 'Delete Topics'},
			{name: 'Upload Images'},
			{name: 'Upload Files'},
			{name: 'Purge'},
			{name: 'Moderate'}
		];

		async.parallel({
			labels: function (next) {
				async.parallel({
					users: async.apply(plugins.fireHook, 'filter:privileges.list_human', privilegeLabels),
					groups: async.apply(plugins.fireHook, 'filter:privileges.groups.list_human', privilegeLabels)
				}, next);
			},
			users: function (next) {
				var userPrivileges;
				async.waterfall([
					async.apply(plugins.fireHook, 'filter:privileges.list', privileges.userPrivilegeList),
					function (_privs, next) {
						userPrivileges = _privs;
						groups.getMembersOfGroups(userPrivileges.map(function (privilege) {
							return 'cid:' + cid + ':privileges:' + privilege;
						}), next);
					},
					function (memberSets, next) {

						memberSets = memberSets.map(function (set) {
							return set.map(function (uid) {
								return parseInt(uid, 10);
							});
						});

						var members = _.unique(_.flatten(memberSets));

						user.getUsersFields(members, ['picture', 'username'], function (err, memberData) {
							if (err) {
								return next(err);
							}

							memberData.forEach(function (member) {
								member.privileges = {};
								for(var x = 0,numPrivs = userPrivileges.length; x < numPrivs; x++) {
									member.privileges[userPrivileges[x]] = memberSets[x].indexOf(parseInt(member.uid, 10)) !== -1;
								}
							});

							next(null, memberData);
						});
					}
				], next);
			},
			groups: function (next) {
				var groupPrivileges;
				async.waterfall([
					async.apply(plugins.fireHook, 'filter:privileges.groups.list', privileges.groupPrivilegeList),
					function (_privs, next) {
						groupPrivileges = _privs;
						groups.getMembersOfGroups(groupPrivileges.map(function (privilege) {
							return 'cid:' + cid + ':privileges:' + privilege;
						}), next);
					},
					function (memberSets, next) {

						var uniqueGroups = _.unique(_.flatten(memberSets));

						groups.getGroups('groups:createtime', 0, -1, function (err, groupNames) {
							if (err) {
								return next(err);
							}

							groupNames = groupNames.filter(function (groupName) {
								return groupName.indexOf(':privileges:') === -1 && uniqueGroups.indexOf(groupName) !== -1;
							});

							groupNames = groups.getEphemeralGroups().concat(groupNames);
							var registeredUsersIndex = groupNames.indexOf('registered-users');
							if (registeredUsersIndex !== -1) {
								groupNames.splice(0, 0, groupNames.splice(registeredUsersIndex, 1)[0]);
							} else {
								groupNames = ['registered-users'].concat(groupNames);
							}

							var adminIndex = groupNames.indexOf('administrators');
							if (adminIndex !== -1) {
								groupNames.splice(adminIndex, 1);
							}

							var memberPrivs;

							var memberData = groupNames.map(function (member) {
								memberPrivs = {};

								for(var x = 0,numPrivs = groupPrivileges.length; x < numPrivs; x++) {
									memberPrivs[groupPrivileges[x]] = memberSets[x].indexOf(member) !== -1;
								}
								return {
									name: member,
									privileges: memberPrivs,
								};
							});

							next(null, memberData);
						});
					},
					function (memberData, next) {
						// Grab privacy info for the groups as well
						async.map(memberData, function (member, next) {
							groups.isPrivate(member.name, function (err, isPrivate) {
								if (err) {
									return next(err);
								}

								member.isPrivate = isPrivate;
								next(null, member);
							});
						}, next);
					}
				], next);
			}
		}, function (err, payload) {
			if (err) {
				return callback(err);
			}

			// This is a hack because I can't do {labels.users.length} to echo the count in templates.js
			payload.columnCount = payload.labels.users.length + 2;

			callback(null, payload);
		});
	};

	privileges.categories.get = function (cid, uid, callback) {
		var privs = ['topics:create', 'topics:read', 'read'];
		async.parallel({
			privileges: function (next) {
				helpers.isUserAllowedTo(privs, uid, cid, next);
			},
			isAdministrator: function (next) {
				user.isAdministrator(uid, next);
			},
			isModerator: function (next) {
				user.isModerator(uid, cid, next);
			}
		}, function (err, results) {
			if (err) {
				return callback(err);
			}
			var privData = _.object(privs, results.privileges);
			var isAdminOrMod = results.isAdministrator || results.isModerator;

			plugins.fireHook('filter:privileges.categories.get', {
				'topics:create': privData['topics:create'] || isAdminOrMod,
				'topics:read': privData['topics:read'] || isAdminOrMod,
				read: privData.read || isAdminOrMod,
				cid: cid,
				uid: uid,
				editable: isAdminOrMod,
				view_deleted: isAdminOrMod,
				isAdminOrMod: isAdminOrMod
			}, callback);
		});
	};

	privileges.categories.isAdminOrMod = function (cid, uid, callback) {
		if (!parseInt(uid, 10)) {
			return callback(null, false);
		}
		helpers.some([
			function (next) {
				user.isModerator(uid, cid, next);
			},
			function (next) {
				user.isAdministrator(uid, next);
			}
		], callback);
	};

	privileges.categories.isUserAllowedTo = function (privilege, cid, uid, callback) {
		if (!cid) {
			return callback(null, false);
		}
		helpers.isUserAllowedTo(privilege, uid, [cid], function (err, results) {
			callback(err, Array.isArray(results) && results.length ? results[0] : false);
		});
	};

	privileges.categories.can = function (privilege, cid, uid, callback) {
		if (!cid) {
			return callback(null, false);
		}

		categories.getCategoryField(cid, 'disabled', function (err, disabled) {
			if (err) {
				return callback(err);
			}

			if (parseInt(disabled, 10) === 1) {
				return callback(null, false);
			}

			helpers.some([
				function (next) {
					helpers.isUserAllowedTo(privilege, uid, [cid], function (err, results) {
						next(err, Array.isArray(results) && results.length ? results[0] : false);
					});
				},
				function (next) {
					user.isModerator(uid, cid, next);
				},
				function (next) {
					user.isAdministrator(uid, next);
				}
			], callback);
		});
	};

	privileges.categories.filterCids = function (privilege, cids, uid, callback) {
		if (!Array.isArray(cids) || !cids.length) {
			return callback(null, []);
		}

		cids = cids.filter(function (cid, index, array) {
			return array.indexOf(cid) === index;
		});

		privileges.categories.getBase(privilege, cids, uid, function (err, results) {
			if (err) {
				return callback(err);
			}

			cids = cids.filter(function (cid, index) {
				return !results.categories[index].disabled &&
					(results.allowedTo[index] || results.isAdmin || results.isModerators[index]);
			});

			callback(null, cids.filter(Boolean));
		});
	};

	privileges.categories.getBase = function (privilege, cids, uid, callback) {
		async.parallel({
			categories: function (next) {
				categories.getCategoriesFields(cids, ['disabled'], next);
			},
			allowedTo: function (next) {
				helpers.isUserAllowedTo(privilege, uid, cids, next);
			},
			isModerators: function (next) {
				user.isModerator(uid, cids, next);
			},
			isAdmin: function (next) {
				user.isAdministrator(uid, next);
			}
		}, callback);
	};

	privileges.categories.filterUids = function (privilege, cid, uids, callback) {
		if (!uids.length) {
			return callback(null, []);
		}

		uids = uids.filter(function (uid, index, array) {
			return array.indexOf(uid) === index;
		});

		async.parallel({
			allowedTo: function (next) {
				helpers.isUsersAllowedTo(privilege, uids, cid, next);
			},
			isModerators: function (next) {
				user.isModerator(uids, cid, next);
			},
			isAdmin: function (next) {
				user.isAdministrator(uids, next);
			}
		}, function (err, results) {
			if (err) {
				return callback(err);
			}

			uids = uids.filter(function (uid, index) {
				return results.allowedTo[index] || results.isModerators[index] || results.isAdmin[index];
			});
			callback(null, uids);
		});
	};

	privileges.categories.give = function (privileges, cid, groupName, callback) {
		giveOrRescind(groups.join, privileges, cid, groupName, callback);
	};

	privileges.categories.rescind = function (privileges, cid, groupName, callback) {
		giveOrRescind(groups.leave, privileges, cid, groupName, callback);
	};

	function giveOrRescind(method, privileges, cid, groupName, callback) {
		async.each(privileges, function (privilege, next) {
			method('cid:' + cid + ':privileges:groups:' + privilege, groupName, next);
		}, callback);
	}

	privileges.categories.canMoveAllTopics = function (currentCid, targetCid, uid, callback) {
		async.parallel({
			isAdministrator: function (next) {
				user.isAdministrator(uid, next);
			},
			moderatorOfCurrent: function (next) {
				user.isModerator(uid, currentCid, next);
			},
			moderatorOfTarget: function (next) {
				user.isModerator(uid, targetCid, next);
			}
		}, function (err, results) {
			if (err) {
				return callback(err);
			}

			callback(null, results.isAdministrator || (results.moderatorOfCurrent && results.moderatorOfTarget));
		});
	};

	privileges.categories.userPrivileges = function (cid, uid, callback) {
		async.parallel({
			find: async.apply(groups.isMember, uid, 'cid:' + cid + ':privileges:find'),
			read: function (next) {
				groups.isMember(uid, 'cid:' + cid + ':privileges:read', next);
			},
			'topics:create': function (next) {
				groups.isMember(uid, 'cid:' + cid + ':privileges:topics:create', next);
			},
			'topics:read': function (next) {
				groups.isMember(uid, 'cid:' + cid + ':privileges:topics:read', next);
			},
			'topics:reply': function (next) {
				groups.isMember(uid, 'cid:' + cid + ':privileges:topics:reply', next);
			},
			'posts:edit': function (next) {
				groups.isMember(uid, 'cid:' + cid + ':privileges:posts:edit', next);
			},
			'posts:delete': function (next) {
				groups.isMember(uid, 'cid:' + cid + ':privileges:posts:delete', next);
			},
			'topics:delete': function (next) {
				groups.isMember(uid, 'cid:' + cid + ':privileges:topics:delete', next);
			},
			mods: function (next) {
				user.isModerator(uid, cid, next);
			}
		}, callback);
	};

	privileges.categories.groupPrivileges = function (cid, groupName, callback) {
		async.parallel({
			'groups:find': async.apply(groups.isMember, groupName, 'cid:' + cid + ':privileges:groups:find'),
			'groups:read': function (next) {
				groups.isMember(groupName, 'cid:' + cid + ':privileges:groups:read', next);
			},
			'groups:topics:create': function (next) {
				groups.isMember(groupName, 'cid:' + cid + ':privileges:groups:topics:create', next);
			},
			'groups:topics:reply': function (next) {
				groups.isMember(groupName, 'cid:' + cid + ':privileges:groups:topics:reply', next);
			},
			'groups:posts:edit': function (next) {
				groups.isMember(groupName, 'cid:' + cid + ':privileges:groups:posts:edit', next);
			},
			'groups:posts:delete': function (next) {
				groups.isMember(groupName, 'cid:' + cid + ':privileges:groups:posts:delete', next);
			},
			'groups:topics:delete': function (next) {
				groups.isMember(groupName, 'cid:' + cid + ':privileges:groups:topics:delete', next);
			},
			'groups:topics:read': function (next) {
				groups.isMember(groupName, 'cid:' + cid + ':privileges:groups:topics:read', next);
			}
		}, callback);
	};

};
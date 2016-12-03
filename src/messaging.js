'use strict';


var async = require('async');
var winston = require('winston');
var S = require('string');

var db = require('./database');
var user = require('./user');
var plugins = require('./plugins');
var meta = require('./meta');
var utils = require('../public/src/utils');
var notifications = require('./notifications');
var userNotifications = require('./user/notifications');

(function (Messaging) {

	require('./messaging/create')(Messaging);
	require('./messaging/delete')(Messaging);
	require('./messaging/edit')(Messaging);
	require('./messaging/rooms')(Messaging);
	require('./messaging/unread')(Messaging);
	require('./messaging/notifications')(Messaging);

	Messaging.getMessageField = function (mid, field, callback) {
		Messaging.getMessageFields(mid, [field], function (err, fields) {
			callback(err, fields ? fields[field] : null);
		});
	};

	Messaging.getMessageFields = function (mid, fields, callback) {
		db.getObjectFields('message:' + mid, fields, callback);
	};

	Messaging.setMessageField = function (mid, field, content, callback) {
		db.setObjectField('message:' + mid, field, content, callback);
	};

	Messaging.setMessageFields = function (mid, data, callback) {
		db.setObject('message:' + mid, data, callback);
	};

	Messaging.getMessages = function (params, callback) {
		var uid = params.uid;
		var roomId = params.roomId;
		var isNew = params.isNew || false;
		var start = params.hasOwnProperty('start') ? params.start : 0;
		var stop = parseInt(start, 10) + ((params.count || 50) - 1);

		var indices = {};
		async.waterfall([
			function (next) {
				canGetMessages(params.callerUid, params.uid, next);
			},
			function (canGet, next) {
				if (!canGet) {
					return callback(null, null);
				}
				db.getSortedSetRevRange('uid:' + uid + ':chat:room:' + roomId + ':mids', start, stop, next);
			},
			function (mids, next) {
				if (!Array.isArray(mids) || !mids.length) {
					return callback(null, []);
				}

				mids.forEach(function (mid, index) {
					indices[mid] = start + index;
				});

				mids.reverse();

				Messaging.getMessagesData(mids, uid, roomId, isNew, next);
			},
			function (messageData, next) {
				messageData.forEach(function (messageData) {
					messageData.index = indices[messageData.messageId.toString()];
				});
				next(null, messageData);
			}
		], callback);
	};

	function canGetMessages(callerUid, uid, callback) {
		plugins.fireHook('filter:messaging.canGetMessages', {
			callerUid: callerUid,
			uid: uid,
			canGet: parseInt(callerUid, 10) === parseInt(uid, 10)
		}, function (err, data) {
			callback(err, data ? data.canGet : false);
		});
	}

	Messaging.getMessagesData = function (mids, uid, roomId, isNew, callback) {

		var keys = mids.map(function (mid) {
			return 'message:' + mid;
		});

		var messages;

		async.waterfall([
			function (next) {
				db.getObjects(keys, next);
			},
			function (_messages, next) {
				messages = _messages.map(function (msg, idx) {
					if (msg) {
						msg.messageId = parseInt(mids[idx], 10);
					}
					return msg;
				}).filter(Boolean);

				var uids = messages.map(function (msg) {
					return msg && msg.fromuid;
				});

				user.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture', 'status'], next);
			},
			function (users, next) {
				messages.forEach(function (message, index) {
					message.fromUser = users[index];
					var self = parseInt(message.fromuid, 10) === parseInt(uid, 10);
					message.self = self ? 1 : 0;
					message.timestampISO = utils.toISOString(message.timestamp);
					message.newSet = false;
					message.roomId = String(message.roomId || roomId);
					if (message.hasOwnProperty('edited')) {
						message.editedISO = new Date(parseInt(message.edited, 10)).toISOString();
					}
				});

				async.map(messages, function (message, next) {
					Messaging.parse(message.content, message.fromuid, uid, roomId, isNew, function (err, result) {
						if (err) {
							return next(err);
						}
						message.content = result;
						message.cleanedContent = S(result).stripTags().decodeHTMLEntities().s;
						next(null, message);
					});
				}, next);
			},
			function (messages, next) {
				if (messages.length > 1) {
					// Add a spacer in between messages with time gaps between them
					messages = messages.map(function (message, index) {
						// Compare timestamps with the previous message, and check if a spacer needs to be added
						if (index > 0 && parseInt(message.timestamp, 10) > parseInt(messages[index - 1].timestamp, 10) + (1000 * 60 * 5)) {
							// If it's been 5 minutes, this is a new set of messages
							message.newSet = true;
						} else if (index > 0 && message.fromuid !== messages[index - 1].fromuid) {
							// If the previous message was from the other person, this is also a new set
							message.newSet = true;
						}

						return message;
					});

					next(undefined, messages);
				} else if (messages.length === 1) {
					// For single messages, we don't know the context, so look up the previous message and compare
					var key = 'uid:' + uid + ':chat:room:' + roomId + ':mids';
					async.waterfall([
						async.apply(db.sortedSetRank, key, messages[0].messageId),
						function (index, next) {
							// Continue only if this isn't the first message in sorted set
							if (index > 0) {
								db.getSortedSetRange(key, index - 1, index - 1, next);
							} else {
								messages[0].newSet = true;
								return next(undefined, messages);
							}
						},
						function (mid, next) {
							Messaging.getMessageFields(mid, ['fromuid', 'timestamp'], next);
						}
					], function (err, fields) {
						if (err) {
							return next(err);
						}

						if (
							(parseInt(messages[0].timestamp, 10) > parseInt(fields.timestamp, 10) + (1000 * 60 * 5)) ||
							(parseInt(messages[0].fromuid, 10) !== parseInt(fields.fromuid, 10))
						) {
							// If it's been 5 minutes, this is a new set of messages
							messages[0].newSet = true;
						}

						next(undefined, messages);
					});
				} else {
					next(null, []);
				}
			}
		], callback);

	};

	Messaging.parse = function (message, fromuid, uid, roomId, isNew, callback) {
		plugins.fireHook('filter:parse.raw', message, function (err, parsed) {
			if (err) {
				return callback(err);
			}

			var messageData = {
				message: message,
				parsed: parsed,
				fromuid: fromuid,
				uid: uid,
				roomId: roomId,
				isNew: isNew,
				parsedMessage: parsed
			};

			plugins.fireHook('filter:messaging.parse', messageData, function (err, messageData) {
				callback(err, messageData ? messageData.parsedMessage : '');
			});
		});
	};

	Messaging.isNewSet = function (uid, roomId, timestamp, callback) {
		var setKey = 'uid:' + uid + ':chat:room:' + roomId + ':mids';

		async.waterfall([
			function (next) {
				db.getSortedSetRevRangeWithScores(setKey, 0, 0, next);
			},
			function (messages, next) {
				if (messages && messages.length) {
					next(null, parseInt(timestamp, 10) > parseInt(messages[0].score, 10) + (1000 * 60 * 5));
				} else {
					next(null, true);
				}
			}
		], callback);
	};


	Messaging.getRecentChats = function (callerUid, uid, start, stop, callback) {
		async.waterfall([
			function (next) {
				canGetRecentChats(callerUid, uid, next);
			},
			function (canGet, next) {
				if (!canGet) {
					return callback(null, null);
				}
				db.getSortedSetRevRange('uid:' + uid + ':chat:rooms', start, stop, next);
			},
			function (roomIds, next) {
				async.parallel({
					roomData: function (next) {
						Messaging.getRoomsData(roomIds, next);
					},
					unread: function (next) {
						db.isSortedSetMembers('uid:' + uid + ':chat:rooms:unread', roomIds, next);
					},
					users: function (next) {
						async.map(roomIds, function (roomId, next) {
							db.getSortedSetRevRange('chat:room:' + roomId + ':uids', 0, 9, function (err, uids) {
								if (err) {
									return next(err);
								}
								uids = uids.filter(function (value) {
									return value && parseInt(value, 10) !== parseInt(uid, 10);
								});
								user.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture', 'status', 'lastonline'] , next);
							});
						}, next);
					},
					teasers: function (next) {
						async.map(roomIds, function (roomId, next) {
							Messaging.getTeaser(uid, roomId, next);
						}, next);
					}
				}, next);
			},
			function (results, next) {
				results.roomData.forEach(function (room, index) {
					room.users = results.users[index];
					room.groupChat = room.hasOwnProperty('groupChat') ? room.groupChat : room.users.length > 2;
					room.unread = results.unread[index];
					room.teaser = results.teasers[index];

					room.users.forEach(function (userData) {
						if (userData && parseInt(userData.uid, 10)) {
							userData.status = user.getStatus(userData);
						}
					});
					room.users = room.users.filter(function (user) {
						return user && parseInt(user.uid, 10);
					});
					room.lastUser = room.users[0];

					room.usernames = Messaging.generateUsernames(room.users, uid);
				});

				next(null, {rooms: results.roomData, nextStart: stop + 1});
			}
		], callback);
	};

	Messaging.generateUsernames = function (users, excludeUid) {
		users = users.filter(function (user) {
			return user && parseInt(user.uid, 10) !== excludeUid;
		});
		return users.map(function (user) {
			return user.username;
		}).join(', ');
	};

	function canGetRecentChats(callerUid, uid, callback) {
		plugins.fireHook('filter:messaging.canGetRecentChats', {
			callerUid: callerUid,
			uid: uid,
			canGet: parseInt(callerUid, 10) === parseInt(uid, 10)
		}, function (err, data) {
			callback(err, data ? data.canGet : false);
		});
	}

	Messaging.getTeaser = function (uid, roomId, callback) {
		var teaser;
		async.waterfall([
			function (next) {
				db.getSortedSetRevRange('uid:' + uid + ':chat:room:' + roomId + ':mids', 0, 0, next);
			},
			function (mids, next) {
				if (!mids || !mids.length) {
					return next(null, null);
				}
				Messaging.getMessageFields(mids[0], ['fromuid', 'content', 'timestamp'], next);
			},
			function (_teaser, next) {
				teaser = _teaser;
				if (!teaser) {
					return callback();
				}
				if (teaser.content) {
					teaser.content = S(teaser.content).stripTags().decodeHTMLEntities().s;
				}

				teaser.timestampISO = utils.toISOString(teaser.timestamp);
				user.getUserFields(teaser.fromuid, ['uid', 'username', 'userslug', 'picture', 'status', 'lastonline'] , next);
			},
			function (user, next) {
				teaser.user = user;
				next(null, teaser);
			}
		], callback);
	};

	Messaging.canMessageUser = function (uid, toUid, callback) {
		if (parseInt(meta.config.disableChat) === 1 || !uid || uid === toUid) {
			return callback(new Error('[[error:chat-disabled]]'));
		}

		if (parseInt(uid, 10) === parseInt(toUid, 10)) {
			return callback(new Error('[[error:cant-chat-with-yourself'));
		}

		async.waterfall([
			function (next) {
				user.exists(toUid, next);
			},
			function (exists, next) {
				if (!exists) {
					return callback(new Error('[[error:no-user]]'));
				}
				user.getUserFields(uid, ['banned', 'email:confirmed'], next);
			},
			function (userData, next) {
				if (parseInt(userData.banned, 10) === 1) {
					return callback(new Error('[[error:user-banned]]'));
				}

				if (parseInt(meta.config.requireEmailConfirmation, 10) === 1 && parseInt(userData['email:confirmed'], 10) !== 1) {
					return callback(new Error('[[error:email-not-confirmed-chat]]'));
				}

				async.parallel({
					settings: async.apply(user.getSettings, toUid),
					isAdmin: async.apply(user.isAdministrator, uid),
					isFollowing: async.apply(user.isFollowing, toUid, uid)
				}, next);
			},
			function (results, next) {
				if (!results.settings.restrictChat || results.isAdmin || results.isFollowing) {
					return next();
				}

 				next(new Error('[[error:chat-restricted]]'));
			}
		], callback);
	};

	Messaging.canMessageRoom = function (uid, roomId, callback) {
		if (parseInt(meta.config.disableChat) === 1 || !uid) {
			return callback(new Error('[[error:chat-disabled]]'));
		}

		async.waterfall([
			function (next) {
				Messaging.isUserInRoom(uid, roomId, next);
			},
			function (inRoom, next) {
				if (!inRoom) {
					return next(new Error('[[error:not-in-room]]'));
				}

				Messaging.getUserCountInRoom(roomId, next);
			},
			function (count, next) {
				if (count < 2) {
					return next(new Error('[[error:no-users-in-room]]'));
				}

				user.getUserFields(uid, ['banned', 'email:confirmed'], next);
			},
			function (userData, next) {
				if (parseInt(userData.banned, 10) === 1) {
					return next(new Error('[[error:user-banned]]'));
				}

				if (parseInt(meta.config.requireEmailConfirmation, 10) === 1 && parseInt(userData['email:confirmed'], 10) !== 1) {
					return next(new Error('[[error:email-not-confirmed-chat]]'));
				}

				next();
			}
		], callback);
	};

	Messaging.hasPrivateChat = function (uid, withUid, callback) {
		if (parseInt(uid, 10) === parseInt(withUid, 10)) {
			return callback(null, 0);
		}
		async.waterfall([
			function (next) {
				async.parallel({
					myRooms: async.apply(db.getSortedSetRevRange, 'uid:' + uid + ':chat:rooms', 0, -1),
					theirRooms: async.apply(db.getSortedSetRevRange, 'uid:' + withUid + ':chat:rooms', 0, -1)
				}, next);
			},
			function (results, next) {
				var roomIds = results.myRooms.filter(function (roomId) {
					return roomId && results.theirRooms.indexOf(roomId) !== -1;
				});

				if (!roomIds.length) {
					return callback();
				}

				var index = 0;
				var roomId = 0;
				async.whilst(function () {
					return index < roomIds.length && !roomId;
				}, function (next) {
					Messaging.getUserCountInRoom(roomIds[index], function (err, count) {
						if (err) {
							return next(err);
						}
						if (count === 2) {
							roomId = roomIds[index];
							next(null, roomId);
						} else {
							++ index;
							next();
						}
					});
				}, function (err) {
					next(err, roomId);
				});
			}
		], callback);
	};


}(exports));

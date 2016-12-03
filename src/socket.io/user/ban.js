'use strict';

var async = require('async');
var user = require('../../user');
var websockets = require('../index');
var events = require('../../events');

module.exports = function (SocketUser) {

	SocketUser.banUsers = function (socket, data, callback) {
		// Backwards compatibility
		if (Array.isArray(data)) {
			data = {
				uids: data,
				until: 0,
				reason: ''
			};
		}

		toggleBan(socket.uid, data.uids, function (uid, next) {
			banUser(uid, data.until || 0, data.reason || '', next);
		}, function (err) {
			if (err) {
				return callback(err);
			}
			async.each(data.uids, function (uid, next) {
				events.log({
					type: 'user-ban',
					uid: socket.uid,
					targetUid: uid,
					ip: socket.ip
				}, next);
			}, callback);
		});
	};

	SocketUser.unbanUsers = function (socket, uids, callback) {
		toggleBan(socket.uid, uids, user.unban, function (err) {
			if (err) {
				return callback(err);
			}

			async.each(uids, function (uid, next) {
				events.log({
					type: 'user-unban',
					uid: socket.uid,
					targetUid: uid,
					ip: socket.ip
				}, next);
			}, callback);
		});
	};

	function toggleBan(uid, uids, method, callback) {
		if (!Array.isArray(uids)) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		async.waterfall([
			function (next) {
				user.isAdminOrGlobalMod(uid, next);
			},
			function (isAdminOrGlobalMod, next) {
				if (!isAdminOrGlobalMod) {
					return next(new Error('[[error:no-privileges]]'));
				}
				async.each(uids, method, next);
			}
		], callback);
	}

	function banUser(uid, until, reason, callback) {
		async.waterfall([
			function (next) {
				user.isAdministrator(uid, next);
			},
			function (isAdmin, next) {
				if (isAdmin) {
					return next(new Error('[[error:cant-ban-other-admins]]'));
				}
				user.ban(uid, until, reason, next);
			},
			function (next) {
				websockets.in('uid_' + uid).emit('event:banned');
				next();
			}
		], callback);
	}
};


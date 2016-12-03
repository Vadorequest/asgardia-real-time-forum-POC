'use strict';

var async = require('async');
var validator = require('validator');

var posts = require('../../posts');
var topics = require('../../topics');
var events = require('../../events');
var websockets = require('../index');
var socketTopics = require('../topics');
var privileges = require('../../privileges');
var plugins = require('../../plugins');
var social = require('../../social');

module.exports = function (SocketPosts) {

	SocketPosts.loadPostTools = function (socket, data, callback) {
		if (!data) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		async.parallel({
			posts: function (next) {
				posts.getPostFields(data.pid, ['deleted', 'bookmarks', 'uid'], next);
			},
			isAdminOrMod: function (next) {
				privileges.categories.isAdminOrMod(data.cid, socket.uid, next);
			},
			canEdit: function (next) {
				privileges.posts.canEdit(data.pid, socket.uid, next);
			},
			canDelete: function (next) {
				privileges.posts.canDelete(data.pid, socket.uid, next);
			},
			bookmarked: function (next) {
				posts.hasBookmarked(data.pid, socket.uid, next);
			},
			tools: function (next) {
				plugins.fireHook('filter:post.tools', {pid: data.pid, uid: socket.uid, tools: []}, next);
			},
			postSharing: function (next) {
				social.getActivePostSharing(next);
			}
		}, function (err, results) {
			if (err) {
				return callback(err);
			}

			results.posts.tools = results.tools.tools;
			results.posts.deleted = parseInt(results.posts.deleted, 10) === 1;
			results.posts.bookmarked = results.bookmarked;
			results.posts.selfPost = socket.uid && socket.uid === parseInt(results.posts.uid, 10);
			results.posts.display_edit_tools = results.canEdit.flag;
			results.posts.display_delete_tools = results.canDelete.flag;
			results.posts.display_moderator_tools = results.posts.display_edit_tools || results.posts.display_delete_tools;
			results.posts.display_move_tools = results.isAdminOrMod;
			callback(null, results);
		});
	};

	SocketPosts.delete = function (socket, data, callback) {
		if (!data || !data.pid) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		var postData;
		async.waterfall([
			function (next) {
				posts.tools.delete(socket.uid, data.pid, next);
			},
			function (_postData, next) {
				postData = _postData;
				isMainAndLastPost(data.pid, next);
			},
			function (results, next) {
				if (results.isMain && results.isLast) {
					deleteTopicOf(data.pid, socket, next);
				} else {
					next();
				}
			},
			function (next) {
				websockets.in('topic_' + data.tid).emit('event:post_deleted', postData);

				events.log({
					type: 'post-delete',
					uid: socket.uid,
					pid: data.pid,
					ip: socket.ip
				});

				next();
			}
		], callback);
	};

	SocketPosts.restore = function (socket, data, callback) {
		if (!data || !data.pid) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		posts.tools.restore(socket.uid, data.pid, function (err, postData) {
			if (err) {
				return callback(err);
			}

			websockets.in('topic_' + data.tid).emit('event:post_restored', postData);

			events.log({
				type: 'post-restore',
				uid: socket.uid,
				pid: data.pid,
				ip: socket.ip
			});

			callback();
		});
	};

	SocketPosts.deletePosts = function (socket, data, callback) {
		if (!data || !Array.isArray(data.pids)) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		async.each(data.pids, function (pid, next) {
			SocketPosts.delete(socket, {pid: pid, tid: data.tid}, next);
		}, callback);
	};

	SocketPosts.purgePosts = function (socket, data, callback) {
		if (!data || !Array.isArray(data.pids)) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		async.each(data.pids, function (pid, next) {
			SocketPosts.purge(socket, {pid: pid, tid: data.tid}, next);
		}, callback);
	};

	SocketPosts.purge = function (socket, data, callback) {
		function purgePost() {
			var postData;
			async.waterfall([
				function (next) {
					posts.getPostField(data.pid, 'toPid', next);
				},
				function (toPid, next) {
					postData = {pid: data.pid, toPid: toPid};
					posts.tools.purge(socket.uid, data.pid, next);
				},
				function (next) {
					websockets.in('topic_' + data.tid).emit('event:post_purged', postData);
					topics.getTopicField(data.tid, 'title', next);
				},
				function (title, next) {
					events.log({
						type: 'post-purge',
						uid: socket.uid,
						pid: data.pid,
						ip: socket.ip,
						title: validator.escape(String(title))
					}, next);
				}
			], callback);
		}

		if (!data || !parseInt(data.pid, 10)) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		isMainAndLastPost(data.pid, function (err, results) {
			if (err) {
				return callback(err);
			}

			if (!results.isMain) {
				return purgePost();
			}

			if (!results.isLast) {
				return callback(new Error('[[error:cant-purge-main-post]]'));
			}

			deleteTopicOf(data.pid, socket, callback);
		});
	};

	function deleteTopicOf(pid, socket, callback) {
		posts.getTopicFields(pid, ['tid', 'cid'], function (err, topic) {
			if (err) {
				return callback(err);
			}
			socketTopics.doTopicAction('delete', 'event:topic_deleted', socket, {tids: [topic.tid], cid: topic.cid}, callback);
		});
	}

	function isMainAndLastPost(pid, callback) {
		async.parallel({
			isMain: function (next) {
				posts.isMain(pid, next);
			},
			isLast: function (next) {
				posts.getTopicFields(pid, ['postcount'], function (err, topic) {
					next(err, topic ? parseInt(topic.postcount, 10) === 1 : false);
				});
			}
		}, callback);
	}

};

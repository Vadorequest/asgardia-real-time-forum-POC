
'use strict';

var async = require('async');
var _ = require('underscore');

var db = require('../database');
var topics = require('../topics');

module.exports = function (Posts) {

	Posts.getCidByPid = function (pid, callback) {
		async.waterfall([
			function (next) {
				Posts.getPostField(pid, 'tid', next);
			},
			function (tid, next) {
				topics.getTopicField(tid, 'cid', next);
			}
		], callback);
	};

	Posts.getCidsByPids = function (pids, callback) {
		var tids;
		var postData;
		async.waterfall([
			function (next) {
				Posts.getPostsFields(pids, ['tid'], next);
			},
			function (_postData, next) {
				postData = _postData;
				tids = postData.map(function (post) {
					return post.tid;
				}).filter(function (tid, index, array) {
					return tid && array.indexOf(tid) === index;
				});

				topics.getTopicsFields(tids, ['cid'], next);
			},
			function (topicData, next) {
				var map = {};
				topicData.forEach(function (topic, index) {
					if (topic) {
						map[tids[index]] = topic.cid;
					}
				});

				var cids = postData.map(function (post) {
					return map[post.tid];
				});
				next(null, cids);
			}
		], callback);
	};

	Posts.filterPidsByCid = function (pids, cid, callback) {
		if (!cid) {
			return callback(null, pids);
		}

		if (!Array.isArray(cid) || cid.length === 1) {
			// Single cid
			db.isSortedSetMembers('cid:' + parseInt(cid, 10) + ':pids', pids, function (err, isMembers) {
				if (err) {
					return callback(err);
				}
				pids = pids.filter(function (pid, index) {
					return pid && isMembers[index];
				});
				callback(null, pids);
			});
		} else {
			// Multiple cids
			async.map(cid, function (cid, next) {
				Posts.filterPidsByCid(pids, cid, next);
			}, function (err, pidsArr) {
				if (err) {
					return callback(err);
				}

				callback(null, _.union.apply(_, pidsArr));
			});
		}
	};
};
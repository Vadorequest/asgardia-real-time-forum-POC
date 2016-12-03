
'use strict';

var async = require('async');
var _ = require('underscore');

var categories = require('../categories');
var search = require('../search');

module.exports = function (Topics) {

	Topics.getSuggestedTopics = function (tid, uid, start, stop, callback) {
		async.parallel({
			tagTids: function (next) {
				getTidsWithSameTags(tid, next);
			},
			searchTids: function (next) {
				getSearchTids(tid, next);
			},
			categoryTids: function (next) {
				getCategoryTids(tid, next);
			}
		}, function (err, results) {
			if (err) {
				return callback(err);
			}
			var tids = results.tagTids.concat(results.searchTids).concat(results.categoryTids);
			tids = tids.filter(function (_tid, index, array) {
				return parseInt(_tid, 10) !== parseInt(tid, 10) && array.indexOf(_tid) === index;
			});

			if (stop === -1) {
				tids = tids.slice(start);
			} else {
				tids = tids.slice(start, stop + 1);
			}

			Topics.getTopics(tids, uid, callback);
		});
	};

	function getTidsWithSameTags(tid, callback) {
		async.waterfall([
			function (next) {
				Topics.getTopicTags(tid, next);
			},
			function (tags, next) {
				async.map(tags, function (tag, next) {
					Topics.getTagTids(tag, 0, -1, next);
				}, next);
			},
			function (data, next) {
				next(null, _.unique(_.flatten(data)));
			}
		], callback);
	}

	function getSearchTids(tid, callback) {
		async.waterfall([
			function (next) {
				Topics.getTopicField(tid, 'title', next);
			},
			function (title, next) {
				search.searchQuery('topic', title, [], [], next);
			}
		], callback);
	}

	function getCategoryTids(tid, callback) {
		async.waterfall([
			function (next) {
				Topics.getTopicField(tid, 'cid', next);
			},
			function (cid, next) {
				categories.getTopicIds(cid, 'cid:' + cid + ':tids', true, 0, 9, next);
			}
		], callback);
	}

};
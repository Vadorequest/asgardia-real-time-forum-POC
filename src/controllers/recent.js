
'use strict';

var async = require('async');
var nconf = require('nconf');
var validator = require('validator');

var user = require('../user');
var topics = require('../topics');
var meta = require('../meta');
var helpers = require('./helpers');
var pagination = require('../pagination');

var recentController = {};

var validFilter = {'': true, 'new': true, 'watched': true};

recentController.get = function (req, res, next) {
	var page = parseInt(req.query.page, 10) || 1;
	var stop = 0;
	var settings;
	var cid = req.query.cid;
	var filter = req.params.filter || '';
	var categoryData;

	if (!validFilter[filter]) {
		return next();
	}

	async.waterfall([
		function (next) {
			async.parallel({
				settings: function (next) {
					user.getSettings(req.uid, next);
				},
				watchedCategories: function (next) {
					helpers.getWatchedCategories(req.uid, cid, next);
				}
			}, next);
		},
		function (results, next) {
			settings = results.settings;
			categoryData = results.watchedCategories;

			var start = Math.max(0, (page - 1) * settings.topicsPerPage);
			stop = start + settings.topicsPerPage - 1;

			topics.getRecentTopics(cid, req.uid, start, stop, filter, next);
		}
	], function (err, data) {
		if (err) {
			return next(err);
		}

		data.categories = categoryData.categories;
		data.selectedCategory = categoryData.selectedCategory;
		data.nextStart = stop + 1;
		data.set = 'topics:recent';
		data['feeds:disableRSS'] = parseInt(meta.config['feeds:disableRSS'], 10) === 1;
		data.rssFeedUrl = nconf.get('relative_path') + '/recent.rss';
		data.title = '[[pages:recent]]';
		data.filters = [{
			name: '[[unread:all-topics]]',
			url: 'recent',
			selected: filter === '',
			filter: ''
		}, {
			name: '[[unread:new-topics]]',
			url: 'recent/new',
			selected: filter === 'new',
			filter: 'new'
		}, {
			name: '[[unread:watched-topics]]',
			url: 'recent/watched',
			selected: filter === 'watched',
			filter: 'watched'
		}];

		data.selectedFilter = data.filters.find(function (filter) {
			return filter && filter.selected;
		});

		var pageCount = Math.max(1, Math.ceil(data.topicCount / settings.topicsPerPage));
		data.pagination = pagination.create(page, pageCount, req.query);

		if (req.path.startsWith('/api/recent') || req.path.startsWith('/recent')) {
			data.breadcrumbs = helpers.buildBreadcrumbs([{text: '[[recent:title]]'}]);
		}

		data.querystring = cid ? ('?cid=' + validator.escape(String(cid))) : '';
		res.render('recent', data);
	});
};

module.exports = recentController;
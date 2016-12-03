'use strict';

var nconf = require('nconf');
var async = require('async');
var S = require('string');

var user = require('../../user');
var posts = require('../../posts');
var plugins = require('../../plugins');
var meta = require('../../meta');
var accountHelpers = require('./helpers');
var helpers = require('../helpers');
var pagination = require('../../pagination');
var messaging = require('../../messaging');

var profileController = {};

profileController.get = function (req, res, callback) {
	var lowercaseSlug = req.params.userslug.toLowerCase();

	if (req.params.userslug !== lowercaseSlug) {
		if (res.locals.isAPI) {
			req.params.userslug = lowercaseSlug;
		} else {
			return res.redirect(nconf.get('relative_path') + '/user/' + lowercaseSlug);
		}
	}
	var page = Math.max(1, parseInt(req.query.page, 10) || 1);
	var itemsPerPage = 10;
	var start = (page - 1) * itemsPerPage;
	var stop = start + itemsPerPage - 1;
	var userData;
	async.waterfall([
		function (next) {
			accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, next);
		},
		function (_userData, next) {
			if (!_userData) {
				return callback();
			}
			userData = _userData;

			req.session.uids_viewed = req.session.uids_viewed || {};
			if (req.uid !== parseInt(userData.uid, 10) && (!req.session.uids_viewed[userData.uid] || req.session.uids_viewed[userData.uid] < Date.now() - 3600000)) {
				user.incrementUserFieldBy(userData.uid, 'profileviews', 1);
				req.session.uids_viewed[userData.uid] = Date.now();
			}

			async.parallel({
				hasPrivateChat: function (next) {
					messaging.hasPrivateChat(req.uid, userData.uid, next);
				},
				posts: function (next) {
					posts.getPostSummariesFromSet('uid:' + userData.theirid + ':posts', req.uid, start, stop, next);
				},
				signature: function (next) {
					posts.parseSignature(userData, req.uid, next);
				},
				aboutme: function (next) {
					if (userData.aboutme) {
						plugins.fireHook('filter:parse.aboutme', userData.aboutme, next);
					} else {
						next();
					}
				}
			}, next);
		},
		function (results, next) {
			if (parseInt(meta.config['reputation:disabled'], 10) === 1) {
				delete userData.reputation;
			}

			userData.posts = results.posts.posts.filter(function (p) {
				return p && parseInt(p.deleted, 10) !== 1;
			});
			userData.hasPrivateChat = results.hasPrivateChat;
			userData.aboutme = results.aboutme;
			userData.nextStart = results.posts.nextStart;
			userData.breadcrumbs = helpers.buildBreadcrumbs([{text: userData.username}]);
			userData.title = userData.username;
			var pageCount = Math.ceil(userData.postcount / itemsPerPage);
			userData.pagination = pagination.create(page, pageCount, req.query);

			userData['cover:url'] = userData['cover:url'] || require('../../coverPhoto').getDefaultProfileCover(userData.uid);
			userData['cover:position'] = userData['cover:position'] || '50% 50%';

			if (!parseInt(userData.profileviews, 10)) {
				userData.profileviews = 1;
			}

			var plainAboutMe = userData.aboutme ? S(userData.aboutme).decodeHTMLEntities().stripTags().s : '';

			res.locals.metaTags = [
				{
					name: "title",
					content: userData.fullname || userData.username
				},
				{
					name: "description",
					content: plainAboutMe
				},
				{
					property: 'og:title',
					content: userData.fullname || userData.username
				},
				{
					property: 'og:description',
					content: plainAboutMe
				}
			];

			if (userData.picture) {
				res.locals.metaTags.push(
					{
						property: 'og:image',
						content: userData.picture,
						noEscape: true
					},
					{
						property: "og:image:url",
						content: userData.picture,
						noEscape: true
					}
				);
			}
			userData.selectedGroup = userData.groups.find(function (group) {
				return group && group.name === userData.groupTitle;
			});

			plugins.fireHook('filter:user.account', {userData: userData, uid: req.uid}, next);
		}
	], function (err, results) {
		if (err) {
			return callback(err);
		}
		res.render('account/profile', results.userData);
	});
};

module.exports = profileController;
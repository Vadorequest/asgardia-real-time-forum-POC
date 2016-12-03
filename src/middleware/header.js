'use strict';

var async = require('async');
var nconf = require('nconf');

var db = require('../database');
var user = require('../user');
var meta = require('../meta');
var plugins = require('../plugins');
var navigation = require('../navigation');

var controllers = {
	api: require('../controllers/api'),
	helpers: require('../controllers/helpers')
};

module.exports = function (middleware) {

	middleware.buildHeader = function (req, res, next) {
		res.locals.renderHeader = true;
		res.locals.isAPI = false;
		async.waterfall([
			function (next) {
				middleware.applyCSRF(req, res, next);
			},
			function (next) {
				async.parallel({
					config: function (next) {
						controllers.api.getConfig(req, res, next);
					},
					plugins: function (next) {
						plugins.fireHook('filter:middleware.buildHeader', {req: req, locals: res.locals}, next);
					}
				}, next);
			},
			function (results, next) {
				res.locals.config = results.config;
				next();
			}
		], next);
	};

	middleware.renderHeader = function (req, res, data, callback) {
		var registrationType = meta.config.registrationType || 'normal';
		var templateValues = {
			bootswatchCSS: meta.config['theme:src'],
			title: meta.config.title || '',
			description: meta.config.description || '',
			'cache-buster': meta.config['cache-buster'] ? 'v=' + meta.config['cache-buster'] : '',
			'brand:logo': meta.config['brand:logo'] || '',
			'brand:logo:url': meta.config['brand:logo:url'] || '',
			'brand:logo:alt': meta.config['brand:logo:alt'] || '',
			'brand:logo:display': meta.config['brand:logo'] ? '' : 'hide',
			allowRegistration: registrationType === 'normal' || registrationType === 'admin-approval' || registrationType === 'admin-approval-ip',
			searchEnabled: plugins.hasListeners('filter:search.query'),
			config: res.locals.config,
			relative_path: nconf.get('relative_path'),
			bodyClass: data.bodyClass
		};

		templateValues.configJSON = JSON.stringify(res.locals.config);

		async.parallel({
			scripts: function (next) {
				plugins.fireHook('filter:scripts.get', [], next);
			},
			isAdmin: function (next) {
				user.isAdministrator(req.uid, next);
			},
			isGlobalMod: function (next) {
				user.isGlobalModerator(req.uid, next);
			},
			isModerator: function (next) {
				user.isModeratorOfAnyCategory(req.uid, next);
			},
			user: function (next) {
				var userData = {
					uid: 0,
					username: '[[global:guest]]',
					userslug: '',
					email: '',
					picture: meta.config.defaultAvatar,
					status: 'offline',
					reputation: 0,
					'email:confirmed': false
				};
				if (req.uid) {
					user.getUserFields(req.uid, Object.keys(userData), next);
				} else {
					next(null, userData);
				}
			},
			isEmailConfirmSent: function (next) {
				if (!meta.config.requireEmailConfirmation || !req.uid) {
					return next(null, false);
				}
				db.get('uid:' + req.uid + ':confirm:email:sent', next);
			},
			navigation: async.apply(navigation.get),
			tags: async.apply(meta.tags.parse, res.locals.metaTags, res.locals.linkTags),
			banned: async.apply(user.isBanned, req.uid),
			banReason: async.apply(user.getBannedReason, req.uid)
		}, function (err, results) {
			if (err) {
				return callback(err);
			}

			if (results.banned) {
				req.logout();
				return res.redirect('/?banned=' + (results.banReason || 'no-reason'));
			}

			results.user.isAdmin = results.isAdmin;
			results.user.isGlobalMod = results.isGlobalMod;
			results.user.isMod = !!results.isModerator;
			results.user.uid = parseInt(results.user.uid, 10);
			results.user.email = String(results.user.email).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
			results.user['email:confirmed'] = parseInt(results.user['email:confirmed'], 10) === 1;
			results.user.isEmailConfirmSent = !!results.isEmailConfirmSent;

			if (res.locals.config && parseInt(meta.config.disableCustomUserSkins, 10) !== 1 && res.locals.config.bootswatchSkin !== 'default') {
				templateValues.bootswatchCSS = '//maxcdn.bootstrapcdn.com/bootswatch/latest/' + res.locals.config.bootswatchSkin + '/bootstrap.min.css';
			}

			templateValues.browserTitle = controllers.helpers.buildTitle(data.title);
			templateValues.navigation = results.navigation;
			templateValues.metaTags = results.tags.meta;
			templateValues.linkTags = results.tags.link;
			templateValues.isAdmin = results.user.isAdmin;
			templateValues.isGlobalMod = results.user.isGlobalMod;
			templateValues.showModMenu = results.user.isAdmin || results.user.isGlobalMod || results.user.isMod;
			templateValues.user = results.user;
			templateValues.userJSON = JSON.stringify(results.user);
			templateValues.useCustomCSS = parseInt(meta.config.useCustomCSS, 10) === 1 && meta.config.customCSS;
			templateValues.customCSS = templateValues.useCustomCSS ? (meta.config.renderedCustomCSS || '') : '';
			templateValues.useCustomJS = parseInt(meta.config.useCustomJS, 10) === 1;
			templateValues.customJS = templateValues.useCustomJS ? meta.config.customJS : '';
			templateValues.maintenanceHeader = parseInt(meta.config.maintenanceMode, 10) === 1 && !results.isAdmin;
			templateValues.defaultLang = meta.config.defaultLang || 'en-GB';
			templateValues.privateUserInfo = parseInt(meta.config.privateUserInfo, 10) === 1;
			templateValues.privateTagListing = parseInt(meta.config.privateTagListing, 10) === 1;

			templateValues.template = {name: res.locals.template};
			templateValues.template[res.locals.template] = true;

			templateValues.scripts = results.scripts.map(function (script) {
				return {src: script};
			});

			if (req.route && req.route.path === '/') {
				modifyTitle(templateValues);
			}

			plugins.fireHook('filter:middleware.renderHeader', {templateValues: templateValues, req: req, res: res}, function (err, data) {
				if (err) {
					return callback(err);
				}

				req.app.render('header', data.templateValues, callback);
			});
		});
	};

	middleware.renderFooter = function (req, res, data, callback) {
		plugins.fireHook('filter:middleware.renderFooter', {templateValues: data, req: req, res: res}, function (err, data) {
			if (err) {
				return callback(err);
			}
			req.app.render('footer', data.templateValues, callback);
		});
	};

	function modifyTitle(obj) {
		var title = controllers.helpers.buildTitle('[[pages:home]]');
		obj.browserTitle = title;

		if (obj.metaTags) {
			obj.metaTags.forEach(function (tag, i) {
				if (tag.property === 'og:title') {
					obj.metaTags[i].content = title;
				}
			});
		}

		return title;
	}

};




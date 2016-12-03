"use strict";

var async = require('async');
var fs = require('fs');
var path = require('path');
var csrf = require('csurf');
var validator = require('validator');
var nconf = require('nconf');
var ensureLoggedIn = require('connect-ensure-login');
var toobusy = require('toobusy-js');

var plugins = require('../plugins');
var languages = require('../languages');
var meta = require('../meta');
var user = require('../user');
var groups = require('../groups');

var analytics = require('../analytics');

var controllers = {
	api: require('./../controllers/api'),
	helpers: require('../controllers/helpers')
};

var middleware = {};

middleware.applyCSRF = csrf();

middleware.ensureLoggedIn = ensureLoggedIn.ensureLoggedIn(nconf.get('relative_path') + '/login');

require('./admin')(middleware);
require('./header')(middleware);
require('./render')(middleware);
require('./maintenance')(middleware);
require('./user')(middleware);
require('./headers')(middleware);

middleware.authenticate = function (req, res, next) {
	if (req.user) {
		return next();
	} else if (plugins.hasListeners('action:middleware.authenticate')) {
		return plugins.fireHook('action:middleware.authenticate', {
			req: req,
			res: res,
			next: next
		});
	}

	controllers.helpers.notAllowed(req, res);
};

middleware.pageView = function (req, res, next) {
	analytics.pageView({
		ip: req.ip,
		path: req.path,
		uid: req.uid
	});

	plugins.fireHook('action:middleware.pageView', {req: req});

	if (req.user) {
		user.updateLastOnlineTime(req.user.uid);
		if (req.path.startsWith('/api/users') || req.path.startsWith('/users')) {
			user.updateOnlineUsers(req.user.uid, next);
		} else {
			user.updateOnlineUsers(req.user.uid);
			next();
		}
	} else {
		next();
	}
};


middleware.pluginHooks = function (req, res, next) {
	async.each(plugins.loadedHooks['filter:router.page'] || [], function (hookObj, next) {
		hookObj.method(req, res, next);
	}, function () {
		// If it got here, then none of the subscribed hooks did anything, or there were no hooks
		next();
	});
};

middleware.validateFiles = function (req, res, next) {
	if (!Array.isArray(req.files.files) || !req.files.files.length) {
		return next(new Error(['[[error:invalid-files]]']));
	}

	next();
};

middleware.prepareAPI = function (req, res, next) {
	res.locals.isAPI = true;
	next();
};

middleware.routeTouchIcon = function (req, res) {
	if (meta.config['brand:touchIcon'] && validator.isURL(meta.config['brand:touchIcon'])) {
		return res.redirect(meta.config['brand:touchIcon']);
	} else {
		return res.sendFile(path.join(__dirname, '../../public', meta.config['brand:touchIcon'] || '/logo.png'), {
			maxAge: req.app.enabled('cache') ? 5184000000 : 0
		});
	}
};

middleware.privateTagListing = function (req, res, next) {
	if (!req.user && parseInt(meta.config.privateTagListing, 10) === 1) {
		controllers.helpers.notAllowed(req, res);
	} else {
		next();
	}
};

middleware.exposeGroupName = function (req, res, next) {
	expose('groupName', groups.getGroupNameByGroupSlug, 'slug', req, res, next);
};

middleware.exposeUid = function (req, res, next) {
	expose('uid', user.getUidByUserslug, 'userslug', req, res, next);
};

function expose(exposedField, method, field, req, res, next) {
	if (!req.params.hasOwnProperty(field)) {
		return next();
	}
	method(req.params[field], function (err, id) {
		if (err) {
			return next(err);
		}

		res.locals[exposedField] = id;
		next();
	});
}

middleware.privateUploads = function (req, res, next) {
	if (req.user || parseInt(meta.config.privateUploads, 10) !== 1) {
		return next();
	}
	if (req.path.startsWith('/uploads/files')) {
		return res.status(403).json('not-allowed');
	}
	next();
};

middleware.busyCheck = function (req, res, next) {
	if (global.env === 'production' && (!meta.config.hasOwnProperty('eventLoopCheckEnabled') || parseInt(meta.config.eventLoopCheckEnabled, 10) === 1) && toobusy()) {
		analytics.increment('errors:503');
		res.status(503).type('text/html').sendFile(path.join(__dirname, '../../public/503.html'));
	} else {
		next();
	}
};

middleware.applyBlacklist = function (req, res, next) {
	meta.blacklist.test(req.ip, function (err) {
		next(err);
	});
};

middleware.getTranslation = function (req, res, next) {
	var language = req.params.language;
	var namespace = req.params.namespace;

	if (language && namespace) {
		languages.get(language, namespace, function (err, translations) {
			if (err) {
				return next(err);
			}

			res.status(200).json(translations);
		});
	} else {
		res.status(404).json('{}');
	}
};

middleware.processTimeagoLocales = function (req, res, next) {
	var fallback = req.path.indexOf('-short') === -1 ? 'jquery.timeago.en.js' : 'jquery.timeago.en-short.js',
		localPath = path.join(__dirname, '../../public/vendor/jquery/timeago/locales', req.path),
		exists;

	try {
		exists = fs.accessSync(localPath, fs.F_OK | fs.R_OK);
	} catch(e) {
		exists = false;
	}

	if (exists) {
		res.status(200).sendFile(localPath, {
			maxAge: req.app.enabled('cache') ? 5184000000 : 0
		});
	} else {
		res.status(200).sendFile(path.join(__dirname, '../../public/vendor/jquery/timeago/locales', fallback), {
			maxAge: req.app.enabled('cache') ? 5184000000 : 0
		});
	}
};


module.exports = middleware;

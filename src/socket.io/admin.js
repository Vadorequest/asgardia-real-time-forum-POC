"use strict";

var async = require('async');
var winston = require('winston');
var nconf = require('nconf');
var path = require('path');

var meta = require('../meta');
var plugins = require('../plugins');
var widgets = require('../widgets');
var user = require('../user');
var logger = require('../logger');
var events = require('../events');
var emailer = require('../emailer');
var db = require('../database');
var analytics = require('../analytics');
var index = require('./index');

var SocketAdmin = {
	user: require('./admin/user'),
	categories: require('./admin/categories'),
	groups: require('./admin/groups'),
	tags: require('./admin/tags'),
	rewards: require('./admin/rewards'),
	navigation: require('./admin/navigation'),
	rooms: require('./admin/rooms'),
	social: require('./admin/social'),
	themes: {},
	plugins: {},
	widgets: {},
	config: {},
	settings: {},
	email: {},
	analytics: {},
	logs: {},
	errors: {}
};

SocketAdmin.before = function (socket, method, data, next) {
	if (!socket.uid) {
		return;
	}

	user.isAdministrator(socket.uid, function (err, isAdmin) {
		if (err || isAdmin) {
			return next(err);
		}

		winston.warn('[socket.io] Call to admin method ( ' + method + ' ) blocked (accessed by uid ' + socket.uid + ')');
	});
};

SocketAdmin.reload = function (socket, data, callback) {
	events.log({
		type: 'restart',
		uid: socket.uid,
		ip: socket.ip
	});
	meta.restart();
	callback();
};

SocketAdmin.restart = function (socket, data, callback) {
	// Rebuild assets and reload NodeBB
	var child_process = require('child_process');
	var build_worker = child_process.fork('app.js', ['--build'], {
		cwd: path.join(__dirname, '../../'),
		stdio: 'pipe'
	});

	build_worker.on('exit', function () {
		events.log({
			type: 'build',
			uid: socket.uid,
			ip: socket.ip
		});

		events.log({
			type: 'restart',
			uid: socket.uid,
			ip: socket.ip
		});

		meta.restart();
		callback();
	});
};

SocketAdmin.fireEvent = function (socket, data, callback) {
	index.server.emit(data.name, data.payload || {});
	callback();
};

SocketAdmin.themes.getInstalled = function (socket, data, callback) {
	meta.themes.get(callback);
};

SocketAdmin.themes.set = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var wrappedCallback = function (err) {
		if (err) {
			return callback(err);
		}
		meta.themes.set(data, callback);
	};
	if (data.type === 'bootswatch') {
		wrappedCallback();
	} else {
		widgets.reset(wrappedCallback);
	}
};

SocketAdmin.plugins.toggleActive = function (socket, plugin_id, callback) {
	require('../posts/cache').reset();
	plugins.toggleActive(plugin_id, callback);
};

SocketAdmin.plugins.toggleInstall = function (socket, data, callback) {
	require('../posts/cache').reset();
	plugins.toggleInstall(data.id, data.version, callback);
};

SocketAdmin.plugins.getActive = function (socket, data, callback) {
	plugins.getActive(callback);
};

SocketAdmin.plugins.orderActivePlugins = function (socket, data, callback) {
	async.each(data, function (plugin, next) {
		if (plugin && plugin.name) {
			db.sortedSetAdd('plugins:active', plugin.order || 0, plugin.name, next);
		} else {
			next();
		}
	}, callback);
};

SocketAdmin.plugins.upgrade = function (socket, data, callback) {
	plugins.upgrade(data.id, data.version, callback);
};

SocketAdmin.widgets.set = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	widgets.setArea(data, callback);
};

SocketAdmin.config.set = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	meta.configs.set(data.key, data.value, function (err) {
		if (err) {
			return callback(err);
		}

		callback();

		plugins.fireHook('action:config.set', {
			key: data.key,
			value: data.value
		});

		logger.monitorConfig({io: index.server}, data);
	});
};

SocketAdmin.config.setMultiple = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	meta.configs.setMultiple(data, function (err) {
		if(err) {
			return callback(err);
		}

		callback();
		var setting;
		for(var field in data) {
			if (data.hasOwnProperty(field)) {
				setting = {
					key: field,
					value: data[field]
				};
				plugins.fireHook('action:config.set', setting);
				logger.monitorConfig({io: index.server}, setting);
			}
		}
	});
};

SocketAdmin.config.remove = function (socket, key, callback) {
	meta.configs.remove(key);
	callback();
};

SocketAdmin.settings.get = function (socket, data, callback) {
	meta.settings.get(data.hash, callback);
};

SocketAdmin.settings.set = function (socket, data, callback) {
	meta.settings.set(data.hash, data.values, callback);
};

SocketAdmin.settings.clearSitemapCache = function (socket, data, callback) {
	require('../sitemap').clearCache();
	callback();
};

SocketAdmin.email.test = function (socket, data, callback) {
	var site_title = meta.config.title || 'NodeBB';
	emailer.send(data.template, socket.uid, {
		subject: '[' + site_title + '] Test Email',
		site_title: site_title,
		url: nconf.get('url')
	}, callback);
};

SocketAdmin.analytics.get = function (socket, data, callback) {
	// Default returns views from past 24 hours, by hour
	if (data.units === 'days') {
		data.amount = 30;
	} else {
		data.amount = 24;
	}

	if (data && data.graph && data.units && data.amount) {
		if (data.graph === 'traffic') {
			async.parallel({
				uniqueVisitors: function (next) {
					if (data.units === 'days') {
						analytics.getDailyStatsForSet('analytics:uniquevisitors', data.until || Date.now(), data.amount, next);
					} else {
						analytics.getHourlyStatsForSet('analytics:uniquevisitors', data.until || Date.now(), data.amount, next);
					}
				},
				pageviews: function (next) {
					if (data.units === 'days') {
						analytics.getDailyStatsForSet('analytics:pageviews', data.until || Date.now(), data.amount, next);
					} else {
						analytics.getHourlyStatsForSet('analytics:pageviews', data.until || Date.now(), data.amount, next);
					}
				},
				monthlyPageViews: function (next) {
					analytics.getMonthlyPageViews(next);
				}
			}, function (err, data) {
				data.pastDay = data.pageviews.reduce(function (a, b) {return parseInt(a, 10) + parseInt(b, 10);});
				data.pageviews[data.pageviews.length - 1] = parseInt(data.pageviews[data.pageviews.length - 1], 10) + analytics.getUnwrittenPageviews();
				callback(err, data);
			});
		}
	} else {
		callback(new Error('Invalid analytics call'));
	}
};

SocketAdmin.logs.get = function (socket, data, callback) {
	meta.logs.get(callback);
};

SocketAdmin.logs.clear = function (socket, data, callback) {
	meta.logs.clear(callback);
};

SocketAdmin.errors.clear = function (socket, data, callback) {
	meta.errors.clear(callback);
};

SocketAdmin.deleteAllEvents = function (socket, data, callback) {
	events.deleteAll(callback);
};


module.exports = SocketAdmin;

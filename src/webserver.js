
'use strict';

var fs = require('fs');
var path = require('path');
var nconf = require('nconf');
var express = require('express');
var app = express();
var server;
var winston = require('winston');
var async = require('async');
var flash = require('connect-flash');
var compression = require('compression');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var useragent = require('express-useragent');
var favicon = require('serve-favicon');

var db = require('./database');
var file = require('./file');
var emailer = require('./emailer');
var meta = require('./meta');
var languages = require('./languages');
var logger = require('./logger');
var plugins = require('./plugins');
var routes = require('./routes');
var auth = require('./routes/authentication');
var templates = require('templates.js');

var helpers = require('../public/src/modules/helpers');

if (nconf.get('ssl')) {
	server = require('https').createServer({
		key: fs.readFileSync(nconf.get('ssl').key),
		cert: fs.readFileSync(nconf.get('ssl').cert)
	}, app);
} else {
	server = require('http').createServer(app);
}

module.exports.server = server;

server.on('error', function (err) {
	winston.error(err);
	if (err.code === 'EADDRINUSE') {
		winston.error('NodeBB address in use, exiting...');
		process.exit(0);
	} else {
		throw err;
	}
});

module.exports.listen = function (callback) {
	callback = callback || function () {};
	emailer.registerApp(app);

	setupExpressApp(app);

	helpers.register();

	logger.init(app);

	initializeNodeBB(function (err) {
		if (err) {
			return callback(err);
		}

		winston.info('NodeBB Ready');

		require('./socket.io').server.emit('event:nodebb.ready', {
			'cache-buster': meta.config['cache-buster']
		});

		plugins.fireHook('action:nodebb.ready');

		listen(callback);
	});
};

function initializeNodeBB(callback) {
	winston.info('initializing NodeBB ...');
	var middleware = require('./middleware');

	async.waterfall([
		async.apply(meta.themes.setupPaths),
		function (next) {
			plugins.init(app, middleware, next);
		},
		async.apply(plugins.fireHook, 'static:assets.prepare', {}),
		async.apply(meta.js.bridgeModules, app),
		function (next) {
			plugins.fireHook('static:app.preload', {
				app: app,
				middleware: middleware
			}, next);
		},
		function (next) {
			plugins.fireHook('filter:hotswap.prepare', [], next);
		},
		function (hotswapIds, next) {
			routes(app, middleware, hotswapIds);
			next();
		},
		function (next) {
			async.series([
				async.apply(meta.js.getFromFile, 'nodebb.min.js'),
				async.apply(meta.js.getFromFile, 'acp.min.js'),
				async.apply(meta.css.getFromFile),
				async.apply(meta.sounds.init),
				async.apply(languages.init),
				async.apply(meta.blacklist.load)
			], next);
		}
	], callback);
}

function setupExpressApp(app) {
	var middleware = require('./middleware');

	var relativePath = nconf.get('relative_path');

	app.engine('tpl', templates.__express);
	app.set('view engine', 'tpl');
	app.set('views', nconf.get('views_dir'));
	app.set('json spaces', process.env.NODE_ENV === 'development' ? 4 : 0);
	app.use(flash());

	app.enable('view cache');

	if (global.env !== 'development') {
		app.enable('cache');
		app.enable('minification');
	}

	app.use(compression());

	setupFavicon(app);

	app.use(relativePath + '/apple-touch-icon', middleware.routeTouchIcon);

	app.use(bodyParser.urlencoded({extended: true}));
	app.use(bodyParser.json());
	app.use(cookieParser());
	app.use(useragent.express());

	app.use(session({
		store: db.sessionStore,
		secret: nconf.get('secret'),
		key: nconf.get('sessionKey'),
		cookie: setupCookie(),
		resave: true,
		saveUninitialized: true
	}));

	app.use(middleware.addHeaders);
	app.use(middleware.processRender);
	auth.initialize(app, middleware);

	var toobusy = require('toobusy-js');
	toobusy.maxLag(parseInt(meta.config.eventLoopLagThreshold, 10) || 100);
	toobusy.interval(parseInt(meta.config.eventLoopInterval, 10) || 500);
}

function setupFavicon(app) {
	var faviconPath = path.join(nconf.get('base_dir'), 'public', meta.config['brand:favicon'] ? meta.config['brand:favicon'] : 'favicon.ico');
	if (file.existsSync(faviconPath)) {
		app.use(nconf.get('relative_path'), favicon(faviconPath));
	}
}

function setupCookie() {
	var cookie = {
		maxAge: 1000 * 60 * 60 * 24 * (parseInt(meta.config.loginDays, 10) || 14)
	};

	if (nconf.get('cookieDomain') || meta.config.cookieDomain) {
		cookie.domain = nconf.get('cookieDomain') || meta.config.cookieDomain;
	}

	if (nconf.get('secure')) {
		cookie.secure = true;
	}

	var relativePath = nconf.get('relative_path');
	if (relativePath !== '') {
		cookie.path = relativePath;
	}

	return cookie;
}

function listen(callback) {
	callback = callback || function () {};
	var port = parseInt(nconf.get('port'), 10);
	var isSocket = isNaN(port);
	var socketPath = isSocket ? nconf.get('port') : '';

	if (Array.isArray(port)) {
		if (!port.length) {
			winston.error('[startup] empty ports array in config.json');
			process.exit();
		}

		winston.warn('[startup] If you want to start nodebb on multiple ports please use loader.js');
		winston.warn('[startup] Defaulting to first port in array, ' + port[0]);
		port = port[0];
		if (!port) {
			winston.error('[startup] Invalid port, exiting');
			process.exit();
		}
	}

	if ((port !== 80 && port !== 443) || nconf.get('trust_proxy') === true) {
		winston.info('Enabling \'trust proxy\'');
		app.enable('trust proxy');
	}

	if ((port === 80 || port === 443) && process.env.NODE_ENV !== 'development') {
		winston.info('Using ports 80 and 443 is not recommend; use a proxy instead. See README.md');
	}

	var bind_address = ((nconf.get('bind_address') === "0.0.0.0" || !nconf.get('bind_address')) ? '0.0.0.0' : nconf.get('bind_address'));
	var args = isSocket ? [socketPath] : [port, bind_address];
	var oldUmask;

	args.push(function (err) {
		if (err) {
			winston.info('[startup] NodeBB was unable to listen on: ' + bind_address + ':' + port);
			process.exit();
		}

		winston.info('NodeBB is now listening on: ' + (isSocket ? socketPath : bind_address + ':' + port));
		if (oldUmask) {
			process.umask(oldUmask);
		}
		callback();
	});

	// Alter umask if necessary
	if (isSocket) {
		oldUmask = process.umask('0000');
		module.exports.testSocket(socketPath, function (err) {
			if (!err) {
				server.listen.apply(server, args);
			} else {
				winston.error('[startup] NodeBB was unable to secure domain socket access (' + socketPath + ')');
				winston.error('[startup] ' + err.message);
				process.exit();
			}
		});
	} else {
		server.listen.apply(server, args);
	}
}

module.exports.testSocket = function (socketPath, callback) {
	if (typeof socketPath !== 'string') {
		return callback(new Error('invalid socket path : ' + socketPath));
	}
	var net = require('net');
	var file = require('./file');
	async.series([
		function (next) {
			file.exists(socketPath, function (exists) {
				if (exists) {
					next();
				} else {
					callback();
				}
			});
		},
		function (next) {
			var testSocket = new net.Socket();
			testSocket.on('error', function (err) {
				next(err.code !== 'ECONNREFUSED' ? err : null);
			});
			testSocket.connect({ path: socketPath }, function () {
				// Something's listening here, abort
				callback(new Error('port-in-use'));
			});
		},
		async.apply(fs.unlink, socketPath),	// The socket was stale, kick it out of the way
	], callback);
};



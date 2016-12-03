"use strict";

var async = require('async');
var nconf = require('nconf');
var winston = require('winston');
var url = require('url');
var cookieParser = require('cookie-parser')(nconf.get('secret'));

var db = require('../database');
var logger = require('../logger');
var ratelimit = require('../middleware/ratelimit');

(function (Sockets) {
	var Namespaces = {};
	var io;

	Sockets.init = function (server) {
		requireModules();

		var SocketIO = require('socket.io');
		var socketioWildcard = require('socketio-wildcard')();
		io = new SocketIO({
			path: nconf.get('relative_path') + '/socket.io'
		});

		addRedisAdapter(io);

		io.use(socketioWildcard);
		io.use(authorize);

		io.on('connection', onConnection);

		io.listen(server, {
			transports: nconf.get('socket.io:transports')
		});

		Sockets.server = io;
	};

	function onConnection(socket) {
		socket.ip = socket.request.headers['x-forwarded-for'] || socket.request.connection.remoteAddress;

		logger.io_one(socket, socket.uid);

		onConnect(socket);

		socket.on('*', function (payload) {
			onMessage(socket, payload);
		});
	}

	function onConnect(socket) {
		if (socket.uid) {
			socket.join('uid_' + socket.uid);
			socket.join('online_users');
		} else {
			socket.join('online_guests');
		}

		socket.join('sess_' + socket.request.signedCookies[nconf.get('sessionKey')]);
		io.sockets.sockets[socket.id].emit('checkSession', socket.uid);
	}

	function onMessage(socket, payload) {
		if (!payload.data.length) {
			return winston.warn('[socket.io] Empty payload');
		}

		var eventName = payload.data[0];
		var params = payload.data[1];
		var callback = typeof payload.data[payload.data.length - 1] === 'function' ? payload.data[payload.data.length - 1] : function () {
		};

		if (!eventName) {
			return winston.warn('[socket.io] Empty method name');
		}

		var parts = eventName.toString().split('.');
		var namespace = parts[0];
		var methodToCall = parts.reduce(function (prev, cur) {
			if (prev !== null && prev[cur]) {
				return prev[cur];
			} else {
				return null;
			}
		}, Namespaces);

		if (!methodToCall) {
			if (process.env.NODE_ENV === 'development') {
				winston.warn('[socket.io] Unrecognized message: ' + eventName);
			}
			return callback({message: '[[error:invalid-event]]'});
		}

		socket.previousEvents = socket.previousEvents || [];
		socket.previousEvents.push(eventName);
		if (socket.previousEvents.length > 20) {
			socket.previousEvents.shift();
		}

		if (!eventName.startsWith('admin.') && ratelimit.isFlooding(socket)) {
			winston.warn('[socket.io] Too many emits! Disconnecting uid : ' + socket.uid + '. Events : ' + socket.previousEvents);
			return socket.disconnect();
		}

		async.waterfall([
			function (next) {
				validateSession(socket, next);
			},
			function (next) {
				if (Namespaces[namespace].before) {
					Namespaces[namespace].before(socket, eventName, params, next);
				} else {
					next();
				}
			},
			function (next) {
				methodToCall(socket, params, next);
			}
		], function (err, result) {
			callback(err ? {message: err.message} : null, result);
		});
	}

	function requireModules() {
		var modules = ['admin', 'categories', 'groups', 'meta', 'modules',
			'notifications', 'plugins', 'posts', 'topics', 'user', 'blacklist'
		];

		modules.forEach(function (module) {
			Namespaces[module] = require('./' + module);
		});
	}

	function validateSession(socket, callback) {
		var req = socket.request;
		if (!req.signedCookies || !req.signedCookies[nconf.get('sessionKey')]) {
			return callback(new Error('[[error:invalid-session]]'));
		}
		db.sessionStore.get(req.signedCookies[nconf.get('sessionKey')], function (err, sessionData) {
			if (err || !sessionData) {
				return callback(err || new Error('[[error:invalid-session]]'));
			}

			callback();
		});
	}

	function authorize(socket, callback) {
		var request = socket.request;

		if (!request) {
			return callback(new Error('[[error:not-authorized]]'));
		}

		async.waterfall([
			function (next) {
				cookieParser(request, {}, next);
			},
			function (next) {
				db.sessionStore.get(request.signedCookies[nconf.get('sessionKey')], function (err, sessionData) {
					if (err) {
						return next(err);
					}
					if (sessionData && sessionData.passport && sessionData.passport.user) {
						request.session = sessionData;
						socket.uid = parseInt(sessionData.passport.user, 10);
					} else {
						socket.uid = 0;
					}
					next();
				});
			}
		], callback);
	}

	function addRedisAdapter(io) {
		if (nconf.get('redis')) {
			var redisAdapter = require('socket.io-redis');
			var redis = require('../database/redis');
			var pub = redis.connect();
			var sub = redis.connect({return_buffers: true});
			io.adapter(redisAdapter({pubClient: pub, subClient: sub}));
		} else if (nconf.get('isCluster') === 'true') {
			winston.warn('[socket.io] Clustering detected, you are advised to configure Redis as a websocket store.');
		}
	}

	Sockets.in = function (room) {
		return io.in(room);
	};

	Sockets.getUserSocketCount = function (uid) {
		if (!io) {
			return 0;
		}

		var room = io.sockets.adapter.rooms['uid_' + uid];
		return room ? room.length : 0;
	};


	Sockets.reqFromSocket = function (socket, payload, event) {
		var headers = socket.request ? socket.request.headers : {};
		var encrypted = socket.request ? !!socket.request.connection.encrypted : false;
		var host = headers.host;
		var referer = headers.referer || '';
		var data = ((payload || {}).data || []);

		if (!host) {
			host = url.parse(referer).host || '';
		}

		return {
			uid: socket.uid,
			params: data[1],
			method: event || data[0],
			body: payload,
			ip: headers['x-forwarded-for'] || socket.ip,
			host: host,
			protocol: encrypted ? 'https' : 'http',
			secure: encrypted,
			url: referer,
			path: referer.substr(referer.indexOf(host) + host.length),
			headers: headers
		};
	};

}(exports));

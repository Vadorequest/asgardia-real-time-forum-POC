"use strict";

var async = require('async');
var winston = require('winston');
var passport = require('passport');
var nconf = require('nconf');
var validator = require('validator');
var _ = require('underscore');
var url = require('url');

var db = require('../database');
var meta = require('../meta');
var user = require('../user');
var plugins = require('../plugins');
var utils = require('../../public/src/utils');
var Password = require('../password');

var sockets = require('../socket.io');

var authenticationController = {};

authenticationController.register = function (req, res, next) {
	var registrationType = meta.config.registrationType || 'normal';

	if (registrationType === 'disabled') {
		return res.sendStatus(403);
	}

	var userData = {};

	for (var key in req.body) {
		if (req.body.hasOwnProperty(key)) {
			userData[key] = req.body[key];
		}
	}

	async.waterfall([
		function (next) {
			if (registrationType === 'invite-only' || registrationType === 'admin-invite-only') {
				user.verifyInvitation(userData, next);
			} else {
				next();
			}
		},
		function (next) {
			if (!userData.email) {
				return next(new Error('[[error:invalid-email]]'));
			}

			if (!userData.username || userData.username.length < meta.config.minimumUsernameLength) {
				return next(new Error('[[error:username-too-short]]'));
			}

			if (userData.username.length > meta.config.maximumUsernameLength) {
				return next(new Error('[[error:username-too-long'));
			}

			user.isPasswordValid(userData.password, next);
		},
		function (next) {
			if (registrationType === 'normal' || registrationType === 'invite-only' || registrationType === 'admin-invite-only') {
				next(null, false);
			} else if (registrationType === 'admin-approval') {
				next(null, true);
			} else if (registrationType === 'admin-approval-ip') {
				db.sortedSetCard('ip:' + req.ip + ':uid', function (err, count) {
					if (err) {
						next(err);
					} else {
						next(null, !!count);
					}
				});
			}
		},
		function (queue, next) {
			res.locals.processLogin = true;	// set it to false in plugin if you wish to just register only
			plugins.fireHook('filter:register.check', {req: req, res: res, userData: userData, queue: queue}, next);
		},
		function (data, next) {
			if (data.queue) {
				addToApprovalQueue(req, userData, next);
			} else {
				registerAndLoginUser(req, res, userData, next);
			}
		}
	], function (err, data) {
		if (err) {
			return res.status(400).send(err.message);
		}

		if (req.body.userLang) {
			user.setSetting(data.uid, 'userLang', req.body.userLang);
		}

		res.json(data);
	});
};

function registerAndLoginUser(req, res, userData, callback) {
	var uid;
	async.waterfall([
		function (next) {
			plugins.fireHook('filter:register.interstitial', {
				userData: userData,
				interstitials: []
			}, function (err, data) {
				if (err) {
					return next(err);
				}

				// If interstitials are found, save registration attempt into session and abort
				var deferRegistration = data.interstitials.length;

				if (!deferRegistration) {
					return next();
				} else {
					userData.register = true;
					req.session.registration = userData;
					return res.json({ referrer: nconf.get('relative_path') + '/register/complete' });
				}
			});
		},
		function (next) {
			user.create(userData, next);
		},
		function (_uid, next) {
			uid = _uid;
			if (res.locals.processLogin) {
				authenticationController.doLogin(req, uid, next);
			} else {
				next();
			}
		},
		function (next) {
			user.deleteInvitationKey(userData.email);
			plugins.fireHook('filter:register.complete', {uid: uid, referrer: req.body.referrer || nconf.get('relative_path') + '/'}, next);
		}
	], callback);
}

function addToApprovalQueue(req, userData, callback) {
	async.waterfall([
		function (next) {
			userData.ip = req.ip;
			user.addToApprovalQueue(userData, next);
		},
		function (next) {
			next(null, {message: '[[register:registration-added-to-queue]]'});
		}
	], callback);
}

authenticationController.registerComplete = function (req, res, next) {
	// For the interstitials that respond, execute the callback with the form body
	plugins.fireHook('filter:register.interstitial', {
		userData: req.session.registration,
		interstitials: []
	}, function (err, data) {
		if (err) {
			return next(err);
		}

		var callbacks = data.interstitials.reduce(function (memo, cur) {
			if (cur.hasOwnProperty('callback') && typeof cur.callback === 'function') {
				memo.push(async.apply(cur.callback, req.session.registration, req.body));
			}

			return memo;
		}, []);

		var done = function () {
			delete req.session.registration;

			if (req.session.returnTo) {
				res.redirect(req.session.returnTo);
			} else {
				res.redirect(nconf.get('relative_path') + '/');
			}
		};

		async.parallel(callbacks, function (err) {
			if (err) {
				req.flash('error', err.message);
				return res.redirect(nconf.get('relative_path') + '/register/complete');
			}

			if (req.session.registration.register === true) {
				res.locals.processLogin = true;
				registerAndLoginUser(req, res, req.session.registration, done);
			} else {
				// Clear registration data in session
				done();
			}
		});
	});
};

authenticationController.registerAbort = function (req, res) {
	// End the session and redirect to home
	req.session.destroy(function () {
		res.redirect(nconf.get('relative_path') + '/');
	});
};

authenticationController.login = function (req, res, next) {
	if (plugins.hasListeners('action:auth.overrideLogin')) {
		return continueLogin(req, res, next);
	}

	var loginWith = meta.config.allowLoginWith || 'username-email';

	if (req.body.username && utils.isEmailValid(req.body.username) && loginWith.indexOf('email') !== -1) {
		user.getUsernameByEmail(req.body.username, function (err, username) {
			if (err) {
				return next(err);
			}
			req.body.username = username ? username : req.body.username;
			continueLogin(req, res, next);
		});
	} else if (loginWith.indexOf('username') !== -1 && !validator.isEmail(req.body.username)) {
		continueLogin(req, res, next);
	} else {
		res.status(500).send('[[error:wrong-login-type-' + loginWith + ']]');
	}
};

function continueLogin(req, res, next) {
	passport.authenticate('local', function (err, userData, info) {
		if (err) {
			return res.status(403).send(err.message);
		}

		if (!userData) {
			if (typeof info === 'object') {
				info = '[[error:invalid-username-or-password]]';
			}

			return res.status(403).send(info);
		}

		var passwordExpiry = userData.passwordExpiry !== undefined ? parseInt(userData.passwordExpiry, 10) : null;

		// Alter user cookie depending on passed-in option
		if (req.body.remember === 'on') {
			var duration = 1000 * 60 * 60 * 24 * (parseInt(meta.config.loginDays, 10) || 14);
			req.session.cookie.maxAge = duration;
			req.session.cookie.expires = new Date(Date.now() + duration);
		} else {
			req.session.cookie.maxAge = false;
			req.session.cookie.expires = false;
		}

		if (passwordExpiry && passwordExpiry < Date.now()) {
			winston.verbose('[auth] Triggering password reset for uid ' + userData.uid + ' due to password policy');
			req.session.passwordExpired = true;
			user.reset.generate(userData.uid, function (err, code) {
				if (err) {
					return res.status(403).send(err.message);
				}

				res.status(200).send(nconf.get('relative_path') + '/reset/' + code);
			});
		} else {
			authenticationController.doLogin(req, userData.uid, function (err) {
				if (err) {
					return res.status(403).send(err.message);
				}

				if (!req.session.returnTo) {
					res.status(200).send(nconf.get('relative_path') + '/');
				} else {
					var next = req.session.returnTo;
					delete req.session.returnTo;

					res.status(200).send(next);
				}
			});
		}
	})(req, res, next);
}

authenticationController.doLogin = function (req, uid, callback) {
	if (!uid) {
		return callback();
	}

	req.login({uid: uid}, function (err) {
		if (err) {
			return callback(err);
		}

		authenticationController.onSuccessfulLogin(req, uid, callback);
	});
};

authenticationController.onSuccessfulLogin = function (req, uid, callback) {
	callback = callback || function () {};
	var uuid = utils.generateUUID();
	req.session.meta = {};

	delete req.session.forceLogin;

	// Associate IP used during login with user account
	user.logIP(uid, req.ip);
	req.session.meta.ip = req.ip;

	// Associate metadata retrieved via user-agent
	req.session.meta = _.extend(req.session.meta, {
		uuid: uuid,
		datetime: Date.now(),
		platform: req.useragent.platform,
		browser: req.useragent.browser,
		version: req.useragent.version
	});

	// Associate login session with user
	async.parallel([
		function (next) {
			user.auth.addSession(uid, req.sessionID, next);
		},
		function (next) {
			db.setObjectField('uid:' + uid + 'sessionUUID:sessionId', uuid, req.sessionID, next);
		},
		function (next) {
			user.updateLastOnlineTime(uid, next);
		}
	], function (err) {
		if (err) {
			return callback(err);
		}

		// Force session check for all connected socket.io clients with the same session id
		sockets.in('sess_' + req.sessionID).emit('checkSession', uid);

		plugins.fireHook('action:user.loggedIn', uid);
		callback();
	});
};

authenticationController.localLogin = function (req, username, password, next) {
	if (!username) {
		return next(new Error('[[error:invalid-username]]'));
	}

	var userslug = utils.slugify(username);
	var uid, userData = {};

	async.waterfall([
		function (next) {
			user.isPasswordValid(password, next);
		},
		function (next) {
			user.getUidByUserslug(userslug, next);
		},
		function (_uid, next) {
			if (!_uid) {
				return next(new Error('[[error:no-user]]'));
			}
			uid = _uid;
			user.auth.logAttempt(uid, req.ip, next);
		},
		function (next) {
			async.parallel({
				userData: function (next) {
					db.getObjectFields('user:' + uid, ['password', 'passwordExpiry'], next);
				},
				isAdmin: function (next) {
					user.isAdministrator(uid, next);
				},
				banned: function (next) {
					user.isBanned(uid, next);
				}
			}, next);
		},
		function (result, next) {
			userData = result.userData;
			userData.uid = uid;
			userData.isAdmin = result.isAdmin;

			if (!result.isAdmin && parseInt(meta.config.allowLocalLogin, 10) === 0) {
				return next(new Error('[[error:local-login-disabled]]'));
			}
			if (!userData || !userData.password) {
				return next(new Error('[[error:invalid-user-data]]'));
			}
			if (result.banned) {
				// Retrieve ban reason and show error
				return user.getLatestBanInfo(uid, function (err, banInfo) {
					if (err) {
						if (err.message === 'no-ban-info') {
							next(new Error('[[error:user-banned]]'));
						} else {
							next(err);
						}
					} else if (banInfo.reason) {
						next(new Error('[[error:user-banned-reason, ' + banInfo.reason + ']]'));
					} else {
						next(new Error('[[error:user-banned]]'));
					}
				});
			}

			Password.compare(password, userData.password, next);
		},
		function (passwordMatch, next) {
			if (!passwordMatch) {
				return next(new Error('[[error:invalid-password]]'));
			}
			user.auth.clearLoginAttempts(uid);
			next(null, userData, '[[success:authentication-successful]]');
		}
	], next);
};

authenticationController.logout = function (req, res, next) {
	if (req.user && parseInt(req.user.uid, 10) > 0 && req.sessionID) {
		var uid = parseInt(req.user.uid, 10);
		var sessionID = req.sessionID;

		user.auth.revokeSession(sessionID, uid, function (err) {
			if (err) {
				return next(err);
			}
			req.logout();
			req.session.destroy();

			user.setUserField(uid, 'lastonline', Date.now() - 300000);

			plugins.fireHook('static:user.loggedOut', {req: req, res: res, uid: uid}, function () {
				res.status(200).send('');

				// Force session check for all connected socket.io clients with the same session id
				sockets.in('sess_' + sessionID).emit('checkSession', 0);
			});
		});
	} else {
		res.status(200).send('');
	}
};


module.exports = authenticationController;

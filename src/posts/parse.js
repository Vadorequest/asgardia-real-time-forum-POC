'use strict';

var nconf = require('nconf');
var url = require('url');
var winston = require('winston');
var S = require('string');

var meta = require('../meta');
var cache = require('./cache');
var plugins = require('../plugins');
var translator = require('../../public/src/modules/translator');

var urlRegex = /href="([^"]+)"/g;

module.exports = function (Posts) {

	Posts.parsePost = function (postData, callback) {
		postData.content = postData.content || '';

		if (postData.pid && cache.has(String(postData.pid))) {
			postData.content = cache.get(String(postData.pid));
			return callback(null, postData);
		}

		// Casting post content into a string, just in case
		if (typeof postData.content !== 'string') {
			postData.content = postData.content.toString();
		}

		plugins.fireHook('filter:parse.post', {postData: postData}, function (err, data) {
			if (err) {
				return callback(err);
			}

			data.postData.content = translator.escape(data.postData.content);

			if (global.env === 'production' && data.postData.pid) {
				cache.set(String(data.postData.pid), data.postData.content);
			}

			callback(null, data.postData);
		});
	};

	Posts.parseSignature = function (userData, uid, callback) {
		userData.signature = sanitizeSignature(userData.signature || '');
		plugins.fireHook('filter:parse.signature', {userData: userData, uid: uid}, callback);
	};

	Posts.relativeToAbsolute = function (content) {
		// Turns relative links in post body to absolute urls
		var parsed, current, absolute;

		while ((current = urlRegex.exec(content)) !== null) {
			if (current[1]) {
				try {
					parsed = url.parse(current[1]);
					if (!parsed.protocol) {
						if (current[1].startsWith('/')) {
							// Internal link
							absolute = nconf.get('url') + current[1];
						} else {
							// External link
							absolute = '//' + current[1];
						}

						content = content.slice(0, current.index + 6) + absolute + content.slice(current.index + 6 + current[1].length);
					}
				} catch(err) {
					winston.verbose(err.messsage);
				}
			}
		}

		return content;
	};

	function sanitizeSignature(signature) {
		var	string = S(signature),
			tagsToStrip = [];

		if (parseInt(meta.config['signatures:disableLinks'], 10) === 1) {
			tagsToStrip.push('a');
		}

		if (parseInt(meta.config['signatures:disableImages'], 10) === 1) {
			tagsToStrip.push('img');
		}

		return tagsToStrip.length ? string.stripTags.apply(string, tagsToStrip).s : signature;
	}
};

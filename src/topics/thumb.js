
'use strict';

var async = require('async');
var nconf = require('nconf');
var winston = require('winston');
var path = require('path');
var fs = require('fs');
var request = require('request');
var mime = require('mime');
var validator = require('validator');

var meta = require('../meta');
var image = require('../image');
var file = require('../file');
var plugins = require('../plugins');

module.exports = function (Topics) {

	Topics.resizeAndUploadThumb = function (data, callback) {
		if (!data.thumb || !validator.isURL(data.thumb)) {
			return callback();
		}

		var pathToUpload;
		var filename;

		async.waterfall([
			function (next) {
				request.head(data.thumb, next);
			},
			function (res, body, next) {

				var type = res.headers['content-type'];
				if (!type.match(/image./)) {
					return next(new Error('[[error:invalid-file]]'));
				}

				var extension = path.extname(data.thumb);
				if (!extension) {
					extension = '.' + mime.extension(type);
				}
				filename = Date.now() + '-topic-thumb' + extension;
				pathToUpload = path.join(nconf.get('base_dir'), nconf.get('upload_path'), 'files', filename);

				request(data.thumb).pipe(fs.createWriteStream(pathToUpload)).on('close', next);
			},
			function (next) {
				file.isFileTypeAllowed(pathToUpload, next);
			},
			function (next) {
				var size = parseInt(meta.config.topicThumbSize, 10) || 120;
				image.resizeImage({
					path: pathToUpload,
					extension: path.extname(pathToUpload),
					width: size,
					height: size
				}, next);
			},
			function (next) {
				if (!plugins.hasListeners('filter:uploadImage')) {
					data.thumb = path.join(nconf.get('upload_url'), 'files', filename);
					return callback();
				}

				plugins.fireHook('filter:uploadImage', {image: {path: pathToUpload, name: ''}, uid: data.uid}, next);
			},
			function (uploadedFile, next) {
				deleteFile(pathToUpload);
				data.thumb = uploadedFile.url;
				next();
			}
		], function (err) {
			if (err) {
				deleteFile(pathToUpload);
			}
			callback(err);
		});
	};

	function deleteFile(path) {
		if (path) {
			fs.unlink(path, function (err) {
				if (err) {
					winston.error(err);
				}
			});
		}
	}

};

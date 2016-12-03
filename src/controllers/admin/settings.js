'use strict';


var async = require('async');
var meta = require('../../meta');

var settingsController = module.exports;

settingsController.get = function (req, res, next) {
	var term = req.params.term ? req.params.term : 'general';

	switch (req.params.term) {
		case 'email':
			renderEmail(req, res, next);
			break;

		default:
			res.render('admin/settings/' + term);
	}
};


function renderEmail(req, res, next) {
	var fs = require('fs');
	var path = require('path');
	var utils = require('../../../public/src/utils');

	var emailsPath = path.join(__dirname, '../../../public/templates/emails');

	async.waterfall([
		function (next) {
			utils.walk(emailsPath, next);
		},
		function (emails, next) {
			async.map(emails, function (email, next) {
				var path = email.replace(emailsPath, '').substr(1).replace('.tpl', '');

				fs.readFile(email, function (err, original) {
					if (err) {
						return next(err);
					}

					var text = meta.config['email:custom:' + path] ? meta.config['email:custom:' + path] : original.toString();

					next(null, {
						path: path,
						fullpath: email,
						text: text,
						original: original.toString()
					});
				});
			}, next);
		}
	], function (err, emails) {
		if (err) {
			return next(err);
		}

		res.render('admin/settings/email', {
			emails: emails,
			sendable: emails.filter(function (email) {
				return email.path.indexOf('_plaintext') === -1 && email.path.indexOf('partials') === -1;
			})
		});
	});
}

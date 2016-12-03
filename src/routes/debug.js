"use strict";

var express = require('express');
var nconf = require('nconf');
var winston = require('winston');
var user = require('../user');
var categories = require('../categories');
var topics = require('../topics');
var posts = require('../posts');
var db = require('../database');

module.exports = function (app, middleware, controllers) {
	var router = express.Router();

	router.get('/uid/:uid', function (req, res) {
		if (!req.params.uid) {
			return res.redirect('/404');
		}

		user.getUserData(req.params.uid, function (err, data) {
			if (err) {
				winston.error(err);
			}

			if (data) {
				res.send(data);
			} else {
				res.status(404).json({
					error: "User doesn't exist!"
				});
			}
		});
	});

	router.get('/cid/:cid', function (req, res) {
		categories.getCategoryData(req.params.cid, function (err, data) {
			if (err) {
				winston.error(err);
			}

			if (data) {
				res.send(data);
			} else {
				res.status(404).send("Category doesn't exist!");
			}
		});
	});

	router.get('/tid/:tid', function (req, res) {
		topics.getTopicData(req.params.tid, function (err, data) {
			if (err) {
				winston.error(err);
			}

			if (data) {
				res.send(data);
			} else {
				res.status(404).send("Topic doesn't exist!");
			}
		});
	});

	router.get('/pid/:pid', function (req, res) {
		posts.getPostData(req.params.pid, function (err, data) {
			if (err) {
				winston.error(err);
			}

			if (data) {
				res.send(data);
			} else {
				res.status(404).send("Post doesn't exist!");
			}
		});
	});

	router.get('/test', function (req, res) {
		res.redirect(404);
	});

	app.use(nconf.get('relative_path') + '/debug', router);
};

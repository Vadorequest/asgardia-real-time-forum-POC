'use strict';
/*global require, after, before*/


var async = require('async');
var assert = require('assert');
var nconf = require('nconf');
var request = require('request');

var db = require('./mocks/databasemock');
var Categories = require('../src/categories');
var Topics = require('../src/topics');
var User = require('../src/user');
var groups = require('../src/groups');

describe('Categories', function () {
	var categoryObj;
	var posterUid;
	var adminUid;

	before(function (done) {
		groups.resetCache();
		async.parallel({
			posterUid: function (next) {
				User.create({username: 'poster'}, next);
			},
			adminUid: function (next) {
				User.create({username: 'admin'}, next);
			}
		}, function (err, results) {
			assert.ifError(err);
			posterUid = results.posterUid;
			adminUid = results.adminUid;
			groups.join('administrators', adminUid, done);
		});
	});


	it('should create a new category', function (done) {

		Categories.create({
			name: 'Test Category',
			description: 'Test category created by testing script',
			icon: 'fa-check',
			blockclass: 'category-blue',
			order: '5'
		}, function (err, category) {
			assert.ifError(err);

			categoryObj = category;
			done();
		});
	});

	it('should retrieve a newly created category by its ID', function (done) {
		Categories.getCategoryById({
			cid: categoryObj.cid,
			set: 'cid:' + categoryObj.cid + ':tids',
			reverse: true,
			start: 0,
			stop: -1,
			uid: 0
		}, function (err, categoryData) {
			assert.equal(err, null);

			assert(categoryData);
			assert.equal(categoryObj.name, categoryData.name);
			assert.equal(categoryObj.description, categoryData.description);

			done();
		});
	});


	it('should load a category route', function (done) {
		request(nconf.get('url') + '/category/' + categoryObj.cid + '/test-category', function (err, response, body) {
			assert.ifError(err);
			assert.equal(response.statusCode, 200);
			assert(body);
			done();
		});
	});

	describe('Categories.getRecentTopicReplies', function () {
		it('should not throw', function (done) {
			Categories.getCategoryById({
				cid: categoryObj.cid,
				set: 'cid:' + categoryObj.cid + ':tids',
				reverse: true,
				start: 0,
				stop: -1,
				uid: 0
			}, function (err, categoryData) {
				assert.ifError(err);
				Categories.getRecentTopicReplies(categoryData, 0, function (err) {
					assert.ifError(err);
					done();
				});
			});
		});
	});

	describe('.getCategoryTopics', function () {
		it('should return a list of topics', function (done) {
			Categories.getCategoryTopics({
				cid: categoryObj.cid,
				set: 'cid:' + categoryObj.cid + ':tids',
				reverse: true,
				start: 0,
				stop: 10,
				uid: 0
			}, function (err, result) {
				assert.equal(err, null);

				assert(Array.isArray(result.topics));
				assert(result.topics.every(function (topic) {
					return topic instanceof Object;
				}));

				done();
			});
		});

		it('should return a list of topics by a specific user', function (done) {
			Categories.getCategoryTopics({
				cid: categoryObj.cid,
				set: 'cid:' + categoryObj.cid + ':uid:' + 1 + ':tids',
				reverse: true,
				start: 0,
				stop: 10,
				uid: 0,
				targetUid: 1
			}, function (err, result) {
				assert.equal(err, null);
				assert(Array.isArray(result.topics));
				assert(result.topics.every(function (topic) {
					return topic instanceof Object && topic.uid === '1';
				}));

				done();
			});
		});
	});

	describe('Categories.moveRecentReplies', function () {
		var moveCid;
		var moveTid;
		before(function (done) {
			async.parallel({
				category: function (next) {
					Categories.create({
						name: 'Test Category 2',
						description: 'Test category created by testing script'
					}, next);
				},
				topic: function (next) {
					Topics.post({
						uid: posterUid,
						cid: categoryObj.cid,
						title: 'Test Topic Title',
						content: 'The content of test topic'
					}, next);
				}
			}, function (err, results) {
				if (err) {
					return done(err);
				}
				moveCid = results.category.cid;
				moveTid = results.topic.topicData.tid;
				Topics.reply({uid: posterUid, content: 'test post', tid: moveTid}, function (err) {
					done(err);
				});
			});
		});

		it('should move posts from one category to another', function (done) {
			Categories.moveRecentReplies(moveTid, categoryObj.cid, moveCid, function (err) {
				assert.ifError(err);
				db.getSortedSetRange('cid:' + categoryObj.cid + ':pids', 0, -1, function (err, pids) {
					assert.ifError(err);
					assert.equal(pids.length, 0);
					db.getSortedSetRange('cid:' + moveCid + ':pids', 0, -1, function (err, pids) {
						assert.ifError(err);
						assert.equal(pids.length, 2);
						done();
					});
				});
			});
		});
	});

	describe('socket methods', function () {
		var socketCategories = require('../src/socket.io/categories');

		before(function (done) {
			Topics.post({
				uid: posterUid,
				cid: categoryObj.cid,
				title: 'Test Topic Title',
				content: 'The content of test topic',
				tags: ['nodebb']
			}, done);
		});

		it('should get recent replies in category', function (done) {
			socketCategories.getRecentReplies({uid: posterUid}, categoryObj.cid, function (err, data) {
				assert.ifError(err);
				assert(Array.isArray(data));
				done();
			});
		});

		it('should get categories', function (done) {
			socketCategories.get({uid: posterUid}, {}, function (err, data) {
				assert.ifError(err);
				assert(Array.isArray(data));
				done();
			});
		});

		it('should get watched categories', function (done) {
			socketCategories.getWatchedCategories({uid: posterUid}, {}, function (err, data) {
				assert.ifError(err);
				assert(Array.isArray(data));
				done();
			});
		});

		it('should load more topics', function (done) {
			socketCategories.loadMore({uid: posterUid}, {cid: categoryObj.cid, after: 0, author: 'poster', tag: 'nodebb'}, function (err, data) {
				assert.ifError(err);
				assert(Array.isArray(data.topics));
				assert.equal(data.topics[0].user.username, 'poster');
				assert.equal(data.topics[0].tags[0].value, 'nodebb');
				assert.equal(data.topics[0].category.cid, categoryObj.cid);
				done();
			});
		});

		it('should load page count', function (done) {
			socketCategories.getPageCount({uid: posterUid}, categoryObj.cid, function (err, pageCount) {
				assert.ifError(err);
				assert.equal(pageCount, 1);
				done();
			});
		});

		it('should load page count', function (done) {
			socketCategories.getTopicCount({uid: posterUid}, categoryObj.cid, function (err, topicCount) {
				assert.ifError(err);
				assert.equal(topicCount, 2);
				done();
			});
		});

		it('should load category by privilege', function (done) {
			socketCategories.getCategoriesByPrivilege({uid: posterUid}, 'find', function (err, data) {
				assert.ifError(err);
				assert(Array.isArray(data));
				done();
			});
		});

		it('should get move categories', function (done) {
			socketCategories.getMoveCategories({uid: posterUid}, {}, function (err, data) {
				assert.ifError(err);
				assert(Array.isArray(data));
				done();
			});
		});

		it('should ignore category', function (done) {
			socketCategories.ignore({uid: posterUid}, categoryObj.cid, function (err) {
				assert.ifError(err);
				Categories.isIgnored([categoryObj.cid], posterUid, function (err, isIgnored) {
					assert.ifError(err);
					assert.equal(isIgnored[0], true);
					done();
				});
			});
		});

		it('should watch category', function (done) {
			socketCategories.watch({uid: posterUid}, categoryObj.cid, function (err) {
				assert.ifError(err);
				Categories.isIgnored([categoryObj.cid], posterUid, function (err, isIgnored) {
					assert.ifError(err);
					assert.equal(isIgnored[0], false);
					done();
				});
			});
		});

		it('should check if user is moderator', function (done) {
			socketCategories.isModerator({uid: posterUid}, {}, function (err, isModerator) {
				assert.ifError(err);
				assert(!isModerator);
				done();
			});
		});

		it('should get category data' , function (done) {
			socketCategories.getCategory({uid: posterUid}, categoryObj.cid, function (err, data) {
				assert.ifError(err);
				assert.equal(categoryObj.cid, data.cid);
				done();
			});
		});
	});

	describe('admin socket methods', function () {
		var socketCategories = require('../src/socket.io/admin/categories');
		var cid;
		before(function (done) {
			Categories.create({
				name: 'update name',
				description: 'update description',
				parentCid: categoryObj.cid,
				icon: 'fa-check',
				order: '5'
			}, function (err, category) {
				assert.ifError(err);

				cid = category.cid;
				done();
			});
		});

		it('should return error with invalid data', function (done) {
			socketCategories.update({uid: adminUid}, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should error if you try to set parent as self', function (done) {
			var updateData = {};
			updateData[cid] = {
				parentCid: cid
			};
			socketCategories.update({uid: adminUid}, updateData, function (err) {
				assert.equal(err.message, '[[error:cant-set-self-as-parent]]');
				done();
			});
		});

		it('should update category data', function (done) {
			var updateData = {};
			updateData[cid] = {
				name: 'new name',
				description: 'new description',
				parentCid: 0,
				order: 3,
				icon: 'fa-hammer'
			};
			socketCategories.update({uid: adminUid}, updateData, function (err) {
				assert.ifError(err);
				Categories.getCategoryData(cid, function (err, data) {
					assert.ifError(err);
					assert.equal(data.name, updateData[cid].name);
					assert.equal(data.description, updateData[cid].description);
					assert.equal(data.parentCid, updateData[cid].parentCid);
					assert.equal(data.order, updateData[cid].order);
					assert.equal(data.icon, updateData[cid].icon);
					done();
				});
			});
		});

		it('should purge category', function (done) {
			Categories.create({
				name: 'purge me',
				description: 'update description'
			}, function (err, category) {
				assert.ifError(err);
				Topics.post({
					uid: posterUid,
					cid: category.cid,
					title: 'Test Topic Title',
					content: 'The content of test topic'
				}, function (err) {
					assert.ifError(err);
					socketCategories.purge({uid: adminUid}, category.cid, function (err) {
						assert.ifError(err);
						done();
					});
				});

			});
		});
	});




	after(function (done) {
		db.emptydb(done);
	});
});

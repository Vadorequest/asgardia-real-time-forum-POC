'use strict';

(function (module) {
	var fork = require('child_process').fork;

	module.hash = function (rounds, password, callback) {
		forkChild({type: 'hash', rounds: rounds, password: password}, callback);
	};

	module.compare = function (password, hash, callback) {
		forkChild({type: 'compare', password: password, hash: hash}, callback);
	};

	function forkChild(message, callback) {
		var forkProcessParams = {};
		if(global.v8debug || parseInt(process.execArgv.indexOf('--debug'), 10) !== -1) {
			forkProcessParams = {execArgv: ['--debug=' + (5859), '--nolazy']};
		}
		var child = fork('./bcrypt', [], forkProcessParams);

		child.on('message', function (msg) {
			if (msg.err) {
				return callback(new Error(msg.err));
			}

			callback(null, msg.result);
		});

		child.send(message);
	}

	return module;
}(exports));
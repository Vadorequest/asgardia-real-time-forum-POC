"use strict";
/* global define, app, config, RELATIVE_PATH */

define('forum/login', ['translator'], function (translator) {
	var	Login = {};

	Login.init = function () {
		var errorEl = $('#login-error-notify'),
			submitEl = $('#login'),
			formEl = $('#login-form');

		submitEl.on('click', function (e) {
			e.preventDefault();

			if (!$('#username').val() || !$('#password').val()) {
				errorEl.find('p').translateText('[[error:invalid-username-or-password]]');
				errorEl.show();
			} else {
				errorEl.hide();

				if (submitEl.hasClass('disabled')) {
					return;
				}

				submitEl.addClass('disabled');

				/*
					Set session refresh flag (otherwise the session check will trip and throw invalid session modal)
					We know the session is/will be invalid (uid mismatch) because the user is attempting a login
				*/
				app.flags = app.flags || {};
				app.flags._sessionRefresh = true;

				formEl.ajaxSubmit({
					headers: {
						'x-csrf-token': config.csrf_token
					},
					success: function (data, status) {
						window.location.href = data + '?loggedin';
					},
					error: function (data, status) {
						if (data.status === 403 && data.responseText === 'Forbidden') {
							window.location.href = config.relative_path + '/login?error=csrf-invalid';
						} else {
							errorEl.find('p').translateText(data.responseText);
							errorEl.show();
							submitEl.removeClass('disabled');
							app.flags._sessionRefresh = false;

							// Select the entire password if that field has focus
							if ($('#password:focus').size()) {
								$('#password').select();
							}
						}
					}
				});
			}
		});

		$('#login-error-notify button').on('click', function (e) {
			e.preventDefault();
			errorEl.hide();
			return false;
		});

		if ($('#content #username').attr('readonly')) {
			$('#content #password').val('').focus();
		} else {
			$('#content #username').focus();
		}
	};

	return Login;
});

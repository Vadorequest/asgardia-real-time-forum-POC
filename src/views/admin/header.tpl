<!DOCTYPE html>
<html>
	<head>
		<title>{title}</title>
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
	
		<link rel="stylesheet" type="text/css" href="{relative_path}/admin.css?{cache-buster}" />
		<link rel="stylesheet" type="text/css" href="{relative_path}/vendor/mdl/mdl.min.css?{cache-buster}" />
		<link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons">
	
		<script>
			var RELATIVE_PATH = "{relative_path}";
			var config = JSON.parse('{{configJSON}}');
			var app = {
				template: "{template.name}",
				user: JSON.parse('{{userJSON}}'),
				config: JSON.parse(decodeURIComponent("{{adminConfigJSON}}")),
				flags: {},
				inAdmin: true
			};
		</script>

		<script src="https://storage.googleapis.com/code.getmdl.io/1.0.3/material.min.js"></script>
		<script type="text/javascript" src="{relative_path}/vendor/jquery/sortable/Sortable.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/acp.min.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/vendor/colorpicker/colorpicker.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/src/admin/admin.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/vendor/ace/ace.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/vendor/semver/semver.browser.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/vendor/jquery/serializeObject/jquery.ba-serializeobject.min.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/vendor/jquery/deserialize/jquery.deserialize.min.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/vendor/snackbar/snackbar.min.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/vendor/slideout/slideout.min.js?{cache-buster}"></script>
		<script type="text/javascript" src="{relative_path}/vendor/nprogress.min.js?{cache-buster}"></script>

		<!-- BEGIN scripts -->
		<script type="text/javascript" src="{scripts.src}"></script>
		<!-- END scripts -->
	</head>

	<body class="admin {bodyClass}">
		<!-- IMPORT admin/partials/menu.tpl -->
		<div class="container" id="content">
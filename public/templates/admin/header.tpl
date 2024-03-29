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
<nav id="menu" class="visible-xs visible-sm">
	<section class="menu-section">
		<h3 class="menu-section-title">General</h3>
		<ul class="menu-section-list">
			<a href="{relative_path}/admin/general/dashboard">Dashboard</a>
			<li><a href="{relative_path}/admin/general/homepage">Home Page</a></li>
			<li><a href="{relative_path}/admin/general/navigation">Navigation</a></li>
			<li><a href="{relative_path}/admin/general/languages">Languages</a></li>
			<li><a href="{relative_path}/admin/general/sounds">Sounds</a></li>
			<li><a href="{relative_path}/admin/general/social">Social</a></li>
		</ul>
	</section>

	<section class="menu-section">
		<h3 class="menu-section-title">Manage</h3>
		<ul class="menu-section-list">
			<li><a href="{relative_path}/admin/manage/categories">Categories</a></li>
			<li><a href="{relative_path}/admin/manage/tags">Tags</a></li>
			<li><a href="{relative_path}/admin/manage/users">Users</a></li>
			<li><a href="{relative_path}/admin/manage/registration">Registration Queue</a></li>
			<li><a href="{relative_path}/admin/manage/groups">Groups</a></li>
			<li><a href="{relative_path}/admin/manage/flags">Flags</a></li>
			<li><a href="{relative_path}/admin/manage/ip-blacklist">IP Blacklist</a></li>
		</ul>
	</section>

	<section class="menu-section">
		<h3 class="menu-section-title">Settings</h3>
		<ul class="menu-section-list">
			<li><a href="{relative_path}/admin/settings/general">General</a></li>
			<li><a href="{relative_path}/admin/settings/reputation">Reputation</a></li>
			<li><a href="{relative_path}/admin/settings/email">Email</a></li>
			<li><a href="{relative_path}/admin/settings/user">User</a></li>
			<li><a href="{relative_path}/admin/settings/group">Group</a></li>
			<li><a href="{relative_path}/admin/settings/guest">Guests</a></li>
			<li><a href="{relative_path}/admin/settings/uploads">Uploads</a></li>
			<li><a href="{relative_path}/admin/settings/post">Post</a></li>
			<li><a href="{relative_path}/admin/settings/chat">Chat</a></li>
			<li><a href="{relative_path}/admin/settings/pagination">Pagination</a></li>
			<li><a href="{relative_path}/admin/settings/tags">Tags</a></li>
			<li><a href="{relative_path}/admin/settings/notifications">Notifications</a></li>
			<li><a href="{relative_path}/admin/settings/cookies">Cookies</a></li>
			<li><a href="{relative_path}/admin/settings/web-crawler">Web Crawler</a></li>
			<li><a href="{relative_path}/admin/settings/sockets">Sockets</a></li>
			<li><a href="{relative_path}/admin/settings/advanced">Advanced</a></li>
		</ul>
	</section>

	<section class="menu-section">
		<h3 class="menu-section-title">Appearance</h3>
		<ul class="menu-section-list">
			<li><a href="{relative_path}/admin/appearance/themes">Themes</a></li>
			<li><a href="{relative_path}/admin/appearance/skins">Skins</a></li>
			<li><a href="{relative_path}/admin/appearance/customise">Custom HTML &amp; CSS</a></li>
		</ul>
	</section>

	<section class="menu-section">
		<h3 class="menu-section-title">Extend</h3>
		<ul class="menu-section-list">
			<li><a href="{relative_path}/admin/extend/plugins">Plugins</a></li>
			<li><a href="{relative_path}/admin/extend/widgets">Widgets</a></li>
			<li><a href="{relative_path}/admin/extend/rewards">Rewards</a></li>
		</ul>
	</section>

	<!-- IF authentication.length -->
	<section class="menu-section">
		<h3 class="menu-section-title">Social Authentication</h3>
		<ul class="menu-section-list">
			<!-- BEGIN authentication -->
			<li>
				<a href="{relative_path}/admin{authentication.route}">{authentication.name}</a>
			</li>
			<!-- END authentication -->
		</ul>
	</section>
	<!-- ENDIF authentication.length -->

	<!-- IF plugins.length -->
	<section class="menu-section">
		<h3 class="menu-section-title">Plugins</h3>
		<ul class="menu-section-list">
			<!-- BEGIN plugins -->
			<li>
				<a href="{relative_path}/admin{plugins.route}">{plugins.name}</a>
			</li>
			<!-- END plugins -->
		</ul>
	</section>
	<!-- ENDIF plugins.length -->

	<section class="menu-section">
		<h3 class="menu-section-title">Advanced</h3>
		<ul class="menu-section-list">
			<li><a href="{relative_path}/admin/advanced/database">Database</a></li>
			<li><a href="{relative_path}/admin/advanced/events">Events</a></li>
			<li><a href="{relative_path}/admin/advanced/logs">Logs</a></li>
			<li><a href="{relative_path}/admin/advanced/errors">Errors</a></li>
			<li><a href="{relative_path}/admin/advanced/cache">Cache</a></li>
			<!-- IF env -->
			<li><a href="{relative_path}/admin/development/logger">Logger</a></li>
			<!-- ENDIF env -->
		</ul>
	</section>
</nav>

<main id="panel">
	<nav class="header" id="header">
		<div class="pull-left">
			<div id="mobile-menu">
				<div class="bar"></div>
				<div class="bar"></div>
				<div class="bar"></div>
			</div>
			<h1 id="main-page-title"></h1>
		</div>

		<ul id="user_label" class="pull-right">
			<li class="dropdown pull-right">
				<a class="dropdown-toggle" data-toggle="dropdown" href="#" id="user_dropdown">
					<i class="fa fa-fw fa-ellipsis-v"></i>
				</a>
				<ul id="user-control-list" class="dropdown-menu" aria-labelledby="user_dropdown">
					<li>
						<a href="#" class="reload" title="Reload Forum">
							Reload Forum
						</a>
					</li>
					<li>
						<a href="#" class="restart" title="Restart Forum">
							Restart Forum
						</a>
					</li>
					<li role="presentation" class="divider"></li>
					<li component="logout">
						<a href="#">Log out</a>
					</li>
				</ul>
			</li>

			<li class="pull-right">
				<a href="{config.relative_path}/">
					<i class="fa fa-fw fa-home" title="View Forum"></i>
				</a>
			</li>

			<form class="pull-right hidden-sm hidden-xs" role="search">
				<div class="" id="acp-search" >
					<div class="dropdown">
						<input type="text" data-toggle="dropdown" class="form-control" placeholder="Search...">
						<ul class="dropdown-menu dropdown-menu-right" role="menu"></ul>
					</div>
				</div>
			</form>
		</ul>
		<ul id="main-menu">
			<li class="menu-item">
				<a href="{relative_path}/admin/general/dashboard">Dashboard</a>
			</li>
			<li class="dropdown menu-item">
				<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">General</a>
				<ul class="dropdown-menu" role="menu">
					<li><a href="{relative_path}/admin/general/homepage">Home Page</a></li>
					<li><a href="{relative_path}/admin/general/navigation">Navigation</a></li>
					<li><a href="{relative_path}/admin/general/languages">Languages</a></li>
					<li><a href="{relative_path}/admin/general/sounds">Sounds</a></li>
					<li><a href="{relative_path}/admin/general/social">Social</a></li>
				</ul>
			</li>
			<li class="dropdown menu-item">
				<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">Manage</a>
				<ul class="dropdown-menu" role="menu">
					<li><a href="{relative_path}/admin/manage/categories">Categories</a></li>
					<li><a href="{relative_path}/admin/manage/tags">Tags</a></li>
					<li><a href="{relative_path}/admin/manage/users">Users</a></li>
					<li><a href="{relative_path}/admin/manage/registration">Registration Queue</a></li>
					<li><a href="{relative_path}/admin/manage/groups">Groups</a></li>
					<li><a href="{relative_path}/admin/manage/flags">Flags</a></li>
					<li><a href="{relative_path}/admin/manage/ip-blacklist">IP Blacklist</a></li>
				</ul>
			</li>
			<li class="dropdown menu-item">
				<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">Settings</a>
				<ul class="dropdown-menu" role="menu">
					<li><a href="{relative_path}/admin/settings/general">General</a></li>
					<li><a href="{relative_path}/admin/settings/reputation">Reputation</a></li>
					<li><a href="{relative_path}/admin/settings/email">Email</a></li>
					<li><a href="{relative_path}/admin/settings/user">User</a></li>
					<li><a href="{relative_path}/admin/settings/group">Group</a></li>
					<li><a href="{relative_path}/admin/settings/guest">Guests</a></li>
					<li><a href="{relative_path}/admin/settings/uploads">Uploads</a></li>
					<li><a href="{relative_path}/admin/settings/post">Post</a></li>
					<li><a href="{relative_path}/admin/settings/chat">Chat</a></li>
					<li><a href="{relative_path}/admin/settings/pagination">Pagination</a></li>
					<li><a href="{relative_path}/admin/settings/tags">Tags</a></li>
					<li><a href="{relative_path}/admin/settings/notifications">Notifications</a></li>
					<li><a href="{relative_path}/admin/settings/cookies">Cookies</a></li>
					<li><a href="{relative_path}/admin/settings/web-crawler">Web Crawler</a></li>
					<li><a href="{relative_path}/admin/settings/sockets">Sockets</a></li>
					<li><a href="{relative_path}/admin/settings/advanced">Advanced</a></li>
				</ul>
			</li>
			<li class="dropdown menu-item">
				<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">Appearance</a>
				<ul class="dropdown-menu" role="menu">
					<li><a href="{relative_path}/admin/appearance/themes">Themes</a></li>
					<li><a href="{relative_path}/admin/appearance/skins">Skins</a></li>
					<li><a href="{relative_path}/admin/appearance/customise">Custom HTML &amp; CSS</a></li>
				</ul>
			</li>
			<li class="dropdown menu-item">
				<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">Extend</a>
				<ul class="dropdown-menu" role="menu">
					<li><a href="{relative_path}/admin/extend/plugins">Plugins</a></li>
					<li><a href="{relative_path}/admin/extend/widgets">Widgets</a></li>
					<li><a href="{relative_path}/admin/extend/rewards">Rewards</a></li>
				</ul>
			</li>
			<!-- IF authentication.length -->
			<li class="dropdown menu-item">
				<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">Social Authentication</a>
				<ul class="dropdown-menu" role="menu">
					<!-- BEGIN authentication -->
					<li>
						<a href="{relative_path}/admin{authentication.route}">{authentication.name}</a>
					</li>
					<!-- END authentication -->
				</ul>
			</li>
			<!-- ENDIF authentication.length -->
			<!-- IF plugins.length -->
			<li class="dropdown menu-item">
				<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">Plugins</a>
				<ul class="dropdown-menu" role="menu">
					<!-- BEGIN plugins -->
					<li>
						<a href="{relative_path}/admin{plugins.route}">{plugins.name}</a>
					</li>
					<!-- END plugins -->
					<li class="divider"></li>
					<li data-link="1">
						<a href="{relative_path}/admin/extend/plugins">Install Plugins</a>
					</li>
				</ul>
			</li>
			<!-- ENDIF plugins.length -->
			<li class="dropdown menu-item">
				<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false">Advanced</a>
				<ul class="dropdown-menu" role="menu">
					<li><a href="{relative_path}/admin/advanced/database">Database</a></li>
					<li><a href="{relative_path}/admin/advanced/events">Events</a></li>
					<li><a href="{relative_path}/admin/advanced/logs">Logs</a></li>
					<li><a href="{relative_path}/admin/advanced/errors">Errors</a></li>
					<li><a href="{relative_path}/admin/advanced/cache">Cache</a></li>
					<!-- IF env -->
					<li><a href="{relative_path}/admin/development/logger">Logger</a></li>
					<!-- ENDIF env -->
				</ul>
			</li>
		</ul>

		<ul class="nav navbar-nav navbar-right hidden-xs reconnect-spinner">
			<li>
				<a href="#" id="reconnect" class="hide" title="Connection to {title} has been lost, attempting to reconnect...">
					<i class="fa fa-check"></i>
				</a>
			</li>
		</ul>
	</nav>
		<div class="container" id="content">
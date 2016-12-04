<ul class="nav nav-pills">
	<li class="active"><a href="#installed" data-toggle="tab">Installed</a></li>
	<li><a href="#active" data-toggle="tab">Active</a></li>
	<li><a href="#deactive" data-toggle="tab">Inactive</a></li>
	<li><a href="#upgrade" data-toggle="tab">
		Out of Date
		<span class="badge">{upgradeCount}</span>
	</a></li>
	<li><a href="#download" data-toggle="tab">Find Plugins</a></li>
</ul>
<br />

<div class="plugins row">
	<div class="col-lg-9">
		<div class="tab-content">
			<div class="tab-pane fade active in" id="installed">
				<ul class="installed">
					<!-- BEGIN installed -->
					<!-- IF !installed.error -->
					<li id="{installed.id}" data-plugin-id="{installed.id}" data-version="{installed.version}" class="clearfix <!-- IF installed.active -->active<!-- ENDIF installed.active -->">
						<div class="pull-right">
							<!-- IF installed.isTheme -->
							<a href="{config.relative_path}/admin/appearance/themes" class="btn btn-info">Themes</a>
							<!-- ELSE -->
							<button data-action="toggleActive" class="btn <!-- IF installed.active --> btn-warning<!-- ELSE --> btn-success<!-- ENDIF installed.active -->"><i class="fa fa-power-off"></i> <!-- IF installed.active -->Deactivate<!-- ELSE -->Activate<!-- ENDIF installed.active --></button>
							<!-- ENDIF installed.isTheme -->

							<button data-action="toggleInstall" data-installed="1" class="btn btn-danger"><i class="fa fa-trash-o"></i> Uninstall</button>
						</div>

						<h2><strong>{installed.name}</strong></h2>

						<!-- IF installed.description -->
						<p>{installed.description}</p>
						<!-- ENDIF installed.description -->
						<!-- IF installed.outdated --><i class="fa fa-exclamation-triangle text-danger"></i> <!-- ENDIF installed.outdated --><small>Installed <strong class="currentVersion">{installed.version}</strong> | Latest <strong class="latestVersion">{installed.latest}</strong></small>
						<!-- IF installed.outdated -->
							<button data-action="upgrade" class="btn btn-success btn-xs"><i class="fa fa-download"></i> Upgrade</button>
						<!-- ENDIF installed.outdated -->
						<!-- IF installed.url -->
						<p>For more information: <a target="_blank" href="{installed.url}">{installed.url}</a></p>
						<!-- ENDIF installed.url -->
					</li>
					<!-- ENDIF !installed.error -->
					<!-- IF installed.error -->
					<li data-plugin-id="{installed.id}" class="clearfix">
						<div class="pull-right">
							<button class="btn btn-default disabled"><i class="fa fa-exclamation-triangle"></i> Unknown</button>

							<button data-action="toggleInstall" data-installed="1" class="btn btn-danger"><i class="fa fa-trash-o"></i> Uninstall</button>
						</div>

						<h2><strong>{installed.id}</strong></h2>
						<p>
							The state of this plugin could not be determined, possibly due to a misconfiguration error.
						</p>
					</li>
					<!-- ENDIF installed.error -->

					<!-- END installed -->
				</ul>
			</div>
			<div class="tab-pane fade" id="active">
				<ul class="active"></ul>
			</div>
			<div class="tab-pane fade" id="deactive">
				<ul class="deactive"></ul>
			</div>
			<div class="tab-pane fade" id="upgrade">
				<ul class="upgrade"></ul>
			</div>
			<div class="tab-pane fade" id="download">
				<ul class="download">
					<!-- BEGIN download -->
					<li id="{download.id}" data-plugin-id="{download.id}" class="clearfix">
						<div class="pull-right">
							<button data-action="toggleActive" class="btn btn-success hidden"><i class="fa fa-power-off"></i> Activate</button>
							<button data-action="toggleInstall" data-installed="0" class="btn btn-success"><i class="fa fa-download"></i> Install</button>
						</div>

						<h2><strong>{download.name}</strong></h2>

						<!-- IF download.description -->
						<p>{download.description}</p>
						<!-- ENDIF download.description -->

						<small>Latest <strong class="latestVersion">{download.latest}</strong></small>

						<!-- IF download.url -->
						<p>For more information: <a target="_blank" href="{download.url}">{download.url}</a></p>
						<!-- ENDIF download.url -->
					</li>

					<!-- END download -->
				</ul>
			</div>
		</div>
	</div>

	<div class="col-lg-3 acp-sidebar">
		<div class="panel panel-default">
			<div class="panel-heading">Plugin Search</div>
			<div class="panel-body">
				<input autofocus class="form-control" type="text" id="plugin-search" placeholder="Search for plugin..."/><br/>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading">Re-order Plugins</div>
			<div class="panel-body">
				<button class="btn btn-default btn-block" id="plugin-order"><i class="fa fa-exchange"></i> Order Active Plugins</button>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading">Interested in writing plugins for NodeBB?</div>
			<div class="panel-body">
				<p>
					Full documentation regarding plugin authoring can be found in the <a target="_blank" href="https://docs.nodebb.org/en/latest/plugins/create.html">NodeBB Docs Portal</a>.
				</p>
			</div>
		</div>
	</div>


	<div class="modal fade" id="order-active-plugins-modal">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
					<h4 class="modal-title">Order Active Plugins</h4>
				</div>
				<div class="modal-body">
					<p>
						Certain plugins work ideally when they are initialised before/after other plugins.
					</p>
					<p>
						Plugins load in the order specified here, from top to bottom
					</p>
					<ul class="plugin-list"></ul>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-default" data-dismiss="modal">Close</button>
					<button type="button" class="btn btn-primary" id="save-plugin-order">Save</button>
				</div>
			</div>
		</div>
	</div>


</div>



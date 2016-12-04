<div class="row">
	<form role="form" class="category" data-cid="{category.cid}">
		<ul class="nav nav-pills">
			<li class="active"><a href="#category-settings" data-toggle="tab">Category Settings</a></li>
			<li><a href="#privileges" data-toggle="tab">Privileges</a></li>
		</ul>
		<br />
		<div class="tab-content">
			<div class="tab-pane fade active in row" id="category-settings">
				<div class="col-md-9">
					<div class="category-settings-form">
						<fieldset>
							<label for="cid-{category.cid}-name">Category Name</label>
							<input id="cid-{category.cid}-name" type="text" class="form-control" placeholder="Category Name" data-name="name" value="{category.name}" /><br />

							<label for="cid-{category.cid}-description">Category Description</label>
							<input id="cid-{category.cid}-description" data-name="description" placeholder="Category Description" value="{category.description}" class="form-control category_description description"></input><br />
						</fieldset>

						<fieldset class="row">
							<div class="col-sm-4 col-xs-12">
								<div class="form-group">
									<label for="cid-{category.cid}-bgColor">Background Colour</label>
									<input id="cid-{category.cid}-bgColor" placeholder="#0059b2" data-name="bgColor" value="{category.bgColor}" class="form-control category_bgColor" />
								</div>
							</div>
							<div class="col-sm-4 col-xs-12">
								<div class="form-group">
									<label for="cid-{category.cid}-color">Text Colour</label>
									<input id="cid-{category.cid}-color" placeholder="#fff" data-name="color" value="{category.color}" class="form-control category_color" />
								</div>
							</div>
							<div class="col-sm-4 col-xs-12">
								<div class="form-group">
									<label for="cid-{category.cid}-imageClass">Background Image Size</label>
										<select id="cid-{category.cid}-imageClass" class="form-control" data-name="imageClass" data-value="{category.imageClass}">
										<option value="auto">auto</option>
										<option value="cover">cover</option>
										<option value="contain">contain</option>
									</select>
								</div>
							</div><br />
							<div class="col-sm-4 col-xs-12">
								<div class="form-group">
									<label for="cid-{category.cid}-class">Custom Class</label>
									<input id="cid-{category.cid}-class" type="text" class="form-control" placeholder="col-md-6 col-xs-6" data-name="class" value="{category.class}" />
								</div>
							</div>
							<div class="col-sm-4 col-xs-12">
								<div class="form-group">
									<label for="cid-{category.cid}-numRecentReplies"># of Recent Replies</label>
									<input id="cid-{category.cid}-numRecentReplies" type="text" class="form-control" placeholder="2" data-name="numRecentReplies" value="{category.numRecentReplies}" />
								</div>
							</div>
							<div class="col-sm-4 col-xs-12">
								<div class="form-group">
									<label for="cid-{category.cid}-link">External Link</label>
									<input id="cid-{category.cid}-link" type="text" class="form-control" placeholder="http://domain.com" data-name="link" value="{category.link}" />
								</div>
							</div>
						</fieldset>
					</div>
				</div>

				<div class="col-md-3 options acp-sidebar">
					<div class="panel panel-default">
						<div class="panel-body">
							<div class="category-preview" style="
								<!-- IF category.backgroundImage -->background-image: url({category.backgroundImage});<!-- ENDIF category.backgroundImage -->
								<!-- IF category.bgColor -->background-color: {category.bgColor};<!-- ENDIF category.bgColor -->
								<!-- IF category.imageClass -->background-size: {category.imageClass};<!-- ENDIF category.imageClass -->
								color: {category.color};
							">
								<div class="icon">
									<i data-name="icon" value="{category.icon}" class="fa {category.icon} fa-2x"></i>
								</div>
							</div>
							<div class="btn-group btn-group-justified">
								<div class="btn-group">
									<button type="button" data-cid="{category.cid}" class="btn btn-default upload-button"><i class="fa fa-upload"></i> Upload Image</button>
								</div>
								<!-- IF category.image -->
								<div class="btn-group">
									<button class="btn btn-warning delete-image"><i data-name="icon" value="fa-times" class="fa fa-times"></i> Remove</button>
								</div>
								<!-- ENDIF category.image -->
							</div><br />

							<fieldset>
								<div class="form-group text-center">
									<label for="category-image">Category Image</label>
									<br/>
									<input id="category-image" type="text" class="form-control" placeholder="Category Image" data-name="image" value="{category.image}" />
								</div>
							</fieldset>

							<fieldset>
								<div class="form-group text-center">
									<label for="cid-{category.cid}-parentCid">Parent Category</label>
									<br/>
									<div class="btn-group <!-- IF !category.parent.name -->hide<!-- ENDIF !category.parent.name -->">
										<button type="button" class="btn btn-default" data-action="changeParent" data-parentCid="{category.parent.cid}"><i class="fa {category.parent.icon}"></i> {category.parent.name}</button>
										<button type="button" class="btn btn-warning" data-action="removeParent" data-parentCid="{category.parent.cid}"><i class="fa fa-times"></i></button>
									</div>
									<button type="button" class="btn btn-default btn-block <!-- IF category.parent.name -->hide<!-- ENDIF category.parent.name -->" data-action="setParent"><i class="fa fa-sitemap"></i> (None)</button>
								</div>
							</fieldset>
							<hr/>
							<button class="btn btn-info btn-block copy-settings"><i class="fa fa-files-o"></i> Copy Settings From</button>
							<hr />
							<button class="btn btn-danger btn-block purge"><i class="fa fa-eraser"></i> Purge Category</button>
						</div>
					</div>
				</div>
			</div>

			<div class="tab-pane fade col-xs-12" id="privileges">
				<p>
					You can configure the access control privileges for this category in this section. Privileges can be granted on a per-user or
					a per-group basis. You can add a new user to this table by searching for them in the form below.
				</p>
				<p class="text-warning">
					<strong>Note</strong>: Privilege settings take effect immediately. It is not necessary to save the category after adjusting
					these settings.
				</p>
				<hr />
				<div class="privilege-table-container">
					<table class="table table-striped privilege-table">
						<tr class="privilege-table-header">
							<th colspan="2"></th>
							<th class="arrowed" colspan="3">Viewing Privileges</th>
							<th class="arrowed" colspan="7">Posting Privileges</th>
							<th class="arrowed" colspan="2">Moderation Privileges</th>
						</tr><tr><!-- zebrastripe reset --></tr>
						<tr>
							<th colspan="2">User</th>
							<!-- BEGIN privileges.labels.users -->
							<th class="text-center">{privileges.labels.users.name}</th>
							<!-- END privileges.labels.users -->
						</tr>
						<!-- IF privileges.users.length -->
						<!-- BEGIN privileges.users -->
						<tr data-uid="{privileges.users.uid}">
							<td>
								<!-- IF ../picture -->
								<img class="avatar avatar-sm" src="{privileges.users.picture}" title="{privileges.users.username}" />
								<!-- ELSE -->
								<div class="avatar avatar-sm" style="background-color: {../icon:bgColor};">{../icon:text}</div>
								<!-- ENDIF ../picture -->
							</td>
							<td>{privileges.users.username}</td>
							{function.spawnPrivilegeStates, privileges.users.username, privileges}
						</tr>
						<!-- END privileges.users -->
						<tr>
							<td colspan="{privileges.columnCount}">
								<button type="button" class="btn btn-primary pull-right" data-ajaxify="false" data-action="search.user"> Add User</button>
							</td>
						</tr>
						<!-- ELSE -->
						<tr>
							<td colspan="{privileges.columnCount}">
								<button type="button" class="btn btn-primary pull-right" data-ajaxify="false" data-action="search.user"> Add User</button>
								No user-specific privileges in this category.
							</td>
						</tr>
						<!-- ENDIF privileges.users.length -->
					</table>

					<table class="table table-striped privilege-table">
						<tr class="privilege-table-header">
							<th colspan="2"></th>
							<th class="arrowed" colspan="3">Viewing Privileges</th>
							<th class="arrowed" colspan="7">Posting Privileges</th>
							<th class="arrowed" colspan="2">Moderation Privileges</th>
						</tr><tr><!-- zebrastripe reset --></tr>
						<tr>
							<th colspan="2">Group</th>
							<!-- BEGIN privileges.labels.groups -->
							<th class="text-center">{privileges.labels.groups.name}</th>
							<!-- END privileges.labels.groups -->
						</tr>
						<!-- BEGIN privileges.groups -->
						<tr data-group-name="{privileges.groups.name}" data-private="<!-- IF privileges.groups.isPrivate -->1<!-- ELSE -->0<!-- ENDIF privileges.groups.isPrivate -->">
							<td>
								<!-- IF privileges.groups.isPrivate -->
								<i class="fa fa-lock text-muted" title="This group is private"></i>
								<!-- ENDIF privileges.groups.isPrivate -->
								{privileges.groups.name}
							</td>
							<td></td>
							{function.spawnPrivilegeStates, name, privileges}
						</tr>
						<!-- END privileges.groups -->
						<tr>
							<td colspan="{privileges.columnCount}">
								<div class="btn-toolbar">
									<button type="button" class="btn btn-primary pull-right" data-ajaxify="false" data-action="search.group"> Add Group</button>
									<button type="button" class="btn btn-info pull-right" data-ajaxify="false" data-action="copyToChildren"> Copy to Children</button>
									<button type="button" class="btn btn-info pull-right" data-ajaxify="fakse" data-action="copyPrivilegesFrom"> Copy From Category</button>
								</div>
							</td>
						</tr>
					</table>
					<div class="help-block">
						If the <code>registered-users</code> group is granted a specific privilege, all other groups receive an
						<strong>implicit privilege</strong>, even if they are not explicitly defined/checked. This implicit
						privilege is shown to you because all users are part of the <code>registered-users</code> user group,
						and so, privileges for additional groups need not be explicitly granted.
					</div>

				</div>
			</div>
		</div>
	</form>
</div>

<button id="save" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
    <i class="material-icons">save</i>
</button>


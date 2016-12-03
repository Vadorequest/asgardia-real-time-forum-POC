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

-- ASAB portal foundation. Apply once through Supabase migrations / SQL editor.
begin;
create schema if not exists portal_private;
revoke all on schema portal_private from public, anon, authenticated;
grant usage on schema portal_private to authenticated;

create table public.portal_profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null default '' check (length(display_name) <= 120),
  phone text not null default '' check (length(phone) <= 40),
  city text not null default '' check (length(city) <= 120),
  created_at timestamptz not null default now()
);
create table public.portal_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  kind text not null check (kind in ('asab','dealer')),
  created_at timestamptz not null default now()
);
create table public.portal_memberships (
  organization_id uuid not null references public.portal_organizations(id),
  user_id uuid not null references public.portal_profiles(id),
  role text not null check (role in ('admin','designer','dealer','technician')),
  active boolean not null default true,
  primary key (organization_id, user_id)
);
create table public.portal_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.portal_profiles(id),
  title text not null check (length(trim(title)) between 1 and 120),
  status text not null default 'draft' check (status in ('draft','verification_requested','changes_requested','verified','quoted','ordered','completed','archived')),
  version integer not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index portal_projects_owner on public.portal_projects(owner_id, updated_at desc);
create table public.portal_assignments (
  project_id uuid not null references public.portal_projects(id),
  organization_id uuid not null,
  user_id uuid not null,
  assigned_by uuid not null references public.portal_profiles(id),
  created_at timestamptz not null default now(),
  primary key (project_id, organization_id, user_id),
  foreign key (organization_id,user_id) references public.portal_memberships(organization_id,user_id)
);
create index portal_assignments_user on public.portal_assignments(user_id, project_id);
create table public.portal_configuration_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.portal_projects(id),
  revision integer not null check (revision > 0),
  configuration jsonb not null check (jsonb_typeof(configuration) = 'object' and octet_length(configuration::text) <= 1048576),
  created_by uuid not null references public.portal_profiles(id),
  created_at timestamptz not null default now(),
  unique (project_id,revision), unique (project_id,id)
);
-- Room revisions are separate from designs: verification must identify exact input.
create table public.portal_room_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.portal_projects(id),
  revision integer not null check (revision > 0),
  measurements jsonb not null check (jsonb_typeof(measurements) = 'object'),
  created_by uuid not null references public.portal_profiles(id),
  created_at timestamptz not null default now(),
  unique(project_id,revision), unique(project_id,id)
);
create table public.portal_verifications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.portal_projects(id),
  room_revision_id uuid not null,
  technician_id uuid references public.portal_profiles(id),
  status text not null default 'requested' check (status in ('requested','in_review','changes_requested','verified')),
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (project_id,room_revision_id) references public.portal_room_revisions(project_id,id),
  unique(project_id,id)
);
create table public.portal_quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.portal_projects(id),
  configuration_revision_id uuid not null,
  verification_id uuid not null,
  status text not null default 'draft' check (status in ('draft','issued','accepted','expired','superseded')),
  currency text not null default 'RON' check (currency = 'RON'),
  total_bani bigint not null check (total_bani >= 0),
  price_snapshot jsonb not null check (jsonb_typeof(price_snapshot) = 'object'),
  valid_until timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (project_id,configuration_revision_id) references public.portal_configuration_revisions(project_id,id),
  foreign key (project_id,verification_id) references public.portal_verifications(project_id,id),
  check ((status = 'accepted') = (accepted_at is not null)),
  unique(project_id,id)
);
create table public.portal_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.portal_projects(id),
  quote_id uuid not null unique,
  woocommerce_order_id bigint unique check (woocommerce_order_id > 0),
  status text not null default 'pending' check (status in ('pending','paid','production','delivery','installation','completed','cancelled','refunded')),
  created_at timestamptz not null default now(),
  foreign key (project_id,quote_id) references public.portal_quotes(project_id,id)
);
-- No public URLs here. Upload/download policies and endpoints arrive with room submission.
create table public.portal_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.portal_projects(id),
  uploaded_by uuid not null references public.portal_profiles(id),
  storage_path text not null unique,
  kind text not null check (kind in ('room_photo','room_document','render','quote_pdf','presentation','verification_report')),
  created_at timestamptz not null default now()
);
-- Audit rows contain identifiers and change types, never configuration/photo contents.
create table public.portal_audit_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.portal_projects(id),
  actor_id uuid references public.portal_profiles(id),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create function portal_private.is_account() returns boolean
language sql stable set search_path = '' as $$
  select auth.uid() is not null and coalesce(auth.jwt()->>'is_anonymous','false') <> 'true';
$$;
create function portal_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select portal_private.is_account() and exists(select 1 from public.portal_memberships m join public.portal_organizations o on o.id=m.organization_id
    where m.user_id=auth.uid() and m.active and m.role='admin' and o.kind='asab');
$$;
create function portal_private.can_access(p_id uuid, p_edit boolean default false, p_commercial boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
  select portal_private.is_account() and (
    portal_private.is_admin() or
    exists(select 1 from public.portal_projects p where p.id=p_id and p.owner_id=auth.uid()) or
    exists(select 1 from public.portal_assignments a join public.portal_memberships m
      on m.organization_id=a.organization_id and m.user_id=a.user_id
      where a.project_id=p_id and a.user_id=auth.uid() and m.active
      and (not (p_edit or p_commercial) or m.role in ('designer','dealer')))
  );
$$;
create function portal_private.bootstrap_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Roles are never read from signup metadata.
  insert into public.portal_profiles(id) values(new.id) on conflict(id) do nothing;
  return new;
end;
$$;
create trigger portal_new_auth_user after insert on auth.users for each row execute function portal_private.bootstrap_profile();
insert into public.portal_profiles(id) select id from auth.users on conflict(id) do nothing;

-- Explicit grants + RLS. All writes use narrow functions; no direct REST writes.
do $$ declare t text; begin
  foreach t in array array['portal_profiles','portal_organizations','portal_memberships','portal_projects','portal_assignments','portal_configuration_revisions','portal_room_revisions','portal_verifications','portal_quotes','portal_orders','portal_assets','portal_audit_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from public, anon, authenticated',t);
    execute format('grant select on table public.%I to authenticated',t);
  end loop;
end $$;
create policy profile_read on public.portal_profiles for select to authenticated using(id=auth.uid() or portal_private.is_admin());
create policy organization_read on public.portal_organizations for select to authenticated using(portal_private.is_admin() or exists(select 1 from public.portal_memberships m where m.organization_id=id and m.user_id=auth.uid() and m.active));
create policy membership_read on public.portal_memberships for select to authenticated using(user_id=auth.uid() or portal_private.is_admin());
create policy project_read on public.portal_projects for select to authenticated using(portal_private.can_access(id));
create policy assignment_read on public.portal_assignments for select to authenticated using(portal_private.can_access(project_id));
create policy configuration_read on public.portal_configuration_revisions for select to authenticated using(portal_private.can_access(project_id));
create policy room_read on public.portal_room_revisions for select to authenticated using(portal_private.can_access(project_id));
create policy verification_read on public.portal_verifications for select to authenticated using(portal_private.can_access(project_id));
create policy quote_read on public.portal_quotes for select to authenticated using(portal_private.can_access(project_id,false,true) and (status <> 'draft' or portal_private.is_admin() or exists(select 1 from public.portal_assignments a join public.portal_memberships m on m.organization_id=a.organization_id and m.user_id=a.user_id where a.project_id=portal_quotes.project_id and a.user_id=auth.uid() and m.active and m.role in ('designer','dealer'))));
create policy order_read on public.portal_orders for select to authenticated using(portal_private.can_access(project_id,false,true));
create policy asset_read on public.portal_assets for select to authenticated using(portal_private.can_access(project_id));
create policy audit_read on public.portal_audit_events for select to authenticated using(portal_private.is_admin());

create function public.portal_create_project(p_title text) returns public.portal_projects
language plpgsql security definer set search_path = '' as $$
declare result public.portal_projects;
begin
  if not portal_private.is_account() then raise exception 'Authentication required' using errcode='42501'; end if;
  insert into public.portal_projects(owner_id,title) values(auth.uid(),trim(p_title)) returning * into result;
  insert into public.portal_audit_events(project_id,actor_id,action) values(result.id,auth.uid(),'project.created');
  return result;
end;
$$;
create function public.portal_rename_project(p_project_id uuid,p_title text) returns public.portal_projects
language plpgsql security definer set search_path = '' as $$
declare result public.portal_projects;
begin
  if not portal_private.can_access(p_project_id,true) then raise exception 'Project unavailable' using errcode='42501'; end if;
  update public.portal_projects set title=trim(p_title),updated_at=now() where id=p_project_id returning * into result;
  insert into public.portal_audit_events(project_id,actor_id,action) values(p_project_id,auth.uid(),'project.renamed');
  return result;
end;
$$;
create function public.portal_save_revision(p_project_id uuid,p_expected_version integer,p_configuration jsonb) returns public.portal_configuration_revisions
language plpgsql security definer set search_path = '' as $$
declare current_project public.portal_projects; result public.portal_configuration_revisions;
begin
  if not portal_private.can_access(p_project_id,true) then raise exception 'Project unavailable' using errcode='42501'; end if;
  select * into current_project from public.portal_projects where id=p_project_id for update;
  if current_project.version <> p_expected_version then raise exception 'Configuration changed; reload before saving' using errcode='40001'; end if;
  -- Later workflow phases must deliberately reopen approved designs; no silent edits.
  if current_project.status not in ('draft','changes_requested') then raise exception 'Project is locked for editing' using errcode='42501'; end if;
  if p_configuration is null or p_configuration ?| array['_lead','customer','customerDetails'] then raise exception 'Invalid configuration snapshot' using errcode='22023'; end if;
  insert into public.portal_configuration_revisions(project_id,revision,configuration,created_by)
    values(p_project_id,current_project.version+1,p_configuration,auth.uid()) returning * into result;
  update public.portal_projects set version=result.revision,updated_at=now() where id=p_project_id;
  insert into public.portal_audit_events(project_id,actor_id,action,details)
    values(p_project_id,auth.uid(),'configuration.saved',jsonb_build_object('revision',result.revision));
  return result;
end;
$$;
create function public.portal_update_profile(p_display_name text,p_phone text,p_city text) returns public.portal_profiles
language plpgsql security definer set search_path = '' as $$
declare result public.portal_profiles;
begin
  if not portal_private.is_account() then raise exception 'Authentication required' using errcode='42501'; end if;
  update public.portal_profiles set display_name=trim(p_display_name),phone=trim(p_phone),city=trim(p_city) where id=auth.uid() returning * into result;
  insert into public.portal_audit_events(actor_id,action) values(auth.uid(),'profile.updated');
  return result;
end;
$$;
create function public.portal_assign_project(p_project_id uuid,p_organization_id uuid,p_user_id uuid,p_remove boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not portal_private.is_admin() then raise exception 'ASAB administrator required' using errcode='42501'; end if;
  if p_remove then
    delete from public.portal_assignments where project_id=p_project_id and organization_id=p_organization_id and user_id=p_user_id;
  else
    if not exists(select 1 from public.portal_memberships where organization_id=p_organization_id and user_id=p_user_id and active) then
      raise exception 'Active staff membership required' using errcode='22023';
    end if;
    insert into public.portal_assignments(project_id,organization_id,user_id,assigned_by) values(p_project_id,p_organization_id,p_user_id,auth.uid()) on conflict do nothing;
  end if;
  insert into public.portal_audit_events(project_id,actor_id,action,details) values(p_project_id,auth.uid(),case when p_remove then 'assignment.removed' else 'assignment.created' end,jsonb_build_object('user_id',p_user_id,'organization_id',p_organization_id));
end;
$$;
-- No function may inherit PUBLIC execute permissions.
revoke all on all functions in schema portal_private from public,anon,authenticated;
grant execute on function portal_private.is_account(),portal_private.is_admin(),portal_private.can_access(uuid,boolean,boolean) to authenticated;
revoke all on function public.portal_create_project(text),public.portal_rename_project(uuid,text),public.portal_save_revision(uuid,integer,jsonb),public.portal_update_profile(text,text,text),public.portal_assign_project(uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.portal_create_project(text),public.portal_rename_project(uuid,text),public.portal_save_revision(uuid,integer,jsonb),public.portal_update_profile(text,text,text),public.portal_assign_project(uuid,uuid,uuid,boolean) to authenticated;
notify pgrst, 'reload schema';
commit;

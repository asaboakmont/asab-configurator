begin;
create table public.portal_commerce_links (
  user_id uuid primary key references public.portal_profiles(id),
  store_url text not null check (store_url ~ '^https://[^/]+$'),
  customer_id bigint not null check (customer_id > 0),
  linked_at timestamptz not null default now(),
  unique(store_url,customer_id)
);
alter table public.portal_commerce_links enable row level security;
revoke all on public.portal_commerce_links from public,anon,authenticated;
grant select on public.portal_commerce_links to authenticated;
-- Service-role access is confined to the verified WooCommerce exchange adapter.
grant select,insert,delete on public.portal_commerce_links to service_role;
grant select on public.portal_memberships to service_role;
create policy commerce_own_read on public.portal_commerce_links for select to authenticated using(user_id=auth.uid());

create function public.portal_archive_project(p_project_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not portal_private.is_account() or not exists(select 1 from public.portal_projects where id=p_project_id and owner_id=auth.uid() and status in ('draft','changes_requested','archived')) then
    raise exception 'Only owned draft projects can be archived' using errcode='42501';
  end if;
  update public.portal_projects set status='archived',updated_at=now() where id=p_project_id;
  insert into public.portal_audit_events(project_id,actor_id,action) values(p_project_id,auth.uid(),'project.archived');
end;
$$;
create function public.portal_duplicate_project(p_project_id uuid) returns public.portal_projects
language plpgsql security definer set search_path='' as $$
declare source public.portal_projects; result public.portal_projects; snapshot jsonb;
begin
  select * into source from public.portal_projects where id=p_project_id and owner_id=auth.uid();
  if not portal_private.is_account() or source.id is null then raise exception 'Project unavailable' using errcode='42501'; end if;
  select configuration into snapshot from public.portal_configuration_revisions where project_id=p_project_id order by revision desc limit 1;
  insert into public.portal_projects(owner_id,title,version) values(auth.uid(),left(source.title,110)||' (copie)',case when snapshot is null then 0 else 1 end) returning * into result;
  if snapshot is not null then
    insert into public.portal_configuration_revisions(project_id,revision,configuration,created_by) values(result.id,1,snapshot,auth.uid());
  end if;
  -- Room verification, commercial links, quotes and assignments are never copied.
  insert into public.portal_audit_events(project_id,actor_id,action,details) values(result.id,auth.uid(),'project.duplicated',jsonb_build_object('source_project_id',p_project_id));
  return result;
end;
$$;
create function public.portal_dashboard(p_offset integer default 0) returns jsonb
language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('summary',r.summary) order by p.updated_at desc,p.id),'[]'::jsonb)
  from (select * from public.portal_projects where owner_id=auth.uid() and status<>'archived' order by updated_at desc,id limit 50 offset greatest(0,least(p_offset,1000000))) p
  left join lateral (
    select jsonb_build_object('layout',configuration->>'layout','collection',configuration->>'collection','dimensions',configuration->'dimensions',
      'cabinetCount',case when jsonb_typeof(configuration->'cabinets')='array' then jsonb_array_length(configuration->'cabinets') else 0 end) summary
    from public.portal_configuration_revisions where project_id=p.id order by revision desc limit 1
  ) r on true;
$$;
revoke all on function public.portal_archive_project(uuid),public.portal_duplicate_project(uuid),public.portal_dashboard(integer) from public,anon,authenticated;
grant execute on function public.portal_archive_project(uuid),public.portal_duplicate_project(uuid),public.portal_dashboard(integer) to authenticated;
notify pgrst,'reload schema';
commit;

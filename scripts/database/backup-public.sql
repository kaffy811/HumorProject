-- One read-only statement, one consistent database snapshot. Export its result as CSV.
with tables as materialized (
 select c.oid,c.relname,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'
), columns as (
 select t.oid,string_agg(format('%I %s%s%s',a.attname,format_type(a.atttypid,a.atttypmod),case when d.adbin is not null then ' DEFAULT '||pg_get_expr(d.adbin,d.adrelid) else '' end,case when a.attnotnull then ' NOT NULL' else '' end),E',\n' order by a.attnum) defs from tables t join pg_attribute a on a.attrelid=t.oid left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attnum>0 and not a.attisdropped group by t.oid
), routines as materialized (
 select p.*,format('public.%I(%s)',p.proname,pg_get_function_identity_arguments(p.oid)) sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and not exists(select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')
), parts as (
 select 0 phase,0::bigint pos,'-- Application backup: tables/data/functions/triggers/RLS/ACL. Auth and Storage are unchanged dependencies.'||E'\nSET check_function_bodies=false;\nSET search_path=public,pg_catalog;' sql
 union all select 1,t.oid::bigint,format('CREATE TABLE public.%I (%s);',t.relname,c.defs) from tables t join columns c on c.oid=t.oid
 union all select 2,t.oid::bigint,format('INSERT INTO public.%I SELECT * FROM json_populate_recordset(NULL::public.%I,%L);',t.relname,t.relname,x.value) from tables t cross join lateral XMLTABLE('/table/row' PASSING query_to_xml(format('select coalesce(json_agg(t),''[]''::json)::text as data from public.%I t',t.relname),false,false,'') COLUMNS value text PATH 'data') x
 union all select 3,p.oid::bigint,pg_get_functiondef(p.oid) from routines p
 union all select 4,c.oid::bigint,format('ALTER TABLE public.%I ADD CONSTRAINT %I %s;',t.relname,c.conname,pg_get_constraintdef(c.oid)) from tables t join pg_constraint c on c.conrelid=t.oid
 union all select 5,i.indexrelid::bigint,pg_get_indexdef(i.indexrelid)||';' from tables t join pg_index i on i.indrelid=t.oid where not exists(select 1 from pg_constraint c where c.conindid=i.indexrelid)
 union all select 6,g.oid::bigint,pg_get_triggerdef(g.oid)||';' from tables t join pg_trigger g on g.tgrelid=t.oid where not g.tgisinternal
 union all select 7,t.oid::bigint,format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;',t.relname) from tables t where t.relrowsecurity
 union all select 8,t.oid::bigint,format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;',t.relname) from tables t where t.relforcerowsecurity
 union all select 9,t.oid::bigint,format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s%s%s;',p.policyname,t.relname,p.permissive,p.cmd,array_to_string(p.roles,','),case when p.qual is not null then ' USING ('||p.qual||')' else '' end,case when p.with_check is not null then ' WITH CHECK ('||p.with_check||')' else '' end) from tables t join pg_policies p on p.schemaname='public' and p.tablename=t.relname
 union all select 10,t.oid::bigint,format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role;',t.relname) from tables t
 union all select 11,t.oid::bigint,format('GRANT %s ON public.%I TO %s;',a.privilege_type,t.relname,case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end) from tables t cross join lateral aclexplode(coalesce(t.relacl,acldefault('r',t.relowner))) a
 union all select 12,t.oid::bigint,format('GRANT %s (%I) ON public.%I TO %s;',x.privilege_type,a.attname,t.relname,quote_ident(pg_get_userbyid(x.grantee))) from tables t join pg_attribute a on a.attrelid=t.oid cross join lateral aclexplode(a.attacl) x where a.attnum>0
 union all select 13,p.oid::bigint,format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role;',p.sig) from routines p
 union all select 14,p.oid::bigint,format('GRANT %s ON FUNCTION %s TO %s;',a.privilege_type,p.sig,case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end) from routines p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
)
select string_agg(sql,E'\n' order by phase,pos,sql) backup_sql from parts;

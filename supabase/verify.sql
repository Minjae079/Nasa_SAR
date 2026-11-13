-- Read-only checks to run after the migration. Expect three tables, all with RLS.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('scenes', 'analyses', 'analysis_assets')
order by tablename;

select extname, extversion, n.nspname as extension_schema
from pg_extension e join pg_namespace n on n.oid = e.extnamespace
where extname = 'postgis';

-- Run after creating the private bucket through the Storage dashboard.
select id, name, public
from storage.buckets
where id = 'sarscope-data';

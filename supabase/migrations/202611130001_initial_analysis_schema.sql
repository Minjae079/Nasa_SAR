-- Run once in the Supabase SQL Editor of the intended SARSCOPE project.
-- This creates metadata tables only; it does not upload files or run a model.
begin;

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

create table public.scenes (
  id uuid primary key default gen_random_uuid(),
  source_product_id text not null unique,
  region_name text not null,
  observed_at timestamptz not null,
  source_url text,
  processing_level text,
  track text,
  frame text,
  flight_direction text,
  polarizations text[] not null default '{}',
  source_crs text not null,
  -- Search geometry is always WGS84 lon/lat; source rasters keep their own CRS.
  footprint extensions.geometry(MultiPolygon, 4326) not null,
  assets jsonb not null default '{}'::jsonb
    check (jsonb_typeof(assets) = 'object'),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  check (not extensions.st_isempty(footprint)),
  check (extensions.st_isvalid(footprint))
);
create index scenes_footprint_idx on public.scenes using gist (footprint);
create index scenes_observed_at_idx on public.scenes (observed_at desc);

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  before_scene_id uuid not null references public.scenes(id),
  after_scene_id uuid not null references public.scenes(id),
  -- One row is one reproducible run; reruns must get a new ID and file prefix.
  model_version text not null,
  checkpoint_sha256 text,
  code_version text,
  threshold double precision not null check (threshold between 0 and 1),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  validation_status text not null default 'experimental'
    check (validation_status in ('experimental', 'validated', 'rejected')),
  parameters jsonb not null default '{}'::jsonb
    check (jsonb_typeof(parameters) = 'object'),
  summary jsonb not null default '{}'::jsonb
    check (jsonb_typeof(summary) = 'object'),
  -- Store reference product IDs, dates and evaluation method, not just a flag.
  validation_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(validation_metadata) = 'object'),
  common_valid_area extensions.geometry(MultiPolygon, 4326),
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  check (before_scene_id <> after_scene_id),
  check (common_valid_area is null or
    (not extensions.st_isempty(common_valid_area) and
     extensions.st_isvalid(common_valid_area)))
);
create index analyses_scene_pair_idx on public.analyses (before_scene_id, after_scene_id);
create index analyses_status_created_idx on public.analyses (status, created_at desc);

create table public.analysis_assets (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id),
  layer_type text not null,
  format text not null check (format in ('cog', 'geotiff', 'png', 'geojson', 'json')),
  -- Store a stable bucket + key, not an expiring signed download URL.
  storage_bucket text not null default 'sarscope-data',
  storage_path text not null check (length(storage_path) > 0),
  crs text,
  bounds jsonb,
  -- For PNG overlays: [[west,north],[east,north],[east,south],[west,south]].
  -- Coordinates must be obtained from the georeferenced/reprojected output.
  image_corners jsonb,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (analysis_id, layer_type, format),
  unique (storage_bucket, storage_path)
);

-- All reads/writes initially go through the trusted server or SQL Editor.
-- No browser/public access policies are enabled by this migration.
alter table public.scenes enable row level security;
alter table public.analyses enable row level security;
alter table public.analysis_assets enable row level security;
revoke all on public.scenes, public.analyses, public.analysis_assets from anon, authenticated;
grant select, insert, update, delete on public.scenes, public.analyses,
  public.analysis_assets to service_role;

comment on table public.scenes is 'Source observation metadata; raster pixels live in object storage.';
comment on table public.analyses is 'Observed water/change analysis runs, not future flood forecasts.';
comment on table public.analysis_assets is 'Model outputs and display layers, addressed by stable storage keys.';

commit;

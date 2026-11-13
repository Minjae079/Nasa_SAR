# SARSCOPE Supabase setup

Target project: `jywbvxyyumznolgultci`

Dashboard: https://supabase.com/dashboard/project/jywbvxyyumznolgultci

## 1. Create the metadata tables

In this project's **SQL Editor**, choose **New query**. Paste all of
`migrations/202611130001_initial_analysis_schema.sql` and run it once.
The transaction creates PostGIS in `extensions` and three new tables:
`scenes`, `analyses`, `analysis_assets`, with spatial/date indexes and RLS.
It inserts no observations or predictions and does not change the website.

If a table already exists, the transaction fails rather than replacing it.
If PostGIS was previously installed in another schema, stop and adapt the
schema qualifiers to its actual location; do not move an existing extension blindly.

## 2. Create the file bucket

Open **Storage** and create a bucket named `sarscope-data`.
Keep **Public bucket OFF**. Do not add public upload/read policies.
Use the dashboard for the first sample upload. Later the trusted Python worker
will upload outputs, and the API will issue temporary signed read URLs.
Database RLS policies do not replace Storage access policies.

Suggested layout (use actual product/run IDs; never overwrite another run):

```text
scenes/<source-product-id>/hh.cog.tif
scenes/<source-product-id>/hv.cog.tif
analyses/<analysis-id>/water_before.cog.tif
analyses/<analysis-id>/water_after.cog.tif
analyses/<analysis-id>/change_mask.cog.tif
analyses/<analysis-id>/before_overlay.png
analyses/<analysis-id>/after_overlay.png
analyses/<analysis-id>/change_overlay.png
```

Store exact available polarizations; not every product has HH and HV.
Keep all derived files under the analysis ID to preserve model/threshold variants.
Keep pixel data in these files, not one SQL row per pixel.

## 3. Verify

Run `verify.sql` in a new SQL Editor query.
Expect three table rows with `rowsecurity = true`, a PostGIS extension row,
and a bucket row with `public = false`.
The SQL has only been prepared locally until you run it against Supabase.

## 4. Prepare a real sample, then connect the API

For one before/after pair, collect product IDs, exact UTC observation times,
source CRS, WGS84 footprint, track/frame/polarizations, model version,
threshold, output COGs and PNGs, plus their bounds/corners.
Only compare aligned grids and the common valid pixel mask. Preserve NoData;
new water candidates are experimental until independently validated.

Next implement a server endpoint that reads a completed analysis and returns
metadata plus signed asset URLs. Keep the service secret in server environment
variables only. Do not paste credentials into chat or put them in browser code.
The local server now loads `.env.local` and only serves allowlisted website
assets. `.env.local` is ignored by Git. See `CONNECT.md` for setup instructions.

The initial SQL setup includes no cloud credentials. Server API connection
code is documented separately in `CONNECT.md`.

# PNG-only model results

React experiment branch: the same server APIs and environment variables are
used. Run npm run dev (Vite + API adapter), npm run build, npm run preview.
React result and connection components are in src/components. See REACT_BRANCH.md.

Project: jywbvxyyumznolgultci. Use the existing PRIVATE sarscope-data bucket.
The website now reads JSON and PNG files, not the existing SQL tables.
Do not delete the tables; they are simply unused by this flow.

## Local connection
Use Node.js 22.16+ and npm ci. In .env.local keep:
- SUPABASE_URL=https://jywbvxyyumznolgultci.supabase.co
- SUPABASE_SECRET_KEY=<your server-only sb_secret_ key>
- SARSCOPE_PUBLIC_ANALYSES=false

The last variable retains its name for compatibility and now controls file
publication. Never commit .env.local or share its secret.
Restart npm run dev. GET /api/database-status should return:
{"connected":true,"storage":"ready","mode":"files-only"}

## Initial empty setup
In Storage > sarscope-data, create a folder named results. Upload
supabase/results-manifest.json into it, renaming the file to manifest.json.
The exact bucket-relative path is results/manifest.json.
The empty manifest contains no fake predictions.

When you intend published entries to be visible to website visitors, set
SARSCOPE_PUBLIC_ANALYSES=true and restart/redeploy.
GET /api/model-results returns state empty for an empty manifest,
awaiting_upload for a missing manifest, and disabled when publication is off.

## Register real images later
Upload the PNG first, then update results/manifest.json LAST.
Use new run IDs/paths for new model runs. Example structure (replace all values
with real result information; this is NOT a prediction):
{
  "version": 1,
  "results": [
    {
      "id": "run-id",
      "published": true,
      "title": "Actual result title",
      "observed_at": "2026-11-13T00:00:00Z",
      "model_version": "actual-checkpoint-version",
      "description": "Describe the actual inputs and what the image shows.",
      "validation_status": "experimental",
      "image_path": "results/run-id/output.png"
    }
  ]
}

All published entries need unique IDs and PNG paths under results/.
published:false entries are never exposed or signed. Mark validated only after
independent validation. For before/after/water/change, use one entry per PNG.
These observation timestamps do not describe a future prediction.

GET /api/model-results reads only the fixed manifest, signs published PNGs for
ten minutes and never queries SQL tables. ?id=<result-id> selects one entry.
/api/analyses is now a compatibility alias with the SAME file-based response.
Responses use no-store. Reload the list to refresh expired image URLs.

## Website and Vercel
Open How it works > Load / refresh results to display ordinary PNG cards.
Check data connection checks the private bucket. Map overlays are a later step
requiring actual georeferencing; this change only displays PNG images.

Vercel Settings > Environment Variables must have the same SUPABASE_URL,
SUPABASE_SECRET_KEY, SARSCOPE_PUBLIC_ANALYSES values for the intended environment.
Never use a browser/public prefix for the secret. Commit source and lockfile,
push, then redeploy. Check /api/database-status and /api/model-results on
the deployed site. No new DB, table, bucket or RLS policy is required.

## Verification boundary
Tests mock Storage responses (no SQL queries), missing objects, private bucket
checks, manifest validation, publication filtering and URL signing.
Real result display needs actual PNGs. Nothing has been uploaded or deployed
by these local code edits.


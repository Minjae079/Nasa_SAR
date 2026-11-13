# Connect the existing website

Project: `jywbvxyyumznolgultci`. Tables and the private `sarscope-data` bucket
have been created by the owner. No sample model results are required to connect.

## Local setup

1. Use Node.js **22.16+** (or a supported newer LTS). Run `node --version`.
2. Run `npm ci` to install the exact versions in `package-lock.json`.
3. Copy `.env.example` to `.env.local` in the project root.
4. In Supabase **Settings > API Keys**, copy a server secret key (`sb_secret_…`)
   into `SUPABASE_SECRET_KEY` in `.env.local`. Do not use a publishable key here.
   Keep `SUPABASE_URL` as provided. Never share or commit the secret.
5. Run `npm run dev` (restart if the server was already running).
6. Visit `http://localhost:3000/api/database-status`. Success is:

```json
{"connected":true,"database":"ready","storage":"ready"}
```

You can also open **How it works > Check data connection** on the site.
The check only reads one ID from each table and bucket settings; it writes nothing.
Missing config gives 503 `SUPABASE_NOT_CONFIGURED`; upstream/key/table/bucket
errors give 502 `SUPABASE_UNAVAILABLE`. A public bucket gives 503
`STORAGE_MUST_BE_PRIVATE`. Inspect the Supabase dashboard for upstream details.

## Vercel

In the existing Vercel project's **Settings > Environment Variables**, add
`SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `SARSCOPE_PUBLIC_ANALYSES=false`.
Choose the deployment environments you intend to connect. Use the secret as a
server variable; never give it a browser/public prefix. Set Node.js to 22.x or
a supported newer LTS. Commit the source and lockfile, push, then redeploy.
Check `https://<your-site>/api/database-status` after deployment.

## Later: publish real model outputs

`GET /api/analyses` returns an empty disabled list until the server variable
`SARSCOPE_PUBLIC_ANALYSES=true` is set. It then lists only rows with
`status='completed'` and JSON `summary.published=true`. These are intentionally
public website results, including experimental results if explicitly published.
No arbitrary/private analysis is exposed just by knowing its UUID.

`GET /api/analyses?id=<uuid>` returns one published run and signed file URLs
valid for ten minutes. Asset paths must be in the private `sarscope-data` bucket
under `analyses/<analysis-id>/`. Public JSON omits internal run parameters and
raw storage paths. Responses use `Cache-Control: no-store`. Renew URLs by
requesting the endpoint again after expiry.

The endpoint is ready for later map integration; it does not generate results
or replace the existing NASA image comparison. No fake records were inserted.

## Validation boundary

Automated tests use mocked Supabase responses. Real hosted connectivity is
unverified until the owner supplies the server environment variables and gets
the successful status response above.

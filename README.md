# DATA AFRICA V1

African Data Intelligence Platform for transparent, source-attributed public statistics.

## Stack

- React 19 + Vite
- Supabase Postgres, Auth and Edge Functions
- Cloudflare Pages
- GitHub Actions

## Deploy

The production workflow is `.github/workflows/deploy-cloudflare.yml`. Add these repository Actions secrets before running it:

- `CLOUDFLARE_API_TOKEN`: Cloudflare API token with Account / Cloudflare Pages / Edit.
- `VITE_SUPABASE_URL`: Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: Supabase publishable key (or legacy anon key). Never use a service-role or secret key here.

The Vite variables are compiled into the public browser bundle. The publishable key is designed for public use; database security must be enforced by RLS. Never place a service-role key in a `VITE_*` variable.

## Supabase database setup

Apply `supabase/migrations/20261118040000_initial_schema_and_seed.sql` once to the intended Supabase project using the SQL Editor or Supabase CLI. It creates the reference tables, datasets, raw records, observations, ingestion runs and verification checks; enables RLS; and seeds 54 African countries, four indicators and source registry entries.

After applying it, deploy the Edge Function:

```bash
supabase functions deploy worldbank-sync
```

The function uses the platform-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` server-side. Do not add those values to the frontend.

## Admin access

Create the admin user through Supabase Auth, then assign `app_metadata.role = "admin"` using the trusted Supabase dashboard/admin process. Do not use editable user metadata for authorization. The function and admin UI check the app metadata claim.

## Current data scope

The World Bank API import supports four indicators: population, GDP, GDP per capita and unemployment. The import is manually initiated by an authenticated admin and records raw payloads plus verification checks. Only verified and published observations are visible publicly. Other listed institutions are catalog entries, not yet active automated integrations.

A successful frontend deployment does not mean that the database migration, Edge Function deployment, admin role, or first data import have been completed. Verify each step in the Supabase dashboard before announcing live data coverage.

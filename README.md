# DATA AFRICA V1

African Data Intelligence Platform for transparent, source-attributed public statistics.

## Production

- Public site: https://data-africa-v1.pages.dev
- Cloudflare Pages project: `data-africa-v1`
- Supabase project: `DATA-AFRICA-V1`
- GitHub repository: https://github.com/peramihomartin288-png/DATA-AFRICA-V1

## Stack

- React 19 + Vite
- Supabase Postgres, Auth and Edge Functions
- Cloudflare Pages
- GitHub Actions

## Verified production setup (18 Nov 2026)

- 54 active African countries seeded.
- 4 active indicators seeded: population, GDP, GDP per capita and unemployment.
- 6 official data-source records registered.
- RLS enabled on the public data tables.
- Public reads are limited to active reference data and published, verified observations.
- Supabase security advisor returned no security lint findings.
- `worldbank-sync` Edge Function is deployed with JWT verification enabled.
- Observation upserts use the existing natural-key unique index.
- GitHub Actions deploys the frontend automatically after pushes to `main`.

## Supabase configuration

The public Vite configuration is set in the Cloudflare Pages production and preview environments:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (publishable/anon key only)

A publishable key is intended for browser use. Never put a service-role or secret key in a `VITE_*` variable.

## Database migrations

The reference-data reconciliation and ingestion-key migrations have been applied to the production Supabase project. The existing project schema already contained the core tables and 54 country records; the migration history is in `supabase/migrations/`.

## Admin onboarding — one owner action remains

There is currently no Auth user with an admin role in this Supabase project. To activate the admin panel:

1. Open Supabase Dashboard → Authentication → Users.
2. Create your own user account with your email and a password you choose privately.
3. Open that user record and set **App Metadata** to include `{"role":"admin"}`. Do not set this in User Metadata.
4. Sign in to the DATA AFRICA website → Admin.

Never share your password or service-role key in chat. The Edge Function independently checks the signed-in user's `app_metadata.role`.

## World Bank import

The `worldbank-sync` Edge Function supports four indicators and can import annual observations across the 54 active countries. It stores source payloads and verification checks. Only observations marked verified and published are visible publicly.

After the owner admin account is activated, sign in to the Admin page and run the first World Bank import. The first import can take several minutes because each country is queried separately. Other listed providers are source-catalog entries; their automated integrations are not yet implemented.

## Deployment

The production workflow is `.github/workflows/deploy-cloudflare.yml`. It builds the React app and deploys `dist/` to Cloudflare Pages. Cloudflare deployment authorization is supplied by the repository's `CLOUDFLARE_API_TOKEN` Actions secret.

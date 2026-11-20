# PERAMIHO VPS PRO — Foundation Plan

## Repository transition

This repository currently contains the DATA AFRICA V1 production application. Its existing public-data application, Cloudflare Pages deployment workflow, Supabase tables, seed records, and `worldbank-sync` Edge Function must be preserved during the transition.

PERAMIHO VPS PRO work starts on the `peramiho-vps-foundation` branch. Do not delete or overwrite the DATA AFRICA V1 application as part of this foundation phase.

## Existing Supabase project

- Project display name: DATA-AFRICA-V1
- Project ref: rqfxumeemzezqximdasx
- Region: eu-west-1
- Status at inspection: ACTIVE_HEALTHY
- Existing tables: countries, sources, indicators, datasets, ingestion_runs, raw_records, observations, verification_checks, profiles
- Existing Edge Function: worldbank-sync (JWT verification enabled)
- Existing data includes 54 country rows, 6 source rows, 4 indicator rows, and observation/ingestion records.

## Target architecture

- Supabase: identity, PostgreSQL metadata, row-level access control, audit records.
- Cloudflare: DNS, HTTPS, edge protection and optional object storage integration.
- GitHub: source control, reviewed changes and CI.
- Compute adapters: provider-neutral interface; no provider is assumed available until its API and terms are verified.
- Object storage: provider-neutral bucket integration for user files and backups.
- Persistent block storage and public networking must be supplied by a real compute/storage/network provider. Supabase, GitHub and Cloudflare Pages are not themselves a general-purpose Linux VM.

## Compute adapter contract

A provider adapter should implement:
- createInstance
- getInstance
- startInstance
- stopInstance
- rebootInstance
- deleteInstance
- getPublicAddress
- getConnectionMetadata

Provider credentials must remain server-side in managed secrets. Never expose provider API tokens, Supabase service-role keys, SSH private keys, or passwords in browser code, Git history, logs, or public API responses.

## Provisioning lifecycle

requested -> approved -> provisioning -> active -> stopping/stopped -> deleting/deleted
Failures must be recorded with a safe error code and an audit event. The UI must never claim that an instance exists until the provider confirms it.

## Multi-tenant security requirements

- Each instance belongs to one authenticated user.
- Users may read only their own instance metadata.
- Provider credentials and private connection material are never readable by ordinary users.
- Owner/admin authorization must use trusted server-side claims or protected app metadata, never user-editable profile metadata.
- RLS must be enabled for all exposed tables.
- User-submitted code must not run inside the dashboard/API process; real execution requires isolated compute and enforced CPU, memory, disk, network and time quotas.
- Passwords and private SSH keys must not be stored as plaintext in database tables.

## Next implementation steps

1. Preserve the existing DATA AFRICA V1 production app and database objects.
2. Add VPS-specific tables and policies in an isolated schema/migration after reviewing the exact SQL.
3. Add provider registry and mock adapter for UI/testing only.
4. Build owner and user VPS dashboards with clear simulated-vs-real status.
5. Integrate a real compute provider only after confirming its free-plan terms, persistent storage, networking, and API.

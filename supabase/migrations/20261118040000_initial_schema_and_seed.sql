-- DATA AFRICA V1 initial schema and reference data
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create table if not exists public.countries (
  iso3 text primary key check (iso3 ~ '^[A-Z]{3}$'),
  name_en text not null,
  name_sw text not null,
  region text not null check (region in ('North Africa','West Africa','Central Africa','East Africa','Southern Africa')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  website_url text,
  api_url text,
  documentation_url text,
  license_url text,
  source_type text not null default 'catalog',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.indicators (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_sw text not null,
  unit text not null,
  topic text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.datasets (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id),
  external_code text not null,
  title text not null,
  attribution_required boolean not null default true,
  license_url text,
  created_at timestamptz not null default now(),
  unique(source_id, external_code)
);

create table if not exists public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id),
  dataset_id uuid references public.datasets(id),
  status text not null check (status in ('running','success','partial','failed')),
  records_received integer not null default 0,
  records_saved integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.raw_records (
  id uuid primary key default gen_random_uuid(),
  ingestion_run_id uuid references public.ingestion_runs(id),
  source_id uuid not null references public.sources(id),
  external_id text,
  payload jsonb not null,
  payload_hash text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.observations (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id),
  indicator_id uuid not null references public.indicators(id),
  country_iso3 text not null references public.countries(iso3),
  raw_record_id uuid references public.raw_records(id),
  period_start date not null,
  period_end date not null,
  value numeric not null,
  unit text not null,
  observation_status text not null default 'final',
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','flagged','rejected')),
  quality_score numeric not null default 0 check (quality_score between 0 and 100),
  source_url text not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique(dataset_id, indicator_id, country_iso3, period_start, period_end)
);

create table if not exists public.verification_checks (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.observations(id) on delete cascade,
  check_type text not null,
  status text not null check (status in ('pass','fail','warning')),
  score numeric not null default 0 check (score between 0 and 100),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists observations_public_lookup on public.observations(country_iso3, indicator_id, period_start) where published = true and verification_status = 'verified';
create index if not exists observations_dataset_period on public.observations(dataset_id, period_start);
create index if not exists verification_checks_observation on public.verification_checks(observation_id);

do $$
declare t text;
begin
  foreach t in array array['countries','sources','indicators','observations'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

alter table public.countries enable row level security;
alter table public.sources enable row level security;
alter table public.indicators enable row level security;
alter table public.datasets enable row level security;
alter table public.ingestion_runs enable row level security;
alter table public.raw_records enable row level security;
alter table public.observations enable row level security;
alter table public.verification_checks enable row level security;

create policy "Public reads active countries" on public.countries for select to anon, authenticated using (is_active);
create policy "Admins manage countries" on public.countries for all to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'admin') with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "Public reads active sources" on public.sources for select to anon, authenticated using (is_active);
create policy "Admins manage sources" on public.sources for all to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'admin') with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "Public reads active indicators" on public.indicators for select to anon, authenticated using (is_active);
create policy "Admins manage indicators" on public.indicators for all to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'admin') with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "Public reads attributed datasets" on public.datasets for select to anon, authenticated using (attribution_required);
create policy "Admins manage datasets" on public.datasets for all to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'admin') with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "Public reads verified published observations" on public.observations for select to anon, authenticated using (published and verification_status = 'verified');
create policy "Admins manage observations" on public.observations for all to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'admin') with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "Admins read ingestion runs" on public.ingestion_runs for select to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "Admins manage ingestion runs" on public.ingestion_runs for all to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'admin') with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "Admins read raw records" on public.raw_records for select to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "Admins manage raw records" on public.raw_records for all to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'admin') with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "Admins read verification checks" on public.verification_checks for select to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "Admins manage verification checks" on public.verification_checks for all to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'admin') with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

grant select on public.countries, public.sources, public.indicators, public.datasets, public.observations to anon, authenticated;
grant select, insert, update, delete on public.countries, public.sources, public.indicators, public.datasets, public.observations to authenticated;
grant select, insert, update, delete on public.ingestion_runs, public.raw_records, public.verification_checks to authenticated;

insert into public.countries (iso3,name_en,name_sw,region,is_active) values
('DZA','Algeria','Algeria','North Africa',true),
('AGO','Angola','Angola','Central Africa',true),
('BEN','Benin','Benin','West Africa',true),
('BWA','Botswana','Botswana','Southern Africa',true),
('BFA','Burkina Faso','Burkina Faso','West Africa',true),
('BDI','Burundi','Burundi','East Africa',true),
('CPV','Cabo Verde','Cabo Verde','West Africa',true),
('CMR','Cameroon','Cameroon','Central Africa',true),
('CAF','Central African Republic','Jamhuri ya Afrika ya Kati','Central Africa',true),
('TCD','Chad','Chad','Central Africa',true),
('COM','Comoros','Komori','East Africa',true),
('COG','Republic of the Congo','Jamhuri ya Kongo','Central Africa',true),
('COD','Democratic Republic of the Congo','Jamhuri ya Kidemokrasia ya Kongo','Central Africa',true),
('CIV','Côte d’Ivoire','Côte d’Ivoire','West Africa',true),
('DJI','Djibouti','Djibouti','East Africa',true),
('EGY','Egypt','Misri','North Africa',true),
('GNQ','Equatorial Guinea','Guinea ya Ikweta','Central Africa',true),
('ERI','Eritrea','Eritrea','East Africa',true),
('SWZ','Eswatini','Eswatini','Southern Africa',true),
('ETH','Ethiopia','Ethiopia','East Africa',true),
('GAB','Gabon','Gabon','Central Africa',true),
('GMB','The Gambia','Gambia','West Africa',true),
('GHA','Ghana','Ghana','West Africa',true),
('GIN','Guinea','Guinea','West Africa',true),
('GNB','Guinea-Bissau','Guinea-Bissau','West Africa',true),
('KEN','Kenya','Kenya','East Africa',true),
('LSO','Lesotho','Lesotho','Southern Africa',true),
('LBR','Liberia','Liberia','West Africa',true),
('LBY','Libya','Libya','North Africa',true),
('MDG','Madagascar','Madagascar','East Africa',true),
('MWI','Malawi','Malawi','Southern Africa',true),
('MLI','Mali','Mali','West Africa',true),
('MRT','Mauritania','Mauritania','West Africa',true),
('MUS','Mauritius','Mauritius','East Africa',true),
('MAR','Morocco','Morocco','North Africa',true),
('MOZ','Mozambique','Msumbiji','Southern Africa',true),
('NAM','Namibia','Namibia','Southern Africa',true),
('NER','Niger','Niger','West Africa',true),
('NGA','Nigeria','Nigeria','West Africa',true),
('RWA','Rwanda','Rwanda','East Africa',true),
('STP','Sao Tome and Principe','Sao Tome na Principe','Central Africa',true),
('SEN','Senegal','Senegal','West Africa',true),
('SYC','Seychelles','Shelisheli','East Africa',true),
('SLE','Sierra Leone','Sierra Leone','West Africa',true),
('SOM','Somalia','Somalia','East Africa',true),
('ZAF','South Africa','Afrika Kusini','Southern Africa',true),
('SSD','South Sudan','Sudani Kusini','East Africa',true),
('SDN','Sudan','Sudan','North Africa',true),
('TZA','Tanzania','Tanzania','East Africa',true),
('TGO','Togo','Togo','West Africa',true),
('TUN','Tunisia','Tunisia','North Africa',true),
('UGA','Uganda','Uganda','East Africa',true),
('ZMB','Zambia','Zambia','Southern Africa',true),
('ZWE','Zimbabwe','Zimbabwe','Southern Africa',true)
on conflict (iso3) do update set name_en=excluded.name_en,name_sw=excluded.name_sw,region=excluded.region,is_active=true;

insert into public.indicators (code,name_en,name_sw,unit,topic) values
('SP.POP.TOTL','Population','Idadi ya watu','people','Demographics'),
('NY.GDP.MKTP.CD','GDP (current US$)','Pato la Taifa (USD)','USD','Economy'),
('NY.GDP.PCAP.CD','GDP per capita','Pato kwa mtu','USD','Economy'),
('SL.UEM.TOTL.ZS','Unemployment rate','Kiwango cha ukosefu wa ajira','%','Employment')
on conflict (code) do update set name_en=excluded.name_en,name_sw=excluded.name_sw,unit=excluded.unit,topic=excluded.topic,is_active=true;

insert into public.sources (code,name,website_url,api_url,documentation_url,license_url,source_type,is_active) values
('WORLDBANK','World Bank Open Data','https://data.worldbank.org/','https://api.worldbank.org/v2/','https://datahelpdesk.worldbank.org/knowledgebase/topics/125589-developer-information','https://www.worldbank.org/en/about/legal/terms-of-use','api',true),
('UNSD','UN Statistics Division','https://data.un.org/','https://unstats.un.org/SDGAPI/','https://unstats.un.org/home/','https://www.un.org/en/about-us/terms-of-use','catalog',true),
('WHO','World Health Organization Data','https://www.who.int/data','https://ghoapi.azureedge.net/api/','https://www.who.int/data/gho/info/gho-odata-api','https://www.who.int/about/policies/publishing/data-policy','catalog',true),
('UNESCO','UNESCO Institute for Statistics','https://uis.unesco.org/','https://api.uis.unesco.org/','https://uis.unesco.org/','https://uis.unesco.org/en/terms-use','catalog',true)
on conflict (code) do update set name=excluded.name,website_url=excluded.website_url,api_url=excluded.api_url,documentation_url=excluded.documentation_url,license_url=excluded.license_url,source_type=excluded.source_type,is_active=true;

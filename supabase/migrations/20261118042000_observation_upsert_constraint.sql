-- Required for idempotent World Bank observation imports.
create unique index if not exists observations_dataset_indicator_country_period_uidx
on public.observations(dataset_id,indicator_id,country_iso3,period_start,period_end);
-- Reconcile reference data with the existing DATA AFRICA V1 schema.
-- The project already has the 54 country records and core tables.
insert into public.indicators (code,name_en,name_sw,unit,topic,is_active) values
('SP.POP.TOTL','Population, total','Jumla ya watu','people','population',true),
('NY.GDP.MKTP.CD','GDP (current US$)','Pato la Taifa (Dola za Marekani)','current US$','economy',true),
('NY.GDP.PCAP.CD','GDP per capita (current US$)','Pato la Taifa kwa mtu (Dola za Marekani)','current US$','economy',true),
('SL.UEM.TOTL.ZS','Unemployment, total (% of labor force)','Ukosefu wa ajira (% ya nguvu kazi)','percent','employment',true)
on conflict (code) do update set name_en=excluded.name_en,name_sw=excluded.name_sw,unit=excluded.unit,topic=excluded.topic,is_active=true;

insert into public.sources
(code,name,website_url,api_url,documentation_url,license_url,terms_url,source_type,attribution_required,is_active)
values
('WORLDBANK','World Bank Open Data','https://data.worldbank.org/','https://api.worldbank.org/v2/','https://datahelpdesk.worldbank.org/knowledgebase/topics/125589-developer-information','https://www.worldbank.org/en/about/legal/terms-of-use','https://www.worldbank.org/en/about/legal/terms-of-use','official',true,true),
('WHO','World Health Organization Data','https://www.who.int/data','https://ghoapi.azureedge.net/api/','https://www.who.int/data/gho/info/gho-odata-api','https://www.who.int/about/policies/publishing/data-policy','https://www.who.int/about/policies/publishing/data-policy','official',true,true),
('UNESCO','UNESCO Institute for Statistics','https://uis.unesco.org/','https://api.uis.unesco.org/','https://uis.unesco.org/','https://uis.unesco.org/en/terms-use','https://uis.unesco.org/en/terms-use','official',true,true),
('UNSD','UN Statistics Division','https://data.un.org/','https://unstats.un.org/SDGAPI/','https://unstats.un.org/home/','https://www.un.org/en/about-us/terms-of-use','https://www.un.org/en/about-us/terms-of-use','official',true,true)
on conflict (code) do update set name=excluded.name,website_url=excluded.website_url,api_url=excluded.api_url,documentation_url=excluded.documentation_url,license_url=excluded.license_url,terms_url=excluded.terms_url,source_type=excluded.source_type,attribution_required=excluded.attribution_required,is_active=true;

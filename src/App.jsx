import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, CheckCircle2, ChevronDown,
  Database, Download, Globe2, Languages, LockKeyhole, LogOut, Menu, RefreshCw,
  Search, ShieldCheck, SlidersHorizontal, X
} from "lucide-react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  BarChart, Bar
} from "recharts";
import { supabase } from "./lib/supabase";

const COUNTRY_SEED = [
["DZA","Algeria","Algeria","North Africa"],["AGO","Angola","Angola","Central Africa"],["BEN","Benin","Benin","West Africa"],["BWA","Botswana","Botswana","Southern Africa"],["BFA","Burkina Faso","Burkina Faso","West Africa"],["BDI","Burundi","Burundi","East Africa"],["CPV","Cabo Verde","Cabo Verde","West Africa"],["CMR","Cameroon","Cameroon","Central Africa"],["CAF","Central African Republic","Jamhuri ya Afrika ya Kati","Central Africa"],["TCD","Chad","Chad","Central Africa"],["COM","Comoros","Komori","East Africa"],["COG","Republic of the Congo","Jamhuri ya Kongo","Central Africa"],["COD","Democratic Republic of the Congo","Jamhuri ya Kidemokrasia ya Kongo","Central Africa"],["CIV","Côte d’Ivoire","Côte d’Ivoire","West Africa"],["DJI","Djibouti","Djibouti","East Africa"],["EGY","Egypt","Misri","North Africa"],["GNQ","Equatorial Guinea","Guinea ya Ikweta","Central Africa"],["ERI","Eritrea","Eritrea","East Africa"],["SWZ","Eswatini","Eswatini","Southern Africa"],["ETH","Ethiopia","Ethiopia","East Africa"],["GAB","Gabon","Gabon","Central Africa"],["GMB","The Gambia","Gambia","West Africa"],["GHA","Ghana","Ghana","West Africa"],["GIN","Guinea","Guinea","West Africa"],["GNB","Guinea-Bissau","Guinea-Bissau","West Africa"],["KEN","Kenya","Kenya","East Africa"],["LSO","Lesotho","Lesotho","Southern Africa"],["LBR","Liberia","Liberia","West Africa"],["LBY","Libya","Libya","North Africa"],["MDG","Madagascar","Madagascar","East Africa"],["MWI","Malawi","Malawi","Southern Africa"],["MLI","Mali","Mali","West Africa"],["MRT","Mauritania","Mauritania","West Africa"],["MUS","Mauritius","Mauritius","East Africa"],["MAR","Morocco","Morocco","North Africa"],["MOZ","Mozambique","Msumbiji","Southern Africa"],["NAM","Namibia","Namibia","Southern Africa"],["NER","Niger","Niger","West Africa"],["NGA","Nigeria","Nigeria","West Africa"],["RWA","Rwanda","Rwanda","East Africa"],["STP","Sao Tome and Principe","Sao Tome na Principe","Central Africa"],["SEN","Senegal","Senegal","West Africa"],["SYC","Seychelles","Shelisheli","East Africa"],["SLE","Sierra Leone","Sierra Leone","West Africa"],["SOM","Somalia","Somalia","East Africa"],["ZAF","South Africa","Afrika Kusini","Southern Africa"],["SSD","South Sudan","Sudani Kusini","East Africa"],["SDN","Sudan","Sudan","North Africa"],["TZA","Tanzania","Tanzania","East Africa"],["TGO","Togo","Togo","West Africa"],["TUN","Tunisia","Tunisia","North Africa"],["UGA","Uganda","Uganda","East Africa"],["ZMB","Zambia","Zambia","Southern Africa"],["ZWE","Zimbabwe","Zimbabwe","Southern Africa"]
].map(([iso3,name_en,name_sw,region]) => ({iso3,name_en,name_sw,region}));

const INDICATOR_SEED = [
{code:"SP.POP.TOTL",name_en:"Population",name_sw:"Idadi ya watu",unit:"people",topic:"Demographics"},
{code:"NY.GDP.MKTP.CD",name_en:"GDP (current US$)",name_sw:"Pato la Taifa (USD)",unit:"USD",topic:"Economy"},
{code:"NY.GDP.PCAP.CD",name_en:"GDP per capita",name_sw:"Pato kwa mtu",unit:"USD",topic:"Economy"},
{code:"SL.UEM.TOTL.ZS",name_en:"Unemployment rate",name_sw:"Kiwango cha ukosefu wa ajira",unit:"%",topic:"Employment"}
];
const REGIONS = ["All regions","North Africa","West Africa","Central Africa","East Africa","Southern Africa"];
const fmt = (v) => Number(v).toLocaleString(undefined,{maximumFractionDigits:2});
const compact = (v) => Intl.NumberFormat("en",{notation:"compact",maximumFractionDigits:1}).format(Number(v));
const nameOf = (c,sw) => sw ? c.name_sw : c.name_en;

export default function App() {
  const [sw,setSw] = useState(false);
  const [countries,setCountries] = useState(COUNTRY_SEED);
  const [indicators,setIndicators] = useState(INDICATOR_SEED);
  const [observations,setObservations] = useState([]);
  const [verifiedCount,setVerifiedCount] = useState(0);
  const [sourceRows,setSourceRows] = useState([]);
  const [loading,setLoading] = useState(true);
  const [connection,setConnection] = useState("checking");
  const [search,setSearch] = useState("");
  const [region,setRegion] = useState("All regions");
  const [activeCountry,setActiveCountry] = useState("TZA");
  const [indicator,setIndicator] = useState("SP.POP.TOTL");
  const [compareA,setCompareA] = useState("TZA");
  const [compareB,setCompareB] = useState("KEN");
  const [page,setPage] = useState("overview");
  const [session,setSession] = useState(null);
  const [isAdmin,setIsAdmin] = useState(false);
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [authError,setAuthError] = useState("");
  const [syncing,setSyncing] = useState(false);
  const [syncResult,setSyncResult] = useState("");
  const [yearFrom,setYearFrom] = useState(2015);
  const [yearTo,setYearTo] = useState(2024);
  const [mobileOpen,setMobileOpen] = useState(false);

  async function loadData() {
    setLoading(true);
    if (!supabase) { setConnection("offline"); setLoading(false); return; }
    const [countryRes,indicatorRes,obsRes,sourceRes,countRes] = await Promise.all([
      supabase.from("countries").select("iso3,name_en,name_sw,region").eq("is_active",true).order("name_en"),
      supabase.from("indicators").select("id,code,name_en,name_sw,unit,topic").eq("is_active",true).order("name_en"),
      supabase.from("observations").select("id,value,period_start,country_iso3,unit,indicator_id,source_url,quality_score").eq("published",true).eq("verification_status","verified").limit(5000),
      supabase.from("sources").select("id,code,name,website_url,api_url,documentation_url,license_url,source_type,is_active").eq("is_active",true).order("name"),
      supabase.from("observations").select("id",{count:"exact",head:true}).eq("published",true).eq("verification_status","verified")
    ]);
    if (countryRes.data?.length) setCountries(countryRes.data);
    if (indicatorRes.data?.length) setIndicators(indicatorRes.data);
    if (obsRes.data) setObservations(obsRes.data);
    if (sourceRes.data) setSourceRows(sourceRes.data);
    setVerifiedCount(countRes.count || 0);
    setConnection(countryRes.error || obsRes.error ? "limited" : "connected");
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    if (!supabase) return;
    supabase.auth.getSession().then(({data}) => {
      setSession(data.session);
      setIsAdmin(data.session?.user?.app_metadata?.role === "admin");
    });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,s) => {
      setSession(s);
      setIsAdmin(s?.user?.app_metadata?.role === "admin");
    });
    return () => subscription.unsubscribe();
  }, []);

  const selectedIndicator = indicators.find(x => x.code === indicator) || INDICATOR_SEED[0];
  const visibleCountries = useMemo(() => countries.filter(c =>
    (region === "All regions" || c.region === region) &&
    [c.name_en,c.name_sw,c.iso3,c.region].join(" ").toLowerCase().includes(search.toLowerCase())
  ),[countries,region,search]);
  const selectedCountry = countries.find(c => c.iso3 === activeCountry) || countries[0];
  const selectedRows = observations.filter(o => o.country_iso3 === activeCountry && o.indicator_id && (indicators.find(i => i.id === o.indicator_id)?.code === indicator || o.indicator_code === indicator));
  const chartRows = selectedRows.map(o => ({year:String(o.period_start).slice(0,4),value:Number(o.value)})).sort((a,b)=>a.year.localeCompare(b.year));
  const compareRows = observations.filter(o => [compareA,compareB].includes(o.country_iso3) && indicators.find(i => i.id === o.indicator_id)?.code === indicator).reduce((acc,o) => { const year=String(o.period_start).slice(0,4); let row=acc.find(x=>x.year===year); if(!row){row={year};acc.push(row)} row[o.country_iso3]=Number(o.value); return acc; },[]).sort((a,b)=>a.year.localeCompare(b.year));
  const sourceCount = sourceRows.length;
  const latestYear = chartRows.length ? chartRows[chartRows.length-1].year : "—";

  async function signIn(e) {
    e.preventDefault(); setAuthError("");
    if (!supabase) { setAuthError("Supabase is not configured yet."); return; }
    const {data,error} = await supabase.auth.signInWithPassword({email,password});
    if (error) { setAuthError(error.message); return; }
    if (data.user?.app_metadata?.role !== "admin") {
      await supabase.auth.signOut();
      setAuthError("This account does not have the admin role.");
    }
  }
  async function signOut() { await supabase?.auth.signOut(); setIsAdmin(false); }
  async function runSync() {
    if (!supabase) return;
    setSyncing(true); setSyncResult("");
    const {data,error} = await supabase.functions.invoke("worldbank-sync",{body:{indicator,startYear:Number(yearFrom),endYear:Number(yearTo)}});
    setSyncing(false);
    if (error) setSyncResult("Sync error: " + error.message);
    else setSyncResult(JSON.stringify(data,null,2));
    await loadData();
  }

  function NavItem({id,icon:Icon,label}) {
    return <button className={"navItem "+(page===id?"active":"")} onClick={()=>{setPage(id);setMobileOpen(false);}}>
      <Icon size={17}/><span>{label}</span>
    </button>;
  }
  const t = sw ? {
    overview:"Muhtasari",countries:"Nchi",compare:"Linganisha",sources:"Vyanzo",admin:"Msimamizi",
    explore:"Chunguza takwimu za Afrika",subtitle:"Takwimu zenye vyanzo vinavyoaminika, uwazi na uhakiki.",
    totalCountries:"Nchi za Afrika",verified:"Takwimu zilizohakikiwa",indicators:"Viashiria",sourcesLabel:"Vyanzo vya data",
    directory:"Orodha ya nchi",search:"Tafuta nchi au msimbo...",allRegions:"Kanda zote",countryProfile:"Wasifu wa nchi",
    selectIndicator:"Chagua kiashiria",noData:"Hakuna takwimu zilizohakikiwa kwa chaguo hili bado.",
    compareTitle:"Linganisha nchi",firstCountry:"Nchi ya kwanza",secondCountry:"Nchi ya pili",
    dataNote:"Takwimu zinazoonekana hapa zimechapishwa baada ya uhakiki.",adminTitle:"Eneo la msimamizi",
    adminDesc:"Ingia kwa akaunti yenye jukumu la admin katika Supabase.",email:"Barua pepe",password:"Nenosiri",
    signIn:"Ingia",sync:"Anzisha uingizaji wa World Bank",startYear:"Mwaka wa kuanza",endYear:"Mwaka wa mwisho",
    signOut:"Toka",loading:"Inapakia...",connected:"Supabase imeunganishwa",offline:"Demo mode — Supabase haijawekwa",
    limited:"Muunganisho wa data una changamoto",latest:"Mwaka wa karibuni",quality:"Uhakiki wa data",
    methodology:"Uwazi wa chanzo",openSource:"Fungua chanzo",empty:"Bado hakuna data iliyochapishwa."
  } : {
    overview:"Overview",countries:"Countries",compare:"Compare",sources:"Sources",admin:"Admin",
    explore:"Explore Africa through data",subtitle:"Trusted statistics with transparent sources and verification.",
    totalCountries:"African countries",verified:"Verified observations",indicators:"Indicators",sourcesLabel:"Data sources",
    directory:"Country directory",search:"Search country or ISO code...",allRegions:"All regions",countryProfile:"Country profile",
    selectIndicator:"Select indicator",noData:"No verified observations are available for this selection yet.",
    compareTitle:"Compare countries",firstCountry:"First country",secondCountry:"Second country",
    dataNote:"Statistics shown here are published only after verification.",adminTitle:"Administrator area",
    adminDesc:"Sign in with an account assigned the admin role in Supabase.",email:"Email address",password:"Password",
    signIn:"Sign in",sync:"Run World Bank import",startYear:"Start year",endYear:"End year",
    signOut:"Sign out",loading:"Loading...",connected:"Supabase connected",offline:"Demo mode — Supabase not configured",
    limited:"Data connection has an issue",latest:"Latest year",quality:"Data verification",
    methodology:"Source transparency",openSource:"Open source",empty:"No published data yet."
  };

  return <div className="appShell">
    <aside className={"sidebar "+(mobileOpen?"sidebarOpen":"")}>
      <div className="brand"><span className="brandMark"><Globe2 size={22}/></span><span>DATA <b>AFRICA</b><small>INTELLIGENCE PLATFORM</small></span><button className="mobileClose" onClick={()=>setMobileOpen(false)}><X size={18}/></button></div>
      <div className="sideLabel">WORKSPACE</div>
      <nav>
        <NavItem id="overview" icon={Activity} label={t.overview}/>
        <NavItem id="countries" icon={Globe2} label={t.countries}/>
        <NavItem id="compare" icon={BarChart3} label={t.compare}/>
        <NavItem id="sources" icon={Database} label={t.sources}/>
      </nav>
      <div className="sideBottom">
        <div className="connection"><span className={"dot "+connection}></span><span>{connection==="connected"?t.connected:connection==="offline"?t.offline:t.limited}</span></div>
        <NavItem id="admin" icon={LockKeyhole} label={t.admin}/>
      </div>
    </aside>
    {mobileOpen && <button className="scrim" onClick={()=>setMobileOpen(false)} aria-label="Close menu"/>}
    <div className="mainArea">
      <header className="topbar">
        <button className="menuButton" onClick={()=>setMobileOpen(true)}><Menu/></button>
        <div className="breadcrumb">DATA AFRICA <span>/</span> {t[page]}</div>
        <div className="topActions"><span className="livePill"><i/> {connection==="connected"?"DATA CONNECTED":"V1 PREVIEW"}</span><button className="languageButton" onClick={()=>setSw(!sw)}><Languages size={16}/>{sw?"English":"Kiswahili"}</button></div>
      </header>
      <main className="content">
        {page==="overview" && <>
          <section className="welcome"><div><div className="eyebrow">AFRICAN DATA INTELLIGENCE</div><h1>{t.explore}</h1><p>{t.subtitle}</p></div><div className="welcomeGlobe"><Globe2 size={88}/><span>54 COUNTRIES</span></div></section>
          <section className="metricGrid">
            <article className="metricCard"><div className="metricIcon mint"><Globe2/></div><span>{t.totalCountries}</span><strong>{countries.length}</strong><small>Across 5 African regions</small></article>
            <article className="metricCard"><div className="metricIcon blue"><ShieldCheck/></div><span>{t.verified}</span><strong>{fmt(verifiedCount)}</strong><small>{verifiedCount ? "Verified & published" : "Awaiting first verified import"}</small></article>
            <article className="metricCard"><div className="metricIcon violet"><BarChart3/></div><span>{t.indicators}</span><strong>{indicators.length}</strong><small>Economic & demographic</small></article>
            <article className="metricCard"><div className="metricIcon amber"><Database/></div><span>{t.sourcesLabel}</span><strong>{sourceCount}</strong><small>Registered source catalog</small></article>
          </section>
          <section className="panel chartPanel"><div className="panelHead"><div><div className="eyebrow">DATA EXPLORER</div><h2>{t.countryProfile}</h2></div><div className="chartControls"><select value={activeCountry} onChange={e=>setActiveCountry(e.target.value)}>{countries.map(c=><option key={c.iso3} value={c.iso3}>{nameOf(c,sw)}</option>)}</select><select value={indicator} onChange={e=>setIndicator(e.target.value)}>{indicators.map(i=><option key={i.code} value={i.code}>{sw?i.name_sw:i.name_en}</option>)}</select></div></div>
            {chartRows.length ? <div className="chartWrap"><ResponsiveContainer width="100%" height={280}><LineChart data={chartRows}><CartesianGrid strokeDasharray="3 3" stroke="#24384a"/><XAxis dataKey="year" stroke="#8da1b3"/><YAxis stroke="#8da1b3" tickFormatter={compact}/><Tooltip contentStyle={{background:"#102438",border:"1px solid #29445b",borderRadius:10}} formatter={v=>fmt(v)}/><Line type="monotone" dataKey="value" stroke="#63d9a3" strokeWidth={3} dot={false} activeDot={{r:5}}/></LineChart></ResponsiveContainer></div> : <div className="emptyState"><BarChart3 size={34}/><b>{t.noData}</b><span>{selectedIndicator?.name_en} · {selectedCountry?.name_en || "Africa"}</span></div>}
            <div className="chartFoot"><span>{selectedCountry?.name_en || "Africa"} · {selectedIndicator?.unit || "—"}</span><span>{t.latest}: {latestYear}</span></div>
          </section>
          <section className="bottomGrid"><div className="panel"><div className="panelHead"><div><div className="eyebrow">REGIONAL COVERAGE</div><h2>Explore by region</h2></div></div><div className="regionList">{REGIONS.slice(1).map(r=><button key={r} onClick={()=>{setRegion(r);setPage("countries");}}><span>{r}</span><b>{countries.filter(c=>c.region===r).length}</b><ChevronDown size={15}/></button>)}</div></div><div className="panel trustPanel"><ShieldCheck size={28}/><h3>{t.methodology}</h3><p>{t.dataNote}</p><div className="trustLine"><CheckCircle2 size={15}/> Source attribution</div><div className="trustLine"><CheckCircle2 size={15}/> Verification status</div><div className="trustLine"><CheckCircle2 size={15}/> Publication controls</div></div></section>
        </>}
        {page==="countries" && <section><div className="pageTitle"><div><div className="eyebrow">COUNTRY DIRECTORY</div><h1>{t.directory}</h1><p>Browse all 54 countries and explore their available indicators.</p></div><span className="countPill">{visibleCountries.length} / {countries.length}</span></div><div className="filterBar"><label className="searchBox"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t.search}/></label><label className="selectBox"><SlidersHorizontal size={16}/><select value={region} onChange={e=>setRegion(e.target.value)}>{REGIONS.map(r=><option key={r} value={r}>{r==="All regions"?t.allRegions:r}</option>)}</select></label></div><div className="countryGrid">{visibleCountries.map(c=><button className={"countryCard "+(activeCountry===c.iso3?"chosen":"")} key={c.iso3} onClick={()=>{setActiveCountry(c.iso3);setPage("overview");}}><span className="countryCode">{c.iso3}</span><b>{nameOf(c,sw)}</b><small>{c.region}</small><span className="countryArrow">↗</span></button>)}</div></section>}
        {page==="compare" && <section><div className="pageTitle"><div><div className="eyebrow">CROSS-COUNTRY ANALYSIS</div><h1>{t.compareTitle}</h1><p>Compare verified observations using the same indicator and reporting years.</p></div></div><div className="panel comparePanel"><div className="compareControls"><label>{t.firstCountry}<select value={compareA} onChange={e=>setCompareA(e.target.value)}>{countries.map(c=><option key={c.iso3} value={c.iso3}>{nameOf(c,sw)}</option>)}</select></label><label>{t.secondCountry}<select value={compareB} onChange={e=>setCompareB(e.target.value)}>{countries.map(c=><option key={c.iso3} value={c.iso3}>{nameOf(c,sw)}</option>)}</select></label><label>{t.selectIndicator}<select value={indicator} onChange={e=>setIndicator(e.target.value)}>{indicators.map(i=><option key={i.code} value={i.code}>{sw?i.name_sw:i.name_en}</option>)}</select></label></div><div className="compareChart">{compareRows.length ? <ResponsiveContainer width="100%" height={320}><BarChart data={compareRows.map(o=>({country:o.country_iso3,year:String(o.period_start).slice(0,4),value:Number(o.value)}))}><CartesianGrid strokeDasharray="3 3" stroke="#24384a"/><XAxis dataKey="year" stroke="#8da1b3"/><YAxis stroke="#8da1b3" tickFormatter={compact}/><Tooltip contentStyle={{background:"#102438",border:"1px solid #29445b",borderRadius:10}}/><Bar dataKey={compareA} name={countries.find(c=>c.iso3===compareA)?.name_en || compareA} fill="#63d9a3" radius={[5,5,0,0]}/><Bar dataKey={compareB} name={countries.find(c=>c.iso3===compareB)?.name_en || compareB} fill="#78aee0" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer> : <div className="emptyState"><BarChart3 size={34}/><b>{t.noData}</b><span>{t.dataNote}</span></div>}</div></div></section>}
        {page==="sources" && <section><div className="pageTitle"><div><div className="eyebrow">TRANSPARENCY REGISTER</div><h1>Data sources</h1><p>Source information and attribution are part of every published dataset.</p></div></div><div className="sourceGrid">{sourceRows.length ? sourceRows.map(source=><article className="panel sourceCard" key={source.id}><div className="sourceLogo">{(source.code || source.name || "DS").slice(0,2).toUpperCase()}</div><h3>{source.name}</h3><p>{source.source_type || "Registered data provider"} · Attribution {source.license_url ? "and license details available" : "details pending"}.</p>{source.website_url && <a href={source.website_url} target="_blank" rel="noreferrer">{source.website_url.replace(/^https?:\\/\\//,"")} ↗</a>}<span className="sourceStatus">{source.api_url ? "API registered" : "Catalog source"}</span></article>) : <div className="emptyState"><Database/><b>No active sources are available.</b></div>}</div><div className="panel notePanel"><ShieldCheck/><div><b>Publication policy</b><p>Each observation should retain its original source URL, reporting period, unit and verification status. Data without verification is not displayed as a confirmed statistic.</p></div></div></section>}
        {page==="admin" && <section><div className="pageTitle"><div><div className="eyebrow">SECURE CONTROL CENTRE</div><h1>{t.adminTitle}</h1><p>{t.adminDesc}</p></div>{isAdmin&&<button className="outlineButton" onClick={signOut}><LogOut size={16}/>{t.signOut}</button>}</div>{!isAdmin ? <form className="panel authPanel" onSubmit={signIn}><div className="authIcon"><LockKeyhole/></div><h2>Admin sign in</h2><p>Only accounts with the admin role in Supabase app metadata can access ingestion controls.</p><label>{t.email}<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username"/></label><label>{t.password}<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label>{authError&&<div className="errorBox">{authError}</div>}<button className="primaryButton" type="submit">{t.signIn}</button></form> : <div className="panel syncPanel"><div className="panelHead"><div><div className="eyebrow">INGESTION JOB</div><h2>World Bank synchronisation</h2></div><span className="secureTag"><ShieldCheck size={14}/> ADMIN VERIFIED</span></div><p>Fetch data from the World Bank API for the selected indicator and year range. Imported observations pass server-side checks before publication.</p><div className="syncFields"><label>{t.selectIndicator}<select value={indicator} onChange={e=>setIndicator(e.target.value)}>{INDICATOR_SEED.map(i=><option key={i.code} value={i.code}>{i.name_en}</option>)}</select></label><label>{t.startYear}<input type="number" min="1960" max="2025" value={yearFrom} onChange={e=>setYearFrom(e.target.value)}/></label><label>{t.endYear}<input type="number" min="1960" max="2025" value={yearTo} onChange={e=>setYearTo(e.target.value)}/></label></div><button className="primaryButton" disabled={syncing||Number(yearTo)<Number(yearFrom)} onClick={runSync}><RefreshCw size={16} className={syncing?"spin":""}/>{syncing?"Synchronising…":t.sync}</button>{syncResult&&<pre className="syncResult">{syncResult}</pre>}</div>}</section>}
      </main>
      <footer className="footer"><span>© {new Date().getFullYear()} DATA AFRICA</span><span>Evidence · Transparency · Insight</span><span className="footerStatus"><i/> {connection==="connected"?"Connected":connection==="offline"?"Preview mode":"Checking connection"}</span></footer>
    </div>
  </div>;
}
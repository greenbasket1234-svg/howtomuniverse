import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const dataDir=mkdtempSync(path.join(tmpdir(),'howtom-metrics-'));
mkdirSync(dataDir,{recursive:true});
const advertiser={id:'adv-1',name:'검증 광고주',accounts:[
  {channel:'meta',status:'connected',account_id:'act_test',last_synced_at:'2026-08-19T03:00:00.000Z',last_row_count:4,last_sync_error:null},
  {channel:'naver',status:'connected',account_id:'naver-test',api_key:'x',secret_key:'y',last_synced_at:'2026-08-19T03:01:00.000Z',last_row_count:4,last_sync_error:null},
  {channel:'google',status:'connected',account_id:'google-test'},
  {channel:'kakao',status:'disconnected',account_id:''},
]};
const dailyMetrics=[
  {advertiserId:'adv-1',channel:'meta',date:'2026-08-10',impressions:1000,clicks:100,spend:100000,dbCount:10,purchases:2,revenue:300000},
  {advertiserId:'adv-1',channel:'meta',date:'2026-08-11',impressions:2000,clicks:200,spend:200000,dbCount:20,purchases:4,revenue:600000},
  {advertiserId:'adv-1',channel:'naver',date:'2026-08-10',impressions:500,clicks:50,spend:50000,dbCount:5,purchases:1,revenue:100000},
  {advertiserId:'adv-1',channel:'naver',date:'2026-08-11',impressions:700,clicks:70,spend:70000,dbCount:7,purchases:2,revenue:140000},
  {advertiserId:'adv-1',channel:'meta',date:'2026-07-31',impressions:999,clicks:99,spend:99999,dbCount:9,purchases:1,revenue:99999},
];
const campaignMetrics=[
  {advertiserId:'adv-1',channel:'meta',date:'2026-08-10',campaignId:'cmp-m1',campaignName:'Meta 캠페인',impressions:1000,clicks:100,spend:100000,dbCount:10,purchases:2,revenue:300000},
  {advertiserId:'adv-1',channel:'meta',date:'2026-08-11',campaignId:'cmp-m1',campaignName:'Meta 캠페인',impressions:2000,clicks:200,spend:200000,dbCount:20,purchases:4,revenue:600000},
  {advertiserId:'adv-1',channel:'naver',date:'2026-08-10',campaignId:'cmp-n1',campaignName:'네이버 캠페인',impressions:500,clicks:50,spend:50000,dbCount:5,purchases:1,revenue:100000},
  {advertiserId:'adv-1',channel:'naver',date:'2026-08-11',campaignId:'cmp-n1',campaignName:'네이버 캠페인',impressions:700,clicks:70,spend:70000,dbCount:7,purchases:2,revenue:140000},
];
const creativeDailyMetrics=[
  {advertiserId:'adv-1',channel:'meta',date:'2026-08-10',campaignId:'cmp-m1',campaignName:'Meta 캠페인',adId:'ad-m1',adName:'Meta 소재',impressions:1000,clicks:100,spend:100000,dbCount:10,purchases:2,revenue:300000},
  {advertiserId:'adv-1',channel:'meta',date:'2026-08-11',campaignId:'cmp-m1',campaignName:'Meta 캠페인',adId:'ad-m1',adName:'Meta 소재',impressions:2000,clicks:200,spend:200000,dbCount:20,purchases:4,revenue:600000},
  {advertiserId:'adv-1',channel:'naver',date:'2026-08-10',campaignId:'cmp-n1',campaignName:'네이버 캠페인',adId:'ad-n1',adName:'네이버 소재',impressions:500,clicks:50,spend:50000,dbCount:5,purchases:1,revenue:100000},
  {advertiserId:'adv-1',channel:'naver',date:'2026-08-11',campaignId:'cmp-n1',campaignName:'네이버 캠페인',adId:'ad-n1',adName:'네이버 소재',impressions:700,clicks:70,spend:70000,dbCount:7,purchases:2,revenue:140000},
];
const keywordDailyMetrics=[
  {advertiserId:'adv-1',channel:'naver',date:'2026-08-10',campaignId:'cmp-n1',campaignName:'네이버 캠페인',adgroupId:'grp-n1',keywordId:'kw-1',keyword:'장기렌트',impressions:500,clicks:50,spend:50000,dbCount:5,purchases:1,revenue:100000},
  {advertiserId:'adv-1',channel:'naver',date:'2026-08-11',campaignId:'cmp-n1',campaignName:'네이버 캠페인',adgroupId:'grp-n1',keywordId:'kw-1',keyword:'장기렌트',impressions:700,clicks:70,spend:70000,dbCount:7,purchases:2,revenue:140000},
];
const syncValidationLogs=[{id:'syncv-1',createdAt:'2026-08-19T03:02:00.000Z',advertiserId:'adv-1',accountId:'act_test',channel:'meta',since:'2026-08-10',until:'2026-08-11',sourceLabel:'Meta account insights',source:{impressions:3000,clicks:300,spend:300000,dbCount:30,purchases:6,revenue:900000},stored:{impressions:3000,clicks:300,spend:300000,dbCount:30,purchases:6,revenue:900000},delta:{impressions:0,clicks:0,spend:0,dbCount:0,purchases:0,revenue:0},ok:true}];
writeFileSync(path.join(dataDir,'howtom-db.json'),JSON.stringify({advertisers:[advertiser],blogProjects:[],blogStyles:[],blogAssets:[],logs:[],dailyMetrics,campaignMetrics,creativeMetrics:[],creativeDailyMetrics,keywordMetrics:[],keywordDailyMetrics,syncValidationLogs,scheduleSlots:[]},null,2));

const port=47891;
const env={...process.env,PORT:String(port),HOWTOM_DATA_DIR:dataDir,HOWTOM_ADMIN_EMAIL:'admin@test.local',HOWTOM_ADMIN_PASSWORD:'test-password-123!',HOWTOM_ADMIN_NAME:'관리자',JWT_SECRET:'0123456789abcdef0123456789abcdef',NODE_ENV:'test'};
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env,stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
const base=`http://127.0.0.1:${port}/api`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(){for(let i=0;i<80;i++){try{const r=await fetch(`${base}/health`);if(r.ok)return}catch{}await sleep(100)}throw new Error(`server start timeout\n${logs}`)}
async function main(){
  await wait();
  const login=await fetch(`${base}/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'admin@test.local',password:'test-password-123!'})});assert.equal(login.status,200);const {token}=await login.json();assert.ok(token);
  const headers={authorization:`Bearer ${token}`};
  const get=async p=>{const r=await fetch(`${base}${p}`,{headers});if(r.status!==200){const text=await r.text();throw new Error(`${p} HTTP ${r.status} ${text}`)}return r.json()};
  const q='?from=2026-08-10&to=2026-08-11&advertiserId=adv-1';
  const daily=await get(`/metrics/daily${q}`);assert.equal(daily.rows.length,4);assert.equal(daily.rows.reduce((s,r)=>s+r.spend,0),420000);
  const summary=await get(`/metrics/summary${q}`);assert.equal(summary.summary.spend,420000);assert.equal(summary.summary.revenue,1140000);
  const campaigns=await get(`/metrics/campaigns${q}`);assert.equal(campaigns.rows.length,2);assert.equal(campaigns.rows.reduce((s,r)=>s+r.spend,0),420000);assert.equal(campaigns.dailyRows.length,4);
  const creatives=await get(`/metrics/creatives${q}`);assert.equal(creatives.rows.length,2);assert.equal(creatives.rows.reduce((s,r)=>s+r.spend,0),420000);const metaCreative=creatives.rows.find(r=>r.channel==='meta');assert.equal(metaCreative.impressions,3000);assert.equal(metaCreative.clicks,300);assert.equal(metaCreative.spend,300000);assert.equal(metaCreative.dbCount,30);assert.equal(metaCreative.revenue,900000);assert.equal(Math.round(metaCreative.ctr*100)/100,10);assert.equal(metaCreative.cpc,1000);assert.equal(metaCreative.cpm,100000);assert.equal(metaCreative.cpa,10000);assert.equal(metaCreative.roas,300);
  const keywords=await get(`/metrics/keywords${q}`);assert.equal(keywords.rows.length,1);assert.equal(keywords.rows[0].spend,120000);assert.equal(keywords.rows[0].clicks,120);
  const funnel=await get(`/metrics/funnel${q}`);assert.equal(funnel.rows.reduce((s,r)=>s+r.spend,0),420000);
  const status=await get(`/metrics/status${q}`);assert.equal(status.rows.find(r=>r.channel==='meta').status,'connected');assert.equal(status.rows.find(r=>r.channel==='naver').status,'connected');assert.equal(status.rows.find(r=>r.channel==='google').status,'connector_unimplemented');assert.equal(status.rows.find(r=>r.channel==='kakao').status,'disconnected');
  const validation=await get('/integrations/sync-validation?advertiserId=adv-1&limit=10');assert.equal(validation.rows[0].ok,true);assert.equal(validation.rows[0].delta.spend,0);assert.equal(validation.rows[0].accountId,'act_test');assert.equal(validation.rows[0].advertiserName,'검증 광고주');
  const reportRes=await fetch(`${base}/reports/daily-performance`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({advertiserName:'검증 광고주',month:'2026-08',platforms:['메타','네이버']})});assert.equal(reportRes.status,200);const report=await reportRes.json();const reportSpend=Object.values(report.source).reduce((sum,row)=>sum+row.spend.reduce((a,b)=>a+b,0),0);assert.equal(reportSpend,420000);assert.equal(report.mode,'central-metrics');
  const unsupportedSync=await fetch(`${base}/integrations/sync`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({advertiserId:'adv-1',channel:'google',days:30})});assert.equal(unsupportedSync.status,501);const unsupportedBody=await unsupportedSync.json();assert.equal(unsupportedBody.status,'connector_unimplemented');
  const outside=await get('/metrics/daily?from=2026-07-31&to=2026-07-31&advertiserId=adv-1');assert.equal(outside.rows.length,1);assert.equal(outside.rows[0].spend,99999);
  console.log('METRICS_INTEGRATION_TEST_OK');
}
try{await main()}finally{child.kill('SIGTERM');await sleep(150);rmSync(dataDir,{recursive:true,force:true})}

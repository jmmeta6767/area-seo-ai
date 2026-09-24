'use strict';
const EXPECTED_STATE_KEYS=['approval_queue','site_history','quality_history'];
function summarizeStateRows(rows){const present=[...new Set((rows||[]).map(x=>x.key).filter(k=>EXPECTED_STATE_KEYS.includes(k)))].sort(),missing=EXPECTED_STATE_KEYS.filter(k=>!present.includes(k));return{expected:[...EXPECTED_STATE_KEYS],present,missing,complete:missing.length===0,updatedAt:Object.fromEntries((rows||[]).filter(x=>EXPECTED_STATE_KEYS.includes(x.key)).map(x=>[x.key,x.updated_at]))}}
function createPersistentStore({databaseUrl=process.env.DATABASE_URL}={}){
  if(!databaseUrl)return {configured:false,kind:'file',init:async()=>{},close:async()=>{}};
  const {Pool}=require('pg');
  const pool=new Pool({connectionString:databaseUrl,ssl:process.env.PGSSL==="disable"?false:{rejectUnauthorized:false},max:3,connectionTimeoutMillis:8000,idleTimeoutMillis:10000});
  async function init(){
    await pool.query(`CREATE TABLE IF NOT EXISTS area_seo_state (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS area_seo_audit (
      id bigserial PRIMARY KEY,
      at timestamptz NOT NULL DEFAULT now(),
      event text NOT NULL,
      draft_id text,
      from_status text,
      to_status text,
      detail jsonb
    )`);
  }
  async function get(key,fallback){const r=await pool.query('SELECT value FROM area_seo_state WHERE key=$1',[key]);return r.rowCount?r.rows[0].value:fallback}
  async function set(key,value){await pool.query(`INSERT INTO area_seo_state(key,value,updated_at) VALUES($1,$2::jsonb,now())
    ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=now()`,[key,JSON.stringify(value)]);return value}
  async function audit(e){await pool.query('INSERT INTO area_seo_audit(event,draft_id,from_status,to_status,detail) VALUES($1,$2,$3,$4,$5::jsonb)',[String(e.event||''),e.draftId||null,e.from||null,e.to||null,JSON.stringify(e.detail||null)])}
  async function events(limit=100){const n=Math.max(1,Math.min(Number(limit)||100,500)),r=await pool.query('SELECT at,event,draft_id AS "draftId",from_status AS "from",to_status AS "to",detail FROM area_seo_audit ORDER BY id DESC LIMIT $1',[n]);return r.rows}
  async function allEvents(){const r=await pool.query('SELECT at,event,draft_id AS "draftId",from_status AS "from",to_status AS "to",detail FROM area_seo_audit ORDER BY id ASC');return r.rows}
  async function stateStatus(){
    const r=await pool.query('SELECT key,updated_at FROM area_seo_state WHERE key = ANY($1::text[]) ORDER BY key',[EXPECTED_STATE_KEYS]);
    return summarizeStateRows(r.rows);
  }
  async function health(){const t=Date.now(),r=await pool.query(`SELECT current_database() AS database, current_user AS role, current_setting('server_version') AS version`);return{ok:true,kind:'postgres',latencyMs:Date.now()-t,database:r.rows[0].database,role:r.rows[0].role,version:r.rows[0].version}}
  async function counts(){const [s,a]=await Promise.all([pool.query('SELECT count(*)::int AS n FROM area_seo_state'),pool.query('SELECT count(*)::int AS n FROM area_seo_audit')]);return{stateRows:s.rows[0].n,auditRows:a.rows[0].n}}
  async function restoreSnapshot({approvalQueue,siteHistory,qualityHistory,auditEvents}){
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      for(const [key,value] of [['approval_queue',approvalQueue],['site_history',siteHistory],['quality_history',qualityHistory]]){
        await client.query(`INSERT INTO area_seo_state(key,value,updated_at) VALUES($1,$2::jsonb,now())
          ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=now()`,[key,JSON.stringify(value)]);
      }
      await client.query('DELETE FROM area_seo_audit');
      for(const e of auditEvents){
        await client.query('INSERT INTO area_seo_audit(at,event,draft_id,from_status,to_status,detail) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[
          e.at||new Date().toISOString(),String(e.event||''),e.draftId||null,e.from||null,e.to||null,JSON.stringify(e.detail??null)
        ]);
      }
      await client.query('COMMIT');
    }catch(e){try{await client.query('ROLLBACK')}catch{}throw e}
    finally{client.release()}
  }
  return {configured:true,kind:'postgres',init,get,set,audit,events,allEvents,stateStatus,health,counts,restoreSnapshot,close:()=>pool.end()};
}
module.exports={createPersistentStore,summarizeStateRows,EXPECTED_STATE_KEYS};

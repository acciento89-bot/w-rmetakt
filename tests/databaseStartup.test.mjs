import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
const sqliteUrl='data:text/javascript,'+encodeURIComponent('export const openDatabaseAsync=(...args)=>globalThis.__warmSQLite.open(...args);');
registerHooks({resolve(specifier,context,next){
 if(specifier==='expo-sqlite')return {url:sqliteUrl,shortCircuit:true};
 if(specifier.startsWith('./') && context.parentURL?.includes('/src/') && !/\.[a-z]+$/.test(specifier))specifier+='.ts';
 return next(specifier,context);
}});
let sequence=0;
async function actualDatabase(open){globalThis.__warmSQLite={open};return (await import(pathToFileURL(process.cwd()+'/src/database.ts').href+'?startup='+ ++sequence)).database;}
function client(){return {execAsync:async()=>{},getAllAsync:async()=>['flow_c','return_c','compressor_hours','hot_water_kwh'].map(name=>({name})),getFirstAsync:async()=>null};}
test('parallel App and purchase initialization share one native connection and one migration',async()=>{
 let opens=0,migrations=0;const c=client();c.execAsync=async()=>{migrations++;await new Promise(resolve=>setImmediate(resolve));};
 const db=await actualDatabase(async()=>{opens++;await new Promise(resolve=>setImmediate(resolve));return c;});
 await Promise.all([db.initialize(),db.initialize()]);
 assert.equal(opens,1,'concurrent startup must not create duplicate native handles');assert.equal(migrations,1,'schema setup must have one in-flight owner');
 assert.equal(await db.getState('pro_entitlement'),null);assert.equal(opens,1);
});
test('failed native open can retry without caching a rejected startup forever',async()=>{
 let attempts=0;const db=await actualDatabase(async()=>{if(++attempts===1)throw new Error('open unavailable');return client();});
 await assert.rejects(db.initialize(),/open unavailable/);await db.initialize();assert.equal(attempts,2);
});
test('schema failure remains visible and a later explicit initialize retries',async()=>{
 const c=client();let attempts=0;c.execAsync=async()=>{if(++attempts===1)throw new Error('schema unavailable');};
 const db=await actualDatabase(async()=>c);await assert.rejects(db.initialize(),/schema unavailable/);await db.initialize();assert.equal(attempts,2);
});

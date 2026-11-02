'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'../js/features/tower-save-backup.js'),'utf8');
const boot=()=>{
 const values=new Map();
 const storage={getItem:k=>values.has(k)?values.get(k):null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const world={window:null,Date,JSON,console};world.window=world;vm.runInNewContext(script,world);
 return {world,storage,values};
};
const record=JSON.stringify({records:{time_hero:{best:10,attempts:5,victories:1}},last:null});
const heroes=JSON.stringify([{name:'내 캐릭터',signatureVersion:1,skills:[{name:'돌진',actions:[{type:'dash'}]}]}]);
test('local backup round-trip preserves tower and fighter saves without remote requests',()=>{
 const {world,storage}=boot();
 storage.setItem('oibung-tower-v1',record);storage.setItem('oibung-forge-v3',heroes);
 storage.setItem('oibung-ancient-one-clear','true');
 const json=world.ArenaSaveBackup.snapshot(storage);
 storage.setItem('oibung-tower-v1',JSON.stringify({records:{},last:null}));
 const restored=world.ArenaSaveBackup.restore(storage,json);
 assert.deepEqual([...restored].sort(),[...world.ArenaSaveBackup.KEYS].sort());
 assert.equal(storage.getItem('oibung-tower-v1'),record);
 assert.equal(storage.getItem('oibung-forge-v3'),heroes);
 assert.equal(storage.getItem('oibung-ancient-one-clear'),'true');
});
test('reject malformed or suspicious backups before writing any save',()=>{
 const {world,storage}=boot(),x=world.ArenaSaveBackup;
 storage.setItem('oibung-tower-v1',record);
 assert.throws(()=>x.restore(storage,'{"format":"wrong"}'));
 const invalid={format:x.FORMAT,version:1,entries:{'oibung-forge-v3':'{"not":"an array"}'}};
 assert.throws(()=>x.restore(storage,JSON.stringify(invalid)),/형식/);
 invalid.entries={'unknown-key':'true'};
 assert.throws(()=>x.restore(storage,JSON.stringify(invalid)),/알 수 없는/);
 invalid.entries={'oibung-tower-v1':JSON.stringify({records:{time_hero:{best:200,attempts:0,victories:0}}})};
 assert.throws(()=>x.restore(storage,JSON.stringify(invalid)),/잘못된 탑 기록/);
 assert.equal(storage.getItem('oibung-tower-v1'),record,'failed import cannot corrupt original');
});
test('backup restore rolls back already written keys if storage quota fails',()=>{
 const {world,storage}=boot(),x=world.ArenaSaveBackup;
 storage.setItem('oibung-tower-v1',record);
 const source=JSON.stringify({format:x.FORMAT,version:1,entries:{
  'oibung-tower-v1':JSON.stringify({records:{},last:null}), 'oibung-forge-v3':heroes
 }});
 const broken={...storage,setItem(k,v){if(k==='oibung-forge-v3')throw Error('quota');storage.setItem(k,v);}};
 assert.throws(()=>x.restore(broken,source),/저장 공간/);
 assert.equal(storage.getItem('oibung-tower-v1'),record);
});

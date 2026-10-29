'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test('fast projectiles hit enemies crossed between snapshots',async()=>{
 const r=await import('../workers/pvp-rules.mjs');
 const p=r.normalizeProfile({skills:[{type:'shot'}]});
 const room=r.createRoom(p,p,'manual',1000);
 room.players[1].x=300;
 room.projectiles.push({owner:0,x:200,y:230,vx:2000,vy:0,damage:17,life:1});
 r.step(room,.1,1100);
 assert.equal(room.players[1].hp,223);
 assert.equal(room.projectiles.length,0);
});
test('overdue combo actions preserve chronological execution order',async()=>{
 const r=await import('../workers/pvp-rules.mjs');
 const p=r.normalizeProfile({skills:[{actions:[{type:'shield'},{type:'dash'},{type:'wave'}]}]});
 const room=r.createRoom(p,p,'manual',1000);
 room.players[1].x=310;
 r.cast(room,0,0,1000);r.step(room,.05,1400);
 assert.equal(room.players[1].hp,220,'dash must precede the in-range wave');
});

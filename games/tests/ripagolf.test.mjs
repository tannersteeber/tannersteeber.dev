import test from 'node:test';
import assert from 'node:assert/strict';
import {Course} from '../ripagolf/Course.js';
import {BallPhysics} from '../ripagolf/BallPhysics.js';
import {CLUBS,predictions,predictionWon,scoreName,reward} from '../ripagolf/rules.js';
import {GolfStore} from '../ripagolf/Store.js';
const saved=new Map();globalThis.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)};
function flat(lie='fairway',options={}){return {tee:{x:0,z:0},pin:{x:0,z:2000},height:()=>0,surface:()=>lie,slope:()=>({x:0,z:0}),windAt:()=>({x:0,z:0}),inBounds:()=>true,relief:()=>({x:0,z:0}),trees:[],...options};}
function simulate(course,spec,dt=1/60){const ball=new BallPhysics(course);let impact=null,event=null;ball.onBounce=()=>{impact??={...ball.p};};ball.launch(spec);for(let i=0;i<Math.ceil(36/dt);i++){event=ball.update(dt,0);if(event?.type==='penalty'||ball.status==='rest'||ball.status==='holed')break;}return {ball,event,impact};}
test('seeded courses cover all pars and maintain a safe tee-to-green corridor',()=>{
 const pars=new Set();for(let seed=1;seed<=150;seed++){
  const c=new Course(seed,seed%70+1);pars.add(c.par);assert.ok(c.length>100&&c.length<470);assert.equal(c.surface(c.pin.x,c.pin.z),'green');
  for(let z=0;z<=c.length;z+=4){assert.ok(['fairway','green','tee'].includes(c.surface(c.center(z),z)));assert.ok(Number.isFinite(c.height(c.center(z),z)));}
  const copy=new Course(seed,seed%70+1);assert.equal(copy.length,c.length);assert.deepEqual(copy.hazards,c.hazards);assert.deepEqual(copy.wind,c.wind);assert.deepEqual(copy.pin,c.pin);
 }assert.deepEqual([...pars].sort(),[3,4,5]);
});
test('club distances are meaningful, power matters and input uses one deterministic simulation',()=>{
 const distances=CLUBS.slice(0,8).map((_,club)=>simulate(flat(),{club,power:1,aim:0}).ball.p.z);
 for(let i=1;i<distances.length;i++)assert.ok(distances[i-1]>distances[i],`${CLUBS[i-1].name} vs ${CLUBS[i].name}`);
 assert.ok(distances[0]>230&&distances[0]<330);assert.ok(distances[7]>35&&distances[7]<70);
 const full=simulate(flat(),{club:4,power:1}),soft=simulate(flat(),{club:4,power:.4});assert.ok(soft.ball.p.z<full.ball.p.z*.65);
 const at30=simulate(flat(),{club:3,power:.8},1/30),at120=simulate(flat(),{club:3,power:.8},1/120);assert.ok(Math.abs(at30.ball.p.z-at120.ball.p.z)<.001);
});
test('wind, spin, lie and slope affect shots without prediction-dependent manipulation',()=>{
 const calm=simulate(flat(),{club:4,power:.8});const wind=simulate(flat('fairway',{windAt:()=>({x:6,z:0})}),{club:4,power:.8});assert.ok(wind.ball.p.x>calm.ball.p.x+1);
 const back=simulate(flat(),{club:4,power:.8,spin:1}),top=simulate(flat(),{club:4,power:.8,spin:-1});assert.ok(back.ball.p.z-back.impact.z<top.ball.p.z-top.impact.z);
 const sand=simulate(flat('sand'),{club:4,power:.8});assert.ok(sand.ball.p.z<calm.ball.p.z*.7);
 const downhill=simulate(flat('green',{height:(x,z)=>-z*.015,slope:()=>({x:0,z:-.015})}),{club:8,power:.1});const level=simulate(flat('green'),{club:8,power:.1});assert.ok(downhill.ball.p.z>level.ball.p.z);
 assert.deepEqual(simulate(flat(),{club:2,power:.77,aim:.1,shape:.3}).ball.p,simulate(flat(),{club:2,power:.77,aim:.1,shape:.3}).ball.p);
});
test('putts can find the cup; fast balls can roll past it',()=>{
 const course=flat('green',{tee:{x:0,z:7},pin:{x:0,z:10}});
 const putt=simulate(course,{club:8,power:.05,aim:0});assert.equal(putt.ball.status,'holed');assert.equal(putt.ball.p.z,10);
 const fast=simulate(course,{club:8,power:1,aim:0});assert.notEqual(fast.ball.status,'holed');assert.ok(fast.ball.p.z>11);
});
test('water applies relief and out of bounds returns to the previous lie',()=>{
 const water=flat('fairway',{surface:(x,z)=>z>2&&z<4?'water':'fairway'});const wet=simulate(water,{club:8,power:.3});assert.equal(wet.event.type,'penalty');assert.equal(wet.event.penalty,1);assert.equal(wet.ball.p.z,0);assert.equal(wet.ball.status,'rest');
 const ob=simulate(flat('fairway',{inBounds:(x,z)=>z<8}),{club:0,power:1});assert.equal(ob.event.type,'penalty');assert.equal(ob.ball.p.z,0);
});
test('golf classifications and exact versus or-better predictions include official strokes',()=>{
 assert.equal(scoreName(5,2),'Albatross');assert.equal(scoreName(4,2),'Eagle');assert.equal(scoreName(4,3),'Birdie');assert.equal(scoreName(3,1),'Hole-in-one');assert.equal(scoreName(4,7),'Triple bogey');assert.equal(scoreName(4,9),'5 over par');
 assert.equal(predictionWon('par',4,3),true);assert.equal(predictionWon('exact-par',4,3),false);assert.equal(predictionWon('exact-birdie',4,3),true);assert.equal(predictionWon('par',4,5),false);assert.equal(predictionWon('ace',3,1),true);
 assert.ok(!predictions(3).some(p=>p.id==='exact-eagle'));assert.ok(!predictions(5).some(p=>p.id==='ace'));assert.ok(reward('exact-eagle',1)>reward('bogey',1)*10);
});
test('settlement is idempotent, builds milestones, resets a lost streak and persists records',()=>{
 saved.clear();const store=new GolfStore();const run=store.start(123);
 for(let i=0;i<5;i++){const hole=run.hole={par:4,strokes:3,prediction:'birdie',result:null};store.stroke(3);const result=store.settle(hole);assert.equal(result.won,true);const points=store.stats.lifetimePoints;store.settle(hole);assert.equal(store.stats.lifetimePoints,points);}
 assert.equal(run.streak,5);assert.ok(store.stats.achievements.includes('Hot Streak'));assert.equal(store.stats.holes,5);assert.equal(store.stats.birdies,5);assert.equal(store.stats.strokes,15);
 run.hole={par:4,strokes:5,prediction:'exact-par',result:null};store.stroke(5);store.settle(run.hole);assert.equal(run.streak,0);assert.equal(store.stats.bestStreak,5);assert.equal(run.status,'lost');assert.equal(store.stats.lost,1);
 const copy=new GolfStore();assert.equal(copy.stats.bestStreak,5);assert.equal(copy.stats.highestScore,run.score);assert.equal(copy.stats.relativeTotal,-4);assert.equal(copy.run.hole.result.won,false);
 store.set('effects',.25);store.set('graphics','low');assert.equal(new GolfStore().settings.effects,.25);assert.equal(new GolfStore().settings.graphics,'low');
});
test('ball snapshots preserve active flight and corrupt saves fail safely',()=>{
 const c=flat(),a=new BallPhysics(c);a.launch({club:2,power:.8,aim:.2});a.update(.1);const b=new BallPhysics(c);b.restore(a.snapshot());for(let i=0;i<200;i++){a.update(1/60);b.update(1/60);}assert.ok(Math.abs(a.p.x-b.p.x)<1e-8);assert.ok(Math.abs(a.p.z-b.p.z)<1e-8);
 saved.set('tsd.ripagolf.v1','broken');assert.equal(new GolfStore().stats.holes,0);const store=new GolfStore();store.set('graphics','broken');assert.equal(store.settings.graphics,'medium');
});

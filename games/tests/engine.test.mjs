// Headless logic regressions. Rendering and hardware sensor checks are documented separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
const storage = new Map();
globalThis.localStorage = {getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
const events = new EventTarget();
globalThis.window = Object.assign(events, {matchMedia:()=>({matches:false}), screen:{}, DeviceOrientationEvent:{}});
globalThis.document = {documentElement:{}, activeElement:null};
globalThis.location = {search:''};
const {SettingsManager} = await import('../shared/engine/SettingsManager.js');
const {MeshBuilder,color} = await import('../shared/engine/MeshBuilder.js');
const {RoadGenerator} = await import('../shared/engine/RoadGenerator.js');
const {VehicleController,VEHICLE_PRESETS} = await import('../shared/engine/VehicleController.js');
const {AssetManager} = await import('../shared/engine/AssetManager.js');
const {TrafficSystem} = await import('../shared/engine/TrafficSystem.js');
const {InputManager} = await import('../shared/engine/InputManager.js');
const {TiltSensor} = await import('../shared/engine/TiltSensor.js');
const {default:Cutup} = await import('../cutup/cutup.js');
const {default:Cruise} = await import('../cruise/cruise.js');
function road(){return new RoadGenerator({seed:42, halfWidth:4, material:new THREE.MeshBasicMaterial(), curvature:s=>.002*Math.sin(s/240), elevation:s=>4*Math.sin(s/300), profile:()=>[{o:-10,c:color(0x00ff00)},{o:10,c:color(0x00ff00)}]});}
test('merged geometry has an index BufferAttribute and finite upward normals',()=>{
 const b=new MeshBuilder(); const c=color(0xffffff);
 b.quad(b.vert(0,0,0,c),b.vert(-1,0,0,c),b.vert(-1,0,1,c),b.vert(0,0,1,c));
 const g=b.build(true); assert.equal(g.index.count,6); assert.equal(g.index.itemSize,1);
 for(const v of g.attributes.normal.array)assert.ok(Number.isFinite(v));
 assert.ok(g.attributes.normal.getY(0)>.99);g.dispose();
});
test('road chunks share boundaries, remain bounded for 30 km, and restart after pruning',()=>{
 const r=road();r.update(0,460,110,Infinity);
 for(let s=0;s<30000;s+=30){r.update(s,460,110,Infinity);assert.ok(Number.isFinite(r.at(s).x));}
 assert.ok(r.pts.size<300);assert.ok(r.chunks.size<13);
 r.rebuildAll();r.update(30000,300,110,Infinity);assert.ok(r.pts.size<300);
 r.reset();r.update(0,460,110,Infinity);assert.ok(Number.isFinite(r.at(0).z));
 const left=r.chunks.get(0).ground.geometry.attributes.position;
 const right=r.chunks.get(1).ground.geometry.attributes.position;
 for(let k=0;k<2;k++)assert.deepEqual([left.getX(40+k),left.getY(40+k),left.getZ(40+k)],[right.getX(k),right.getY(k),right.getZ(k)]);
 r.dispose();
});
test('shared driving responds to left and right and is stable at 30/60/120 fps',()=>{
 const run=(fps,steer)=>{const r=road(),v=new VehicleController(r,{...VEHICLE_PRESETS.cutup,limit:8,roadHalf:7});v.reset(0,34);v.targetSpeed=34;for(let i=0;i<fps*5;i++)v.update(1/fps,{steer,throttle:0});return v;};
 assert.ok(run(60,-1).d<0);assert.ok(run(60,1).d>0);
 const a=run(30,.25),b=run(120,.25);assert.ok(Math.abs(a.d-b.d)<.1);assert.ok(Math.abs(a.s-b.s)<.2);
});
test('pooled traffic stays in lanes and spawns without vehicle overlaps',()=>{
 const r=road(),assets=new AssetManager(),scene=new THREE.Scene();
 const t=new TrafficSystem(scene,assets,r,{lanes:4,laneWidth:3.6,max:28});
 t.prefill(0,650,2.1);
 for(let i=0;i<1200;i++){
   t.update(1/60,i*34/60,34,2.1,650);
   for(const c of t.cars.filter(c=>c.active)){
     assert.ok(c.lane>=0&&c.lane<4);assert.equal(c.d,(c.lane-1.5)*3.6);
     for(const o of t.cars.filter(o=>o.active&&o!==c&&o.lane===c.lane))assert.ok(Math.abs(o.s-c.s)>(o.L+c.L)/2);
   }
 }
 assert.equal(t.cars.length,28); t.dispose(scene);assets.dispose();r.dispose();
});
test('settings and records persist; corrupt storage falls back safely',()=>{
 storage.clear();let s=new SettingsManager();s.set('sensitivity',1.5);s.set('graphics','low');s.submitRecord('cutup.best',1234);s=new SettingsManager();assert.equal(s.get('sensitivity'),1.5);assert.equal(s.get('graphics'),'low');assert.equal(s.record('cutup.best'),1234);assert.equal(s.submitRecord('cutup.best',20),false);
 storage.set('tsd.arcade.settings.v1','invalid');assert.equal(new SettingsManager().get('sensitivity'),1);storage.clear();
 s=new SettingsManager();s.set('graphics','invalid');assert.equal(s.get('graphics'),'high');s.set('volume',-2);assert.equal(s.get('volume'),.6);assert.equal(s.submitRecord('cutup.best',Infinity),false);
});
test('mouse requires holding; multitouch cancellation clears inputs; UI never steers',()=>{
 const surface=new EventTarget();surface.getBoundingClientRect=()=>({left:0,width:800});surface.setPointerCapture=()=>{};
 const settings=new SettingsManager();settings.set('desktopMode','mouse');const i=new InputManager(surface,settings);i.setEnabled(true);
 const pointer=(type,id,x,ui=false)=>{const e=new Event(type,{cancelable:true});Object.defineProperties(e,{pointerId:{value:id},clientX:{value:x},pointerType:{value:'mouse'},button:{value:0}});surface.closest=()=>ui;surface.dispatchEvent(e);};
 pointer('pointermove',1,700);i.update(.1);assert.equal(i.steer,0);
 pointer('pointerdown',1,700);i.update(.1);assert.ok(i.steer>0);
 pointer('pointercancel',1,700);for(let n=0;n<20;n++)i.update(.05);assert.equal(i.steer,0);
 pointer('pointerdown',2,100,true);assert.equal(i.holds.size,0);
 i.destroy();
});
test('tilt calibration and wraparound work flat and upright with one permission request',async()=>{
 let asks=0;window.DeviceOrientationEvent={requestPermission:async()=>{asks++;return 'denied';}};
 const denied=new TiltSensor();assert.equal(await denied.enable(),false);assert.equal(await denied.enable(),false);assert.equal(asks,1);denied.disable();
 window.DeviceOrientationEvent={};const sensor=new TiltSensor();
 sensor._onOrientation({alpha:359,beta:0,gamma:0});sensor.calibrate();sensor._onOrientation({alpha:1,beta:0,gamma:0});assert.ok(Math.abs(sensor.angle()-2*Math.PI/180)<1e-6);
 sensor._onOrientation({alpha:0,beta:70,gamma:0});sensor.calibrate();sensor._onOrientation({alpha:0,beta:70,gamma:20});assert.ok(Math.abs(sensor.angle())>.05);sensor.calibrate();assert.equal(sensor.angle(),0);sensor.disable();
});
test('Cutup collision ends run, close passes add combos, and scores persist',()=>{
 const g=new Cutup();g.settings=new SettingsManager();g.vehicle={s:120,d:0,speed:34,crash:()=>{g.hit=true;}};
 g.audio={nearMiss(){},crash(){}};g.hud={toast(){},flash(){}};g.cameraCtl={addShake(){}};g.endRun=()=>{g.state='crashed';};
 g._passed(.5);assert.equal(g.combo,1);assert.equal(g.score,300);
 g.traffic={cars:[{active:true,s:120,d:0,L:4.6,W:1.84}],update(){}};
 g.updateRun(1/60,'playing');assert.equal(g.hit,true);assert.equal(g.state,'crashed');assert.ok(g.settings.record('cutup.best')>=300);
});
test('both full scenery generators produce valid mesh data',()=>{
 for(const Game of [Cruise,Cutup]){
  const g=new Game();g.palette=Object.fromEntries(['grassA','grassB','asphalt','shoulder','line','edge','treeA','treeB','trunk','mountain','sand','concrete','building','window','lamp','accent'].map(k=>[k,color(0x778899)]));g.palette.page='signature';g.assets=new AssetManager();g.road=g.createRoad();g.road.update(0,650,110,Infinity);
  for(const chunk of g.road.chunks.values())for(const mesh of [chunk.ground,chunk.scenery].filter(Boolean)){
   assert.ok(mesh.geometry.index.count>0);for(const v of mesh.geometry.attributes.position.array)assert.ok(Number.isFinite(v));
  }
  g.road.dispose();g.assets.dispose();
 }
});

test('missing heading and nonfinite orientation never become valid tilt input',()=>{
 const sensor=new TiltSensor();sensor._onOrientation({alpha:null,beta:0,gamma:0});assert.equal(sensor.hasSample,false);sensor._onOrientation({alpha:0,beta:NaN,gamma:0});assert.equal(sensor.hasSample,false);sensor._onOrientation({alpha:0,beta:0,gamma:0});assert.equal(sensor.active,true);sensor._lastSample=performance.now()-3000;assert.equal(sensor.active,false);assert.equal(sensor.status,'unavailable');sensor.disable();
});

test('driving displays convert to mph and miles without changing stored units',async()=>{
 const {mph,miles}=await import('../shared/engine/Units.js');
 assert.equal(mph(1609.344/3600),1);assert.equal(mph(26.8224),60);assert.equal(miles(1609.344),'1.00 mi');assert.equal(miles(0),'0.00 mi');
 const g=new Cruise();g.settings=new SettingsManager();g.settings.submitRecord('cruise.distance',1609.344);assert.equal(g.titleRecord(),'Longest drive: 1.00 mi');assert.equal(g.settings.record('cruise.distance'),1609.344);
});

test('Digital Rain renders binary glyphs and other themes retain weather streaks',async()=>{
 const glyphs=[];
 const originalCreate=document.createElement;
 document.createElement=()=>({width:0,height:0,getContext:()=>({fillText:digit=>glyphs.push(digit)})});
 globalThis.getComputedStyle=()=>({getPropertyValue:()=> '144'});
 Object.assign(document.documentElement,{classList:{contains:()=>false},getAttribute:()=> 'rain'});
 const {Environment,getPalette}=await import('../shared/engine/Environment.js');
 const settings=new SettingsManager(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
 const env=new Environment(scene,camera);
 try{
  env.apply(getPalette(settings,'cruise'),460);env.update(1/60,0);
  assert.deepEqual(glyphs,['0','1']);assert.ok(env.binaryRain.every(points=>points.visible));assert.equal(env.rainLines.visible,false);
  for(const points of env.binaryRain)assert.ok([...points.geometry.attributes.position.array].every(Number.isFinite));
  document.documentElement.getAttribute=()=>null;settings.set('cruise.weather','rain');env.apply(getPalette(settings,'cruise'),460);
  assert.equal(env.rainLines.visible,true);assert.ok(env.binaryRain.every(points=>!points.visible));
 }finally{env.dispose();document.createElement=originalCreate;}
});

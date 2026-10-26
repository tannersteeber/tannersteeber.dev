import test from 'node:test';
import assert from 'node:assert/strict';
import {Course} from '../ripagolf/Course.js';
import {BallPhysics} from '../ripagolf/BallPhysics.js';
import {CLUBS,predictions,predictionWon,scoreName,reward,puttPower} from '../ripagolf/rules.js';
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
 const putt=simulate(course,{club:8,power:puttPower(3),aim:0});assert.equal(putt.ball.status,'holed');assert.ok(Math.abs(putt.ball.p.z-10)<.033);
 const fast=simulate(course,{club:8,power:1,aim:0});assert.notEqual(fast.ball.status,'holed');assert.ok(fast.ball.p.z>11);
});
test('water applies relief and out of bounds returns to the previous lie',()=>{
 const water=flat('fairway',{surface:(x,z)=>z>2&&z<4?'water':'fairway'});const wet=simulate(water,{club:8,power:1});assert.equal(wet.event.type,'penalty');assert.equal(wet.event.penalty,1);assert.equal(wet.ball.p.z,0);assert.equal(wet.ball.status,'rest');
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

// Physics fixtures use real metre-scale cups and deliberately varied input paths.
const {BALL_RADIUS,CUP_RADIUS,CUP_DEPTH,CUP_CLEARANCE,cupSweep}=await import('../ripagolf/CupPhysics.js');
const {SwingGesture}=await import('../ripagolf/SwingGesture.js');
const {terrainGeometry,cupSurroundGeometry}=await import('../ripagolf/TerrainGeometry.js');
function advance(ball,seconds=30,dt=1/120){const events=[];for(let i=0;i<seconds/dt&&!['rest','holed'].includes(ball.status);i++){const e=ball.update(dt,i*dt);if(e)events.push(e.type);}return events;}
function rollingBall(course,start,velocity){const b=new BallPhysics(course);b.reset(start);b.status='rolling';b.v={x:0,y:0,z:0,...velocity};return b;}
test('cup has regulation-inspired scale, swept entry, a falling state and an interior resting position',()=>{
 assert.equal(BALL_RADIUS*2,.04267);assert.equal(CUP_RADIUS*2,.108);assert.equal(CUP_DEPTH,.1016);
 assert.ok(cupSweep({x:0,z:-1},{x:0,z:1},{x:0,z:0}));
 const c=flat('green',{pin:{x:0,z:0}}),b=rollingBall(c,{x:0,z:-.08},{z:.45});
 let entry=false;for(let i=0;i<100;i++){const e=b.update(1/120);if(e?.type==='cup-entry'){entry=true;assert.equal(b.status,'cupping');assert.ok(b.p.y>-CUP_DEPTH);break;}}
 assert.ok(entry);assert.notEqual(b.status,'holed');advance(b,2);assert.equal(b.status,'holed');assert.ok(Math.abs(b.p.y-(-CUP_DEPTH+BALL_RADIUS))<1e-8);assert.ok(Math.hypot(b.p.x,b.p.z)<=CUP_CLEARANCE+.00001);
});
test('fast central putts pass over, glancing rim contacts deflect and nearby misses never award a hole',()=>{
 const c=flat('green',{pin:{x:0,z:0}});
 const fast=rollingBall(c,{x:0,z:-.2},{z:4});advance(fast,1);assert.notEqual(fast.status,'holed');assert.ok(fast.p.z>.2);
 const miss=rollingBall(c,{x:.09,z:-.2},{z:.8});advance(miss,3);assert.notEqual(miss.status,'holed');assert.equal(miss.p.x,.09);
 const rim=rollingBall(c,{x:.043,z:-.15},{z:1.3});let hits=0;rim.onRim=()=>hits++;advance(rim,3);assert.ok(hits>0);assert.ok(Math.abs(rim.p.x-.043)>.005);assert.notEqual(rim.status,'holed');
});
test('descending chips enter the actual opening; an adjacent chip lands on the green',()=>{
 const c=flat('green',{pin:{x:0,z:0}});
 for(const [x,shouldHole]of [[0,true],[.12,false]]){
  const b=new BallPhysics(c);b.p={x,y:.32,z:0};b.previous={...b.p};b.v={x:0,y:-2,z:0};b.status='flight';const events=advance(b,4);
  assert.equal(b.status==='holed',shouldHole);assert.equal(events.includes('cup-entry'),shouldHole);
 }
});
test('ground contact responds to uphill, downhill and cross-slope forces without micro bouncing',()=>{
 const slope=(sx,sz)=>flat('green',{height:(x,z)=>x*sx+z*sz,slope:()=>({x:sx,z:sz})});
 const down=rollingBall(slope(0,-.04),{x:0,z:0},{z:.2});advance(down,2);assert.ok(down.v.z>.2);
 const uphill=rollingBall(slope(0,.05),{x:0,z:0},{z:.65});advance(uphill,3);assert.ok(uphill.v.z<0,'steep uphill putt rolls backward');
 const side=rollingBall(slope(.025,0),{x:0,z:0},{z:1.5});advance(side,3);assert.ok(side.p.x<-.1);
 const still=rollingBall(slope(.008,.006),{x:0,z:0},{});advance(still,3);assert.equal(still.status,'rest');assert.ok(Math.abs(still.p.y/Math.hypot(1,.008,.006)-BALL_RADIUS)<1e-10,'sphere rests one radius normal to the slope');
});
test('club flight has distinct height/carry and wind acts on relative airflow',()=>{
 function flight(club,wind){const c=flat('fairway',{windAt:()=>wind}),b=new BallPhysics(c);b.launch({club,power:1});let apex=0;for(let i=0;i<5000&&b.status!=='rest';i++){b.update(1/120);apex=Math.max(apex,b.p.y);}return {b,apex};}
 const driver=flight(0,{x:0,z:0}),wedge=flight(7,{x:0,z:0});assert.ok(driver.b.shot.carry>wedge.b.shot.carry*3);assert.ok(wedge.apex/wedge.b.shot.carry>driver.apex/driver.b.shot.carry);
 const head=flight(4,{x:0,z:-6}),tail=flight(4,{x:0,z:6});assert.ok(head.b.shot.carry<tail.b.shot.carry);
 const bounceFair=simulate(flat('fairway'),{club:4,power:.65}),bounceSand=simulate(flat('sand'),{club:4,power:.65});assert.ok(bounceFair.ball.p.z-bounceFair.impact.z>bounceSand.ball.p.z-bounceSand.impact.z);
});
test('mesh triangles and physics heights agree, the cup is open, bunkers are depressed and seeds validate',()=>{
 for(const seed of [1,3,12,48]){
  const c=new Course(seed),mesh=terrainGeometry(c),p=mesh.geometry.attributes.position,index=mesh.geometry.index;assert.ok(c.validation.valid);
  for(let k=0;k<index.count;k+=Math.max(3,Math.floor(index.count/180/3)*3)){
   const ids=[index.getX(k),index.getX(k+1),index.getX(k+2)],x=ids.reduce((s,i)=>s+p.getX(i),0)/3,z=ids.reduce((s,i)=>s+p.getZ(i),0)/3,y=ids.reduce((s,i)=>s+p.getY(i),0)/3;
   assert.ok(Math.abs(c.height(x,z)-y)<.00002,'triangle centroid equals collision surface');
  }
  const sand=c.hazards.find(h=>h.type==='sand');assert.ok(c.height(sand.x,sand.z)<c.baseHeight(sand.x,sand.z)+.5,'bunker has a depression');
  const ring=cupSurroundGeometry(c),positions=ring.attributes.position;
  for(let i=0;i<96;i++)assert.ok(Math.abs(Math.hypot(positions.getX(i)-c.pin.x,positions.getZ(i)-c.pin.z)-CUP_RADIUS)<.00004);
  assert.ok(c.height(0,0)>c.baseHeight(0,0)+.4,'elevated tee');mesh.geometry.dispose();ring.dispose();
 }
});
test('gesture power is progressive, repeatable, bounded and has putting finesse',()=>{
 function gesture(endY,time,club=4,hz=60,dx=0){const g=new SwingGesture(.5,.9,0);for(let i=1;i<=Math.ceil(time*hz);i++){const f=Math.min(1,i/(time*hz));g.move(.5+dx*f,.9+(endY-.9)*f,time*f,club);}return g.release(.5+dx,endY,time,club);}
 assert.ok(gesture(.1,.25).power>gesture(.6,.25).power);assert.ok(gesture(.2,.2).power>gesture(.2,1).power);
 assert.ok(gesture(-.1,.01).power<=1);assert.ok(gesture(.75,.3,8).power<gesture(.75,.3,4).power);
 assert.ok(Math.abs(gesture(.15,.4,4,30).power-gesture(.15,.4,4,120).power)<1e-8);
 assert.equal(gesture(.89,.1).canceled,true);assert.ok(gesture(.2,.4,4,60,.12).error>0);assert.ok(gesture(.2,.4,4,60,-.12).error<0);
 const cancel=new SwingGesture(.5,.9,0);cancel.move(.5,.3,.2);assert.equal(cancel.release(.5,.89,.4).canceled,true);
 const outside=new SwingGesture(.5,.9,0);assert.equal(outside.release(1.4,.2,.2).canceled,true);
 const erratic=new SwingGesture(.5,.9,0);erratic.move(.8,.65,.1);erratic.move(.2,.4,.2);const f=erratic.release(.5,.15,.3);assert.ok(Math.abs(f.error)>.05);
});
test('putting power spans tap-ins and long rolls, with smaller powers providing useful fine control',()=>{
 for(const distance of [.2,1,3,10,20]){const c=flat('green',{pin:{x:0,z:distance}}),b=new BallPhysics(c);b.launch({club:8,power:puttPower(distance)});advance(b,40);assert.equal(b.status,'holed',`${distance}m controlled putt`);}
 assert.ok(puttPower(.2)<puttPower(1)&&puttPower(1)<puttPower(10));
});
test('camera frames the ball, cup and landing target across narrow and wide safe viewing zones',async()=>{
 const THREE=await import('../vendor/three.module.js'),{GolfCamera}=await import('../ripagolf/GolfCamera.js');
 for(const aspect of [.65,1.1,1.8])for(const seed of [1,12,48]){
  const course=new Course(seed),ball=new BallPhysics(course),camera=new THREE.PerspectiveCamera(62,aspect,.04,2600),control=new GolfCamera(camera);
  const aim=Math.atan2(course.pin.x,course.pin.z),landing={x:course.pin.x,z:course.pin.z};
  control.update(1/60,{course,ball,position:ball.p,phase:'aim',aim,zoom:1,pitch:.2,time:0,reduced:false,putting:false,landing});
  camera.updateProjectionMatrix();for(const point of [ball.p,{...course.pin,y:course.height(course.pin.x,course.pin.z)},landing]){
    const projected=new THREE.Vector3(point.x,point.y??course.height(point.x,point.z),point.z).project(camera);assert.ok(Math.abs(projected.x)<1&&Math.abs(projected.y)<1,'camera framing');
  }
  const initial=camera.position.clone();control.update(.1,{course,ball,position:ball.p,phase:'aim',aim:aim+.5,zoom:1,pitch:.5,time:0,reduced:false,putting:false,landing,swinging:true});assert.deepEqual(camera.position,initial);
 }
});

test('Hole camera fits the entire green and fringe at phone and desktop sizes',async()=>{
 const THREE=await import('../vendor/three.module.js'),{GolfCamera}=await import('../ripagolf/GolfCamera.js');
 for(const [w,h]of [[390,780],[667,320],[1060,700]]){
  const course=new Course(12),ball=new BallPhysics(course),camera=new THREE.PerspectiveCamera(62,w/h,.04,2600),control=new GolfCamera(camera),safe={left:12,right:w-12,top:100,bottom:h-70,fullWidth:w,fullHeight:h};
  control.update(1/60,{course,ball,position:ball.p,phase:'aim',aim:0,zoom:1,pitch:.2,time:0,reduced:true,cameraView:'hole',safeView:safe});
  for(let i=0;i<16;i++){const angle=i*Math.PI/8,x=course.pin.x+Math.cos(angle)*(course.greenRadius+2),z=course.pin.z+Math.sin(angle)*(course.greenRadius+2),p=new THREE.Vector3(x,course.height(x,z),z).project(camera),px=(p.x+1)*w/2,py=(1-p.y)*h/2;assert.ok(px>=safe.left&&px<=safe.right&&py>=safe.top&&py<=safe.bottom,`whole green remains in clear view ${w}x${h}: ${px},${py}`);}
 }
});

test('generated par 3, 4 and 5 holes can be completed from the tee using the actual shot simulation',async()=>{
 const {planShot}=await import('./golf-shot-planner.mjs'),pars=[];
 for(const seed of [1,2,7]){
  const course=new Course(seed),ball=new BallPhysics(course);pars.push(course.par);let strokes=0,time=0;
  while(ball.status!=='holed'&&strokes<8){
   const shot=planShot(course,ball.p,time);assert.ok(shot.cost<1000,'reachable landing');ball.launch(shot);strokes++;
   for(let i=0;i<5400&&!['rest','holed'].includes(ball.status);i++){time+=1/60;const event=ball.update(1/60,time);assert.notEqual(event?.type,'penalty');}
  }
  assert.equal(ball.status,'holed',`seed ${seed} completed through normal shots`);assert.ok(strokes<=course.par+1);
 }
 assert.deepEqual(pars.sort(),[3,4,5]);
});
test('mid-drop saves resume inside the cup, and legacy ball saves keep their lie without an extra stroke',()=>{
 const c=flat('green',{pin:{x:0,z:0}}),a=rollingBall(c,{x:0,z:-.08},{z:.45});
 for(let i=0;i<120&&a.status!=='cupping';i++)a.update(1/120);
 assert.equal(a.status,'cupping');const b=new BallPhysics(c);b.restore(a.snapshot());advance(a,2);advance(b,2);assert.equal(b.status,'holed');assert.deepEqual(b.p,a.p);
 const legacy=new BallPhysics(c);legacy.restore({p:{x:2,y:20,z:3},v:{x:0,y:-3,z:1},status:'flight'});assert.equal(legacy.status,'rest');assert.equal(legacy.p.x,2);assert.equal(legacy.p.z,3);assert.equal(legacy.p.y,BALL_RADIUS);
});
test('full shots check up on greens while ordinary putts retain their distance calibration',()=>{
 const fairway=simulate(flat('fairway'),{club:4,power:1}),green=simulate(flat('green'),{club:4,power:1}),wedge=simulate(flat('green'),{club:7,power:1});
 assert.ok(green.ball.p.z-green.impact.z<(fairway.ball.p.z-fairway.impact.z)*.45,'green absorbs a full-shot landing');
 assert.ok(wedge.ball.p.z-wedge.impact.z<4,'wedge has restrained green rollout');
 const putt=simulate(flat('green',{pin:{x:0,z:3}}),{club:8,power:puttPower(3)});assert.equal(putt.ball.status,'holed','putting calibration remains useful');
});

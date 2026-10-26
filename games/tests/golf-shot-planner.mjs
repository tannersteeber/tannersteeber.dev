// Test-only deterministic search: play generated holes from their tee without moving the ball.
import {BallPhysics} from '../ripagolf/BallPhysics.js';
import {CLUBS,recommend,puttPower,clamp} from '../ripagolf/rules.js';
export function planShot(course,origin,time){
 const d=course.distance(origin.x,origin.z),lie=course.surface(origin.x,origin.z),index=recommend(d,lie),baseAim=Math.atan2(course.pin.x-origin.x,course.pin.z-origin.z);
 const evaluate=(club,power,aim)=>{const b=new BallPhysics(course);b.reset(origin);b.launch({club,power,aim});let e;
  for(let i=0;i<5400&&!['rest','holed'].includes(b.status);i++){e=b.update(1/60,time+(i+1)/60);if(e?.type==='penalty')break;}
  const distance=course.distance(b.p.x,b.p.z),cost=b.status==='holed'?-1:distance+(e?.type==='penalty'?1000:0)+(course.surface(b.p.x,b.p.z)==='sand'?3:0);
  return {club,power,aim,cost,b};};
 let best;
 for(const club of [...new Set([index,Math.min(8,index+1),Math.max(0,index-1)])]){
  let power=club===8?puttPower(d):clamp(d/(CLUBS[club].carry*1.2),.005,1),aim=baseAim,local=evaluate(club,power,aim);
  let dp=.2,da=.08;
  for(let i=0;i<10;i++){
   for(const [p,a]of [[clamp(local.power+dp,.005,1),local.aim],[clamp(local.power-dp,.005,1),local.aim],[local.power,local.aim+da],[local.power,local.aim-da]]){
    const candidate=evaluate(club,p,a);if(candidate.cost<local.cost)local=candidate;
   }dp*=.6;da*=.6;
  }
  if(!best||local.cost<best.cost)best=local;
 }
 return best;
}

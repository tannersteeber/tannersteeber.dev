import {clamp} from './rules.js?v=20261026-touch-9';
export const BALL_RADIUS=.04267/2;
export const CUP_RADIUS=.108/2;
export const CUP_DEPTH=.1016;
export const CUP_CLEARANCE=CUP_RADIUS-BALL_RADIUS;
// Swept horizontal segment against a circle. Handles an entire crossing in one step.
export function cupSweep(a,b,pin,radius=CUP_CLEARANCE){
  const x=a.x-pin.x,z=a.z-pin.z,dx=b.x-a.x,dz=b.z-a.z,A=dx*dx+dz*dz;
  const closest=A?clamp(-(x*dx+z*dz)/A,0,1):0;
  const miss=Math.hypot(x+dx*closest,z+dz*closest);
  if(miss>radius)return null;
  if(A<1e-14)return {enter:0,exit:1,closest,miss};
  const B=2*(x*dx+z*dz),D=B*B-4*A*(x*x+z*z-radius*radius);
  if(D<0)return null;
  const enter=Math.max(0,(-B-Math.sqrt(D))/(2*A)),exit=Math.min(1,(-B+Math.sqrt(D))/(2*A));
  return enter<=exit?{enter,exit,closest,miss}:null;
}
export function cupContact(before,after,velocity,course,rolling){
  const pin=course.pin,level=course.height(pin.x,pin.z),speed=Math.hypot(velocity.x,velocity.z);
  const hit=cupSweep(before,after,pin);
  if(hit){
    const chord=2*Math.sqrt(Math.max(0,CUP_CLEARANCE*CUP_CLEARANCE-hit.miss*hit.miss));
    const fallTime=Math.sqrt(2*BALL_RADIUS*.55/9.81);
    const slow=speed<Math.max(.18,chord/fallTime);
    const crossing=before.y>=level+BALL_RADIUS-.002&&after.y<=level+BALL_RADIUS;
    const steep=velocity.y<-.4&&-velocity.y>speed*1.5;
    if((rolling&&slow)||(!rolling&&crossing&&(slow||steep))){
      const t=rolling?hit.closest:clamp((before.y-level-BALL_RADIUS)/(before.y-after.y||1),0,1);
      const x=before.x+(after.x-before.x)*t,z=before.z+(after.z-before.z)*t;
      if(Math.hypot(x-pin.x,z-pin.z)<=CUP_CLEARANCE+.00001)return {type:'entry',x,z,level};
    }
  }
  // Glancing contact with the raised rim can lip out; fast central putts pass over.
  const dx=after.x-before.x,dz=after.z-before.z,travel=Math.hypot(dx,dz);
  const impactParameter=travel?Math.abs((before.x-pin.x)*dz-(before.z-pin.z)*dx)/travel:Infinity;
  const rim=cupSweep(before,after,pin,CUP_RADIUS+BALL_RADIUS*.5);
  if(rolling&&rim&&impactParameter>CUP_CLEARANCE*.82&&rim.enter>0&&speed>.3){
    const x=before.x+(after.x-before.x)*rim.enter-pin.x,z=before.z+(after.z-before.z)*rim.enter-pin.z,d=Math.hypot(x,z)||1;
    return {type:'rim',nx:x/d,nz:z/d};
  }
  return null;
}

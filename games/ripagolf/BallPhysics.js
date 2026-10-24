import {CLUBS,clamp} from './rules.js';
export const BALL_RADIUS=.12;
const FRICTION={green:.36,fairway:1.6,tee:1.3,rough:2.9,sand:4.8};
export class BallPhysics {
  constructor(course){this.course=course;this.reset(course.tee);}
  reset(p){this.p={x:p.x,y:this.course.height(p.x,p.z)+BALL_RADIUS,z:p.z};this.v={x:0,y:0,z:0};this.status='rest';this.spin=0;this.sideSpin=0;this.age=0;this.restTime=0;this.origin={...this.p};this.accumulator=0;}
  launch({club=4,power=.8,aim=0,error=0,spin=0,shape=0,loft=0}) {
    if(this.status!=='rest')return false;
    const c=CLUBS[club];if(!c)return false;
    this.origin={...this.p};const lie=this.course.surface(this.p.x,this.p.z);
    const resistance=lie==='sand'?(club===7?.9:.66):lie==='rough'?.82:1;
    const speed=c.speed*(club===8?1:.9)*Math.sqrt(clamp(power,.015,1))*resistance;
    const theta=(c.loft+loft)*Math.PI/180,yaw=aim+clamp(error,-1,1)*c.accuracy*Math.PI/180;
    this.v={x:Math.sin(yaw)*speed*Math.cos(theta),y:club===8?0:speed*Math.sin(theta),z:Math.cos(yaw)*speed*Math.cos(theta)};
    this.spin=c.spin*(1+spin*.45);this.sideSpin=shape;
    this.status=club===8?'rolling':'flight';this.age=0;this.restTime=0;this.accumulator=0;return true;
  }
  snapshot(){return {p:{...this.p},v:{...this.v},status:this.status,spin:this.spin,sideSpin:this.sideSpin,age:this.age,origin:{...this.origin},restTime:this.restTime};}
  restore(s){if(!s?.p||!s?.v)return;for(const value of [...Object.values(s.p),...Object.values(s.v)])if(!Number.isFinite(value))return;
    this.p={...s.p};this.v={...s.v};this.status=['rest','flight','rolling','holed'].includes(s.status)?s.status:'rest';this.spin=s.spin||0;this.sideSpin=s.sideSpin||0;this.age=s.age||0;this.origin={...(s.origin||s.p)};this.restTime=s.restTime||0;this.accumulator=0;}
  update(dt,windTime=0){
    if(this.status==='rest'||this.status==='holed')return null;
    this.accumulator+=Math.min(dt,.1);let event=null;
    while(this.accumulator>=1/120){this.accumulator-=1/120;event=this.step(1/120,windTime);if(event)break;}
    return event;
  }
  step(dt,time){
    const p=this.p,v=this.v,c=this.course;this.age+=dt;
    if(this.status==='flight'){
      const wind=c.windAt(time),rx=wind.x-v.x,rz=wind.z-v.z,speed=Math.hypot(rx,v.y,rz),horizontal=Math.hypot(v.x,v.z);
      const lift=Math.min(2.5,.000012*this.spin*horizontal);
      v.x+=rx*speed*.001*dt;v.z+=rz*speed*.001*dt;v.y+=(-9.81-v.y*speed*.001+lift)*dt;
      const side=.0006*this.sideSpin*horizontal;v.x+=v.z*side*dt;v.z-=v.x*side*dt;
    }else{
      const lie=c.surface(p.x,p.z),slope=c.slope(p.x,p.z),friction=FRICTION[lie]||1;
      v.x-=slope.x*9.81*dt;v.z-=slope.z*9.81*dt;
      const speed=Math.hypot(v.x,v.z),next=Math.max(0,speed-friction*dt),scale=speed>0?next/speed:0;
      v.x*=scale;v.z*=scale;v.y=0;
    }
    const before={x:p.x,z:p.z};p.x+=v.x*dt;p.z+=v.z*dt;p.y+=v.y*dt;
    if(!c.inBounds(p.x,p.z)){this.reset(this.origin);return {type:'penalty',reason:'Out of bounds · stroke and distance',penalty:1};}
    const height=c.height(p.x,p.z)+BALL_RADIUS,lie=c.surface(p.x,p.z);
    if(p.y<=height||this.status==='rolling'){
      if(lie==='water'){const drop=c.relief(p.x,p.z);this.reset(drop);return {type:'penalty',reason:'Water · one penalty stroke and fairway relief',penalty:1};}
      p.y=height;
      if(this.status==='flight'){
        const impact=-v.y;
        const retention=lie==='sand'?.24:lie==='rough'?.38:clamp(.64-this.spin/14000,.18,.62);
        v.x*=retention;v.z*=retention;
        v.y=impact*(lie==='sand'?.06:lie==='rough'?.13:.25);this.spin*=.45;
        if(v.y<1.1){v.y=0;this.status='rolling';}
        if(impact>1.5)this.onBounce?.(impact);
      }
      if(this.status==='rolling'){
        const dx=p.x-before.x,dz=p.z-before.z,den=dx*dx+dz*dz;
        const t=den?clamp(((c.pin.x-before.x)*dx+(c.pin.z-before.z)*dz)/den,0,1):0;
        const cupDist=Math.hypot(before.x+dx*t-c.pin.x,before.z+dz*t-c.pin.z);
        if(lie==='green'&&cupDist<.42&&Math.hypot(v.x,v.z)<2.6){p.x=c.pin.x;p.z=c.pin.z;p.y=c.height(p.x,p.z)-.12;v.x=v.y=v.z=0;this.status='holed';return {type:'holed'};}
        this.restTime=Math.hypot(v.x,v.z)<.12?this.restTime+dt:0;
        if(this.restTime>.45){v.x=v.y=v.z=0;this.status='rest';return {type:'rest'};}
      }
    }
    // Trunks have physical collisions; foliage remains decorative.
    for(const tree of c.trees){
      const dx=p.x-tree.x,dz=p.z-tree.z,d=Math.hypot(dx,dz),radius=.45*tree.scale+BALL_RADIUS;
      if(d<radius&&p.y<c.height(tree.x,tree.z)+6*tree.scale){
        const nx=dx/(d||1),nz=dz/(d||1),dot=v.x*nx+v.z*nz;
        if(dot<0){v.x-=1.5*dot*nx;v.z-=1.5*dot*nz;p.x=tree.x+nx*radius;p.z=tree.z+nz*radius;}
      }
    }
    // A numerical safety net stops pathological motion without advancing toward the cup.
    if(this.age>35){p.y=height;v.x=v.y=v.z=0;this.status='rest';return {type:'rest'};}
    return null;
  }
}

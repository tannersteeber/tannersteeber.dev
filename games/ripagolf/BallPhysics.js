import {CLUBS,clamp} from './rules.js?v=20261026-touch-9';
import {surfacePhysics} from './SurfacePhysics.js?v=20261026-touch-9';
import {airAcceleration} from './Aerodynamics.js?v=20261026-touch-9';
import {BALL_RADIUS,CUP_DEPTH,CUP_CLEARANCE,cupContact} from './CupPhysics.js?v=20261026-touch-9';
export {BALL_RADIUS} from './CupPhysics.js?v=20261026-touch-9';
const STEP=1/120;
const contactHeight=(course,x,z)=>{const s=course.slope(x,z);return course.height(x,z)+BALL_RADIUS*Math.hypot(1,s.x,s.z);};
export class BallPhysics {
  constructor(course){this.course=course;this.reset(course.tee);}
  reset(p){
    this.p={x:p.x,y:contactHeight(this.course,p.x,p.z),z:p.z};this.previous={...this.p};
    this.v={x:0,y:0,z:0};this.status='rest';this.spin=0;this.sideSpin=0;this.age=0;this.restTime=0;
    this.origin={...this.p};this.accumulator=0;this.windClock=null;this.cupTime=0;this.shot=null;
  }
  launch({club=4,power=.8,aim=0,error=0,spin=0,shape=0,loft=0}){
    if(this.status!=='rest')return false;const c=CLUBS[club];if(!c)return false;
    this.origin={...this.p};const lie=this.course.surface(this.p.x,this.p.z),surface=surfacePhysics(lie);
    const resistance=lie==='sand'&&club===7?.9:surface.launch;
    const speed=c.speed*Math.pow(clamp(power,.002,1),club===8?.7:.5)*resistance;
    const theta=(club===8?0:clamp(c.loft+loft,5,70))*Math.PI/180,yaw=aim+clamp(error,-1,1)*c.accuracy*Math.PI/180;
    this.v={x:Math.sin(yaw)*speed*Math.cos(theta),y:club===8?0:speed*Math.sin(theta),z:Math.cos(yaw)*speed*Math.cos(theta)};
    this.spin=club===8?0:c.spin*(1+clamp(spin,-1,1)*(spin<0?1.25:.55));this.sideSpin=clamp(shape+error*.18,-1,1);
    this.status=club===8?'rolling':'flight';this.age=0;this.restTime=0;this.accumulator=0;this.windClock=null;this.cupTime=0;
    this.shot={club,power:clamp(power,.002,1),carry:club===8?0:null,total:0,lie,launchSpeed:speed};return true;
  }
  snapshot(){return {version:2,p:{...this.p},v:{...this.v},status:this.status,spin:this.spin,sideSpin:this.sideSpin,age:this.age,origin:{...this.origin},restTime:this.restTime,accumulator:this.accumulator,windClock:this.windClock,cupTime:this.cupTime,shot:this.shot?{...this.shot}:null};}
  restore(s){
    if(!s?.p||!s?.v||![s.p.x,s.p.y,s.p.z,s.v.x,s.v.y,s.v.z].every(Number.isFinite))return;
    this.p={...s.p};this.previous={...this.p};this.v={...s.v};this.status=['rest','flight','rolling','cupping','holed'].includes(s.status)?s.status:'rest';
    this.spin=Number.isFinite(s.spin)?s.spin:0;this.sideSpin=Number.isFinite(s.sideSpin)?s.sideSpin:0;this.age=s.age||0;
    this.origin={...(s.origin||s.p)};this.restTime=s.restTime||0;this.accumulator=clamp(s.accumulator||0,0,STEP);this.windClock=Number.isFinite(s.windClock)?s.windClock:null;this.cupTime=s.cupTime||0;this.shot=s.shot?{...s.shot}:null;
    // Old saves used an oversized ball. Preserve the stroke and lie, never award an old proximity win.
    if(s.version!==2){this.p.y=contactHeight(this.course,this.p.x,this.p.z);if(this.status!=='holed')this.status='rest';this.v={x:0,y:0,z:0};}
  }
  renderedPosition(){const a=clamp(this.accumulator/STEP,0,1);return this.status==='rest'||this.status==='holed'?this.p:{x:this.previous.x+(this.p.x-this.previous.x)*a,y:this.previous.y+(this.p.y-this.previous.y)*a,z:this.previous.z+(this.p.z-this.previous.z)*a};}
  summary(){return this.shot?{...this.shot,total:Math.hypot(this.p.x-this.origin.x,this.p.z-this.origin.z),lie:this.status==='holed'?'cup':this.course.surface(this.p.x,this.p.z),remaining:this.course.distance?.(this.p.x,this.p.z)??Math.hypot(this.p.x-this.course.pin.x,this.p.z-this.course.pin.z)}:null;}
  update(dt,windTime=0){
    if(this.status==='rest'||this.status==='holed')return null;
    if(this.windClock===null)this.windClock=windTime-dt;
    this.accumulator+=Math.min(Math.max(0,dt),.1);let event=null;
    while(this.accumulator+1e-12>=STEP){this.accumulator=Math.max(0,this.accumulator-STEP);this.previous={...this.p};this.windClock+=STEP;event=this.step(STEP,this.windClock);if(event)break;}
    return event;
  }
  dropIntoCup(dt){
    const p=this.p,v=this.v,c=this.course,level=c.height(c.pin.x,c.pin.z),floor=level-CUP_DEPTH+BALL_RADIUS;
    this.cupTime+=dt;v.y-=9.81*dt;p.x+=v.x*dt;p.z+=v.z*dt;p.y+=v.y*dt;
    const x=p.x-c.pin.x,z=p.z-c.pin.z,d=Math.hypot(x,z);
    if(d>CUP_CLEARANCE){const nx=x/d,nz=z/d,dot=v.x*nx+v.z*nz;p.x=c.pin.x+nx*CUP_CLEARANCE;p.z=c.pin.z+nz*CUP_CLEARANCE;if(dot>0){v.x-=1.15*dot*nx;v.z-=1.15*dot*nz;}}
    if(p.y<=floor){p.y=floor;v.x*=.5;v.z*=.5;v.y=Math.min(.55,Math.abs(v.y)*.08);if(this.cupTime>.16&&Math.hypot(v.x,v.y,v.z)<.16){this.status='holed';v.x=v.y=v.z=0;return {type:'holed'};}}
    return null;
  }
  step(dt,time){
    if(this.status==='cupping')return this.dropIntoCup(dt);
    const p=this.p,v=this.v,c=this.course,before={...p};this.age+=dt;
    const rolling=this.status==='rolling';
    if(!rolling){const a=airAcceleration(v,c.windAt(time),this.spin,this.sideSpin);v.x+=a.x*dt;v.y+=a.y*dt;v.z+=a.z*dt;this.spin*=Math.exp(-.025*dt);}
    else{
      const s=c.slope(p.x,p.z),mat=surfacePhysics(c.surface(p.x,p.z)),den=1+s.x*s.x+s.z*s.z;
      const gx=-9.81*s.x/den,gz=-9.81*s.z/den,slopeForce=Math.hypot(gx,gz),speed=Math.hypot(v.x,v.z);
      if(speed<.018&&slopeForce<mat.grip){v.x=v.z=0;this.restTime+=dt;}
      else{this.restTime=0;v.x+=gx*dt;v.z+=gz*dt;const moving=Math.hypot(v.x,v.z),deceleration=mat.rolling+moving*.012+((mat.speedDrag||0)+(this.shot?.club<8?mat.landingDrag||0:0))*moving*moving,f=Math.max(0,1-deceleration*dt/(moving||1));v.x*=f;v.z*=f;}
      v.y=0;
      if(this.restTime>.15){this.status='rest';return {type:'rest'};}
    }
    p.x+=v.x*dt;p.z+=v.z*dt;p.y+=v.y*dt;
    if(rolling)p.y=contactHeight(c,p.x,p.z);
    const water=c.waterAt?.(p.x,p.z);
    if((water&&p.y-BALL_RADIUS<=water.level)||(c.surface(p.x,p.z)==='water'&&p.y-BALL_RADIUS<=c.height(p.x,p.z)+.005)){
      const summary=this.summary(),drop=c.relief(p.x,p.z);this.reset(drop);return {type:'penalty',reason:'Water · one penalty stroke and fairway relief',penalty:1,summary};
    }
    if(!c.inBounds(p.x,p.z)){const summary=this.summary();this.reset(this.origin);return {type:'penalty',reason:'Out of bounds · stroke and distance',penalty:1,summary};}
    const cup=cupContact(before,p,v,c,rolling);
    if(cup?.type==='entry'){
      if(this.shot?.carry===null)this.shot.carry=Math.hypot(cup.x-this.origin.x,cup.z-this.origin.z);
      p.x=cup.x;p.z=cup.z;p.y=Math.min(p.y,cup.level+BALL_RADIUS);v.x*=.35;v.z*=.35;v.y=Math.min(v.y,-.08);this.status='cupping';this.cupTime=0;return {type:'cup-entry'};
    }
    if(cup?.type==='rim'){
      const dot=v.x*cup.nx+v.z*cup.nz;
      if(dot<0){v.x-=1.2*dot*cup.nx;v.z-=1.2*dot*cup.nz;this.onRim?.();}
    }
    const ground=contactHeight(c,p.x,p.z);
    if(!rolling&&p.y<=ground){
      // Sweep to the first heightfield crossing rather than bouncing at a penetrated endpoint.
      let lo=0,hi=1;
      for(let i=0;i<12;i++){const t=(lo+hi)/2,x=before.x+(p.x-before.x)*t,z=before.z+(p.z-before.z)*t,y=before.y+(p.y-before.y)*t;if(y>contactHeight(c,x,z))lo=t;else hi=t;}
      const x=before.x+(p.x-before.x)*hi,z=before.z+(p.z-before.z)*hi;p.x=x;p.z=z;p.y=contactHeight(c,x,z);
      const lie=c.surface(x,z),mat=surfacePhysics(lie),s=c.slope(x,z),len=Math.hypot(s.x,1,s.z),n={x:-s.x/len,y:1/len,z:-s.z/len};
      const normal=v.x*n.x+v.y*n.y+v.z*n.z,impact=Math.max(0,-normal);
      if(this.shot?.carry===null)this.shot.carry=Math.hypot(p.x-this.origin.x,p.z-this.origin.z);
      if(normal<0){
        const tx=v.x-normal*n.x,ty=v.y-normal*n.y,tz=v.z-normal*n.z;
        const spinBrake=clamp(this.spin/10000,0,.6),retain=Math.max(.05,1-mat.contactFriction-spinBrake*impact/24);
        v.x=tx*retain-normal*mat.restitution*n.x;v.y=ty*retain-normal*mat.restitution*n.y;v.z=tz*retain-normal*mat.restitution*n.z;
        this.spin*=.38;
        if(impact>1)this.onBounce?.(impact,lie);
      }
      if(impact*mat.restitution<.5){this.status='rolling';v.y=0;}
    }
    for(const tree of c.trees){
      const x=p.x-tree.x,z=p.z-tree.z,d=Math.hypot(x,z),radius=(.4-.15*clamp((p.y-c.height(tree.x,tree.z))/(3.5*tree.scale),0,1))*tree.scale+BALL_RADIUS;
      if(d<radius&&p.y<c.height(tree.x,tree.z)+3.5*tree.scale){const nx=x/(d||1),nz=z/(d||1),dot=v.x*nx+v.z*nz;if(dot<0){v.x-=1.45*dot*nx;v.z-=1.45*dot*nz;p.x=tree.x+nx*radius;p.z=tree.z+nz*radius;}}
    }
    return null;
  }
}

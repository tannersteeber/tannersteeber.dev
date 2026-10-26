import { mulberry32,smoothstep } from '../shared/engine/RoadGenerator.js';
import {clamp} from './rules.js?v=20261026-touch-9';
export const SURFACES=['rough','fairway','green','sand','water','tee'];
export class Course {
  constructor(seed,index=1) {
    this.seed=seed>>>0;this.index=index;const r=this.rng=mulberry32(this.seed);
    this.par=[3,4,5][Math.floor(r()*3)];
    this.length=({3:115,4:245,5:365})[this.par]+r()*({3:55,4:90,5:95})[this.par];
    this.bend=(r()-.5)*(this.par===3?18:58);this.phase=r()*6.28;
    this.width=16-Math.min(index/20,3)+r()*3;
    this.pin={x:this.center(this.length)+(r()-.5)*6,z:this.length};
    this.greenRadius=15+r()*3;this.greenX=(r()-.5)*.025;this.greenZ=(r()-.5)*.025;
    this.terrainStrength=1;this.greenBase=this.baseHeight(this.pin.x,this.pin.z)+2.4;
    this.tee={x:0,z:0};this.hazards=[];
    // Side hazards never cut the entire fairway or the playable green.
    for(let i=0;i<2+(this.par>3?2:0);i++) {
      const z=35+r()*Math.max(15,this.length-75),side=r()<.5?-1:1,water=i===0&&this.par>3;
      this.hazards.push({x:this.center(z)+side*(this.width+10+r()*9),z,rx:water?9+r()*5:5+r()*4,rz:water?16+r()*9:7+r()*7,type:water?'water':'sand'});
    }
    // A greenside bunker leaves the putting surface unobstructed.
    this.hazards.push({x:this.pin.x+(r()<.5?-1:1)*(this.greenRadius+6),z:this.length-6,rx:5,rz:9,type:'sand'});
    for(const h of this.hazards)if(h.type==='water')h.level=this.baseHeight(h.x,h.z)-.65;
    const angle=r()*Math.PI*2,speed=1.5+r()*(3.2+Math.min(index,20)*.08);
    this.wind={x:Math.sin(angle)*speed,z:Math.cos(angle)*speed,speed,angle};
    this.trees=[];
    for(let i=0;i<90;i++){
      const z=-15+r()*(this.length+60),x=(r()<.5?-1:1)*(38+r()*42);
      if(Math.hypot(x-this.pin.x,z-this.pin.z)<this.greenRadius+8||this.surface(x,z)!=='rough'||Math.abs(x-this.center(z))<this.width+5)continue;
      this.trees.push({x,z,scale:.8+r()*1.1});
    }
    this.rebuildTerrain();
    for(let attempt=0;!this.validation.valid&&attempt<4;attempt++){this.terrainStrength*=.65;this.rebuildTerrain();}
    if(!this.validation.valid)throw new Error('Course failed playability validation');
  }
  center(z) {return this.bend*Math.pow(Math.sin(clamp(z/this.length,0,1)*Math.PI),2);}
  baseHeight(x,z) {
    const t=this.terrainStrength??1;
    return t*(5.8*Math.sin(z/87+this.phase)+2.6*Math.sin(z/39+this.phase*.7)+2.5*Math.sin(x/61+this.phase)*Math.sin(z/113+.4)+.6*Math.sin(x/22+z/36));
  }
  rawHeight(x,z){
    let y=this.baseHeight(x,z),t=this.terrainStrength??1;
    const g=1-smoothstep(this.greenRadius-3,this.greenRadius+12,Math.hypot(x-this.pin.x,z-this.pin.z));
    const green=this.baseHeight(this.pin.x,this.pin.z)+2.4*t+(x-this.pin.x)*this.greenX+(z-this.pin.z)*this.greenZ;
    y=y*(1-g)+green*g;
    const tee=1-smoothstep(5,23,Math.hypot(x,z));y=y*(1-tee)+(this.baseHeight(0,0)+1.8*t)*tee;
    for(const h of this.hazards){
      const radius=Math.hypot((x-h.x)/h.rx,(z-h.z)/h.rz),blend=1-smoothstep(.25,1.12,radius);
      if(h.type==='sand')y-=.85*t*blend;
      else y=y*(1-blend)+(h.level-1.5)*blend;
    }
    return y;
  }
  rebuildTerrain(){
    const step=1.5,sorted=(min,max,extra)=>[...new Set([...Array.from({length:Math.ceil((max-min)/step)+1},(_,i)=>Math.min(max,min+i*step)),...extra])].sort((a,b)=>a-b);
    const xs=sorted(-91,91,[this.pin.x-.25,this.pin.x+.25]),zs=sorted(-30,this.length+70,[this.pin.z-.25,this.pin.z+.25]);
    const heights=new Float32Array(xs.length*zs.length);
    for(let j=0;j<zs.length;j++)for(let i=0;i<xs.length;i++)heights[j*xs.length+i]=this.rawHeight(xs[i],zs[j]);
    this.heightfield={xs,zs,heights};this.validation=this.validate();
  }
  cell(axis,value){let lo=0,hi=axis.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(axis[mid]<=value)lo=mid;else hi=mid;}return lo;}
  sample(x,z){
    const f=this.heightfield;
    if(!f||x<f.xs[0]||x>f.xs.at(-1)||z<f.zs[0]||z>f.zs.at(-1))return {height:this.rawHeight(x,z),slope:null};
    const i=this.cell(f.xs,x),j=this.cell(f.zs,z),dx=f.xs[i+1]-f.xs[i],dz=f.zs[j+1]-f.zs[j],u=(x-f.xs[i])/dx,v=(z-f.zs[j])/dz,k=j*f.xs.length+i;
    const a=f.heights[k],b=f.heights[k+f.xs.length],c=f.heights[k+1],d=f.heights[k+f.xs.length+1];
    // The same diagonal and barycentric interpolation used by GolfWorld's mesh.
    return u+v<=1?{height:a+u*(c-a)+v*(b-a),slope:{x:(c-a)/dx,z:(b-a)/dz}}:{height:d+(1-u)*(b-d)+(1-v)*(c-d),slope:{x:(d-b)/dx,z:(d-c)/dz}};
  }
  height(x,z){return this.sample(x,z).height;}
  slope(x,z){const value=this.sample(x,z);if(value.slope)return value.slope;const e=.05;return {x:(this.rawHeight(x+e,z)-this.rawHeight(x-e,z))/(2*e),z:(this.rawHeight(x,z+e)-this.rawHeight(x,z-e))/(2*e)};}
  waterAt(x,z){const h=this.hazards.find(h=>h.type==='water'&&((x-h.x)/h.rx)**2+((z-h.z)/h.rz)**2<1);return h?{level:h.level}:null;}
  validate(){
    let maxSlope=0;const issues=[];
    for(let z=0;z<=this.length;z+=3){const x=this.center(z),s=this.slope(x,z);maxSlope=Math.max(maxSlope,Math.hypot(s.x,s.z));if(!['tee','fairway','green'].includes(this.surface(x,z)))issues.push('blocked route');}
    if(maxSlope>.28)issues.push('route slope');
    if(this.surface(this.pin.x,this.pin.z)!=='green'||!this.inBounds(this.pin.x,this.pin.z))issues.push('pin');
    for(let i=0;i<16;i++){const a=i*Math.PI/8,s=this.slope(this.pin.x+Math.cos(a)*4,this.pin.z+Math.sin(a)*4);if(Math.hypot(s.x,s.z)>.035)issues.push('putting slope');}
    return {valid:issues.length===0,maxSlope,issues:[...new Set(issues)]};
  }
  surface(x,z) {
    if(Math.hypot(x-this.pin.x,z-this.pin.z)<this.greenRadius)return 'green';
    if(Math.hypot(x,z)<7)return 'tee';
    for(const h of this.hazards)if(((x-h.x)/h.rx)**2+((z-h.z)/h.rz)**2<1)return h.type;
    if(z>=0&&z<=this.length&&Math.abs(x-this.center(z))<this.width*(.9+.1*Math.sin(z/30)))return 'fairway';
    return 'rough';
  }
  inBounds(x,z){return Math.abs(x)<88&&z>-24&&z<this.length+48;}
  relief(x,z){
    let at=clamp(z-8,8,this.length-20);
    while(this.surface(this.center(at),at)==='water'&&at>8)at-=4;
    return {x:this.center(at),z:at};
  }
  windAt(time){const factor=1+.08*Math.sin(time*.25+this.phase);return {x:this.wind.x*factor,z:this.wind.z*factor};}
  distance(x,z){return Math.hypot(x-this.pin.x,z-this.pin.z);}
}

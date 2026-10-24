import { mulberry32,smoothstep } from '../shared/engine/RoadGenerator.js';
import {clamp} from './rules.js';
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
    this.greenBase=this.baseHeight(this.pin.x,this.pin.z);
    this.tee={x:0,z:0};this.hazards=[];
    // Side hazards never cut the entire fairway or the playable green.
    for(let i=0;i<2+(this.par>3?2:0);i++) {
      const z=35+r()*Math.max(15,this.length-75),side=r()<.5?-1:1,water=i===0&&this.par>3;
      this.hazards.push({x:this.center(z)+side*(this.width+10+r()*9),z,rx:water?9+r()*5:5+r()*4,rz:water?16+r()*9:7+r()*7,type:water?'water':'sand'});
    }
    // A greenside bunker leaves the putting surface unobstructed.
    this.hazards.push({x:this.pin.x+(r()<.5?-1:1)*(this.greenRadius+6),z:this.length-6,rx:5,rz:9,type:'sand'});
    const angle=r()*Math.PI*2,speed=1.5+r()*(3.2+Math.min(index,20)*.08);
    this.wind={x:Math.sin(angle)*speed,z:Math.cos(angle)*speed,speed,angle};
    this.trees=[];
    for(let i=0;i<90;i++){
      const z=-15+r()*(this.length+60),x=(r()<.5?-1:1)*(38+r()*42);
      if(Math.hypot(x-this.pin.x,z-this.pin.z)<this.greenRadius+8||this.surface(x,z)==='water')continue;
      this.trees.push({x,z,scale:.8+r()*1.1});
    }
  }
  center(z) {return this.bend*Math.pow(Math.sin(clamp(z/this.length,0,1)*Math.PI),2);}
  baseHeight(x,z) {return 1.5*Math.sin(z/68+this.phase)*Math.sin(x/85+.7)+.65*Math.sin(z/32+this.phase);}
  height(x,z) {
    let y=this.baseHeight(x,z);
    const g=1-smoothstep(this.greenRadius-2,this.greenRadius+7,Math.hypot(x-this.pin.x,z-this.pin.z));
    y=y*(1-g)+(this.greenBase+(x-this.pin.x)*this.greenX+(z-this.pin.z)*this.greenZ)*g;
    const tee=1-smoothstep(6,12,Math.hypot(x,z));return y*(1-tee)+this.baseHeight(0,0)*tee;
  }
  slope(x,z) {const e=.2;return {x:(this.height(x+e,z)-this.height(x-e,z))/(2*e),z:(this.height(x,z+e)-this.height(x,z-e))/(2*e)};}
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

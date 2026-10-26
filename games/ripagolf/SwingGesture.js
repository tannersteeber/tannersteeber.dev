import {clamp} from './rules.js?v=20261026-touch-9';
// Normalized coordinates and seconds make gesture behavior independent of pixels and refresh rate.
export class SwingGesture {
  constructor(x,y,time){this.points=[{x,y,time}];this.start=this.points[0];this.maxTravel=0;this.feedback={power:0,error:0,canceled:false,armed:false,speed:0};}
  move(x,y,time,club=4,sensitivity=1){
    const previous=this.points.at(-1);time=Math.max(previous.time,time);
    if(x!==previous.x||y!==previous.y)this.points.push({x,y,time});
    if(this.points.length>240)this.points.splice(1,1);
    const dy=this.start.y-y,dx=x-this.start.x,travel=dy/.74;this.maxTravel=Math.max(this.maxTravel,travel);
    const duration=Math.max(.09,time-this.start.time),speed=Math.max(0,dy/duration);
    const outside=x<-.16||x>1.16||y<-.22||y>1.16;
    const returned=this.maxTravel>.14&&dy<.045;
    let deviation=0,bias=0;
    for(const p of this.points){const progress=dy?clamp((this.start.y-p.y)/dy,0,1):0;deviation+=Math.abs(p.x-this.start.x-dx*progress);bias+=p.x-this.start.x;}
    deviation/=this.points.length;bias/=this.points.length;
    const velocityFactor=.72+.28*clamp(speed/1.8,0,1),normalized=clamp(travel,0,1);
    const power=clamp(Math.pow(normalized,club===8?1.65:1.12)*velocityFactor*sensitivity,0,1);
    const error=clamp(dx/Math.max(.16,dy)*.8+Math.sign(bias||dx||1)*deviation*1.5,-1,1);
    this.feedback={power,error,canceled:outside||returned,armed:dy>.055&&this.maxTravel>.09,speed,duration,distance:normalized,deviation};return this.feedback;
  }
  release(x,y,time,club=4,sensitivity=1){const f=this.move(x,y,time,club,sensitivity);return {...f,canceled:f.canceled||!f.armed||f.power<.005};}
}

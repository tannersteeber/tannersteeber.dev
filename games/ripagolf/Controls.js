import {clamp} from './rules.js';
export class GolfControls {
  constructor(canvas,swingZone,hooks,settings){
    this.hooks=hooks;this.settings=settings;this.keys=new Set();this.off=[];
    const on=(el,event,fn,options)=>{el.addEventListener(event,fn,options);this.off.push(()=>el.removeEventListener(event,fn,options));};
    on(window,'keydown',e=>{
      if(/INPUT|SELECT|TEXTAREA/.test(e.target?.tagName))return;
      if(['Space','KeyA','KeyD','ArrowLeft','ArrowRight','Escape','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9'].includes(e.code))e.preventDefault();
      if(e.code==='Escape'&&!e.repeat)hooks.pause();
      if(e.code==='Space'&&!e.repeat)hooks.timing();
      if(/^Digit[1-9]$/.test(e.code)&&!e.repeat)hooks.club(Number(e.code.slice(-1))-1);
      this.keys.add(e.code);
    });on(window,'keyup',e=>this.keys.delete(e.code));on(window,'blur',()=>{this.keys.clear();this.drag=null;this.swipe=null;hooks.charge(0);});
    on(canvas,'pointerdown',e=>{this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};try{canvas.setPointerCapture(e.pointerId);}catch{}});
    on(canvas,'pointermove',e=>{if(!this.drag||this.drag.id!==e.pointerId)return;hooks.aim(-(e.clientX-this.drag.x)*.004*this.settings.cameraSensitivity);hooks.pitch((e.clientY-this.drag.y)*.005);this.drag.x=e.clientX;this.drag.y=e.clientY;});
    const endDrag=()=>{this.drag=null;};on(canvas,'pointerup',endDrag);on(canvas,'pointercancel',endDrag);on(canvas,'wheel',e=>{e.preventDefault();hooks.zoom(e.deltaY*.001);},{passive:false});
    on(swingZone,'pointerdown',e=>{
      if(!swingZone.getClientRects().length)return;
      e.preventDefault();if(e.button&&e.pointerType==='mouse')return;
      this.swipe={id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now()};try{swingZone.setPointerCapture(e.pointerId);}catch{}
    });
    on(swingZone,'pointermove',e=>{if(this.swipe?.id!==e.pointerId)return;hooks.charge(clamp((this.swipe.y-e.clientY)/(swingZone.clientHeight*.82),0,1));});
    on(swingZone,'pointerup',e=>{
      if(this.swipe?.id!==e.pointerId)return;const start=this.swipe;this.swipe=null;hooks.charge(0);
      const dy=start.y-e.clientY,dx=e.clientX-start.x,elapsed=Math.max(.07,(performance.now()-start.t)/1000);
      if(dy<12)return;
      const length=dy/Math.max(50,swingZone.clientHeight*.82),intensity=clamp(dy/(Math.max(1,innerHeight)*elapsed)*.75,.5,1.12);
      const power=clamp(length*(.65+.35*intensity)*settings.swingSensitivity,.02,1);
      hooks.swing(power,clamp(dx/Math.max(40,dy)*1.4,-1,1));
    });
    on(swingZone,'pointercancel',()=>{this.swipe=null;hooks.charge(0);});on(swingZone,'contextmenu',e=>e.preventDefault());
  }
  update(dt){const k=this.keys,left=k.has('KeyA')||k.has('ArrowLeft'),right=k.has('KeyD')||k.has('ArrowRight');if(left||right)this.hooks.aim((Number(right)-Number(left))*dt*.55);}
  reset(){this.keys.clear();this.drag=this.swipe=null;}
  destroy(){this.off.forEach(off=>off());this.reset();}
}

import {SwingGesture} from './SwingGesture.js?v=20261025-physics-2';
export class GolfControls {
  constructor(canvas,swingZone,hooks,settings){
    this.hooks=hooks;this.settings=settings;this.keys=new Set();this.off=[];
    const on=(el,event,fn,options)=>{el.addEventListener(event,fn,options);this.off.push(()=>el.removeEventListener(event,fn,options));};
    on(window,'keydown',e=>{
      if(/INPUT|SELECT|TEXTAREA/.test(e.target?.tagName)||this.swipe)return;
      if(['Space','KeyA','KeyD','ArrowLeft','ArrowRight','Escape','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9'].includes(e.code))e.preventDefault();
      if(e.code==='Escape'&&!e.repeat)hooks.pause();
      if(e.code==='Space'&&!e.repeat)hooks.timing();
      if(/^Digit[1-9]$/.test(e.code)&&!e.repeat)hooks.club(Number(e.code.slice(-1))-1);
      this.keys.add(e.code);
    });on(window,'keyup',e=>this.keys.delete(e.code));on(window,'blur',()=>{this.keys.clear();this.drag=null;this.swipe=null;hooks.gesture?.(null);hooks.charge(0);});
    on(canvas,'pointerdown',e=>{if(this.swipe||this.drag)return;this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};try{canvas.setPointerCapture(e.pointerId);}catch{}});
    on(canvas,'pointermove',e=>{if(!this.drag||this.drag.id!==e.pointerId)return;hooks.aim(-(e.clientX-this.drag.x)*.004*this.settings.cameraSensitivity);hooks.pitch((e.clientY-this.drag.y)*.005*this.settings.cameraSensitivity);this.drag.x=e.clientX;this.drag.y=e.clientY;});
    const endDrag=()=>{this.drag=null;};on(canvas,'pointerup',endDrag);on(canvas,'pointercancel',endDrag);on(canvas,'wheel',e=>{e.preventDefault();hooks.zoom(e.deltaY*.001*this.settings.cameraSensitivity);},{passive:false});
    const normalized=e=>{const r=swingZone.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height,time:(Number.isFinite(e.timeStamp)?e.timeStamp:performance.now())/1000};};
    on(swingZone,'pointerdown',e=>{
      if(this.swipe||!swingZone.getClientRects().length||e.button>0||hooks.canSwing?.()===false)return;
      e.preventDefault();this.drag=null;this.keys.clear();const p=normalized(e);this.swipe={id:e.pointerId,gesture:new SwingGesture(p.x,p.y,p.time)};
      hooks.gesture?.(this.swipe.gesture);try{swingZone.setPointerCapture(e.pointerId);}catch{}
    });
    on(swingZone,'pointermove',e=>{
      if(this.swipe?.id!==e.pointerId)return;e.preventDefault();
      for(const sample of e.getCoalescedEvents?.().length?e.getCoalescedEvents():[e]){const p=normalized(sample);this.swipe.gesture.move(p.x,p.y,p.time,hooks.clubIndex?.()??4,settings.swingSensitivity);}
      hooks.charge(this.swipe.gesture.feedback.canceled?0:this.swipe.gesture.feedback.power);hooks.gesture?.(this.swipe.gesture);
    });
    on(swingZone,'pointerup',e=>{
      if(this.swipe?.id!==e.pointerId)return;e.preventDefault();const p=normalized(e),gesture=this.swipe.gesture;
      const result=gesture.release(p.x,p.y,p.time,hooks.clubIndex?.()??4,settings.swingSensitivity);this.swipe=null;
      hooks.charge(0);hooks.gesture?.(gesture,true);
      if(!result.canceled&&hooks.canSwing?.()!==false)hooks.swing(result.power,result.error);
    });
    const cancel=()=>{this.swipe=null;hooks.charge(0);hooks.gesture?.(null);};
    on(swingZone,'pointercancel',cancel);on(swingZone,'lostpointercapture',()=>{if(this.swipe)cancel();});on(window,'resize',cancel);
    on(swingZone,'contextmenu',e=>e.preventDefault());
  }
  update(dt){if(this.swipe)return;const k=this.keys,left=k.has('KeyA')||k.has('ArrowLeft'),right=k.has('KeyD')||k.has('ArrowRight');if(left||right)this.hooks.aim((Number(right)-Number(left))*dt*.55);}
  reset(){this.keys.clear();this.drag=this.swipe=null;this.hooks.gesture?.(null);}
  destroy(){this.off.forEach(off=>off());this.reset();}
}

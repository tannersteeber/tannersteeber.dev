import {h} from '../shared/ui/dom.js';
import {CLUBS,predictions,PREDICTIONS,yards} from './rules.js?v=20261025-controls-7';
import {PAGE_THEMES} from './ThemeAdapter.js?v=20261025-controls-7';
export function wordmark(){
  const mark=h('span',{class:'rg-brandmark','aria-hidden':'true'});
  mark.innerHTML='<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="28" stroke="currentColor" stroke-width="3" stroke-dasharray="8 5"/><circle cx="32" cy="32" r="21" stroke="currentColor"/><path d="M26 46V16l19 7-19 7" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M17 47h30" stroke="currentColor" stroke-width="2"/><circle cx="37" cy="41" r="5" fill="currentColor"/></svg>';
  return mark;
}
const num=n=>Math.floor(n).toLocaleString();
const distanceLabel=m=>m<9.144?`${(m/.3048).toFixed(1)} ft`:`${yards(m)} yd`;
export class GolfUI {
  constructor(root,game){
    this.game=game;this.root=root;this.fields={};
    this.layer=h('div',{class:'rg-ui'});
    this.top=h('header',{class:'rg-top'},h('a',{class:'rg-back',href:'../../arcade.html',text:'← Arcade'}),h('span',{class:'rg-small-brand'},wordmark(),'RipaGolf'),h('button',{class:'rg-icon',type:'button','aria-label':'Pause game',text:'Ⅱ',onclick:()=>game.togglePause()}));
    this.cameraButtons={};this.cameraTools=h('div',{class:'rg-camera-tools',hidden:true});
    for(const [view,label]of [['main','Main'],['hole','Hole'],['overview','Course']]){const button=this.button(label,()=>game.setCameraView(view));button.setAttribute('aria-label',label+' camera');this.cameraButtons[view]=button;this.cameraTools.append(button);}
    this.greenButton=this.button('Contours',()=>game.setting('greenHeightmap',!game.store.settings.greenHeightmap));this.greenButton.setAttribute('aria-label','Toggle green heightmap and downhill arrows');this.cameraTools.append(this.greenButton);this.top.insertBefore(this.cameraTools,this.top.lastChild);
    this.contourKey=h('p',{class:'rg-contour-key',hidden:true,text:'Low → High · arrows point downhill'});
    this.hud=h('div',{class:'rg-hud',hidden:true});
    for(const [key,label] of [['hole','Hole'],['par','Par'],['strokes','Strokes'],['pin','To pin'],['wind','Wind'],['streak','Streak'],['score','Run score'],['club','Club'],['carry','Est. carry'],['lie','Lie'],['slope','Green slope']]){
      const value=h('strong',{text:'0'});this.fields[key]=value;this.hud.append(h('div',{class:'rg-stat '+(key==='streak'?'rg-jackpot':'')},h('span',{text:label}),value));
    }
    this.predictionLabel=h('p',{class:'rg-active-prediction'});this.hud.append(this.predictionLabel);
    this.flight=h('div',{class:'rg-flight',hidden:true,'aria-live':'polite'});
    this.toast=h('div',{class:'rg-toast',role:'status'});
    this.shot=h('section',{class:'rg-shot',hidden:true,'aria-label':'Shot controls'});
    this.club=h('select',{'aria-label':'Club',onchange:e=>game.chooseClub(Number(e.target.value))},CLUBS.map((c,i)=>h('option',{value:i,text:`${i+1} · ${c.name} · ~${yards(c.carry)} yd`})));
    this.lie=h('span',{class:'rg-lie'});
    this.clubHeader=h('div',{class:'rg-shot-header'},this.club,this.lie);this.shot.append(this.clubHeader);
    this.shot.append(h('p',{class:'rg-preview-label rg-range-hint',text:'Approx. full-power range · varies with conditions.'}));
    this.aim=this.range('Aim',-100,100,.1,v=>game.setAim(Number(v)*Math.PI/180));
    this.power=this.range('Power',.5,100,.5,v=>game.setPower(Number(v)/100));
    this.plan=h('p',{class:'rg-preview-label'});this.shot.append(this.plan);
    const options=this.shotOptions=h('div',{class:'rg-shot-options','aria-label':'Shot shape and trajectory'});
    this.spin=this.select('Spin',[['0','Standard spin'],['1','Backspin'],['-1','Topspin']],v=>game.setShotOption('spin',Number(v)));
    this.shape=this.select('Shape',[['0','Straight'],['-0.7','Draw'],['0.7','Fade']],v=>game.setShotOption('shape',Number(v)));
    this.loft=this.select('Trajectory',[['0','Normal'],['-6','Low'],['6','High']],v=>game.setShotOption('loft',Number(v)));
    this.putterOptionsHint=h('p',{class:'rg-putter-options-hint',hidden:true,text:'Putting uses aim and power. Spin and trajectory apply to airborne shots.'});
    options.append(this.putterOptionsHint,this.spin,this.shape,this.loft);
    this.adjustments=h('div',{class:'rg-adjustments'},this.aim.closest('label'),this.power.closest('label'),this.plan,options);
    this.shot.append(this.adjustments);
    this.swingZone=h('div',{class:'rg-swing-zone',role:'group','aria-label':'Swipe upward here to swing'},h('span',{class:'rg-swipe-arrow',text:'↑'}),h('span',{text:'Swipe up to swing'}),h('small',{text:'Length = power · speed = intensity'}));
    const svgNS='http://www.w3.org/2000/svg';this.trail=document.createElementNS(svgNS,'svg');this.trail.setAttribute('viewBox','0 0 100 100');this.trail.setAttribute('preserveAspectRatio','none');this.trail.setAttribute('aria-hidden','true');this.trail.classList.add('rg-gesture-trail');
    this.trailPath=document.createElementNS(svgNS,'path');this.trail.append(this.trailPath);this.swingZone.append(this.trail);
    this.swingFeedback=h('strong',{class:'rg-swipe-feedback',text:'Swipe up'});this.swingDetails=h('small',{class:'rg-swipe-details',text:'Start at ring · return or leave edge to cancel'});this.swingZone.append(this.swingFeedback,this.swingDetails);
    this.lastShot=h('p',{class:'rg-shot-summary',hidden:true});this.shot.append(this.lastShot);
    this.chargeFill=h('i');this.swingZone.append(h('div',{class:'rg-charge'},this.chargeFill));this.shot.append(this.swingZone);
    this.needle=h('i');this.timingBar=h('div',{class:'rg-timing',hidden:true},h('span'),this.needle);
    this.swingButton=this.button('Time swing · Space',()=>game.timing(),true);
    this.shot.append(this.timingBar,this.swingButton);
    this.swingDock=h('aside',{class:'rg-swing-dock',hidden:true,'aria-label':'Swing controls'});
    this.mobile=matchMedia('(pointer:coarse), (max-width:650px), (max-width:900px) and (max-height:520px)');
    this.onLayout=()=>{
      game.controls?.reset();root.classList.toggle('rg-touch-layout',this.mobile.matches);
      if(this.mobile.matches){this.layer.insertBefore(this.hud,this.shot);this.hud.prepend(this.clubHeader);this.swingDock.append(this.swingZone,this.timingBar,this.swingButton,this.flight);}
      else{this.shot.prepend(this.clubHeader);this.layer.insertBefore(this.hud,this.shot);this.layer.insertBefore(this.flight,this.shot);this.shot.append(this.swingZone,this.timingBar,this.swingButton);}
      this.resizeDock();
    };
    this.mobile.addEventListener('change',this.onLayout);
    this.dockObserver=new ResizeObserver(()=>this.resizeDock());this.dockObserver.observe(this.shot);
    this.modal=h('div',{class:'rg-modal',hidden:true});
    this.layer.append(this.top,this.hud,this.flight,this.shot,this.swingDock,this.toast,this.contourKey,this.modal);root.append(this.layer);this.onLayout();this.dockObserver.observe(this.top);this.dockObserver.observe(this.hud);this.dockObserver.observe(this.swingDock);
    this.onKey=e=>{
      if(this.modal.hidden||e.code!=='Tab')return;
      const focus=[...this.top.querySelectorAll('button, a'),...this.modal.querySelectorAll('button, a, input, select')].filter(el=>!el.disabled&&el.getClientRects().length);
      const first=focus[0],last=focus.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
      if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    };window.addEventListener('keydown',this.onKey,true);
  }
  resizeDock(){
    const height=Math.ceil(this.shot.getBoundingClientRect().height);
    const value=`${height}px`;if(this.root.style.getPropertyValue('--rg-dock-height')!==value)this.root.style.setProperty('--rg-dock-height',value);
    this.root.classList.toggle('rg-aiming',!this.shot.hidden);this.swingDock.hidden=this.shot.hidden||!this.mobile.matches;const y=Math.ceil(this.top.getBoundingClientRect().bottom-this.root.getBoundingClientRect().top+10);if(this.root.style.getPropertyValue('--rg-ui-top')!==y+'px')this.root.style.setProperty('--rg-ui-top',y+'px');
  }
  button(text,action,primary=false){return h('button',{class:'rg-button'+(primary?' rg-primary':''),type:'button',text,onclick:()=>{this.game.audio.unlock();this.game.audio.click();action();}});}
  range(label,min,max,step,fn){
    const input=h('input',{type:'range',min,max,step,'aria-label':label,oninput:e=>fn(e.target.value)}),val=h('output');input.output=val;
    if(label==='Aim'){
      // Relative touch dragging avoids jumping several degrees per track pixel.
      let drag=null;
      input.title='Drag for fine aim; use − and + for 0.1° steps';
      input.addEventListener('pointerdown',e=>{if(input.disabled||!['touch','pen'].includes(e.pointerType))return;e.preventDefault();drag={id:e.pointerId,x:e.clientX,value:Number(input.value)};try{input.setPointerCapture(e.pointerId);}catch{}});
      input.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId||input.disabled)return;e.preventDefault();input.value=String(Math.max(min,Math.min(max,Math.round((drag.value+(e.clientX-drag.x)*.12)/step)*step)));input.dispatchEvent(new Event('input',{bubbles:true}));});
      for(const type of ['pointerup','pointercancel','lostpointercapture'])input.addEventListener(type,()=>{drag=null;});
    }
    const change=dir=>{if(input.disabled)return;input.value=String(Math.max(min,Math.min(max,Number(input.value)+dir*step)));input.dispatchEvent(new Event('input',{bubbles:true}));};
    const minus=this.button('−',()=>change(-1)),plus=this.button('+',()=>change(1));minus.setAttribute('aria-label','Decrease '+label.toLowerCase());plus.setAttribute('aria-label','Increase '+label.toLowerCase());
    this.shot.append(h('label',{class:'rg-slider'},h('span',{class:'rg-slider-heading'},h('span',{text:label}),val),minus,input,plus));return input;
  }
  safeView(){
    const r=this.root.getBoundingClientRect(),visible=el=>el&&!el.hidden&&getComputedStyle(el).visibility!=='hidden'&&el.getClientRects().length;
    let left=14,right=r.width-14,top=this.top.getBoundingClientRect().bottom-r.top+12,bottom=r.height-18;
    if(this.mobile.matches){
      const gap=parseFloat(getComputedStyle(this.swingDock).bottom)||64;bottom=r.height-gap-10;
      if(visible(this.hud))top=Math.max(top,this.hud.getBoundingClientRect().bottom-r.top+10);
      if(this.game.cameraView==='main'&&visible(this.shot)&&visible(this.swingDock)){
        const a=this.shot.getBoundingClientRect(),b=this.swingDock.getBoundingClientRect();
        if(r.height>=r.width)bottom=Math.min(bottom,a.top-r.top-10,b.top-r.top-10);
        else{left=Math.max(left,a.right-r.left+12);right=Math.min(right,b.left-r.left-12);}
      }
    }else if(visible(this.shot)&&this.game.cameraView==='main')right=Math.min(right,this.shot.getBoundingClientRect().left-r.left-16);
    if(visible(this.contourKey))top=Math.max(top,this.contourKey.getBoundingClientRect().bottom-r.top+8);
    return {left,right:Math.max(left+40,right),top,bottom:Math.max(top+60,bottom),fullWidth:r.width,fullHeight:r.height};
  }
  syncCamera(){
    const active=['aim','timing','flight'].includes(this.game.phase);this.cameraTools.hidden=!active;
    this.root.classList.toggle('rg-inspecting',active&&this.game.cameraView!=='main');
    for(const [view,button]of Object.entries(this.cameraButtons))button.setAttribute('aria-pressed',String(this.game.cameraView===view));
    this.greenButton.setAttribute('aria-pressed',String(this.game.store.settings.greenHeightmap));this.contourKey.hidden=!active||!this.game.store.settings.greenHeightmap;
  }
  select(label,options,fn){
    const select=h('select',{'aria-label':label,onchange:e=>fn(e.target.value)},options.map(([v,t])=>h('option',{value:v,text:t})));
    const short={'Standard spin':'Std','Backspin':'Back','Topspin':'Top','Straight':'Line','Normal':'Mid'};
    const choices=h('div',{class:'rg-choice-buttons',role:'group','aria-label':label},options.map(([value,text])=>{
      const button=this.button(short[text]||text,()=>{if(select.disabled)return;select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));});
      button.dataset.value=value;button.setAttribute('aria-label',label+': '+text);return button;
    }));
    return h('div',{class:'rg-option'},h('span',{text:label==='Trajectory'?'Flight':label}),select,choices);
  }
  panel(kind,title,children){
    this.kind=kind;this.modal.className='rg-modal rg-'+kind;this.modal.replaceChildren(h('section',{class:'rg-panel',role:'dialog','aria-label':title},h('h2',{text:title}),...children));this.modal.hidden=false;
    this.shot.hidden=true;this.syncCamera();this.cameraTools.hidden=true;this.contourKey.hidden=true;this.resizeDock();this.modal.querySelector('button, select, input, a')?.focus({preventScroll:true});
  }
  close(){this.modal.hidden=true;this.kind=null;}
  title(){
    const g=this.game,s=g.store.stats;
    this.kind='title';this.modal.className='rg-modal rg-title';
    const actions=h('div',{class:'rg-actions'});
    if(g.store.run?.status==='active'&&g.store.run.hole)actions.append(this.button('Resume run',()=>g.resumeSaved(),true));
    actions.append(this.button('Play Golf',()=>g.newRun(),true),this.button('How to Play',()=>this.help()),this.button('Statistics',()=>this.statistics()),this.button('Settings',()=>g.openSettings()));
    this.modal.replaceChildren(h('section',{class:'rg-panel',role:'dialog','aria-label':'RipaGolf main menu'},
      h('div',{class:'rg-wordmark'},wordmark(),h('h1',{text:'RipaGolf'})),h('p',{class:'rg-tagline',text:'Swing. Predict. Survive.'}),
      h('p',{class:'rg-intro',text:'The precision of golf. The pressure of the streak. Read the hole, place your prediction and make every stroke count.'}),
      h('div',{class:'rg-records'},h('div',null,h('span',{text:'Best streak'}),h('strong',{text:num(s.bestStreak)})),h('div',null,h('span',{text:'Highest run'}),h('strong',{text:num(s.highestScore)}))),
      actions,h('p',{class:'rg-footnote',text:'Free virtual points only · No money, purchases or prizes'})));
    this.modal.hidden=false;this.shot.hidden=true;this.hud.hidden=true;this.cameraTools.hidden=true;this.contourKey.hidden=true;this.resizeDock();this.modal.querySelector('button')?.focus({preventScroll:true});
  }
  overview(){this.close();this.flight.hidden=false;this.flight.replaceChildren(h('strong',{text:`Hole ${this.game.run.holeIndex} · Par ${this.game.course.par} · ${yards(this.game.course.length)} yd`}),this.button('Choose prediction',()=>this.game.openPredictions()));}
  predictions(selected=null){
    const g=this.game,c=g.course;
    const meta=h('p',{class:'rg-hole-meta',text:`Hole ${g.run.holeIndex} · Par ${c.par} · ${yards(c.length)} yards · Wind ${(c.wind.speed*2.23694).toFixed(0)} mph`});
    this.map=h('canvas',{class:'rg-map',width:640,height:145,'aria-label':'Hole map with fairway, sand, water, tee and pin'});
    this.lockButton=this.button('Lock in prediction',()=>g.lockPrediction(),true);this.lockButton.disabled=!selected;
    this.chips=h('div',{class:'rg-chips',role:'group','aria-label':'Choose a prediction'},predictions(c.par).map(p=>h('button',{
      class:'rg-chip'+(p.id===selected?' selected':''),type:'button','aria-pressed':p.id===selected?'true':'false',onclick:()=>{
        g.audio.unlock();g.audio.click();g.selection=p.id;
        for(const button of this.chips.children){const on=button.dataset.prediction===p.id;button.classList.toggle('selected',on);button.setAttribute('aria-pressed',String(on));}this.lockButton.disabled=false;
      },'data-prediction':p.id},h('strong',{text:p.name}),h('span',{text:`${p.mult}× · ${Math.round(p.mult*1000).toLocaleString()} base pts`}))));
    this.panel('prediction','Read the hole. Place your chip.',[meta,this.map,h('p',{class:'rg-footnote',text:'Green = fairway · Ivory = sand · Blue = water. Your official stroke count includes penalties.'}),this.chips,this.lockButton]);
    this.flight.hidden=true;this.drawMap();
  }
  drawMap(){
    if(!this.map||!this.map.isConnected)return;const c=this.game.course,p=this.game.theme.palette.world,x=this.map.getContext('2d'),w=640,h=145;
    const scale=Math.min((w-40)/(c.length+35),(h-20)/180),X=z=>20+z*scale,Y=v=>h/2-v*scale;
    x.fillStyle=p.rough.getStyle();x.fillRect(0,0,w,h);x.lineCap='round';x.strokeStyle=p.fairway.getStyle();x.lineWidth=c.width*2*scale;x.beginPath();
    for(let z=0;z<c.length;z+=3){const a=X(z),b=Y(c.center(z));if(z===0)x.moveTo(a,b);else x.lineTo(a,b);}x.stroke();
    x.fillStyle=p.green.getStyle();x.beginPath();x.arc(X(c.pin.z),Y(c.pin.x),c.greenRadius*scale,0,Math.PI*2);x.fill();
    for(const hazard of c.hazards){x.fillStyle=p[hazard.type].getStyle();x.beginPath();x.ellipse(X(hazard.z),Y(hazard.x),hazard.rz*scale,hazard.rx*scale,0,0,Math.PI*2);x.fill();}
    x.fillStyle='#fff';x.beginPath();x.arc(X(0),Y(0),4,0,7);x.fill();x.fillStyle=p.accent.getStyle();x.beginPath();x.arc(X(c.pin.z),Y(c.pin.x),4,0,7);x.fill();
  }
  ready(){this.close();this.flight.hidden=true;this.hud.hidden=false;this.shot.hidden=false;this.syncShot();}
  lockShotInputs(locked){for(const input of [this.club,this.aim,this.power,...this.adjustments.querySelectorAll('select')])input.disabled=locked||(this.game.club===8&&input.tagName==='SELECT'&&input!==this.club);}
  syncShot(){
    this.putterOptionsHint.hidden=this.game.club!==8;for(const option of [this.spin,this.shape,this.loft])option.hidden=this.game.club===8;
    this.lockShotInputs(this.game.phase!=='aim');this.syncCamera();this.resizeDock();
    const g=this.game;this.club.value=String(g.club);this.lie.textContent=g.course.surface(g.ball.p.x,g.ball.p.z);
    this.aim.value=String(g.relativeAim()*180/Math.PI);this.aim.output.textContent=(g.relativeAim()*180/Math.PI).toFixed(1)+'°';
    this.power.value=String(g.power*100);this.power.output.textContent=(g.power*100).toFixed(g.power<.1?1:0)+'%';
    this.swingButton.disabled=!['aim','timing'].includes(g.phase);
    if(g.phase==='timing')this.updateTiming(g.timingValue);
    this.timingBar.hidden=g.phase!=='timing';this.swingZone.hidden=g.phase!=='aim';this.swingButton.hidden=g.phase==='flight';this.swingButton.textContent=(g.phase==='timing'?'Strike':'Time swing')+(this.mobile.matches?'':' · Space');
    for(const [key,el]of [['spin',this.spin],['shape',this.shape],['loft',this.loft]]){const select=el.querySelector('select');select.value=String(g[key]);for(const button of el.querySelectorAll('button')){button.disabled=select.disabled;button.setAttribute('aria-pressed',String(Number(button.dataset.value)===g[key]));}}
  }
  update(){
    const g=this.game;if(!g.run||!g.course)return;
    const values={hole:g.run.holeIndex,par:g.course.par,strokes:g.hole.strokes,pin:distanceLabel(g.course.distance(g.ball.p.x,g.ball.p.z)),wind:`${this.windArrow()} ${(Math.hypot(...Object.values(g.course.windAt(g.windTime)))*2.23694).toFixed(0)} mph`,streak:g.run.streak,score:num(g.run.score)};
    const slope=g.course.slope(g.ball.p.x,g.ball.p.z);values.club=CLUBS[g.club].name;values.carry=`${yards(CLUBS[g.club].carry)} yd`;this.fields.carry.previousElementSibling.textContent=g.club===8?'Est. roll':'Est. carry';values.lie=g.course.surface(g.ball.p.x,g.ball.p.z);const cross=slope.x*Math.cos(g.aim)-slope.z*Math.sin(g.aim),up=slope.x*Math.sin(g.aim)+slope.z*Math.cos(g.aim);values.slope=Math.hypot(slope.x,slope.z)<.001?'Level':`${(Math.hypot(slope.x,slope.z)*100).toFixed(1)}% / ${(Math.atan(Math.hypot(slope.x,slope.z))*180/Math.PI).toFixed(1)}° · ${Math.abs(cross)>.002?(cross>0?'left':'right'):(up>0?'uphill':'downhill')}`;
    for(const [key,value]of Object.entries(values))this.fields[key].textContent=value;
    const greenSlope=g.course.slope(g.course.pin.x,g.course.pin.z);this.contourKey.textContent=`At cup: ${(Math.atan(Math.hypot(greenSlope.x,greenSlope.z))*180/Math.PI).toFixed(1)}° · downhill arrows · Low → High`;
    const prediction=PREDICTIONS.find(p=>p.id===g.hole.prediction);this.predictionLabel.textContent=prediction?`${prediction.name} · ${prediction.mult}× reward · Par ${g.course.par} / ${yards(g.course.length)} yd`:'';
  }
  updateTiming(value){this.needle.style.transform=`translate3d(${(value+1)*50}%,0,0)`;}
  windArrow(){return ['↑','↗','→','↘','↓','↙','←','↖'][Math.round(this.game.course.wind.angle/(Math.PI/4))%8];}
  charge(value){this.chargeFill.style.transform=`scaleX(${value})`;}
  inFlight(){this.shot.hidden=!this.mobile.matches;this.resizeDock();this.syncShot();this.flight.hidden=false;this.flight.replaceChildren(h('strong',{text:this.game.club===8?'Reading the green…':'Ball in flight…'}),this.button('Speed up to next shot · 8×',()=>this.game.speedUpShot()));}
  syncPlayback(){const button=this.flight.querySelector('button');if(button){button.textContent=this.game.playbackRate===1?'Speed up to next shot · 8×':'Normal speed · 1×';button.setAttribute('aria-pressed',String(this.game.playbackRate>1));}}
  shotSummary(summary){if(!summary)return;this.lastShot.hidden=false;this.lastShot.textContent=`Last shot · carry ${yards(summary.carry||0)} yd · total ${yards(summary.total)} yd · ${summary.lie} · ${distanceLabel(summary.remaining)} left`;}
  gesture(gesture,released=false){
    if(!gesture){this.lockShotInputs(this.game.phase!=='aim');if(this.trailReleased)return;this.swingZone.classList.remove('rg-swiping','rg-swipe-canceled');this.trailPath.setAttribute('d','');this.swingFeedback.textContent='Swipe up';this.swingDetails.textContent='Start at ring · return or leave edge to cancel';return;}
    this.lockShotInputs(!released||this.game.phase!=='aim');clearTimeout(this.trailTimer);this.trailReleased=released;
    const points=gesture.points,f=gesture.feedback;let d=`M ${points[0].x*100} ${points[0].y*100}`;
    for(let i=1;i<points.length;i++){const p=points[i],next=points[i+1];d+=next?` Q ${p.x*100} ${p.y*100} ${(p.x+next.x)*50} ${(p.y+next.y)*50}`:` L ${p.x*100} ${p.y*100}`;}
    this.trailPath.setAttribute('d',d);this.swingZone.classList.toggle('rg-swiping',!released);this.swingZone.classList.toggle('rg-swipe-canceled',f.canceled);this.swingZone.classList.toggle('rg-trail-released',released);
    const club=this.game.club,power=f.power||0,estimate=CLUBS[club].carry*Math.pow(power,club===8?1.4:1);
    this.swingFeedback.textContent=f.canceled?'Cancel swing':`${Math.round(power*100)}% power`;
    this.swingDetails.textContent=f.canceled?'Release to cancel':`${Math.abs(f.error)<.12?'Straight':f.error<0?'Left deviation':'Right deviation'} · ~${yards(estimate)} yd · ${f.speed.toFixed(1)}× speed`;
    if(released)this.trailTimer=setTimeout(()=>{this.trailReleased=false;this.swingZone.classList.remove('rg-trail-released');this.gesture(null);},360);
  }
  titleMenu(){this.panel('title-menu','Menu',[h('div',{class:'rg-actions'},this.button('Back to main menu',()=>this.title(),true),this.button('Settings',()=>this.game.openSettings()),this.button('How to Play',()=>this.help()),this.button('Statistics',()=>this.statistics()),h('a',{class:'rg-button',href:'../../arcade.html',text:'Return to Arcade'}))]);}
  pause(){this.panel('pause','Paused',[h('div',{class:'rg-actions'},this.button('Resume',()=>this.game.resume(),true),this.button('Settings',()=>this.game.openSettings()),this.button('End run',()=>this.game.abandon()),h('a',{class:'rg-button',href:'../../arcade.html',text:'Return to Arcade'}))]);}
  result(result){
    const g=this.game;this.flight.hidden=true;
    const lines=h('dl',{class:'rg-scorecard'});
    for(const [k,v]of [['Hole',`${g.run.holeIndex} · Par ${g.course.par}`],['Official strokes',g.hole.strokes],['Result',result.name],['Prediction',PREDICTIONS.find(p=>p.id===g.hole.prediction)?.name],['Current streak',result.streak],['Run score',num(result.score)]])lines.append(h('div',null,h('dt',{text:k}),h('dd',{text:String(v)})));
    this.panel(result.won?'won':'lost',result.won?'Prediction won':'Streak lost',[
      h('p',{class:'rg-eyebrow',text:'Hole complete'}),h('div',{class:'rg-award'},h('span',{class:'rg-result-chip','aria-hidden':'true',text:result.won?'✓':'×'}),h('strong',{text:result.won?'+'+num(result.points)+' pts':num(result.score)+' run pts'})),
      result.milestone?h('p',{class:'rg-milestone',text:result.milestone}):null,lines,
      h('div',{class:'rg-actions'},this.button(result.won?'Next hole':'Play another run',()=>result.won?g.nextHole():g.newRun(),true),this.button('Statistics',()=>this.statistics()),this.button('Main menu',()=>g.mainMenu()))
    ]);
    if(result.won&&!g.store.settings.reducedMotion)this.animateNumber(this.modal.querySelector('.rg-award strong'),result.points);
  }
  animateNumber(el,points){const start=performance.now();const tick=now=>{if(!el.isConnected)return;const t=Math.min(1,(now-start)/650);el.textContent='+'+num(points*(1-(1-t)**3))+' pts';if(t<1)this.countRaf=requestAnimationFrame(tick);};this.countRaf=requestAnimationFrame(tick);}
  statistics(){
    const s=this.game.store.stats,rows=[['Best streak',s.bestStreak],['Highest run',num(s.highestScore)],['Lifetime points',num(s.lifetimePoints)],['Current streak',this.game.store.run?.streak||0],['Holes completed',s.holes],['Total strokes',s.strokes],['Birdies',s.birdies],['Eagles',s.eagles],['Holes-in-one',s.aces],['Predictions won',s.won],['Predictions lost',s.lost],['Avg. strokes vs par',s.holes?(s.relativeTotal/s.holes).toFixed(2):'—'],['Prediction success',s.holes?Math.round(s.won/s.holes*100)+'%':'—']];
    const stats=h('div',{class:'rg-stats-grid'},rows.map(([label,value])=>h('div',null,h('span',{text:label}),h('strong',{text:String(value)}))));
    this.panel('statistics','The clubhouse',[stats,h('h3',{text:'Milestone badges'}),h('div',{class:'rg-badges'},s.achievements.length?s.achievements.map(name=>h('span',{text:name})):h('p',{text:'Build a streak of 5 to earn your first badge.'})),this.button('Back',()=>this.game.returnScreen(),true)]);
  }
  help(){this.panel('help','How to play',[
    h('ol',{class:'rg-instructions'},[
      'Review each seeded par 3, 4 or 5. Choose a prediction and lock it before taking a shot.',
      'Choose a club, adjust aim and planned power. The outlined path previews that shot in current conditions.',
      'On mobile, start at the right-side ring and swipe upward. The trail shows power and accuracy. Return to the start or leave the edge before release to cancel. Short swipes give finer putting control.',
      'On desktop, set the Power slider and use Time swing / Space, then strike when the needle reaches the center. A/D aim, number keys select clubs, canvas drag rotates the view and mouse wheel zooms.',
      'Use the putter on the green. Reduce power for precision. Ground slope, lie, bounce, spin and wind affect every shot.',
      'Finish the hole. A matching prediction earns virtual points and extends the streak. A failed prediction ends the run.'
    ].map(text=>h('li',{text}))),
    h('p',{class:'rg-footnote',text:'Arcade rules: a generous cup captures slow rolling balls. Water adds one penalty and safe fairway relief; out of bounds adds one penalty and returns to your previous lie. One shot always counts one stroke. No money or cash-equivalent prizes.'}),this.button('Back',()=>this.game.returnScreen(),true)
  ]);}
  settings(){
    const g=this.game,s=g.store.settings,body=h('div',{class:'rg-settings-body'});
    const row=(label,control)=>body.append(h('label',{class:'rg-setting'},h('span',{text:label}),control));
    row('Graphics',h('select',{'aria-label':'Graphics',onchange:e=>g.setting('graphics',e.target.value)},['low','medium','high'].map(v=>h('option',{value:v,selected:s.graphics===v,text:v[0].toUpperCase()+v.slice(1)}))));
    for(const [key,label,min,max,step]of [['swingSensitivity','Swing sensitivity',.4,2,.05],['cameraSensitivity','Camera sensitivity',.4,2,.05],['effects','Sound effects',0,1,.05],['music','Lounge music',0,1,.05]]){
      const out=h('output',{text:key.includes('Sensitivity')?s[key].toFixed(2)+'×':Math.round(s[key]*100)+'%'});
      row(label,h('span',{class:'rg-setting-range'},h('input',{type:'range',min,max,step,value:s[key],'aria-label':label,oninput:e=>{const v=Number(e.target.value);g.setting(key,v);out.textContent=key.includes('Sensitivity')?v.toFixed(2)+'×':Math.round(v*100)+'%';}}),out));
    }
    for(const [key,label]of [['muted','Mute all audio'],['reducedMotion','Reduced motion'],['puttingGuide','Putting slope grid'],['greenHeightmap','Green heightmap & runoff arrows']])row(label,h('input',{type:'checkbox',checked:s[key],'aria-label':label,onchange:e=>g.setting(key,e.target.checked)}));
    const themes=PAGE_THEMES.slice(),current=document.documentElement.dataset.pageTheme||'signature';if(!themes.some(t=>t.id===current))themes.push({id:current,label:current});
    row('Website theme',h('select',{'aria-label':'Website theme',onchange:e=>{g.theme.setPage(e.target.value);this.settings();}},themes.map(t=>h('option',{value:t.id,selected:t.id===current,text:t.label}))));
    if(current==='signature')row('Appearance',h('select',{'aria-label':'Appearance',onchange:e=>g.theme.setDark(e.target.value==='dark')},[['light','Light'],['dark','Dark']].map(([v,t])=>h('option',{value:v,selected:document.documentElement.classList.contains('theme-dark')===(v==='dark'),text:t}))));
    if(current==='rain')row('Digital Rain hue',h('input',{type:'range',min:0,max:360,value:getComputedStyle(document.documentElement).getPropertyValue('--rain-h')||144,'aria-label':'Digital Rain hue',oninput:e=>g.theme.setHue(Number(e.target.value))}));
    this.panel('settings','Table settings',[body,this.button('Done',()=>g.closeSettings(),true)]);
  }
  announce(text){clearTimeout(this.toastTimer);this.toast.textContent=text;this.toast.classList.add('visible');this.toastTimer=setTimeout(()=>this.toast.classList.remove('visible'),2600);}
  destroy(){clearTimeout(this.trailTimer);this.dockObserver.disconnect();this.mobile.removeEventListener('change',this.onLayout);clearTimeout(this.toastTimer);cancelAnimationFrame(this.countRaf);window.removeEventListener('keydown',this.onKey,true);this.layer.remove();}
}

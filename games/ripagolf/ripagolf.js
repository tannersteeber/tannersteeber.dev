import * as THREE from '../vendor/three.module.js';
import {GameRenderer,webglAvailable} from '../shared/engine/Renderer.js';
import {GameEngine} from '../shared/engine/GameEngine.js';
import {h} from '../shared/ui/dom.js';
import {Course} from './Course.js';
import {BallPhysics} from './BallPhysics.js';
import {GolfWorld} from './GolfWorld.js';
import {GolfStore} from './Store.js';
import {ThemeAdapter} from './ThemeAdapter.js';
import {GolfControls} from './Controls.js';
import {GolfUI} from './UI.js';
import {GolfAudio} from './Audio.js';
import {CLUBS,predictions,clamp,recommend,yards} from './rules.js';
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export default class RipaGolf {
  constructor(){this.phase='title';this.time=0;this.windTime=0;this.club=4;this.aim=0;this.power=.8;this.spin=0;this.shape=0;this.loft=0;this.zoom=1;this.pitch=.2;this.dirty=true;this.previewWait=0;this.saveWait=0;}
  async init(root){
    this.root=root;this.store=new GolfStore();this.audio=new GolfAudio(this.store);
    if(!webglAvailable()) {this.fatal('This browser does not support the WebGL graphics needed to play RipaGolf.');return;}
    this.viewport=h('div',{class:'rg-viewport'});root.prepend(this.viewport);
    try{this.gr=new GameRenderer(this.viewport,this.store.settings.graphics);}catch(error){this.fatal('The 3D course could not start on this device.');return;}
    this.world=new GolfWorld(this.gr);this.course=new Course(164238,1);this.ball=new BallPhysics(this.course);this.world.build(this.course);
    this.ui=new GolfUI(root,this);
    this.theme=new ThemeAdapter(palette=>{this.world.apply(palette);this.ui.drawMap();});
    this.controls=new GolfControls(this.gr.canvas,this.ui.swingZone,{
      pause:()=>this.togglePause(),timing:()=>this.timing(),club:i=>this.chooseClub(i),
      aim:delta=>this.changeAim(delta),pitch:delta=>{this.pitch=clamp(this.pitch+delta,0,1);},zoom:delta=>{this.zoom=clamp(this.zoom+delta,.6,2.7);},
      charge:value=>this.ui.charge(value),swing:(power,error)=>this.shoot(power,error)
    },this.store.settings);
    this.engine=new GameEngine(this.gr);this.engine.update=dt=>this.update(dt);this.engine.onHidden=()=>{this.pause();this.capture();this.audio.pause();};
    this.onHide=()=>this.capture();window.addEventListener('pagehide',this.onHide);
    this.contextLost=e=>{e.preventDefault();this.pause();this.engine.stop();this.fatal('The graphics connection was interrupted. Reload to resume your saved run.');};this.gr.canvas.addEventListener('webglcontextlost',this.contextLost);
    root.classList.toggle('rg-reduced',this.store.settings.reducedMotion);
    this.ui.title();this.engine.start();root.classList.add('ready');
  }
  fatal(message){this.root.classList.add('ready');this.root.append(h('section',{class:'rg-error',role:'alert'},h('h1',{text:'Unable to open the course'}),h('p',{text:message}),h('a',{class:'rg-button',href:'../../arcade.html',text:'Back to Arcade'})));}
  newRun(){
    this.audio.unlock();this.audio.active=true;
    const requested=Number(new URLSearchParams(location.search).get('seed'));
    const seed=requested>0?requested:crypto.getRandomValues(new Uint32Array(1))[0];
    this.run=this.store.start(seed);this.nextHole(true);
  }
  nextHole(first=false){
    if(!this.run||(!first&&!this.hole?.result?.won))return;
    if(!first)this.run.holeIndex++;
    const seed=(this.run.seed+Math.imul(this.run.holeIndex,0x9e3779b9))>>>0;
    this.course=new Course(seed,this.run.holeIndex);this.ball=new BallPhysics(this.course);this.ball.onBounce=impact=>this.audio.bounce(impact);
    this.world.build(this.course);
    this.hole=this.run.hole={courseSeed:seed,par:this.course.par,strokes:0,prediction:null,locked:false,result:null,phase:'overview'};
    this.selection=null;this.windTime=0;this.spin=this.shape=this.loft=0;this.zoom=1;this.phase='overview';this.overviewTime=0;
    this.prepareLie();this.ui.hud.hidden=false;this.ui.update();this.ui.overview();this.capture();
    if(this.store.settings.reducedMotion)this.openPredictions();
  }
  openPredictions(){if(this.phase!=='overview')return;this.phase='prediction';this.ui.predictions(this.selection);this.capture();}
  lockPrediction(){
    if(this.phase!=='prediction'||!predictions(this.course.par).some(p=>p.id===this.selection)||this.hole.locked)return;
    this.hole.prediction=this.selection;this.hole.locked=true;this.audio.lock();this.phase='aim';this.ui.ready();this.ui.update();this.capture();
  }
  prepareLie(){
    const d=this.course.distance(this.ball.p.x,this.ball.p.z),lie=this.course.surface(this.ball.p.x,this.ball.p.z);
    this.aimBase=Math.atan2(this.course.pin.x-this.ball.p.x,this.course.pin.z-this.ball.p.z);this.aim=this.aimBase;
    this.club=recommend(d,lie);this.power=clamp(d/(this.club===8?64:CLUBS[this.club].carry),.025,1);this.dirty=true;this.previewWait=0;
  }
  relativeAim(){return wrap(this.aim-this.aimBase);}
  changeAim(delta){if(this.phase!=='aim')return;this.aim=wrap(this.aim+delta);this.dirty=true;this.ui.syncShot();}
  setAim(delta){if(this.phase!=='aim')return;this.aim=wrap(this.aimBase+delta);this.dirty=true;this.ui.syncShot();}
  chooseClub(index){if(this.phase!=='aim'||!CLUBS[index])return;this.club=index;const d=this.course.distance(this.ball.p.x,this.ball.p.z);this.power=clamp(d/(index===8?64:CLUBS[index].carry),.025,1);this.dirty=true;this.ui.syncShot();}
  setPower(value){if(this.phase!=='aim')return;this.power=clamp(value,.02,1);this.dirty=true;this.ui.syncShot();}
  setShotOption(key,value){if(this.phase!=='aim')return;if(!['spin','shape','loft'].includes(key)||!Number.isFinite(value))return;this[key]=value;this.dirty=true;}
  shotSpec(power=this.power,error=0){return {club:this.club,power,aim:this.aim,error,spin:this.spin,shape:this.shape,loft:this.club===8?0:this.loft};}
  timing(){
    if(this.phase==='aim'){this.audio.unlock();this.phase='timing';this.timingTime=0;this.timingValue=-1;this.ui.syncShot();}
    else if(this.phase==='timing')this.shoot(this.power,this.timingValue);
  }
  shoot(power,error){
    if(!['aim','timing'].includes(this.phase)||!this.hole?.locked||this.ball.status!=='rest')return;
    this.audio.unlock();this.audio.active=true;
    if(!this.ball.launch(this.shotSpec(power,error)))return;
    this.hole.strokes++;this.store.stroke();this.phase='flight';this.audio.hit(this.club===8);this.controls.reset();this.ui.inFlight();this.ui.update();this.capture();
  }
  preview(){
    const sim=new BallPhysics(this.course);sim.reset(this.ball.p);sim.launch(this.shotSpec());
    const points=[{...sim.p}];let event=null;
    for(let i=0;i<1500;i++){event=sim.update(1/60,this.windTime);if(i%8===0)points.push({...sim.p});if(event?.type==='penalty'||['rest','holed'].includes(sim.status))break;}
    points.push({...sim.p});this.world.setPreview(points);
    const distance=Math.hypot(sim.p.x-this.ball.p.x,sim.p.z-this.ball.p.z);
    this.ui.plan.textContent=`${this.club===8?'Putt':'Shot'} preview · ${yards(distance)} yd at ${Math.round(this.power*100)}%${event?.type==='penalty'?' · hazard risk':''}`;
  }
  update(dt){
    this.time+=dt;
    if(this.phase==='paused'||this.ui.kind==='settings')return;
    this.controls.update(dt);
    if(this.phase!=='title'){this.windTime+=dt;this.audio.update(dt);}
    if(this.phase==='overview'){this.overviewTime+=dt;if(this.overviewTime>2.3)this.openPredictions();}
    if(this.phase==='timing'){this.timingTime+=dt;this.timingValue=-Math.cos(this.timingTime*3.4);this.ui.updateTiming(this.timingValue);}
    if(this.phase==='flight'){
      const event=this.ball.update(dt,this.windTime);
      if(event?.type==='penalty'){this.hole.strokes+=event.penalty;this.store.stroke(event.penalty);this.ui.announce(event.reason);this.readyAfterShot();}
      else if(event?.type==='rest'){this.readyAfterShot();}
      else if(event?.type==='holed'){this.finishHole();}
    }
    this.previewWait-=dt;
    if(this.dirty&&this.phase==='aim'&&this.previewWait<=0){this.preview();this.dirty=false;this.previewWait=.18;}
    this.world.update(dt,this.phase,this.ball,this.aim,this.zoom,this.pitch,this.time,this.store.settings.reducedMotion);
    this.hudTime=(this.hudTime||0)+dt;if(this.hudTime>.1){this.hudTime=0;this.ui.update();}
    this.saveWait+=dt;if(this.saveWait>2){this.saveWait=0;this.capture();}
  }
  readyAfterShot(){this.phase='aim';this.prepareLie();this.ui.ready();this.ui.update();this.capture();}
  finishHole(){
    if(this.hole.result)return;
    const result=this.store.settle(this.hole);this.phase=result.won?'result':'lost';this.ui.result(result);this.ui.update();this.audio.result(result.won,result.milestone);this.capture();
  }
  capture(){
    if(!this.run||!this.hole||this.run.hole!==this.hole)return;
    if(this.phase!=='title'&&this.phase!=='paused')this.hole.phase=this.phase;
    this.hole.ball=this.ball.snapshot();this.hole.aim=this.aim;this.hole.club=this.club;this.hole.power=this.power;
    this.hole.spin=this.spin;this.hole.shape=this.shape;this.hole.loft=this.loft;this.hole.windTime=this.windTime;this.hole.selection=this.selection;this.store.save();
  }
  resumeSaved(){
    this.run=this.store.run;this.hole=this.run?.hole;if(!this.hole)return;
    this.course=new Course(this.hole.courseSeed,this.run.holeIndex);this.ball=new BallPhysics(this.course);this.ball.restore(this.hole.ball);this.ball.onBounce=impact=>this.audio.bounce(impact);this.world.build(this.course);
    this.prepareLie();this.aim=Number.isFinite(this.hole.aim)?this.hole.aim:this.aim;this.club=CLUBS[this.hole.club]?this.hole.club:this.club;this.power=this.hole.power||this.power;
    this.spin=this.hole.spin||0;this.shape=this.hole.shape||0;this.loft=this.hole.loft||0;this.windTime=this.hole.windTime||0;this.selection=this.hole.selection||this.hole.prediction;this.audio.unlock();this.audio.active=true;this.ui.hud.hidden=false;
    if(this.hole.result){this.phase=this.hole.result.won?'result':'lost';this.ui.result(this.hole.result);}
    else if(!this.hole.locked){this.phase='prediction';this.ui.predictions(this.selection);}
    else{this.phase='paused';this.pausedFrom=this.ball.status==='flight'||this.ball.status==='rolling'?'flight':'aim';this.ui.pause();}
    this.ui.update();
  }
  pause(){
    if(!['aim','flight','timing','prediction','overview'].includes(this.phase))return;
    this.capture();this.pausedFrom=this.phase==='timing'?'aim':this.phase;this.phase='paused';this.controls.reset();this.audio.pause();this.ui.pause();
  }
  resume(){
    if(this.phase!=='paused')return;this.audio.unlock();this.audio.active=true;this.phase=this.pausedFrom||'aim';
    if(this.phase==='prediction')this.ui.predictions(this.selection);else if(this.phase==='overview')this.ui.overview();else if(this.phase==='flight'){this.ui.close();this.ui.inFlight();}else this.ui.ready();
  }
  togglePause(){
    if(this.ui.kind==='settings'){this.closeSettings();return;}
    if(this.phase==='title'){if(this.ui.kind==='title-menu')this.ui.title();else this.ui.titleMenu();return;}
    if(this.phase==='paused')this.resume();else this.pause();
  }
  openSettings(){
    this.settingsReturn=this.phase;this.settingsKind=this.ui.kind;
    if(['aim','flight','timing','prediction','overview'].includes(this.phase))this.pause();
    this.ui.settings();
  }
  closeSettings(){
    const kind=this.settingsKind;this.ui.close();
    if(this.phase==='paused')this.ui.pause();else if(this.phase==='title')this.ui.title();else if(['result','lost'].includes(this.phase))this.ui.result(this.hole.result);else this.returnScreen();
  }
  setting(key,value){this.store.set(key,value);this.audio.volume();if(key==='graphics')this.gr.setQuality(this.store.settings.graphics);this.root.classList.toggle('rg-reduced',this.store.settings.reducedMotion);}
  returnScreen(){if(this.phase==='title')this.ui.title();else if(this.phase==='paused')this.ui.pause();else if(this.hole?.result)this.ui.result(this.hole.result);else this.ui.ready();}
  abandon(){if(this.run)this.run.status='abandoned';this.capture();this.mainMenu();}
  mainMenu(){this.capture();this.phase='title';this.ui.flight.hidden=true;this.ui.shot.hidden=true;this.ui.title();this.audio.active=false;}
  destroy(){
    this.capture();window.removeEventListener('pagehide',this.onHide);this.gr?.canvas.removeEventListener('webglcontextlost',this.contextLost);this.engine?.destroy();this.controls?.destroy();this.theme?.destroy();this.ui?.destroy();this.audio?.destroy();this.world?.destroy();this.gr?.dispose();this.viewport?.remove();
  }
}

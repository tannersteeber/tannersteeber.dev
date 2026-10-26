import * as THREE from '../vendor/three.module.js';
const smooth=(speed,dt)=>1-Math.exp(-speed*dt);
export class GolfCamera {
  constructor(camera){this.camera=camera;this.position=new THREE.Vector3();this.focus=new THREE.Vector3();this.wanted=new THREE.Vector3();this.look=new THREE.Vector3();this.initial=true;this.mode='overview';}
  frameSafe(points,safe){
    const c=this.camera,w=safe?.fullWidth||1000,h=safe?.fullHeight||700;
    const box=safe||{left:20,top:20,right:w-20,bottom:h-20};
    c.clearViewOffset();c.fov=62;c.updateProjectionMatrix();c.updateMatrixWorld();
    const bounds=()=>{const p=points.map(p=>new THREE.Vector3(p.x,p.y,p.z).project(c)).filter(p=>p.z<1&&Number.isFinite(p.x));return {left:Math.min(...p.map(p=>(p.x+1)*w/2)),right:Math.max(...p.map(p=>(p.x+1)*w/2)),top:Math.min(...p.map(p=>(1-p.y)*h/2)),bottom:Math.max(...p.map(p=>(1-p.y)*h/2))};};
    let b=bounds();if(!Number.isFinite(b.left))return;
    const factor=Math.max(1,(b.right-b.left)/Math.max(40,box.right-box.left-24),(b.bottom-b.top)/Math.max(40,box.bottom-box.top-24));
    if(factor>1){c.fov=Math.min(95,2*Math.atan(Math.tan(31*Math.PI/180)*factor)*180/Math.PI);c.updateProjectionMatrix();b=bounds();}
    const x=(b.left+b.right)/2-(box.left+box.right)/2,y=(b.top+b.bottom)/2-(box.top+box.bottom)/2;
    c.setViewOffset(w,h,x,y,w,h);c.updateProjectionMatrix();
  }
  update(dt,{course:c,ball,position:p,phase,aim,zoom,pitch,time,reduced,putting,landing,swinging,cameraView='main',safeView}){
    if(swinging)return;
    const overview=['title','overview','prediction'].includes(phase)||cameraView==='overview',holeView=!overview&&cameraView==='hole';
    const altitude=p.y-c.height(p.x,p.z),speed=Math.hypot(ball.v.x,ball.v.z),flying=phase==='flight'&&ball.status==='flight'&&altitude>3;
    this.mode=overview?'overview':holeView?'hole':flying?'flight':phase==='flight'?'landing':putting?'putting':'aim';
    const pin={...c.pin,y:c.height(c.pin.x,c.pin.z)};
    if(overview){
      const center=c.length*.47,x=c.center(center),orbit=phase==='title'&&!reduced?Math.sin(time*.08)*.04:0;
      this.wanted.set(c.length*(.25+orbit),c.height(x,center)+c.length*.8+25,-c.length*.03);this.look.set(x,c.height(x,center),center);
    }else if(holeView){
      const bearing=Math.atan2(c.pin.x-p.x,c.pin.z-p.z),radius=c.greenRadius+3,fit=Math.max(1,1/this.camera.aspect),d=radius*1.4*zoom*fit;
      this.wanted.set(pin.x-Math.sin(bearing)*d,pin.y+radius*1.25*fit+pitch,pin.z-Math.cos(bearing)*d);this.look.set(pin.x,pin.y+.05,pin.z);
    }else if(phase==='flight'){
      const dir=speed>.3?Math.atan2(ball.v.x,ball.v.z):aim,dist=(flying?6+Math.min(5,speed*.075):3.8+Math.min(3,speed*.2))*zoom;
      this.wanted.set(p.x-Math.sin(dir)*dist,p.y+(flying?1.6+pitch:1.05+pitch),p.z-Math.cos(dir)*dist);
      this.look.set(p.x+ball.v.x*.08,p.y+.04,p.z+ball.v.z*.08);
    }else{
      const d=c.distance(p.x,p.z),dist=(putting?Math.max(2.5,Math.min(5,d*.35+1.8)):7)*zoom;
      this.wanted.set(p.x-Math.sin(aim)*dist,p.y+(putting?.75+pitch*.7:1.1+pitch*.7),p.z-Math.cos(aim)*dist);
      const ahead=putting?Math.min(3,d)*.45:Math.min(22,d*.5);
      this.look.set(p.x+Math.sin(aim)*ahead,p.y+.04,p.z+Math.cos(aim)*ahead);
    }
    for(const tree of c.trees){const x=this.wanted.x-tree.x,z=this.wanted.z-tree.z,d=Math.hypot(x,z),r=2.8*tree.scale;if(d<r&&this.wanted.y<c.height(tree.x,tree.z)+9*tree.scale){this.wanted.x=tree.x+x/(d||1)*r;this.wanted.z=tree.z+z/(d||1)*r;}}
    this.wanted.y=Math.max(this.wanted.y,c.height(this.wanted.x,this.wanted.z)+.7);
    if(this.initial||reduced){this.position.copy(this.wanted);this.focus.copy(this.look);}else{this.position.lerp(this.wanted,smooth(5,dt));this.focus.lerp(this.look,smooth(5,dt));}
    this.initial=false;this.camera.position.copy(this.position);this.camera.lookAt(this.focus);this.camera.updateMatrixWorld();
    const points=overview?[p,pin]:holeView?[pin,...Array.from({length:8},(_,i)=>{const angle=i*Math.PI/4,x=pin.x+Math.cos(angle)*(c.greenRadius+2),z=pin.z+Math.sin(angle)*(c.greenRadius+2);return {x,y:c.height(x,z),z};})]:phase==='flight'?[p]:[p,pin,...(landing?[{...landing,y:c.height(landing.x,landing.z)}]:[])];
    this.frameSafe(points,safeView);
  }
}

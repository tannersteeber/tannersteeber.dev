import * as THREE from '../vendor/three.module.js';
const smooth=(speed,dt)=>1-Math.exp(-speed*dt);
export class GolfCamera {
  constructor(camera){this.camera=camera;this.position=new THREE.Vector3();this.focus=new THREE.Vector3();this.wanted=new THREE.Vector3();this.look=new THREE.Vector3();this.initial=true;this.mode='overview';}
  update(dt,{course:c,ball,position:p,phase,aim,zoom,pitch,time,reduced,putting,landing,swinging}){
    if(swinging)return;
    const overview=['title','overview','prediction'].includes(phase),altitude=p.y-c.height(p.x,p.z),speed=Math.hypot(ball.v.x,ball.v.z);
    const flying=phase==='flight'&&ball.status==='flight'&&altitude>5;
    this.mode=overview?'overview':flying?'flight':phase==='flight'?'landing':putting?'putting':'aim';
    if(overview){
      const center=c.length*.47,x=c.center(center),orbit=phase==='title'&&!reduced?Math.sin(time*.08)*.04:0;
      this.wanted.set(c.length*(.25+orbit),c.height(x,center)+c.length*.8+25,-c.length*.03);this.look.set(x,c.height(x,center),center);
    }else if(phase==='flight'){
      const dir=speed>.3?Math.atan2(ball.v.x,ball.v.z):aim,dist=(flying?14+speed*.22:6+speed*.4)*zoom;
      this.wanted.set(p.x-Math.sin(dir)*dist,p.y+(flying?dist*.5:2.3+pitch*3),p.z-Math.cos(dir)*dist);
      this.look.set(p.x+ball.v.x*.16,p.y+.1,p.z+ball.v.z*.16);
    }else{
      const target=putting?c.pin:(landing||{x:p.x+Math.sin(aim)*45,z:p.z+Math.cos(aim)*45}),d=Math.hypot(target.x-p.x,target.z-p.z);
      // Fit both the ball and intended landing/cup, including narrow safe viewports.
      const framing=Math.max(1,.62/Math.max(.3,this.camera.aspect));
      const dist=(putting?Math.max(2.5,d*.65+1):Math.max(12,d*.43))*zoom*framing;
      this.wanted.set(p.x-Math.sin(aim)*dist,p.y+(putting?.7+pitch*1.5+dist*(.28+pitch*.2):dist*(.65+pitch*.3)),p.z-Math.cos(aim)*dist);
      const weight=putting?.42:.43;
      this.look.set(p.x+(target.x-p.x)*weight,p.y+(c.height(target.x,target.z)-p.y)*weight+.12,p.z+(target.z-p.z)*weight);
    }
    for(const tree of c.trees){const x=this.wanted.x-tree.x,z=this.wanted.z-tree.z,d=Math.hypot(x,z),radius=2.8*tree.scale;if(d<radius&&this.wanted.y<c.height(tree.x,tree.z)+9*tree.scale){this.wanted.x=tree.x+x/(d||1)*radius;this.wanted.z=tree.z+z/(d||1)*radius;}}
    this.wanted.y=Math.max(this.wanted.y,c.height(this.wanted.x,this.wanted.z)+1.2);
    if(this.initial||reduced){this.position.copy(this.wanted);this.focus.copy(this.look);}else{this.position.lerp(this.wanted,smooth(4,dt));this.focus.lerp(this.look,smooth(4.5,dt));}
    this.initial=false;this.camera.position.copy(this.position);this.camera.lookAt(this.focus);this.camera.updateMatrixWorld();
  }
}

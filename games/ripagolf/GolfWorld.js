import * as THREE from '../vendor/three.module.js';
import {SURFACES} from './Course.js';
import {BALL_RADIUS} from './BallPhysics.js';
const damp=(k,dt)=>1-Math.exp(-k*dt);
export class GolfWorld {
  constructor(renderer){
    this.gr=renderer;this.scene=renderer.scene;this.camera=renderer.camera;this.owned=[];
    this.hemi=new THREE.HemisphereLight(0xf6f5d9,0x395d42,2.1);this.sun=new THREE.DirectionalLight(0xffedc9,2.2);
    this.sun.position.set(-80,130,-40);this.scene.add(this.hemi,this.sun);
    this.ball=new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS,16,12),new THREE.MeshLambertMaterial({color:0xffffff}));this.scene.add(this.ball);
    this.shadow=new THREE.Mesh(new THREE.CircleGeometry(.23,20),new THREE.MeshBasicMaterial({color:0x13291f,transparent:true,opacity:.3,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;this.scene.add(this.shadow);
    this.marker=new THREE.Mesh(new THREE.RingGeometry(.36,.44,32),new THREE.MeshBasicMaterial({transparent:true,opacity:.85,depthWrite:false,side:THREE.DoubleSide}));this.marker.rotation.x=-Math.PI/2;this.scene.add(this.marker);
    this.preview=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({transparent:true,opacity:.65,dashSize:1,gapSize:.7}));this.scene.add(this.preview);
    this.landing=new THREE.Mesh(new THREE.RingGeometry(.7,.83,32),new THREE.MeshBasicMaterial({transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));this.landing.rotation.x=-Math.PI/2;this.scene.add(this.landing);
    this.group=new THREE.Group();this.scene.add(this.group);this.target=new THREE.Vector3();this.look=new THREE.Vector3();this.initial=true;
  }
  clear(){
    for(const mesh of this.group.children.slice()){mesh.geometry?.dispose();if(mesh.material)(Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(m=>m.dispose());this.group.remove(mesh);}
    this.surfaceMeshes=[];
  }
  build(course){
    this.clear();this.course=course;this.initial=true;
    const step=3.5,nx=52,nz=Math.ceil((course.length+100)/step),vertices=[],indices=[],types=[],shades=[];
    for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){
      const px=-91+x*3.5,pz=-30+z*step,lie=course.surface(px,pz);
      vertices.push(px,course.height(px,pz),pz);types.push(SURFACES.indexOf(['green','sand','water'].includes(lie)?'rough':lie));shades.push(lie==='fairway'?(Math.floor(pz/10)%2?.96:1.06):1);
    }
    for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const a=z*(nx+1)+x,b=a+nx+1;indices.push(a,b,a+1,a+1,b,b+1);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(vertices.length),3));
    this.terrain=new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({vertexColors:true}));this.terrainTypes=types;this.shades=shades;this.group.add(this.terrain);
    // Join the playable rectangle to a broad rolling landscape. The inner perimeter
    // uses the exact course vertices, so the camera never sees an island edge or seam.
    const perimeter=[],minZ=-30,maxZ=minZ+nz*step;
    for(let i=0;i<=nx;i++)perimeter.push([-91+i*step,minZ]);
    for(let i=1;i<=nz;i++)perimeter.push([91,minZ+i*step]);
    for(let i=1;i<=nx;i++)perimeter.push([91-i*step,maxZ]);
    for(let i=1;i<nz;i++)perimeter.push([-91,maxZ-i*step]);
    const land=[],landIndices=[],N=perimeter.length,centerZ=(minZ+maxZ)/2,scales=[1,1.3,2,3.5,6,10];
    for(const scale of scales)for(const [x,z]of perimeter){
      const px=x*scale,pz=centerZ+(z-centerZ)*scale;
      const fade=Math.min(1,Math.max(0,(scale-1)/2));
      const hill=fade*(8*Math.sin(px*.009)*Math.cos(pz*.008)+4*Math.sin(pz*.021+px*.012));
      land.push(px,course.height(px,pz)+hill,pz);
    }
    for(let ring=0;ring<scales.length-1;ring++)for(let i=0;i<N;i++){
      const a=ring*N+i,b=ring*N+(i+1)%N,c=(ring+1)*N+i,d=(ring+1)*N+(i+1)%N;
      landIndices.push(a,c,b,b,c,d);
    }
    const landscapeGeometry=new THREE.BufferGeometry();landscapeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(land,3));landscapeGeometry.setIndex(landIndices);landscapeGeometry.computeVertexNormals();
    this.landscape=new THREE.Mesh(landscapeGeometry,new THREE.MeshLambertMaterial({side:THREE.DoubleSide}));this.group.add(this.landscape);
    const patch=(x,z,rx,rz,type)=>{
      const pos=[x,course.height(x,z)+.045,z],idx=[];
      // Sample the whole patch so it follows the terrain between its center and edge.
      const segments=64,rings=8;
      for(let r=1;r<=rings;r++)for(let i=0;i<segments;i++){
        const a=i/segments*Math.PI*2,px=x+Math.cos(a)*rx*r/rings,pz=z+Math.sin(a)*rz*r/rings;
        pos.push(px,course.height(px,pz)+.045,pz);
        const outer=1+(r-1)*segments+i,next=1+(r-1)*segments+(i+1)%segments;
        if(r===1)idx.push(0,next,outer);
        else{const inner=outer-segments,innerNext=next-segments;idx.push(inner,next,outer,inner,innerNext,next);}
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
      const material=type==='water'?new THREE.MeshPhongMaterial({shininess:100,specular:0xb4e9e7}):new THREE.MeshLambertMaterial();
      const mesh=new THREE.Mesh(g,material);mesh.userData.surface=type;this.surfaceMeshes.push(mesh);this.group.add(mesh);
    };
    patch(course.pin.x,course.pin.z,course.greenRadius,course.greenRadius,'green');
    for(const h of course.hazards)patch(h.x,h.z,h.rx,h.rz,h.type);
    const treeCount=course.trees.length;
    this.trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.25,.4,3.5,7),new THREE.MeshLambertMaterial(),treeCount);
    this.leaves=new THREE.InstancedMesh(new THREE.ConeGeometry(2.6,7,9),new THREE.MeshLambertMaterial(),treeCount);
    const temp=new THREE.Object3D();
    course.trees.forEach((tree,i)=>{const y=course.height(tree.x,tree.z);temp.position.set(tree.x,y+1.75*tree.scale,tree.z);temp.scale.setScalar(tree.scale);temp.updateMatrix();this.trunks.setMatrixAt(i,temp.matrix);temp.position.y=y+6*tree.scale;temp.updateMatrix();this.leaves.setMatrixAt(i,temp.matrix);});
    this.group.add(this.trunks,this.leaves);
    const py=course.height(course.pin.x,course.pin.z);
    this.pole=new THREE.Mesh(new THREE.CylinderGeometry(.045,.06,3.2,8),new THREE.MeshLambertMaterial());this.pole.position.set(course.pin.x,py+1.6,course.pin.z);this.group.add(this.pole);
    const flagGeo=new THREE.BufferGeometry();flagGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1.3,-.12,0,0,-.65,0],3));flagGeo.computeVertexNormals();
    this.flag=new THREE.Mesh(flagGeo,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));this.flag.position.set(course.pin.x,py+3.1,course.pin.z);this.group.add(this.flag);
    const hole=new THREE.Mesh(new THREE.CircleGeometry(.42,32),new THREE.MeshBasicMaterial({color:0x06130c}));hole.rotation.x=-Math.PI/2;hole.position.set(course.pin.x,py+.055,course.pin.z);this.group.add(hole);
    this.cupTrim=new THREE.Mesh(new THREE.RingGeometry(.43,.53,32),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));this.cupTrim.rotation.x=-Math.PI/2;this.cupTrim.position.copy(hole.position);this.cupTrim.position.y+=.004;this.group.add(this.cupTrim);
    for(const x of [-1.5,1.5]){const m=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,.18,24),new THREE.MeshLambertMaterial());m.position.set(x,course.height(x,0)+.1,0);m.userData.tee=true;this.group.add(m);}
    if(this.palette)this.apply(this.palette);
  }
  apply(palette){
    this.palette=palette;const p=palette.world;this.scene.background=p.sky;this.scene.fog=new THREE.Fog(p.fog,360,850);
    this.hemi.intensity=palette.dark?1.7:2.1;this.sun.intensity=palette.dark?1.5:2.2;
    this.marker.material.color.copy(p.accent);this.landing.material.color.copy(p.accent);this.preview.material.color.copy(p.accent);
    if(!this.terrain)return;
    const col=this.terrain.geometry.attributes.color;
    for(let i=0;i<col.count;i++){const c=p[SURFACES[this.terrainTypes[i]]],f=this.shades[i];col.setXYZ(i,c.r*f,c.g*f,c.b*f);}col.needsUpdate=true;
    for(const mesh of this.surfaceMeshes)mesh.material.color.copy(p[mesh.userData.surface]);
    this.landscape.material.color.copy(p.rough);
    this.trunks.material.color.copy(p.trunk);this.leaves.material.color.copy(p.leaves);this.pole.material.color.copy(p.accent);this.flag.material.color.copy(p.accent);this.cupTrim.material.color.copy(p.accent);
    for(const m of this.group.children)if(m.userData.tee)m.material.color.copy(p.accent);
  }
  setPreview(points){
    this.preview.geometry.dispose();this.preview.geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(p.x,p.y+.06,p.z)));this.preview.computeLineDistances();
    const end=points.at(-1);if(end)this.landing.position.set(end.x,this.course.height(end.x,end.z)+.09,end.z);
  }
  update(dt,mode,ball,aim,zoom,pitch,time,reduced){
    if(!this.course)return;const p=ball.p,c=this.course,overview=['title','overview','prediction'].includes(mode);
    this.ball.position.set(p.x,p.y,p.z);this.ball.rotation.x+=ball.v.z*dt/BALL_RADIUS;this.ball.rotation.z-=ball.v.x*dt/BALL_RADIUS;
    const ground=c.height(p.x,p.z);this.shadow.position.set(p.x,ground+.075,p.z);this.shadow.material.opacity=Math.max(.05,.3-(p.y-ground)*.008);
    this.marker.position.set(p.x,ground+.08,p.z);this.marker.visible=mode!=='flight'&&mode!=='result'&&mode!=='lost';
    const preview=mode==='aim'||mode==='timing';this.preview.visible=this.landing.visible=preview;
    this.flag.rotation.y=Math.atan2(c.wind.x,c.wind.z)+(!reduced?Math.sin(time*2)*.08:0);
    if(overview){
      const orbit=mode==='title'&&!reduced?Math.sin(time*.08)*.07:0;
      this.target.set(c.length*(.27+orbit),c.length*.9+20,c.length*.05);this.look.set(c.center(c.length/2),1,c.length*.48);
    }else{
      const speed=Math.hypot(ball.v.x,ball.v.z),dist=(mode==='flight'?20+speed*.3:15)*zoom;
      this.target.set(p.x-Math.sin(aim)*dist,p.y+dist*(.35+pitch*.3),p.z-Math.cos(aim)*dist);
      this.look.set(p.x+Math.sin(aim)*6,p.y+.4,p.z+Math.cos(aim)*6);
    }
    if(this.initial||reduced)this.camera.position.copy(this.target);else this.camera.position.lerp(this.target,damp(4,dt));
    this.initial=false;this.camera.lookAt(this.look);
  }
  destroy(){this.clear();for(const mesh of [this.ball,this.shadow,this.marker,this.preview,this.landing]){mesh.geometry.dispose();mesh.material.dispose();this.scene.remove(mesh);}this.scene.remove(this.group,this.hemi,this.sun);}
}

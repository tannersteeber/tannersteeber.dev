import * as THREE from '../vendor/three.module.js';
import {BALL_RADIUS,CUP_RADIUS,CUP_DEPTH} from './CupPhysics.js?v=20261025-physics-2';
import {terrainGeometry,cupSurroundGeometry} from './TerrainGeometry.js?v=20261025-physics-2';
import {GolfCamera} from './GolfCamera.js?v=20261025-physics-2';
export class GolfWorld {
  constructor(renderer){
    this.cameraCtl=new GolfCamera(renderer.camera);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(64,64);
    for(let i=0;i<4096;i++){const noise=220+Math.floor(26*(.5+.5*Math.sin(i*73.1)));pixels.data.set([noise,noise,noise,255],i*4);}ctx.putImageData(pixels,0,0);
    this.grassTexture=new THREE.CanvasTexture(canvas);this.grassTexture.wrapS=this.grassTexture.wrapT=THREE.RepeatWrapping;this.grassTexture.anisotropy=Math.min(4,renderer.renderer.capabilities.getMaxAnisotropy());
    this.gr=renderer;this.scene=renderer.scene;this.camera=renderer.camera;this.owned=[];
    this.hemi=new THREE.HemisphereLight(0xf6f5d9,0x395d42,2.1);this.sun=new THREE.DirectionalLight(0xffedc9,2.2);
    this.sun.position.set(-80,130,-40);this.scene.add(this.hemi,this.sun);
    this.ball=new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS,16,12),new THREE.MeshLambertMaterial({color:0xffffff}));this.scene.add(this.ball);
    this.shadow=new THREE.Mesh(new THREE.CircleGeometry(.07,24),new THREE.MeshBasicMaterial({color:0x13291f,transparent:true,opacity:.3,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;this.scene.add(this.shadow);
    this.marker=new THREE.Mesh(new THREE.RingGeometry(.07,.085,32),new THREE.MeshBasicMaterial({transparent:true,opacity:.85,depthWrite:false,side:THREE.DoubleSide}));this.marker.rotation.x=-Math.PI/2;this.scene.add(this.marker);
    this.airMarker=new THREE.Mesh(new THREE.RingGeometry(.075,.09,32),new THREE.MeshBasicMaterial({transparent:true,opacity:.8,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));this.airMarker.renderOrder=4;this.scene.add(this.airMarker);
    this.preview=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({transparent:true,opacity:.65,dashSize:1,gapSize:.7}));this.scene.add(this.preview);
    this.landing=new THREE.Mesh(new THREE.RingGeometry(.7,.83,32),new THREE.MeshBasicMaterial({transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));this.landing.rotation.x=-Math.PI/2;this.scene.add(this.landing);
    this.group=new THREE.Group();this.scene.add(this.group);this.target=new THREE.Vector3();this.look=new THREE.Vector3();this.initial=true;
  }
  clear(){
    for(const mesh of this.group.children.slice()){mesh.geometry?.dispose();if(mesh.material)(Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(m=>m.dispose());this.group.remove(mesh);}
    this.surfaceMeshes=[];
  }
  build(course){
    this.clear();this.course=course;this.initial=true;this.cameraCtl.initial=true;this.previewEnd=null;this.preview.geometry.dispose();this.preview.geometry=new THREE.BufferGeometry();
    const {geometry,types,shades}=terrainGeometry(course),{xs,zs}=course.heightfield;
    const nx=xs.length-1,nz=zs.length-1;
    this.terrain=new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({vertexColors:true,map:this.grassTexture}));this.terrainTypes=types;this.shades=shades;this.group.add(this.terrain);
    // Join the playable rectangle to a broad rolling landscape. The inner perimeter
    // uses the exact course vertices, so the camera never sees an island edge or seam.
    const perimeter=[],minZ=zs[0],maxZ=zs.at(-1);
    for(let i=0;i<=nx;i++)perimeter.push([xs[i],minZ]);
    for(let i=1;i<=nz;i++)perimeter.push([91,zs[i]]);
    for(let i=1;i<=nx;i++)perimeter.push([xs[nx-i],maxZ]);
    for(let i=1;i<nz;i++)perimeter.push([-91,zs[nz-i]]);
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
    // Water is a horizontal surface above a shaped basin, never a decal on the grass.
    for(const h of course.hazards.filter(h=>h.type==='water')){
      const g=new THREE.CircleGeometry(1,64);g.rotateX(-Math.PI/2);g.scale(h.rx,1,h.rz);
      const mesh=new THREE.Mesh(g,new THREE.MeshPhongMaterial({shininess:90,specular:0xb4e9e7,transparent:true,opacity:.87}));mesh.position.set(h.x,h.level,h.z);mesh.userData.surface='water';this.surfaceMeshes.push(mesh);this.group.add(mesh);
    }
    this.cupSurround=new THREE.Mesh(cupSurroundGeometry(course),new THREE.MeshLambertMaterial());this.cupSurround.userData.surface='green';this.surfaceMeshes.push(this.cupSurround);this.group.add(this.cupSurround);
    const treeCount=course.trees.length;
    this.trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.25,.4,3.5,7),new THREE.MeshLambertMaterial(),treeCount);
    this.leaves=new THREE.InstancedMesh(new THREE.ConeGeometry(2.6,7,9),new THREE.MeshLambertMaterial(),treeCount);
    const temp=new THREE.Object3D();
    course.trees.forEach((tree,i)=>{const y=course.height(tree.x,tree.z);temp.position.set(tree.x,y+1.75*tree.scale,tree.z);temp.scale.setScalar(tree.scale);temp.updateMatrix();this.trunks.setMatrixAt(i,temp.matrix);temp.position.y=y+6*tree.scale;temp.updateMatrix();this.leaves.setMatrixAt(i,temp.matrix);});
    this.group.add(this.trunks,this.leaves);
    const py=course.height(course.pin.x,course.pin.z);
    this.pole=new THREE.Mesh(new THREE.CylinderGeometry(.008,.009,2.1,8),new THREE.MeshLambertMaterial());this.pole.position.set(course.pin.x,py+1.05,course.pin.z);this.group.add(this.pole);
    const flagGeo=new THREE.BufferGeometry();flagGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.65,-.06,0,0,-.35,0],3));flagGeo.computeVertexNormals();
    this.flag=new THREE.Mesh(flagGeo,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));this.flag.position.set(course.pin.x,py+2.06,course.pin.z);this.group.add(this.flag);
    const cup=new THREE.Mesh(new THREE.CylinderGeometry(CUP_RADIUS,CUP_RADIUS,CUP_DEPTH,64,1,true),new THREE.MeshStandardMaterial({color:0xd7dfd6,roughness:.8,side:THREE.BackSide}));cup.position.set(course.pin.x,py-CUP_DEPTH/2,course.pin.z);this.group.add(cup);this.cupInterior=cup;
    const bottom=new THREE.Mesh(new THREE.CircleGeometry(CUP_RADIUS,64),new THREE.MeshBasicMaterial({color:0x101710}));bottom.rotation.x=-Math.PI/2;bottom.position.set(course.pin.x,py-CUP_DEPTH,course.pin.z);this.group.add(bottom);
    this.cupTrim=new THREE.Mesh(new THREE.TorusGeometry(CUP_RADIUS+.0006,.0012,8,64),new THREE.MeshStandardMaterial({roughness:.7}));this.cupTrim.rotation.x=-Math.PI/2;this.cupTrim.position.set(course.pin.x,py+.0005,course.pin.z);this.group.add(this.cupTrim);
    const grid=[];
    for(let x=-10;x<=10;x++)for(let z=-10;z<=10;z++){
      const px=course.pin.x+x,pz=course.pin.z+z,y=course.height(px,pz)+.008;
      if(Math.hypot(x,z)<course.greenRadius-2){grid.push(px,y,pz,px+.85,course.height(px+.85,pz)+.008,pz,px,y,pz,px,course.height(px,pz+.85)+.008,pz+.85);
        const slope=course.slope(px,pz),dx=-slope.x*25,dz=-slope.z*25;if(Math.hypot(dx,dz)>.1)grid.push(px,y+.005,pz,px+dx,course.height(px+dx,pz+dz)+.012,pz+dz);}
    }
    const guide=new THREE.BufferGeometry();guide.setAttribute('position',new THREE.Float32BufferAttribute(grid,3));this.puttingGrid=new THREE.LineSegments(guide,new THREE.LineBasicMaterial({transparent:true,opacity:.17,depthWrite:false}));this.group.add(this.puttingGrid);
    for(const x of [-1.5,1.5]){const m=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,.18,24),new THREE.MeshLambertMaterial());m.position.set(x,course.height(x,0)+.1,0);m.userData.tee=true;this.group.add(m);}
    if(this.palette)this.apply(this.palette);
  }
  apply(palette){
    this.palette=palette;const p=palette.world;this.scene.background=p.sky;this.scene.fog=new THREE.Fog(p.fog,360,850);
    this.hemi.intensity=palette.dark?1.7:2.1;this.sun.intensity=palette.dark?1.5:2.2;
    this.airMarker.material.color.copy(p.accent);this.marker.material.color.copy(p.accent);this.landing.material.color.copy(p.accent);this.preview.material.color.copy(p.accent);
    if(!this.terrain)return;
    const col=this.terrain.geometry.attributes.color;
    for(let i=0;i<col.count;i++){const c=p[this.terrainTypes[i]],f=this.shades[i];col.setXYZ(i,c.r*f,c.g*f,c.b*f);}col.needsUpdate=true;
    for(const mesh of this.surfaceMeshes)mesh.material.color.copy(p[mesh.userData.surface]);
    this.landscape.material.color.copy(p.rough);this.puttingGrid.material.color.copy(p.accent);
    this.trunks.material.color.copy(p.trunk);this.leaves.material.color.copy(p.leaves);this.pole.material.color.copy(p.accent);this.flag.material.color.copy(p.accent);this.cupTrim.material.color.copy(p.accent);
    for(const m of this.group.children)if(m.userData.tee)m.material.color.copy(p.accent);
  }
  setPreview(points){
    this.preview.geometry.dispose();this.preview.geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(p.x,p.y+.06,p.z)));this.preview.computeLineDistances();
    const end=points.at(-1);this.previewEnd=end;if(end)this.landing.position.set(end.x,this.course.height(end.x,end.z)+.09,end.z);
  }
  update(dt,mode,ball,aim,zoom,pitch,time,reduced,options={}){
    if(!this.course)return;const p=ball.renderedPosition(),c=this.course,ground=c.height(p.x,p.z),height=Math.max(0,p.y-ground);
    this.ball.position.set(p.x,p.y,p.z);this.ball.rotation.x+=ball.v.z*dt/BALL_RADIUS;this.ball.rotation.z-=ball.v.x*dt/BALL_RADIUS;
    this.shadow.position.set(p.x,ground+.002,p.z);this.shadow.material.opacity=Math.max(.04,.3-height*.008);this.shadow.scale.setScalar(1+Math.min(2,height*.04));this.shadow.visible=ball.status!=='cupping'&&ball.status!=='holed';
    this.marker.position.set(p.x,ground+.008,p.z);this.marker.visible=['aim','timing'].includes(mode);
    this.marker.scale.setScalar(Math.max(1,this.camera.position.distanceTo(this.ball.position)*.018));
    this.preview.visible=this.landing.visible=['aim','timing'].includes(mode);this.puttingGrid.visible=!!options.putting&&options.puttingGuide!==false&&['aim','timing'].includes(mode);
    this.flag.rotation.y=Math.atan2(c.wind.x,c.wind.z)+(!reduced?Math.sin(time*2)*.06:0);
    this.cameraCtl.update(dt,{course:c,ball,position:p,phase:mode,aim,zoom,pitch,time,reduced,putting:options.putting,landing:this.previewEnd,swinging:options.swinging});
    this.airMarker.position.copy(this.ball.position);this.airMarker.quaternion.copy(this.camera.quaternion);this.airMarker.scale.setScalar(Math.max(.5,this.camera.position.distanceTo(this.ball.position)*.07));this.airMarker.visible=['aim','timing','flight'].includes(mode)&&!['cupping','holed'].includes(ball.status);
    if(!options.swinging)this.camera.position.y=Math.max(this.camera.position.y,c.height(this.camera.position.x,this.camera.position.z)+.8);
  }
  destroy(){this.clear();for(const mesh of [this.ball,this.shadow,this.marker,this.airMarker,this.preview,this.landing]){mesh.geometry.dispose();mesh.material.dispose();this.scene.remove(mesh);}this.scene.remove(this.group,this.hemi,this.sun);this.grassTexture.dispose();}
}

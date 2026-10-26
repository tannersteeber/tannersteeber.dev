import * as THREE from '../vendor/three.module.js';
import {BALL_RADIUS,CUP_RADIUS,CUP_DEPTH} from './CupPhysics.js?v=20261025-controls-7';
import {terrainGeometry,cupSurroundGeometry} from './TerrainGeometry.js?v=20261025-controls-7';
import {surfaceTextures,terrainMaterials} from './SurfaceTextures.js?v=20261025-controls-7';
import {GolfCamera} from './GolfCamera.js?v=20261025-controls-7';
export class GolfWorld {
  constructor(renderer){
    this.cameraCtl=new GolfCamera(renderer.camera);
    this.textures=surfaceTextures(renderer.renderer);
    this.gr=renderer;this.scene=renderer.scene;this.camera=renderer.camera;this.owned=[];
    this.hemi=new THREE.HemisphereLight(0xf6f5d9,0x395d42,2.1);this.sun=new THREE.DirectionalLight(0xffedc9,2.2);
    this.sun.position.set(-80,130,-40);this.scene.add(this.hemi,this.sun);
    this.ball=new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS,16,12),new THREE.MeshLambertMaterial({color:0xffffff}));this.scene.add(this.ball);
    this.shadow=new THREE.Mesh(new THREE.CircleGeometry(.07,24),new THREE.MeshBasicMaterial({color:0x13291f,transparent:true,opacity:.3,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;this.scene.add(this.shadow);
    this.marker=new THREE.Mesh(new THREE.RingGeometry(.07,.085,32),new THREE.MeshBasicMaterial({transparent:true,opacity:.85,depthWrite:false,side:THREE.DoubleSide}));this.marker.rotation.x=-Math.PI/2;this.scene.add(this.marker);
    this.airMarker=new THREE.Mesh(new THREE.RingGeometry(.075,.09,32),new THREE.MeshBasicMaterial({transparent:true,opacity:.8,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));this.airMarker.renderOrder=4;this.scene.add(this.airMarker);
    // A screen-space ribbon keeps the preview legible on phones and distant shots.
    this.preview=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,side:THREE.DoubleSide,
      uniforms:{resolution:{value:new THREE.Vector2(1,1)},color:{value:new THREE.Color('#fff3ba')}},
      vertexShader:`attribute vec3 other;attribute float side;varying float edge;uniform vec2 resolution;
        void main(){vec4 a=projectionMatrix*modelViewMatrix*vec4(position,1.);vec4 b=projectionMatrix*modelViewMatrix*vec4(other,1.);
          vec2 direction=(b.xy/b.w-a.xy/a.w)*resolution;float length=max(length(direction),.0001);
          vec2 normal=vec2(-direction.y,direction.x)/length;a.xy+=normal*side*4.5/resolution*a.w;gl_Position=a;edge=side;}`,
      fragmentShader:`uniform vec3 color;varying float edge;void main(){float rim=smoothstep(.45,.72,abs(edge));gl_FragColor=vec4(mix(mix(color,vec3(1.),.55),vec3(.035,.09,.065),rim),.96);}`
    }));this.preview.frustumCulled=false;this.preview.renderOrder=2;this.scene.add(this.preview);
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
    this.terrain=new THREE.Mesh(geometry,terrainMaterials(this.textures));this.terrainTypes=types;this.shades=shades;this.group.add(this.terrain);
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
      const mesh=new THREE.Mesh(g,new THREE.MeshPhongMaterial({map:this.textures.water,shininess:100,specular:0xb4e9e7,transparent:true,opacity:.87}));mesh.position.set(h.x,h.level,h.z);mesh.userData.surface='water';this.surfaceMeshes.push(mesh);this.group.add(mesh);
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
    // Reusable monogram face on sculpted, freestanding tee plaques.
    if(!this.teeFace){
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=320;const ctx=canvas.getContext('2d');
      ctx.fillStyle='#10291f';ctx.fillRect(0,0,512,320);ctx.strokeStyle='#e3c580';ctx.lineWidth=8;ctx.strokeRect(20,20,472,280);
      ctx.strokeStyle='#8b7546';ctx.lineWidth=2;ctx.strokeRect(32,32,448,256);
      ctx.fillStyle='#f5dfa2';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='italic 900 190px Georgia';ctx.fillText('RG',250,150);
      ctx.font='bold 25px Georgia';ctx.fillText('R I P A G O L F',256,265);
      this.teeFace=new THREE.CanvasTexture(canvas);this.teeFace.colorSpace=THREE.SRGBColorSpace;this.teeFace.anisotropy=4;
    }
    for(const x of [-1.5,1.5]){
      const y=course.height(x,0),base=new THREE.Mesh(new THREE.BoxGeometry(.95,.13,.48),new THREE.MeshStandardMaterial({color:0x183a2a,roughness:.45,metalness:.35}));base.position.set(x,y+.065,0);this.group.add(base);
      const body=new THREE.Mesh(new THREE.BoxGeometry(.76,.5,.14),new THREE.MeshStandardMaterial({roughness:.35,metalness:.55}));body.position.set(x,y+.35,0);body.userData.tee=true;this.group.add(body);
      for(const direction of [-1,1]){const face=new THREE.Mesh(new THREE.PlaneGeometry(.72,.45),new THREE.MeshBasicMaterial({map:this.teeFace}));face.position.set(x,y+.35,direction*.071);face.rotation.y=direction<0?Math.PI:0;this.group.add(face);}
    }
    const positions=geometry.attributes.position,heatPositions=Array.from(positions.array),heatIndex=[],fractions=[];let low=Infinity,high=-Infinity;
    for(let i=0;i<positions.count;i++){const d=Math.hypot(positions.getX(i)-course.pin.x,positions.getZ(i)-course.pin.z);if(d<course.greenRadius-2){low=Math.min(low,positions.getY(i));high=Math.max(high,positions.getY(i));}heatPositions[i*3+1]+=.006;}
    const index=geometry.index;
    for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],x=ids.reduce((s,id)=>s+positions.getX(id),0)/3,z=ids.reduce((s,id)=>s+positions.getZ(id),0)/3;if(Math.hypot(x-course.pin.x,z-course.pin.z)<course.greenRadius+8&&course.surface(x,z)!=='water')heatIndex.push(...ids);}
    for(let i=0;i<positions.count;i++)fractions.push(Math.max(0,Math.min(1,(positions.getY(i)-low)/Math.max(.01,high-low))));
    const cupRing=cupSurroundGeometry(course),ringPosition=cupRing.attributes.position,offset=heatPositions.length/3;
    for(let i=0;i<ringPosition.count;i++){heatPositions.push(ringPosition.getX(i),ringPosition.getY(i)+.006,ringPosition.getZ(i));fractions.push(Math.max(0,Math.min(1,(ringPosition.getY(i)-low)/Math.max(.01,high-low))));}
    for(const i of cupRing.index.array)heatIndex.push(i+offset);cupRing.dispose();
    const heat=new THREE.BufferGeometry();heat.setAttribute('position',new THREE.Float32BufferAttribute(heatPositions,3));heat.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(heatPositions.length),3));heat.setIndex(heatIndex);
    this.heightmap=new THREE.Mesh(heat,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.58,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));this.heightFractions=fractions;this.heightmap.material.extensions={derivatives:true};
    this.heightmap.material.onBeforeCompile=shader=>{
      shader.vertexShader='varying float vContourHeight;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvContourHeight=position.y;');
      shader.fragmentShader='varying float vContourHeight;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat band=abs(fract(vContourHeight/.08)-.5); float width=max(fwidth(vContourHeight/.08)*1.3,.025); float line=1.-smoothstep(.025,.025+width,band); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.06,.14,.11),line*.55);');
    };this.group.add(this.heightmap);
    const arrows=[];
    for(let x=-24;x<=24;x+=2)for(let z=-24;z<=24;z+=2){const px=course.pin.x+x,pz=course.pin.z+z;if(Math.hypot(x,z)>course.greenRadius+7||Math.hypot(x,z)<.3)continue;const s=course.slope(px,pz),length=Math.hypot(s.x,s.z);if(length<.002)continue;const scale=.25+Math.min(.75,length*8),dx=-s.x/length*scale,dz=-s.z/length*scale,y=course.height(px,pz)+.018,ex=px+dx,ez=pz+dz,ey=course.height(ex,ez)+.018;arrows.push(px,y,pz,ex,ey,ez,ex,ey,ez,ex-dx*.27+dz*.22,ey,ez-dz*.27-dx*.22,ex,ey,ez,ex-dx*.27-dz*.22,ey,ez-dz*.27+dx*.22);}
    const arrowGeometry=new THREE.BufferGeometry();arrowGeometry.setAttribute('position',new THREE.Float32BufferAttribute(arrows,3));this.runoffArrows=new THREE.LineSegments(arrowGeometry,new THREE.LineBasicMaterial({transparent:true,opacity:.8,depthWrite:false}));this.group.add(this.runoffArrows);
    if(this.palette)this.apply(this.palette);
  }
  apply(palette){
    this.palette=palette;const p=palette.world;this.scene.background=p.sky;this.scene.fog=new THREE.Fog(p.fog,360,850);
    this.hemi.intensity=palette.dark?1.7:2.1;this.sun.intensity=palette.dark?1.5:2.2;
    this.airMarker.material.color.copy(p.accent);this.marker.material.color.copy(p.accent);this.landing.material.color.copy(p.accent);this.preview.material.uniforms.color.value.copy(p.accent);
    if(!this.terrain)return;
    const col=this.terrain.geometry.attributes.color;
    for(let i=0;i<col.count;i++){const c=p[this.terrainTypes[i]],f=this.shades[i];col.setXYZ(i,c.r*f,c.g*f,c.b*f);}col.needsUpdate=true;
    for(const mesh of this.surfaceMeshes)mesh.material.color.copy(p[mesh.userData.surface]);
    this.landscape.material.color.copy(p.rough);this.puttingGrid.material.color.copy(p.accent);this.runoffArrows.material.color.set('#153b29').lerp(p.accent,.12);
    const heat=this.heightmap.geometry.attributes.color,low=new THREE.Color('#3985ca').lerp(p.accent,.1),high=new THREE.Color('#f4b64d').lerp(p.accent,.15),color=new THREE.Color();for(let i=0;i<heat.count;i++){color.copy(low).lerp(high,this.heightFractions[i]);heat.setXYZ(i,color.r,color.g,color.b);}heat.needsUpdate=true;
    this.trunks.material.color.copy(p.trunk);this.leaves.material.color.copy(p.leaves);this.pole.material.color.copy(p.accent);this.flag.material.color.copy(p.accent);this.cupTrim.material.color.copy(p.accent);
    for(const m of this.group.children)if(m.userData.tee)m.material.color.copy(p.accent);
  }
  setPreview(points,aim=0,origin={x:0,y:0,z:0}){
    this.previewAim=aim;this.previewOrigin={...origin};this.preview.position.set(origin.x,origin.y,origin.z);this.preview.rotation.y=0;
    const positions=[],other=[],sides=[],indices=[];
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],base=positions.length/3;
      for(const [p,q,side]of [[a,b,-1],[a,b,1],[b,a,1],[b,a,-1]]){positions.push(p.x-origin.x,p.y-origin.y+.12,p.z-origin.z);other.push(q.x-origin.x,q.y-origin.y+.12,q.z-origin.z);sides.push(side);}
      indices.push(base,base+1,base+2,base+1,base+3,base+2);
    }
    this.preview.geometry.dispose();const geometry=this.preview.geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('other',new THREE.Float32BufferAttribute(other,3));geometry.setAttribute('side',new THREE.Float32BufferAttribute(sides,1));geometry.setIndex(indices);
    const end=points.at(-1);this.previewEnd=end;if(end)this.landing.position.set(end.x,this.course.height(end.x,end.z)+.09,end.z);
  }
  update(dt,mode,ball,aim,zoom,pitch,time,reduced,options={}){
    if(!this.course)return;const p=ball.renderedPosition(),c=this.course,ground=c.height(p.x,p.z),height=Math.max(0,p.y-ground);
    this.ball.position.set(p.x,p.y,p.z);this.ball.rotation.x+=ball.v.z*dt/BALL_RADIUS;this.ball.rotation.z-=ball.v.x*dt/BALL_RADIUS;
    this.shadow.position.set(p.x,ground+.002,p.z);this.shadow.material.opacity=Math.max(.04,.3-height*.008);this.shadow.scale.setScalar(1+Math.min(2,height*.04));this.shadow.visible=ball.status!=='cupping'&&ball.status!=='holed';
    this.marker.position.set(p.x,ground+.008,p.z);this.marker.visible=['aim','timing'].includes(mode);
    this.marker.scale.setScalar(Math.max(1,this.camera.position.distanceTo(this.ball.position)*.018));
    // Rotate immediately with fine aim input between the full physics predictions.
    // The next prediction refresh resolves wind, terrain and spin exactly.
    if(this.previewOrigin&&['aim','timing'].includes(mode)){
      const delta=aim-this.previewAim;this.preview.rotation.y=delta;
      if(this.previewEnd){const o=this.previewOrigin,x=this.previewEnd.x-o.x,z=this.previewEnd.z-o.z,px=o.x+x*Math.cos(delta)+z*Math.sin(delta),pz=o.z-x*Math.sin(delta)+z*Math.cos(delta);this.landing.position.set(px,c.height(px,pz)+.09,pz);}
    }
    this.gr.renderer.getSize(this.preview.material.uniforms.resolution.value);
    this.preview.visible=this.landing.visible=['aim','timing'].includes(mode);this.puttingGrid.visible=!!options.putting&&options.puttingGuide!==false&&['aim','timing'].includes(mode);
    this.heightmap.visible=this.runoffArrows.visible=!!options.greenHeightmap&&['aim','timing','flight'].includes(mode);
    this.flag.rotation.y=Math.atan2(c.wind.x,c.wind.z)+(!reduced?Math.sin(time*2)*.06:0);
    this.cameraCtl.update(dt,{course:c,ball,position:p,phase:mode,aim,zoom,pitch,time,reduced,putting:options.putting,landing:this.previewEnd,swinging:options.swinging,cameraView:options.cameraView,safeView:options.safeView});
    this.airMarker.position.copy(this.ball.position);this.airMarker.quaternion.copy(this.camera.quaternion);this.airMarker.scale.setScalar(Math.max(.5,this.camera.position.distanceTo(this.ball.position)*.07));this.airMarker.visible=['aim','timing','flight'].includes(mode)&&!['cupping','holed'].includes(ball.status);
    if(!options.swinging)this.camera.position.y=Math.max(this.camera.position.y,c.height(this.camera.position.x,this.camera.position.z)+.8);
  }
  destroy(){this.clear();for(const mesh of [this.ball,this.shadow,this.marker,this.airMarker,this.preview,this.landing]){mesh.geometry.dispose();mesh.material.dispose();this.scene.remove(mesh);}this.teeFace?.dispose();this.scene.remove(this.group,this.hemi,this.sun);for(const texture of Object.values(this.textures))texture.dispose();}
}

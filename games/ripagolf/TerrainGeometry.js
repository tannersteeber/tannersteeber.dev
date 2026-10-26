import * as THREE from '../vendor/three.module.js';
import {TERRAIN_MATERIALS} from './SurfaceTextures.js?v=20261025-controls-7';
import {CUP_RADIUS} from './CupPhysics.js?v=20261025-controls-7';
export function terrainGeometry(course){
  const {xs,zs,heights}=course.heightfield,positions=[],uv=[],index=[],groups=TERRAIN_MATERIALS.map(()=>[]),types=[],shades=[];
  for(let j=0;j<zs.length;j++)for(let i=0;i<xs.length;i++){
    const x=xs[i],z=zs[j],lie=course.surface(x,z);positions.push(x,heights[j*xs.length+i],z);uv.push(x/8,z/8);types.push(lie);
    shades.push(1+.035*Math.sin(x*5.7+z*2.3)+(lie==='fairway'?(Math.floor(z/9)%2?.035:-.025):0));
  }
  for(let j=0;j<zs.length-1;j++)for(let i=0;i<xs.length-1;i++){
    // Leave a square socket for the precisely cut circular cup surround.
    if(xs[i]>=course.pin.x-.250001&&xs[i+1]<=course.pin.x+.250001&&zs[j]>=course.pin.z-.250001&&zs[j+1]<=course.pin.z+.250001)continue;
    const a=j*xs.length+i,b=a+xs.length;const type=course.surface((xs[i]+xs[i+1])/2,(zs[j]+zs[j+1])/2),group=groups[TERRAIN_MATERIALS.indexOf(type)];group.push(a,b,a+1,a+1,b,b+1);
  }
  const g=new THREE.BufferGeometry();for(let material=0;material<groups.length;material++){const start=index.length;for(const value of groups[material])index.push(value);g.addGroup(start,groups[material].length,material);}
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(positions.length),3));g.setIndex(index);g.computeVertexNormals();return {geometry:g,types,shades};
}
export function cupSurroundGeometry(course){
  const pos=[],idx=[],N=96;
  for(let ring=0;ring<4;ring++)for(let i=0;i<N;i++){
    const a=i/N*Math.PI*2,dx=Math.cos(a),dz=Math.sin(a),edge=.25/Math.max(Math.abs(dx),Math.abs(dz)),r=CUP_RADIUS+(edge-CUP_RADIUS)*ring/3;
    const x=course.pin.x+dx*r,z=course.pin.z+dz*r;pos.push(x,course.height(x,z),z);
  }
  for(let ring=0;ring<3;ring++)for(let i=0;i<N;i++){const a=ring*N+i,b=ring*N+(i+1)%N,c=a+N,d=b+N;idx.push(a,b,c,b,d,c);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
}

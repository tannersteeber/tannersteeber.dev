import * as THREE from '../vendor/three.module.js';
import {PAGE_THEMES} from '../shared/engine/SettingsManager.js';
const root=document.documentElement;
export {PAGE_THEMES};
// Theme identifiers only affect the default brand treatment. All other palettes read site tokens.
// Future CSS themes inherit this adapter automatically, including custom --golf-* overrides.
export class ThemeAdapter {
  constructor(onChange){
    this.onChange=onChange;this.pending=false;
    this.observer=new MutationObserver(()=>{if(this.pending)return;this.pending=true;requestAnimationFrame(()=>{this.pending=false;this.apply();});});
    this.observer.observe(root,{attributes:true,attributeFilter:['class','data-page-theme','style']});
    this.storage=e=>{if(['site-theme','page-theme','rain-hue'].includes(e.key))this.restore();};window.addEventListener('storage',this.storage);
    this.restore();
  }
  restore(){
    try{
      const dark=localStorage.getItem('site-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
      root.classList.toggle('theme-dark',dark==='dark');
      const page=localStorage.getItem('page-theme')||'signature';
      if(page!=='signature'&&/^[a-z][a-z0-9-]*$/.test(page))root.dataset.pageTheme=page;else root.removeAttribute('data-page-theme');
      const savedHue=localStorage.getItem('rain-hue'),hue=Number(savedHue);if(savedHue!==null&&Number.isFinite(hue))root.style.setProperty('--rain-h',String(hue));
    }catch{}
    this.apply();
  }
  setPage(id){try{localStorage.setItem('page-theme',id);}catch{}if(id==='signature')root.removeAttribute('data-page-theme');else root.dataset.pageTheme=id;this.apply();}
  setDark(dark){try{localStorage.setItem('site-theme',dark?'dark':'light');}catch{}root.classList.toggle('theme-dark',dark);this.apply();}
  setHue(hue){root.style.setProperty('--rain-h',String(hue));try{localStorage.setItem('rain-hue',String(hue));}catch{}this.apply();}
  apply(){
    const cs=getComputedStyle(root),read=(key,fallback)=>cs.getPropertyValue(key).trim()||fallback;
    const page=root.dataset.pageTheme||'signature',brand=page==='signature',dark=root.classList.contains('theme-dark')||!brand;
    const val=(key,fallback)=>read('--golf-'+key,fallback);
    const palette={page,dark,
      bg:val('bg',brand?(dark?'#101814':'#f5f0e6'):read('--bg','#101814')),
      surface:val('surface',brand?(dark?'#102d24':'#fffdf5'):read('--card-surface','#102d24')),
      felt:val('felt',brand?(dark?'#064e3b':'#e0ecdf'):read('--card-surface-2','#064e3b')),
      text:val('text',brand?(dark?'#f5f0e6':'#172d24'):read('--text','#f5f0e6')),
      muted:val('muted',brand?(dark?'#c0c9bc':'#526458'):read('--muted','#c0c9bc')),
      accent:val('accent',brand?(dark?'#d4af37':'#9c7417'):read('--accent','#d4af37')),
      secondary:val('secondary',brand?'#e8cf83':read('--accent-2','#e8cf83')),
      onAccent:val('on-accent',brand?'#101814':read('--on-accent','#101814')),
      border:val('border',brand?'#a08c4c':read('--border-strong','#a08c4c')),
      success:val('success',brand?'#32926b':read('--accent','#32926b')),
      failure:val('failure',brand?'#b91c1c':'#e66a79')};
    for(const [key,value]of Object.entries(palette))if(!['page','dark'].includes(key)&&root.style.getPropertyValue('--rg-'+key)!==value)root.style.setProperty('--rg-'+key,value);
    // Numeric Three colors are resolved in one place; surface identity remains recognizable.
    const accent=new THREE.Color(palette.accent),mix=(hex,amount)=>new THREE.Color(hex).lerp(accent,brand?0:amount);
    palette.world={
      sky:mix(dark?'#233c4d':'#b8dcec',.12),fog:mix(dark?'#536c63':'#b4d1b8',.1),
      rough:mix('#376546',.12),fairway:mix('#448a4f',.12),green:mix('#6fa75b',.07),sand:mix('#e3cf9c',.04),water:mix('#377c9c',.18),tee:mix('#5f9952',.1),
      trunk:new THREE.Color('#69523c'),leaves:mix('#27573e',.12),accent};
    this.palette=palette;this.onChange?.(palette);return palette;
  }
  destroy(){this.observer.disconnect();window.removeEventListener('storage',this.storage);this.onChange=null;}
}

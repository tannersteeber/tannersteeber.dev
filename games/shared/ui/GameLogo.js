import {h} from './dom.js';

// Small, theme-colored vector marks shared by title and in-game wordmarks.
export function gameLogo(id){
  const mark=h('span',{class:'g-brandmark','aria-hidden':'true'});
  const art=id==='cruise'
    ? '<circle cx="44" cy="18" r="6"/><path d="M6 35 19 21l12 11 9-8 18 15M6 48h12m28 0h12M22 58c-6-13 17-18 11-30M40 58c-7-13 9-18 0-30"/><path d="m31 53 1-4m2-7 1-4"/>'
    : '<path d="M19 9h26M19 55h26M22 16v9m0 14v9M42 16v9m0 14v9" opacity=".55"/><path d="m14 38 4-12h25l7 12v10H14V38Zm4 0h27M22 26l3-8h12l6 8M20 43h5m14 0h5M5 24h8M3 31h7M51 19h10M54 26h7"/>';
  mark.innerHTML='<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="60" height="60" rx="17" opacity=".45"/>'+art+'</svg>';
  return mark;
}

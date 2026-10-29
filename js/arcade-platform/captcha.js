import {config} from './config.js';
let script;
export function captcha(form){
 if(!config.turnstileSiteKey)return {token:()=>undefined,reset(){},destroy(){}};
 const mount=document.createElement('div');mount.className='ap-captcha';mount.setAttribute('aria-label','Account verification');form.append(mount);
 let token,widget,theme,size,resizeObserver,themeObserver,destroyed=false;
 if(!script)script=new Promise((resolve,reject)=>{
  const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;s.onload=resolve;
  s.onerror=()=>{script=undefined;reject(new Error('Could not load account verification.'));};document.head.append(s);
 });
 function render(){
  if(destroyed||!mount.isConnected)return;
  const root=document.documentElement,nextTheme=root.classList.contains('theme-dark')||root.hasAttribute('data-page-theme')?'dark':'light',nextSize=mount.clientWidth<300?'compact':'flexible';
  if(widget!==undefined&&theme===nextTheme&&size===nextSize)return;
  token=undefined;if(widget!==undefined){window.turnstile.remove(widget);mount.replaceChildren();}
  theme=nextTheme;size=nextSize;
  widget=window.turnstile.render(mount,{sitekey:config.turnstileSiteKey,theme,size,callback:value=>{token=value;},'expired-callback':()=>{token=undefined;},'error-callback':()=>{token=undefined;}});
 }
 script.then(()=>{
  if(destroyed||!mount.isConnected)return;render();
  themeObserver=new MutationObserver(render);themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['class','data-page-theme']});
  resizeObserver=new ResizeObserver(render);resizeObserver.observe(mount);
 }).catch(()=>{if(!destroyed)mount.textContent='Verification could not load. Reload to try again.';});
 return {
  token(){if(!token)throw new Error('Complete the account verification first.');return token;},
  reset(){token=undefined;if(widget!==undefined&&mount.isConnected)window.turnstile.reset(widget);},
  destroy(){destroyed=true;token=undefined;themeObserver?.disconnect();resizeObserver?.disconnect();if(widget!==undefined)window.turnstile.remove(widget);}
 };
}

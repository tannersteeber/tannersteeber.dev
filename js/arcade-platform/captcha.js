import {config} from './config.js';
let script;
export function captcha(form){
 if(!config.turnstileSiteKey)return {token:()=>undefined,reset(){}};
 const mount=document.createElement('div');mount.setAttribute('aria-label','Account verification');form.append(mount);let token,widget;
 if(!script)script=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;s.onload=resolve;s.onerror=()=>reject(new Error('Could not load account verification.'));document.head.append(s);});
 script.then(()=>{if(mount.isConnected)widget=window.turnstile.render(mount,{sitekey:config.turnstileSiteKey,theme:'auto',callback:value=>{token=value;},'expired-callback':()=>{token=undefined;},'error-callback':()=>{token=undefined;}});}).catch(()=>{mount.textContent='Verification could not load. Reload to try again.';});
 return {token(){if(!token)throw new Error('Complete the account verification first.');return token;},reset(){token=undefined;if(widget!==undefined&&mount.isConnected)window.turnstile.reset(widget);}};
}

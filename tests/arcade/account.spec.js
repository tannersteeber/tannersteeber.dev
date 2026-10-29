import {test,expect} from '@playwright/test';
import {validateGolf} from '../../games/shared/services/golf-validator.js';
// Exercise the configured widget without contacting Cloudflare in mocked UI tests.
test.beforeEach(async({page})=>{
 await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',route=>route.fulfill({contentType:'application/javascript',body:`window.turnstile={render(mount,options){const id=String(Math.random());mount.dataset.testWidget=id;mount.dataset.widgetTheme=options.theme;mount.dataset.widgetSize=options.size;const box=document.createElement('div');box.textContent='Account verification complete (test)';box.style.cssText='display:grid;align-items:center;padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--muted);font:13px var(--font);height:'+(options.size==='compact'?'140px':'65px')+';width:'+(options.size==='compact'?'150px':'100%');mount.append(box);queueMicrotask(()=>options.callback('test-captcha-token'));return id;},reset(){},remove(){}};`}));
});
const uid='11111111-1111-4111-8111-111111111111';
const user={id:uid,aud:'authenticated',role:'authenticated',email:'test@example.test',email_confirmed_at:'2026-10-01T00:00:00Z',created_at:'2026-10-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{},identities:[]};
const token=[{alg:'HS256',typ:'JWT'},{sub:uid,exp:2000000000,iat:1700000000,aud:'authenticated',role:'authenticated',session_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},'test'].map((v,i)=>i===2?v:Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
async function backend(page){let profile={user_id:uid,username:'PlayerOne',public_profile:false,leaderboard_opt_in:false,created_at:user.created_at};let gameSession=null;const calls=[];await page.route('https://ibiwrmcehgbjjnrebwnp.supabase.co/**',async route=>{const req=route.request(),url=new URL(req.url());calls.push(url.pathname);let data={};if(url.pathname.endsWith('/token'))data={access_token:token,token_type:'bearer',expires_in:3600,refresh_token:'local-test-token',user};else if(url.pathname.endsWith('/user'))data=user;else if(url.pathname.endsWith('/logout'))return route.fulfill({status:204});else if(url.pathname.includes('/rpc/arcade_profile_save')){const body=req.postDataJSON();profile={...profile,username:body.p_username,public_profile:body.p_public,leaderboard_opt_in:body.p_ranked,display_name:body.p_display_name||''};data=profile;}else if(url.pathname.includes('/rpc/arcade_start')){const b=req.postDataJSON();gameSession={id:b.p_key,user_id:uid,game_id:b.p_game,validator_version:b.p_game==='ripagolf'?'golf-v1':'practice-v1',seed:14279,status:'active',revision:0,expires_at:'2099-01-01',state:{holeIndex:1,streak:0,score:0,strokes:0,prediction:null,ball:null,windTime:0}};data=gameSession;}else if(url.pathname.includes('/functions/v1/arcade-api')){const b=req.postDataJSON();if(b.action==='golf'){const result=validateGolf(gameSession,b);gameSession={...gameSession,revision:gameSession.revision+1,state:result.state};data={revision:gameSession.revision,state:gameSession.state};}}else if(url.pathname.endsWith('/arcade_sessions'))data=gameSession?[gameSession]:[];else if(url.pathname.includes('/rpc/arcade_save'))data={revision:1};else if(url.pathname.includes('/rpc/arcade_exchange_info'))data={exchange_enabled:false};else if(url.pathname.includes('/rpc/arcade_leaderboard'))data={enabled:false,rows:[],total:0,own:null};else if(url.pathname.endsWith('/arcade_profiles'))data=req.headers().accept?.includes('object')?profile:[profile];else if(url.pathname.endsWith('/arcade_achievement_definitions'))data=[{id:'first-run',name:'First Run',description:'Complete your first verified run.',game_id:'cruise',stat:'runs_completed',threshold:1}];else if(url.pathname.endsWith('/arcade_wallets'))data={user_id:uid,arcade_points:0,casino_chips:0,lifetime_earned:0,lifetime_spent:0};else if(url.pathname.endsWith('/arcade_periods'))data=[{id:'all',kind:'all'}];else if(url.pathname.endsWith('/arcade_stat_definitions'))data=[{game_id:'arcade',stat:'points_earned',label:'Lifetime Arcade Points earned'}];else if(url.pathname.startsWith('/rest/'))data=[];return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});});return calls;}
async function signIn(page){await page.goto('/arcade.html');await page.getByRole('textbox',{name:'Email',exact:true}).fill('test@example.test');await page.getByLabel('Password (at least 12 characters)').fill('TestPassword123!');await page.getByRole('button',{name:'Sign In',exact:true}).last().click();await expect(page.getByText('Playing as PlayerOne')).toBeVisible();}
test('sign-in waits for CAPTCHA and sends its token to Supabase',async({page})=>{
 const calls=await backend(page);
 await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',route=>route.fulfill({contentType:'application/javascript',body:`window.turnstile={render(mount,options){const button=document.createElement('button');button.type='button';button.textContent='Complete test verification';button.onclick=()=>options.callback('test-captcha-token');mount.append(button);return 'test';},reset(){},remove(){}};`}));
 await page.goto('/arcade.html');
 await page.getByLabel('Email',{exact:true}).fill('test@example.test');
 await page.getByLabel('Password (at least 12 characters)').fill('TestPassword123!');
 await page.getByRole('button',{name:'Sign In',exact:true}).last().click();
 await expect(page.getByText('Complete the account verification first.')).toBeVisible();
 expect(calls.some(path=>path.endsWith('/token'))).toBe(false);
 await page.getByRole('button',{name:'Complete test verification'}).click();
 const request=page.waitForRequest(req=>new URL(req.url()).pathname.endsWith('/token'));
 await page.getByRole('button',{name:'Sign In',exact:true}).last().click();
 expect((await request).postDataJSON().gotrue_meta_security.captcha_token).toBe('test-captcha-token');
 await expect(page.getByText('Playing as PlayerOne')).toBeVisible();
});
test('Arcade is gated; account screens, privacy, themes and logout work',async({page},info)=>{const errors=[];page.on('pageerror',e=>errors.push(e.message));await backend(page);await signIn(page);await expect(page.locator('#arcade-library')).toBeVisible();await expect(page.locator('.arcade-card')).toHaveCount(3);await page.getByRole('button',{name:'Wallet',exact:true}).click();await expect(page.getByText('Exchange will open after the conversion rate is approved.')).toBeVisible();await page.getByRole('button',{name:'Leaderboards',exact:true}).click();await expect(page.getByText('Competitive rankings are awaiting validation and rule approval. Practice records remain private.')).toBeVisible();await page.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.getByLabel('Allow signed-in players to view my verified profile')).not.toBeChecked();await page.getByLabel('Username',{exact:true}).fill('UpdatedPlayer');await page.getByLabel('Display name (optional)',{exact:true}).fill('Player Display');await page.getByRole('button',{name:'Save Profile',exact:true}).click();await expect(page.getByText('Playing as UpdatedPlayer')).toBeVisible();await expect(page.getByLabel('Display name (optional)',{exact:true})).toHaveValue('Player Display');await page.getByRole('button',{name:'Statistics',exact:true}).click();await expect(page.getByLabel('Statistics period')).toHaveValue('all');await page.getByRole('button',{name:'Settings',exact:true}).click();for(const theme of ['signature','retro','rain']){await page.evaluate(t=>{if(t==='signature')document.documentElement.removeAttribute('data-page-theme');else document.documentElement.setAttribute('data-page-theme',t);},theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`test-results/account-${info.project.name}.png`,fullPage:true});await page.getByRole('button',{name:'Sign Out',exact:true}).first().click();await expect(page.getByText('Welcome to the Arcade')).toBeVisible();await expect(page.locator('#arcade-library')).toBeHidden();expect(errors).toEqual([]);});
test('direct game entry requires login and public pages do not load account code',async({page})=>{const calls=await backend(page);await page.goto('/index.html');await expect(page.locator('#arcade-account')).toHaveCount(0);expect(calls.length).toBe(0);for(const game of ['cruise','cutup','ripagolf']){await page.goto(`/games/${game}/index.html`);await expect(page.getByRole('link',{name:'Sign in at the Arcade'})).toBeVisible();await expect(page.locator('canvas')).toHaveCount(0);}});
test('registration, recovery request and recovery password form',async({page})=>{await backend(page);await page.goto('/arcade.html');await page.getByRole('button',{name:'Create Account',exact:true}).first().click();await page.getByLabel('Email',{exact:true}).fill('test@example.test');await page.getByLabel('Password (at least 12 characters)').fill('TestPassword123!');await page.getByRole('button',{name:'Create Account',exact:true}).last().click();await expect(page.getByRole('heading',{name:'Check your email',exact:true})).toBeFocused();await expect(page.getByText('Check test@example.test for a verification link.',{exact:false})).toBeVisible();await expect(page.getByLabel('Password (at least 12 characters)')).toHaveCount(0);await expect(page.locator('#arcade-library')).toBeHidden();await page.getByRole('button',{name:'Back to Sign In',exact:true}).click();await expect(page.getByLabel('Email',{exact:true})).toHaveValue('test@example.test');await expect(page.getByRole('button',{name:'Resend verification email'})).toBeVisible();await page.getByRole('button',{name:'Forgot Password',exact:true}).click();await page.getByLabel('Email',{exact:true}).fill('test@example.test');await page.getByRole('button',{name:'Send Recovery Email',exact:true}).click();await expect(page.getByText('If this address can receive a recovery email, a link is on its way.')).toBeVisible();await signIn(page);await page.goto('/arcade.html?recovery=1');await expect(page.getByRole('heading',{name:'Choose a new password'})).toBeVisible();await page.getByLabel('New password',{exact:true}).fill('NewTestPassword123!');await page.getByRole('button',{name:'Update Password',exact:true}).click();await expect(page.getByText('Password updated.')).toBeVisible();});

test('authenticated driving games play, pause, finish and save without startup errors',async({page})=>{await backend(page);await signIn(page);for(const game of ['cruise','cutup']){await page.goto(`/games/${game}/index.html`);await expect(page.locator('#game-root')).toHaveClass(/ready/);await expect(page.locator('.g-title .g-btn-primary')).toBeVisible();await page.locator('.g-title .g-btn-primary').click();await expect(page.locator('.g-title')).toBeHidden();await page.getByRole('button',{name:'Pause game',exact:true}).click();await expect(page.getByRole('button',{name:'Finish & Save Run'})).toBeVisible();await expect(page.locator('#game-root')).not.toHaveAttribute('data-startup-error');}});
test('authenticated golf locks a prediction and completes a server-backed shot',async({page},info)=>{test.setTimeout(60000);await backend(page);await signIn(page);await page.goto('/games/ripagolf/index.html');await expect(page.getByRole('button',{name:'Play Golf',exact:true})).toBeVisible();await page.getByRole('button',{name:'Play Golf',exact:true}).click();await expect(page.getByRole('button',{name:'Lock in prediction',exact:true})).toBeVisible({timeout:15000});await page.getByRole('button',{name:'Par or better',exact:false}).click();await page.getByRole('button',{name:'Lock in prediction',exact:true}).click();await expect(page.locator('.rg-shot')).toBeVisible();await page.getByRole('button',{name:/^Time swing/}).click();await page.getByRole('button',{name:/^Strike/}).click();await expect(page.locator('.rg-flight')).toBeVisible();await expect(page.locator('.rg-shot')).toBeVisible({timeout:45000});await expect(page.locator('.g-platform-error')).toHaveCount(0);await page.screenshot({path:`test-results/golf-${info.project.name}.png`});});

test('account layouts follow every theme on sign-up and all player screens',async({page},info)=>{
 test.setTimeout(60000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await backend(page);await page.goto('/arcade.html');
 const themes=['light','dark','retro','rain'];
 const theme=async name=>{
  await page.evaluate(name=>{const root=document.documentElement;root.classList.toggle('theme-dark',name==='dark');if(name==='retro'||name==='rain')root.dataset.pageTheme=name;else root.removeAttribute('data-page-theme');},name);
  await page.evaluate(()=>document.fonts.ready);
 };
 const fits=async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 for(const name of themes){
  await theme(name);
  await page.getByRole('group',{name:'Account access'}).getByRole('button',{name:'Create Account',exact:true}).click();
  await page.getByLabel('Email',{exact:true}).fill('test@example.test');
  const password=page.getByLabel('Password (at least 12 characters)',{exact:true});await password.fill('TestPassword123!');
  await page.getByRole('button',{name:'Show password',exact:true}).click();await expect(password).toHaveAttribute('type','text');
  await page.getByRole('button',{name:'Hide password',exact:true}).click();await expect(password).toHaveAttribute('type','password');
  const font=await password.evaluate(node=>getComputedStyle(node).fontFamily);
  if(name==='retro')expect(font).toContain('Pixelify Sans');
  if(name==='rain')expect(font).toContain('Cascadia Code');
  await expect(page.locator('.ap-captcha')).toHaveAttribute('data-widget-theme',name==='light'?'light':'dark');await fits();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({animations:'disabled',path:`test-results/signup-${name}-${info.project.name}.png`,fullPage:true});
  await page.getByRole('button',{name:'Forgot Password',exact:true}).click();
  await expect(page.getByLabel('Email',{exact:true})).toHaveValue('test@example.test');await fits();
 }
 if(info.project.name==='mobile'){
  await page.setViewportSize({width:320,height:740});await fits();await expect(page.locator('.ap-captcha')).toHaveAttribute('data-widget-size','compact');await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:'test-results/account-narrow-mobile.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
 }
 await signIn(page);
 for(const name of themes){
  await theme(name);
  for(const view of ['Library','Profile','Statistics','Leaderboards','Wallet','Achievements','Settings']){
   await page.getByRole('navigation',{name:'Arcade account'}).getByRole('button',{name:view,exact:true}).click();
   await expect(page.locator('.ap-card[aria-busy=true]')).toHaveCount(0);await fits();
   if(view==='Achievements')await expect(page.getByRole('progressbar',{name:'First Run progress'})).toBeVisible();if(view==='Library'||view==='Settings'){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({animations:'disabled',path:`test-results/${view.toLowerCase()}-${name}-${info.project.name}.png`,fullPage:true});}
  }
 }
 expect(errors).toEqual([]);
});


test('signup errors stay next to the form and allow a retry',async({page})=>{
 await backend(page);
 await page.route('https://ibiwrmcehgbjjnrebwnp.supabase.co/auth/v1/signup*',route=>route.fulfill({status:422,contentType:'application/json',body:JSON.stringify({code:'weak_password',msg:'Choose a stronger password.'})}));
 await page.goto('/arcade.html');await page.getByRole('group',{name:'Account access'}).getByRole('button',{name:'Create Account',exact:true}).click();
 await page.getByLabel('Email',{exact:true}).fill('test@example.test');await page.getByLabel('Password (at least 12 characters)',{exact:true}).fill('TestPassword123!');
 await page.getByRole('button',{name:'Create Account',exact:true}).last().click();
 await expect(page.locator('.ap-form [role=status]')).toHaveText('Choose a stronger password.');
 await expect(page.getByRole('heading',{name:'Check your email',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Create Account',exact:true}).last()).toBeEnabled();
});

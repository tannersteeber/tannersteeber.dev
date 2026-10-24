// Scoring is independent of rendering, physics and prediction selection.
export const CLUBS = [
  { id:'driver', name:'Driver', speed:72, loft:14, spin:2300, accuracy:7, carry:283 },
  { id:'wood', name:'Fairway wood', speed:64, loft:19, spin:3200, accuracy:6, carry:265 },
  { id:'hybrid', name:'Hybrid', speed:57, loft:23, spin:4000, accuracy:5, carry:231 },
  { id:'long', name:'Long iron', speed:51, loft:28, spin:4700, accuracy:4.5, carry:211 },
  { id:'mid', name:'Mid iron', speed:44, loft:34, spin:5600, accuracy:4, carry:175 },
  { id:'short', name:'Short iron', speed:37, loft:41, spin:6600, accuracy:3.5, carry:130 },
  { id:'pitch', name:'Pitching wedge', speed:30, loft:48, spin:7600, accuracy:3, carry:86 },
  { id:'sand', name:'Sand wedge', speed:24, loft:56, spin:8400, accuracy:2.5, carry:50 },
  { id:'putter', name:'Putter', speed:6.8, loft:0, spin:0, accuracy:2, carry:60 }
];
export const PREDICTIONS = [
  { id:'bogey', name:'Bogey or better', mult:.5, delta:1, exact:false },
  { id:'par', name:'Par or better', mult:1, delta:0, exact:false },
  { id:'exact-par', name:'Exact par', mult:1.5, delta:0, exact:true },
  { id:'birdie', name:'Birdie or better', mult:2, delta:-1, exact:false },
  { id:'exact-birdie', name:'Exact birdie', mult:3, delta:-1, exact:true },
  { id:'eagle', name:'Eagle or better', mult:5, delta:-2, exact:false },
  { id:'exact-eagle', name:'Exact eagle', mult:8, delta:-2, exact:true },
  { id:'ace', name:'Hole-in-one', mult:20, strokes:1, exact:true }
];
export const MILESTONES = {5:'Hot Streak',10:'High Roller',20:'Golden Run',50:'Ripa Legend',100:'Legendary Streak'};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const yards=metres=>Math.round(metres/0.9144);
export function predictions(par) { return PREDICTIONS.filter(p=>par===3 ? !['eagle','exact-eagle'].includes(p.id) : p.id!=='ace'); }
export function predictionWon(id,par,strokes) {
  const p=predictions(par).find(p=>p.id===id);
  if(!p||!Number.isInteger(strokes)||strokes<1)return false;
  const target=p.strokes??par+p.delta;
  return p.exact?strokes===target:strokes<=target;
}
export function scoreName(par,strokes) {
  if(strokes===1)return 'Hole-in-one';
  const relative=strokes-par;
  return ({'-3':'Albatross','-2':'Eagle','-1':'Birdie',0:'Par',1:'Bogey',2:'Double bogey',3:'Triple bogey'})[relative]??(relative<0?`${-relative} under par`:`${relative} over par`);
}
export function reward(id,streak) {
  const p=PREDICTIONS.find(p=>p.id===id);
  return p?Math.round(1000*p.mult*(1+Math.min(50,Math.max(0,streak-1))*.04)):0;
}
export function recommend(distance,lie) {
  if((lie==='green'&&distance<65)||((lie==='fairway'||lie==='tee')&&distance<10))return 8;
  if(lie==='sand'&&distance<80)return 7;
  const limit=lie==='rough'?2:0;
  for(let i=7;i>=limit;i--)if(CLUBS[i].carry>=distance*.95)return i;
  return limit;
}

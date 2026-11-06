import {configured,watchUser,logIn,signUp,logInWithGoogle,resetPassword,logOut,userStore,saveDisplayName} from './firebase.js';

const $=(s,el)=>(el||document).querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DEFAULT_CATS=[
  {id:'food',name:'Food & drinks',budget:0},{id:'transport',name:'Transport',budget:0},
  {id:'bills',name:'Rent & bills',budget:0},{id:'shopping',name:'Shopping',budget:0},
  {id:'fun',name:'Fun',budget:0},{id:'other',name:'Other',budget:0}];
const CARD_BG={
  green:'linear-gradient(140deg,#2E8A5C 0%,#1F6B47 55%,#14492F 100%)',
  graphite:'linear-gradient(140deg,#3A3F3C 0%,#1E2321 60%,#0E1110 100%)',
  clay:'linear-gradient(140deg,#C9733F 0%,#A4552A 60%,#7A3C1C 100%)',
  ocean:'linear-gradient(140deg,#3B7BB5 0%,#255C8F 60%,#173E63 100%)',
  plum:'linear-gradient(140deg,#7A5AA8 0%,#5B3F86 60%,#3D2A5C 100%)'};
const ICON_SNOW='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 2v20M4.9 6l14.2 12M19.1 6 4.9 18"/></svg>';
const ICON_TRASH='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';

function ym(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
function today(){const d=new Date();return ym(d)+'-'+String(d.getDate()).padStart(2,'0')}
function monthLabel(m,short){const [y,mo]=m.split('-').map(Number);return new Date(y,mo-1,1).toLocaleString('en-US',short?{month:'short',year:'numeric'}:{month:'long',year:'numeric'})}
function dayLabel(d){const [y,m,dd]=d.split('-').map(Number);return new Date(y,m-1,dd).toLocaleString('en-US',{weekday:'short',day:'numeric',month:'short'})}
function newId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}

const ICON_REPEAT='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg>';
const ICON_EDIT='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>';
const S={db:null,live:false,cards:{},expenses:{},recurring:{},accounts:{},moves:{},settings:null,loaded:{},made:new Set(),running:false,seeding:false,acct:null,
  view:'overview',month:ym(new Date()),tab:'Virtual',sel:null,faceId:null,
  fCat:'all',fCard:'all',confirm:null,pending:false};
const VIEWS=['overview','accounts','stats','cards','budgets','activity'];
const ACCT_TYPES={
  cash:{label:'Cash',color:'var(--c3)',path:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>'},
  bank:{label:'Bank',color:'var(--c1)',path:'<path d="M3 10h18L12 4z"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>'},
  savings:{label:'Savings',color:'var(--c4)',path:'<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>'},
  emergency:{label:'Emergency fund',color:'var(--c8)',path:'<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="M12 9v6M9 12h6"/>'},
  other:{label:'Others',color:'var(--c7)',path:'<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z"/><path d="M16 14h.01"/>'}};
const DEFAULT_ACCTS=[['cash','Cash'],['bank','Bank'],['savings','Savings'],['emergency','Emergency fund'],['other','Others']];

function cats(){return (S.settings&&Array.isArray(S.settings.categories)&&S.settings.categories.length)?S.settings.categories:DEFAULT_CATS}
function cur(){return (S.settings&&S.settings.currency)||'NT$'}
function money(n){const v=Math.round((Number(n)||0)*100)/100;const c=cur();return c+(c.length>1?' ':'')+v.toLocaleString('en-US',{maximumFractionDigits:2})}
function catOf(id){return cats().find(c=>c.id===id)}
function catName(id){const c=catOf(id);return c?c.name:'Uncategorized'}
function catColor(id){const i=cats().findIndex(c=>c.id===id);return i<0?'var(--muted)':'var(--c'+((i%8)+1)+')'}
function cardList(){return Object.entries(S.cards).map(([id,c])=>Object.assign({id},c)).sort((a,b)=>(a.order||0)-(b.order||0))}
function expList(){return Object.entries(S.expenses).map(([id,e])=>Object.assign({id},e))}
function monthExp(){return expList().filter(e=>String(e.date||'').startsWith(S.month)).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.createdAt||0)-(a.createdAt||0))}
function sum(a){return a.reduce((s,e)=>s+(Number(e.amount)||0),0)}
function pctClass(p){return p>100?'bad':p>85?'warn':''}
function dim(m){const [y,mo]=m.split('-').map(Number);return new Date(y,mo,0).getDate()}
function addMonths(m,n){const [y,mo]=m.split('-').map(Number);return ym(new Date(y,mo-1+n,1))}
function ordinal(n){const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])}
function recList(){return Object.entries(S.recurring).map(([id,r])=>Object.assign({id},r)).sort((a,b)=>(a.day||0)-(b.day||0))}
function acctList(){return Object.entries(S.accounts).map(([id,a])=>Object.assign({id},a)).sort((a,b)=>(a.order||0)-(b.order||0))}
function moveList(){return Object.entries(S.moves).map(([id,m])=>Object.assign({id},m))}
function acctIcon(type,cls){const T=ACCT_TYPES[type]||ACCT_TYPES.other;return '<span class="'+(cls||'ai')+'" style="color:'+T.color+';background:color-mix(in srgb,'+T.color+' 15%,transparent)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+T.path+'</svg></span>'}
/* Balance = starting amount + money added + transfers in − transfers out − expenses paid from it. */
function balance(id){
  const a=S.accounts[id];if(!a)return 0;let b=Number(a.start)||0;
  moveList().forEach(m=>{const v=Number(m.amount)||0;if(m.kind==='transfer'){if(m.toId===id)b+=v;if(m.fromId===id)b-=v}else if(m.toId===id)b+=v});
  expList().forEach(e=>{if(e.accountId===id)b-=Number(e.amount)||0});
  return Math.round(b*100)/100;
}
function acctFlow(id,m){
  let inn=0,out=0;
  moveList().forEach(x=>{if(!String(x.date||'').startsWith(m))return;const v=Number(x.amount)||0;
    if(x.kind==='transfer'){if(x.toId===id)inn+=v;if(x.fromId===id)out+=v}
    else if(x.toId===id){if(v>=0)inn+=v;else out-=v}});
  expList().forEach(e=>{if(e.accountId===id&&String(e.date||'').startsWith(m))out+=Number(e.amount)||0});
  return {inn,out};
}
function totalMoney(){return acctList().reduce((s,a)=>s+balance(a.id),0)}
function acctName(id){const a=S.accounts[id];return a?a.name:'Removed account'}
function paidLabel(x){const card=S.cards[x.cardId];if(card)return esc(card.name)+' ··'+esc(card.last4||'');if(x.cardId)return 'Removed card';const a=S.accounts[x.accountId];return a?esc(a.name):'Cash / other'}
function payOptions(cur){
  const cl=cardList(),al=acctList();let h='';
  if(al.length)h+='<optgroup label="Money">'+al.map(a=>'<option value="a:'+a.id+'"'+(cur==='a:'+a.id?' selected':'')+'>'+esc(a.name)+' · '+esc(money(balance(a.id)))+' left</option>').join('')+'</optgroup>';
  if(cl.length)h+='<optgroup label="Cards">'+cl.map(c=>'<option value="c:'+c.id+'"'+(c.frozen?' disabled':'')+(cur==='c:'+c.id?' selected':'')+'>'+esc(c.name)+' ··'+esc(c.last4||'')+(c.frozen?' (frozen)':c.accountId&&S.accounts[c.accountId]?' · from '+esc(S.accounts[c.accountId].name):'')+'</option>').join('')+'</optgroup>';
  h+='<option value=""'+(!cur?' selected':'')+'>Not tracked</option>';
  return h;
}
function payValue(x){return x.cardId?'c:'+x.cardId:x.accountId?'a:'+x.accountId:''}
function readPay(v){v=v||'';if(v.startsWith('c:')){const id=v.slice(2),c=S.cards[id];return {cardId:id,accountId:(c&&c.accountId)||''}}if(v.startsWith('a:'))return {cardId:'',accountId:v.slice(2)};return {cardId:'',accountId:''}}
function defaultPay(){
  if(S.lastPay&&(S.lastPay.startsWith('a:')?S.accounts[S.lastPay.slice(2)]:S.cards[S.lastPay.slice(2)]&&!S.cards[S.lastPay.slice(2)].frozen))return S.lastPay;
  if(S.accounts.cash)return 'a:cash';const a=acctList()[0];return a?'a:'+a.id:'';
}
function seedAccounts(){
  if(S.seeding||!S.loaded.accts||!S.loaded.set||!S.db)return;
  if(Object.keys(S.accounts).length||(S.settings&&S.settings.accountsSeeded))return;
  S.seeding=true;
  DEFAULT_ACCTS.forEach(([type,name],i)=>put('accounts',type,{name,type,start:0,order:i+1,createdAt:Date.now()}));
  saveSettings({accountsSeeded:true});
}
function dueDate(r,m){return m+'-'+String(Math.min(r.day||1,dim(m))).padStart(2,'0')}
const EVERY=[[1,'Every month'],[2,'Every 2 months'],[3,'Every 3 months'],[4,'Every 4 months'],[6,'Every 6 months'],[12,'Every year']];
function every(r){const n=Number(r&&r.every)||1;return n>0?n:1}
function monthsBetween(a,b){const [ya,ma]=a.split('-').map(Number),[yb,mb]=b.split('-').map(Number);return (yb-ya)*12+(mb-ma)}
function onCycle(r,m){const d=monthsBetween(r.startMonth||m,m);return d>=0&&d%every(r)===0}
function nextCycle(r,from){if(!r.startMonth)return from;if(from<=r.startMonth)return r.startMonth;const d=monthsBetween(r.startMonth,from),n=every(r);return addMonths(r.startMonth,Math.ceil(d/n)*n)}
function nextDue(r){
  const cm=ym(new Date());let m=nextCycle(r,cm);
  if(S.expenses['r-'+r.id+'-'+m]||(r.skipped||[]).includes(m))m=addMonths(m,every(r));
  return m;
}
function freqLabel(r){const n=every(r);return n===1?'Every month':n===12?'Every year':'Every '+n+' months'}
function everyOptions(sel){return EVERY.map(([n,l])=>'<option value="'+n+'"'+(n===sel?' selected':'')+'>'+l+'</option>').join('')}
function recStatus(r,m){
  const e=S.expenses['r-'+r.id+'-'+m];
  if(e)return {k:'paid',label:'Logged '+dayLabel(e.date),cls:'ok'};
  if((r.skipped||[]).includes(m))return {k:'skip',label:'Skipped',cls:''};
  if(r.active===false)return {k:'paused',label:'Paused',cls:''};
  if(m<(r.startMonth||m))return {k:'later',label:'Starts '+monthLabel(r.startMonth,true),cls:''};
  if(!onCycle(r,m))return {k:'off',label:'Next '+monthLabel(nextCycle(r,m),true),cls:''};
  const due=dueDate(r,m),card=S.cards[r.cardId];
  if(due<=today())return card&&card.frozen?{k:'frozen',label:'Waiting · card frozen',cls:'ice'}:{k:'due',label:'Due',cls:'warn'};
  return {k:'upcoming',label:'Due '+dayLabel(due),cls:'warn'};
}
/* Logs each active recurring item once per month, on its day. Ids are fixed per month, so it never doubles up. */
function runRecurring(){
  if(S.running||!(S.loaded.exp&&S.loaded.rec&&S.loaded.cards))return;
  S.running=true;
  try{
    const cm=ym(new Date()),td=today();
    recList().forEach(r=>{
      if(r.active===false||!r.startMonth||!(Number(r.amount)>0))return;
      let m=r.startMonth,guard=0;
      while(m<=cm&&guard++<60){
        const id='r-'+r.id+'-'+m,due=dueDate(r,m),card=S.cards[r.cardId];
        if(due<=td&&!S.expenses[id]&&!S.made.has(id)&&!(r.skipped||[]).includes(m)&&!(card&&card.frozen)){
          S.made.add(id);
          const acc=r.cardId&&card?(card.accountId||''):(r.accountId||'');
          put('expenses',id,{amount:Number(r.amount),category:r.category,cardId:r.cardId||'',accountId:acc,note:r.note||'',date:due,createdAt:Date.now(),recurringId:r.id,example:!!r.example});
        }
        m=addMonths(m,every(r));
      }
    });
  }finally{S.running=false}
}

/* ---------- store ---------- */
function toast(msg){
  const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toast.t);clearTimeout(toast.h);
  requestAnimationFrame(()=>t.classList.add('show'));
  toast.t=setTimeout(()=>{t.classList.remove('show');toast.h=setTimeout(()=>{t.hidden=true},260)},3200);
}
function errMsg(e){
  if(e&&e.code==='permission-denied')return "You don't have permission to save that. Try logging out and back in.";
  if(e&&e.code==='resource-exhausted')return 'Too many changes at once. Wait a moment and try again.';
  return "That change didn't save. Check your connection and try again.";
}
function put(col,id,data){if(S.db)S.db.put(col,id,data).catch(e=>toast(errMsg(e)))}
function patch(col,id,data){if(S.db)S.db.patch(col,id,data).catch(e=>toast(errMsg(e)))}
function del(col,id){if(S.db)S.db.del(col,id).catch(e=>toast(errMsg(e)))}
function saveSettings(partial){
  const next=Object.assign({},S.settings||{},{currency:cur(),categories:cats(),example:!!(S.settings&&S.settings.example)},partial);
  if(S.db)S.db.put('settings','moss',next).catch(e=>toast(errMsg(e)));
}
function setSync(state){
  const d=$('#sync-dot'),t=$('#sync-txt');
  if(state==='live'){d.style.background='var(--accent)';t.textContent='Saved to your account'}
  else if(state==='offline'){d.style.background='var(--warn)';t.textContent='Offline · will sync later'}
  else{d.style.background='var(--track)';t.textContent='Connecting…'}
}
let unsubs=[];
function disconnect(){
  unsubs.forEach(u=>{try{u()}catch(e){}});unsubs=[];
  Object.assign(S,{profile:null,db:null,live:false,cards:{},expenses:{},recurring:{},accounts:{},moves:{},settings:null,loaded:{},made:new Set(),seeding:false,acct:null,lastPay:null,sel:null,faceId:null,confirm:null});
  $('#view').innerHTML='';$('#view').dataset.view='';closeModal();
}
function connect(uid){
  disconnect();
  const store=userStore(uid);S.db=store;S.live=true;setSync('connecting');
  const fail=e=>{setSync('offline');toast(e&&e.code==='permission-denied'?"Couldn't read your data. Check your Firestore rules (see README).":'Lost the connection to your data. Reload to reconnect.')};
  const onCol=(key,flag)=>(data,fromCache)=>{S[key]=data;if(!fromCache){S.loaded[flag]=true;setSync('live')}render()};
  unsubs.push(store.subscribe('cards',onCol('cards','cards'),fail));
  unsubs.push(store.subscribe('expenses',onCol('expenses','exp'),fail));
  unsubs.push(store.subscribe('recurring',onCol('recurring','rec'),fail));
  unsubs.push(store.subscribe('accounts',onCol('accounts','accts'),fail));
  unsubs.push(store.subscribe('moves',onCol('moves','moves'),fail));
  unsubs.push(store.subscribeDoc('settings','moss',d=>{S.settings=d;S.loaded.set=true;render()},fail));
  unsubs.push(store.subscribeDoc('profile','main',d=>{S.profile=d;paintUser();render()},fail));
  render();
}
window.addEventListener('offline',()=>{if(S.db)setSync('offline')});
window.addEventListener('online',()=>{if(S.db)setSync('live')});

/* ---------- render ---------- */
function render(){
  runRecurring();seedAccounts();
  const view=$('#view'),a=document.activeElement;
  if(a&&view.contains(a)&&/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)){S.pending=true;return}
  S.pending=false;
  const ready=!!(S.loaded.exp&&S.loaded.cards&&S.loaded.rec&&S.loaded.accts&&S.loaded.set);
  const key=S.view+'|'+(S.view==='account'?S.pid:'')+'|'+S.month+'|'+ready,enter=key!==S.lastKey;S.lastKey=key;
  view.classList.remove('enter');
  document.querySelectorAll('[data-nav]').forEach(el=>{if(el.dataset.nav===(S.view==='account'?'accounts':S.view))el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')});
  document.querySelectorAll('.m-label').forEach(el=>el.textContent=monthLabel(S.month,el.closest('.mtop')));
  const ex=monthExp();$('#m-total').textContent=money(sum(ex))+' this month';
  $('#greet').textContent=greeting();
  $('#today-lbl').textContent=new Date().toLocaleString('en-US',{weekday:'long',day:'numeric',month:'long'})+' · '+({overview:'Overview',account:(S.accounts[S.pid]||{}).name||'Account',accounts:'My money',stats:'Statistics',cards:'Cards',budgets:'Budgets',activity:'Activity'})[S.view];
  $('#tip').hidden=true;
  if(S.view==='cards'){renderCards();afterRender(enter);return}
  view.dataset.view=S.view;
  if(S.view==='stats'){view.innerHTML=vStats();fillStats();afterRender(enter);return}
  if(S.view==='account'){view.innerHTML=vAccount();const c=$('#ch-bal');if(c)c.innerHTML=drawBal(c.clientWidth);afterRender(enter);return}
  view.innerHTML=S.view==='accounts'?vAccounts():S.view==='budgets'?vBudgets():S.view==='activity'?vActivity():vOverview();
  afterRender(enter);
}

const RM=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function afterRender(enter){
  const view=$('#view');
  if(!enter||RM)return;
  void view.offsetWidth;view.classList.add('enter');
  clearTimeout(afterRender.t);afterRender.t=setTimeout(()=>view.classList.remove('enter'),1200);
  // count big money figures up from zero
  view.querySelectorAll('.big, .acct .bal, .mchip b, .kpi b').forEach(el=>{
    const txt=el.textContent.trim(),v=parseFloat(txt.replace(/[^0-9.\-]/g,''));
    if(!isFinite(v)||money(v)!==txt.replace(/^\+/,''))return;
    const plus=txt.startsWith('+')?'+':'',t0=performance.now(),dur=900;
    const step=now=>{const k=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-k,3);el.textContent=plus+money(Math.round(v*e*100)/100);if(k<1&&el.isConnected)requestAnimationFrame(step)};
    el.textContent=plus+money(0);requestAnimationFrame(step);
  });
}

/* Greeting: changes with the time of day and uses the name you chose (or your account name). */
function firstName(){
  const nick=S.settings&&String(S.settings.nickname||'').trim();if(nick)return nick;
  const pn=S.profile&&String(S.profile.name||'').trim();if(pn)return pn.split(/\s+/)[0];
  const u=S.user;if(!u)return '';
  if(u.displayName)return u.displayName.trim().split(/\s+/)[0];
  const local=String(u.email||'').split('@')[0].replace(/[^A-Za-z]+/g,' ').trim().split(' ')[0]||'';
  return local?local[0].toUpperCase()+local.slice(1).toLowerCase():'';
}
function greeting(){
  const h=new Date().getHours(),g=h<12?'Good morning':h<18?'Good afternoon':'Good evening',n=firstName();
  return n?g+', '+n:g;
}
setInterval(()=>{const el=$('#greet');if(el&&S.user)el.textContent=greeting()},60000);

/* ---------- statistics ---------- */
function monthTotal(m){return sum(expList().filter(e=>String(e.date||'').startsWith(m)))}
function totalBudget(){return cats().reduce((s,c)=>s+(Number(c.budget)||0),0)}
function short(n){const c=cur(),a=Math.abs(n);const v=a>=1e6?(Math.round(n/1e5)/10)+'M':a>=1000?(Math.round(n/100)/10)+'k':String(Math.round(n));return c+(c.length>1?' ':'')+v}
function niceMax(v){if(!(v>0))return 1000;const p=Math.pow(10,Math.floor(Math.log10(v))),n=v/p;return (n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*p}
function barPath(x,y,w,h,r){if(h<=0)return '';r=Math.min(r,w/2,h);return 'M'+x+','+(y+h)+'V'+(y+r)+'Q'+x+','+y+' '+(x+r)+','+y+'H'+(x+w-r)+'Q'+(x+w)+','+y+' '+(x+w)+','+(y+r)+'V'+(y+h)+'Z'}
function daysElapsed(m){const cm=ym(new Date());return m===cm?new Date().getDate():m<cm?dim(m):0}
function yAxis(W,padL,padR,top,ih,max){
  return [0,.5,1].map(f=>{const y=top+ih-f*ih;return '<line x1="'+padL+'" x2="'+(W-padR)+'" y1="'+y+'" y2="'+y+'" stroke="var(--grid)" stroke-width="1"/><text x="'+(padL-8)+'" y="'+(y+4)+'" text-anchor="end">'+esc(short(max*f))+'</text>'}).join('');
}
function vStats(){
  const m=S.month,prev=addMonths(m,-1),ex=monthExp(),spent=sum(ex),pspent=monthTotal(prev),budget=totalBudget();
  const days=daysElapsed(m),avg=days?spent/days:0,mname=monthLabel(m).split(' ')[0],pname=monthLabel(prev).split(' ')[0];
  let html=localBanner()+'<div class="headrow"><div><h1>Statistics</h1><p>How your spending in '+esc(monthLabel(m))+' compares.</p></div></div>';
  if(!ex.length&&!expList().length)return html+'<div class="empty"><b>No spending to show yet</b>Add a few expenses and your charts appear here.</div>';
  const byDay={};ex.forEach(e=>{byDay[e.date]=(byDay[e.date]||0)+(Number(e.amount)||0)});
  const big=Object.entries(byDay).sort((a,b)=>b[1]-a[1])[0];
  const rec=sum(ex.filter(e=>e.recurringId)),recPct=spent>0?Math.round(rec/spent*100):0;
  let delta='No spending in '+pname+' to compare';
  if(pspent>0){const d=(spent-pspent)/pspent*100;delta=Math.abs(d)<1?'About the same as '+pname:(Math.round(Math.abs(d))+'% '+(d>0?'more':'less')+' than '+pname)}
  html+='<div class="kpis">'
    +'<div class="kpi"><span>Spent in '+esc(mname)+'</span><b class="num">'+esc(money(spent))+'</b><small>'+esc(delta)+'</small></div>'
    +'<div class="kpi"><span>Average per day</span><b class="num">'+esc(money(avg))+'</b><small>'+(days?'Over '+days+' day'+(days>1?'s':''):'Month hasn\'t started')+'</small></div>'
    +'<div class="kpi"><span>Biggest day</span><b class="num">'+(big?esc(money(big[1])):'—')+'</b><small>'+(big?esc(dayLabel(big[0])):'No expenses yet')+'</small></div>'
    +'<div class="kpi"><span>Monthly bills</span><b class="num">'+recPct+'%</b><small>'+esc(money(rec))+' of this month is recurring</small></div></div>';
  html+='<section class="panel"><div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:center"><h2>LAST 6 MONTHS</h2><div class="legend"><span><i class="sw" style="background:var(--chart);height:10px;width:10px;border-radius:3px"></i>Spent</span>'+(budget>0?'<span><i class="sw" style="background:repeating-linear-gradient(90deg,var(--muted) 0 4px,transparent 4px 7px)"></i>Monthly budget</span>':'')+'</div></div><div class="chart" id="ch-trend" role="img" aria-label="Spending for the last six months"></div>'
    +'<details class="tbl"><summary>Show as table</summary><table><thead><tr><th>Month</th><th>Spent</th></tr></thead><tbody>'+Array.from({length:6},(_,i)=>addMonths(m,i-5)).map(x=>'<tr><td>'+esc(monthLabel(x))+'</td><td class="num">'+esc(money(monthTotal(x)))+'</td></tr>').join('')+'</tbody></table></details></section>';
  html+='<section class="panel"><div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:center"><h2>SPENDING PACE IN '+esc(mname.toUpperCase())+'</h2><div class="legend"><span><i class="sw" style="background:var(--chart)"></i>Spent so far</span>'+(budget>0?'<span><i class="sw" style="background:repeating-linear-gradient(90deg,var(--muted) 0 4px,transparent 4px 7px)"></i>Even pace to budget</span>':'')+'</div></div><div class="chart" id="ch-pace" role="img" aria-label="Running total of spending this month"></div></section>';
  const byCat=cats().map(c=>({c,s:sum(ex.filter(e=>e.category===c.id)),p:sum(expList().filter(e=>e.category===c.id&&String(e.date||'').startsWith(prev)))})).filter(x=>x.s>0||x.p>0).sort((a,b)=>b.s-a.s);
  const maxC=Math.max(1,...byCat.map(x=>x.s));
  html+='<div class="grid2"><section class="panel"><h2>BY CATEGORY</h2>'+(spent>0?drawDonut(byCat.filter(x=>x.s>0),spent,ex):'')+(byCat.length?'<div>'+byCat.map(({c,s,p})=>{const sh=spent>0?Math.round(s/spent*100):0,d=s-p;
      const dtxt=p>0||s>0?(d===0?'Same as '+pname:(d>0?'+':'−')+money(Math.abs(d))+' vs '+pname):'';
      return '<div class="share"><span class="nm"><span class="dot" style="background:'+catColor(c.id)+'"></span><span>'+esc(c.name)+'</span></span><div class="bar"><i style="width:'+(s/maxC*100)+'%;background:'+catColor(c.id)+'"></i></div><span class="rt num"><b>'+esc(money(s))+' · '+sh+'%</b><small>'+esc(dtxt)+'</small></span></div>'}).join('')+'</div>':'<div class="empty"><b>No spending this month</b></div>')+'</section>';
  html+='<section class="panel"><h2>AVERAGE BY WEEKDAY</h2><div class="chart" id="ch-week" role="img" aria-label="Average spending per weekday this month"></div><p class="muted" style="margin:0;font-size:12px">Average for each weekday so far in '+esc(mname)+', monthly bills included.</p></section></div>';
  const top=ex.slice().sort((a,b)=>(Number(b.amount)||0)-(Number(a.amount)||0)).slice(0,5);
  html+='<section class="panel"><h2>BIGGEST EXPENSES</h2>'+(top.length?'<div>'+top.map(e=>txnRow(e,false)).join('')+'</div>':'<div class="empty"><b>Nothing logged in '+esc(mname)+' yet</b></div>')+'</section>';
  return html;
}
function drawDonut(items,spent,ex){
  const other=sum(ex.filter(e=>!catOf(e.category)));
  const segs=items.map(({c,s})=>({name:c.name,v:s,color:catColor(c.id)}));
  if(other>0)segs.push({name:'Uncategorized',v:other,color:'var(--muted)'});
  const size=210,cx=size/2,R=96,r=60,mid=(R+r)/2,sw=R-r,C=2*Math.PI*mid,gap=segs.length>1?2:0;
  let acc=0,arcs='';
  segs.forEach(sg=>{
    const len=sg.v/spent*C,draw=Math.max(0.5,len-gap),pct=Math.round(sg.v/spent*100);
    arcs+='<circle cx="'+cx+'" cy="'+cx+'" r="'+mid+'" fill="none" stroke="'+sg.color+'" stroke-width="'+sw+'" stroke-dasharray="'+draw+' '+(C-draw)+'" stroke-dashoffset="'+(-acc)+'" transform="rotate(-90 '+cx+' '+cx+')" data-tip="'+esc(sg.name+': '+money(sg.v)+' · '+pct+'%')+'" style="cursor:default"><title>'+esc(sg.name+' '+pct+'%')+'</title></circle>';
    acc+=len;
  });
  const top=segs[0],topPct=Math.round(top.v/spent*100);
  return '<div style="display:flex;justify-content:center;padding:4px 0 8px"><svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'" role="img" aria-label="Share of spending by category. Biggest is '+esc(top.name)+' at '+topPct+' percent.">'
    +'<circle cx="'+cx+'" cy="'+cx+'" r="'+mid+'" fill="none" stroke="var(--bar)" stroke-width="'+sw+'"/>'+arcs
    +'<text x="'+cx+'" y="'+(cx-8)+'" text-anchor="middle" style="font-family:var(--font);font-size:12px;fill:var(--muted)">Total spent</text>'
    +'<text x="'+cx+'" y="'+(cx+16)+'" text-anchor="middle" style="font-family:var(--font);font-size:'+(money(spent).length>11?17:20)+'px;font-weight:800;fill:var(--fg)">'+esc(short(spent))+'</text>'
    +'</svg></div>';
}
function fillStats(){
  const t=$('#ch-trend'),p=$('#ch-pace'),w=$('#ch-week');
  if(t)t.innerHTML=drawTrend(t.clientWidth);
  if(p)p.innerHTML=drawPace(p.clientWidth);
  if(w)w.innerHTML=drawWeek(w.clientWidth);
}
function drawTrend(W){
  W=Math.max(260,W);const H=210,padL=58,padR=8,top=12,bot=28,iw=W-padL-padR,ih=H-top-bot;
  const months=Array.from({length:6},(_,i)=>addMonths(S.month,i-5)),vals=months.map(monthTotal),budget=totalBudget();
  const max=niceMax(Math.max(budget,...vals));const band=iw/6,bw=Math.min(44,band*.56);
  let s='<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">'+yAxis(W,padL,padR,top,ih,max);
  months.forEach((mo,i)=>{const v=vals[i],h=v/max*ih,x=padL+band*i+(band-bw)/2,y=top+ih-h,cur=mo===S.month;
    s+='<path d="'+barPath(x,y,bw,h,4)+'" fill="'+(cur?'var(--chart)':'color-mix(in srgb,var(--chart) 42%,var(--surface))')+'"/>';
    s+='<text x="'+(padL+band*i+band/2)+'" y="'+(H-8)+'" text-anchor="middle" style="'+(cur?'fill:var(--fg);font-weight:700':'')+'">'+esc(monthLabel(mo,true).split(' ')[0])+'</text>';
    if(cur&&v>0)s+='<text x="'+(padL+band*i+band/2)+'" y="'+(y-6)+'" text-anchor="middle" style="fill:var(--fg);font-weight:700">'+esc(short(v))+'</text>';
  });
  if(budget>0){const y=top+ih-budget/max*ih;s+='<line x1="'+padL+'" x2="'+(W-padR)+'" y1="'+y+'" y2="'+y+'" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 3"/>'}
  months.forEach((mo,i)=>{s+='<rect x="'+(padL+band*i)+'" y="'+top+'" width="'+band+'" height="'+ih+'" fill="transparent" data-tip="'+esc(monthLabel(mo)+': '+money(vals[i])+(budget>0?' of '+money(budget):''))+'"/>'});
  return s+'</svg>';
}
function drawPace(W){
  W=Math.max(260,W);const m=S.month,D=dim(m),el=daysElapsed(m),budget=totalBudget();
  if(!el)return '<div class="empty"><b>'+esc(monthLabel(m))+' hasn\'t started yet</b></div>';
  const H=210,padL=58,padR=12,top=12,bot=28,iw=W-padL-padR,ih=H-top-bot;
  const daily=Array.from({length:D},(_,i)=>{const d=m+'-'+String(i+1).padStart(2,'0');return sum(expList().filter(e=>e.date===d))});
  const cum=[];daily.reduce((a,v,i)=>(cum[i]=a+v),0);
  const max=niceMax(Math.max(budget,cum[el-1]||0));
  const X=i=>padL+(D>1?i/(D-1):0)*iw,Y=v=>top+ih-v/max*ih;
  let s='<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">'+yAxis(W,padL,padR,top,ih,max);
  [1,8,15,22,D].forEach(d=>{s+='<text x="'+X(d-1)+'" y="'+(H-8)+'" text-anchor="middle">'+d+'</text>'});
  if(budget>0)s+='<line x1="'+X(0)+'" y1="'+Y(budget/D)+'" x2="'+X(D-1)+'" y2="'+Y(budget)+'" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 3"/>';
  const pts=cum.slice(0,el).map((v,i)=>X(i)+','+Y(v));
  s+='<path d="M'+X(0)+','+Y(0)+'L'+pts.join('L')+'L'+X(el-1)+','+Y(0)+'Z" fill="color-mix(in srgb,var(--chart) 14%,transparent)"/>';
  s+='<path d="M'+pts.join('L')+'" fill="none" stroke="var(--chart)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
  s+='<line id="pace-cross" x1="0" x2="0" y1="'+top+'" y2="'+(top+ih)+'" stroke="var(--muted)" stroke-width="1" visibility="hidden"/>';
  s+='<circle cx="'+X(el-1)+'" cy="'+Y(cum[el-1])+'" r="5" fill="var(--chart)" stroke="var(--surface)" stroke-width="2"/>';
  const lx=Math.min(X(el-1),W-padR-70);
  s+='<text x="'+lx+'" y="'+Math.max(top+10,Y(cum[el-1])-10)+'" style="fill:var(--fg);font-weight:700">'+esc(short(cum[el-1]))+'</text>';
  const step=D>1?iw/(D-1):iw;
  for(let i=0;i<el;i++){const d=m+'-'+String(i+1).padStart(2,'0');
    s+='<rect x="'+(X(i)-step/2)+'" y="'+top+'" width="'+step+'" height="'+ih+'" fill="transparent" data-cross="pace-cross" data-cx="'+X(i)+'" data-tip="'+esc(dayLabel(d)+': '+money(daily[i])+' · '+money(cum[i])+' so far'+(budget>0?' (pace '+money(budget/D*(i+1))+')':''))+'"/>'}
  return s+'</svg>';
}
function drawWeek(W){
  W=Math.max(240,W);const m=S.month,el=daysElapsed(m);
  if(!el)return '<div class="empty"><b>No days to average yet</b></div>';
  const names=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],tot=[0,0,0,0,0,0,0],cnt=[0,0,0,0,0,0,0];
  const [y,mo]=m.split('-').map(Number);
  for(let d=1;d<=el;d++){const wd=(new Date(y,mo-1,d).getDay()+6)%7;cnt[wd]++;tot[wd]+=sum(expList().filter(e=>e.date===m+'-'+String(d).padStart(2,'0')))}
  const avg=tot.map((t,i)=>cnt[i]?t/cnt[i]:0),hi=Math.max(...avg);
  const H=190,padL=52,padR=4,top=12,bot=26,iw=W-padL-padR,ih=H-top-bot,max=niceMax(hi),band=iw/7,bw=Math.min(30,band*.6);
  let s='<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">'+yAxis(W,padL,padR,top,ih,max);
  avg.forEach((v,i)=>{const h=v/max*ih,x=padL+band*i+(band-bw)/2,isHi=v===hi&&v>0;
    s+='<path d="'+barPath(x,top+ih-h,bw,h,4)+'" fill="'+(isHi?'var(--chart)':'color-mix(in srgb,var(--chart) 42%,var(--surface))')+'"/>';
    s+='<text x="'+(padL+band*i+band/2)+'" y="'+(H-8)+'" text-anchor="middle" style="'+(isHi?'fill:var(--fg);font-weight:700':'')+'">'+names[i]+'</text>';
    s+='<rect x="'+(padL+band*i)+'" y="'+top+'" width="'+band+'" height="'+ih+'" fill="transparent" data-tip="'+esc(names[i]+': '+money(v)+' on average')+'"/>'});
  return s+'</svg>';
}

function exampleBanner(){
  if(!(S.settings&&S.settings.example))return '';
  return '<div class="banner"><p><b>These are example cards and expenses.</b> Clear them to start with your own, or edit them as you go.</p><button class="btn small primary" data-act="clear-examples">Clear examples</button><button class="btn small" data-act="keep-examples">Keep them</button></div>';
}
function localBanner(){return ''}
function txnRow(e,withDel){
  const card=S.cards[e.cardId];const c=catColor(e.category);
  const sub=(e.recurringId?'Recurring · ':'')+esc(catName(e.category))+' · '+paidLabel(e)+(withDel?'':' · '+dayLabel(e.date));
  let right='<span class="amt num">−'+esc(money(e.amount))+'</span>';
  if(withDel){
    right+=S.confirm==='exp:'+e.id
      ?'<button class="btn small danger solid" data-act="del-exp" data-id="'+e.id+'">Delete</button><button class="btn small" data-act="cancel">Keep</button>'
      :'<button class="iconbtn" data-act="ask" data-key="exp:'+e.id+'" aria-label="Delete expense">'+ICON_TRASH+'</button>';
  }
  return '<div class="txn"><span class="ic" style="color:'+c+';background:color-mix(in srgb,'+c+' 14%,transparent)">'+esc(catName(e.category).slice(0,1))+'</span><div class="tx"><b>'+esc(e.note||catName(e.category))+'</b><span>'+sub+'</span></div>'+right+'</div>';
}

function vOverview(){
  const ex=monthExp(),spent=sum(ex),budget=cats().reduce((s,c)=>s+(Number(c.budget)||0),0);
  const left=budget-spent,p=budget>0?spent/budget*100:0;
  const now=new Date(),cm=ym(now),[y,m]=S.month.split('-').map(Number),dim=new Date(y,m,0).getDate();
  const daysLeft=S.month===cm?dim-now.getDate()+1:S.month>cm?dim:0;
  const upcoming=recList().map(r=>({r,st:recStatus(r,S.month)})).filter(x=>['upcoming','due','frozen'].includes(x.st.k));
  const upSum=upcoming.reduce((s,x)=>s+(Number(x.r.amount)||0),0);
  const free=left-upSum;
  const perDay=free>0&&daysLeft>0?free/daysLeft:0;
  const mname=monthLabel(S.month).split(' ')[0];
  let html=localBanner()+exampleBanner();
  html+='<div class="headrow"><div><h1>Overview</h1><p>Where your money went in '+esc(monthLabel(S.month))+'.</p></div><button class="btn primary deskonly" data-act="add"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Add expense</button></div>';
  html+='<section class="hero" aria-label="Month summary"><div class="main"><span class="muted" style="font-weight:600">Spent in '+esc(mname)+'</span><span class="big num">'+esc(money(spent))+'</span>'
    +(budget>0?'<span class="muted num">of '+esc(money(budget))+' budget'+(p>100?' · <span class="pill bad">Over by '+esc(money(-left))+'</span>':'')+'</span><div class="bar"><i class="'+pctClass(p)+'" style="width:'+Math.min(100,p)+'%"></i></div>':'<span class="muted">No budget set yet. <a href="#budgets" style="color:var(--accent);font-weight:700">Set your budgets</a></span>')
    +'</div><div class="stats"><div class="stat"><span>Left to spend</span><b class="num" style="color:'+(left<0?'var(--bad)':'var(--fg)')+'">'+esc(money(Math.max(0,left)))+'</b></div><div class="stat"><span>'+(daysLeft>0?'Per day · '+daysLeft+' days left':'Month closed')+'</span><b class="num">'+(daysLeft>0?esc(money(perDay)):'—')+'</b></div><div class="stat"><span>Bills still coming</span><b class="num">'+esc(money(upSum))+'</b></div></div></section>';
  const al=acctList();
  if(al.length){
    html+='<section class="panel"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h2>YOUR MONEY · <span class="num" style="color:var(--fg)">'+esc(money(totalMoney()))+'</span></h2><a href="#accounts" style="color:var(--accent);font-weight:700;font-size:13px">Manage</a></div><div class="moneyrow">'
      +al.map(a=>{const b=balance(a.id);return '<a class="mchip" href="#acct-'+esc(a.id)+'">'+acctIcon(a.type)+'<span class="t"><span>'+esc(a.name)+'</span><b class="num'+(b<0?' neg':'')+'">'+esc(money(b))+'</b></span></a>'}).join('')+'</div></section>';
  }
  if(upcoming.length){
    html+='<section class="panel"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h2>COMING UP IN '+esc(mname.toUpperCase())+'</h2><a href="#budgets" style="color:var(--accent);font-weight:700;font-size:13px">Manage</a></div><div>'
      +upcoming.map(({r,st})=>{return '<div class="txn"><span class="ic" style="color:var(--warn);background:var(--warn-soft)">'+ICON_REPEAT+'</span><div class="tx"><b>'+esc(r.note||catName(r.category))+'</b><span>'+esc(catName(r.category))+' · '+paidLabel(r)+'</span></div><span class="pill '+st.cls+'">'+esc(st.label)+'</span><span class="amt num">'+esc(money(r.amount))+'</span></div>'}).join('')
      +'</div><p class="muted" style="margin:0;font-size:12px">The per-day amount above already sets these aside.</p></section>';
  }
  const byCat=cats().map(c=>({c,s:sum(ex.filter(e=>e.category===c.id))}));
  const other=sum(ex.filter(e=>!catOf(e.category)));
  html+='<div class="grid2"><section class="panel"><h2>BUDGETS BY CATEGORY</h2><div>'
    +byCat.map(({c,s})=>{const b=Number(c.budget)||0,pp=b>0?s/b*100:(s>0?101:0);
      const pill=b>0&&s>b?'<span class="pill bad">Over</span>':b>0&&pp>85?'<span class="pill warn">Almost there</span>':'';
      return '<div class="catrow"><span class="nm"><span class="dot" style="background:'+catColor(c.id)+'"></span><span>'+esc(c.name)+'</span>'+pill+'</span><span class="num muted"><b style="color:var(--fg)">'+esc(money(s))+'</b>'+(b>0?' / '+esc(money(b)):'')+'</span><div class="bar"><i class="'+pctClass(pp)+'" style="width:'+Math.min(100,pp)+'%;'+(pctClass(pp)?'':'background:'+catColor(c.id))+'"></i></div></div>'}).join('')
    +(other>0?'<div class="catrow"><span class="nm"><span class="dot" style="background:var(--c8)"></span><span>Uncategorized</span></span><span class="num"><b>'+esc(money(other))+'</b></span></div>':'')
    +'</div></section>';
  const recent=ex.slice(0,6);
  html+='<section class="panel"><div style="display:flex;justify-content:space-between;align-items:center"><h2>RECENT</h2>'+(ex.length?'<a href="#activity" style="color:var(--accent);font-weight:700;font-size:13px">See all</a>':'')+'</div>'
    +(recent.length?'<div>'+recent.map(e=>txnRow(e,false)).join('')+'</div>':'<div class="empty"><b>No expenses in '+esc(mname)+' yet</b>Tap Add expense to log your first one.</div>')+'</section></div>';
  const cl=cardList();
  if(cl.length){
    html+='<section class="panel"><h2>BY CARD</h2><div>'+cl.map(c=>{const s=sum(ex.filter(e=>e.cardId===c.id)),l=Number(c.limit)||0,pp=l>0?s/l*100:0;
      return '<div class="txn"><span class="mini" style="background:'+(CARD_BG[c.color]||CARD_BG.green)+'"></span><div class="tx"><b>'+esc(c.name)+'</b><span>'+esc(c.kind)+' ··'+esc(c.last4||'')+(c.frozen?' · Frozen':'')+'</span></div><span class="num muted"><b style="color:var(--fg)">'+esc(money(s))+'</b>'+(l>0?' / '+esc(money(l)):'')+'</span>'+(l>0&&pp>100?'<span class="pill bad">Over limit</span>':'')+'</div>'}).join('')+'</div></section>';
  }
  return html;
}

function moneyRow(r){
  const pos=r.amt>=0;
  const del=r.moveId?(S.confirm==='move:'+r.moveId
    ?'<button class="btn small danger solid" data-act="del-move" data-id="'+r.moveId+'">Delete</button><button class="btn small" data-act="cancel">Keep</button>'
    :'<button class="iconbtn" data-act="ask" data-key="move:'+r.moveId+'" aria-label="Delete this entry">'+ICON_TRASH+'</button>'):'';
  return '<div class="txn"><span class="ic" style="color:'+(pos?'var(--accent)':'var(--warn)')+';background:'+(pos?'var(--accent-soft)':'var(--warn-soft)')+'">'+(pos?'+':'−')+'</span><div class="tx"><b>'+esc(r.title)+'</b><span>'+esc(r.sub)+'</span></div><span class="amt num'+(pos?' pos':'')+'">'+(pos?'+':'−')+esc(money(Math.abs(r.amt)))+'</span>'+del+'</div>';
}
function acctHistory(id,m){
  const rows=[];
  moveList().forEach(x=>{if(!String(x.date||'').startsWith(m))return;const v=Number(x.amount)||0,d=dayLabel(x.date);
    if(x.kind==='transfer'){
      if(x.toId===id)rows.push({date:x.date,c:x.createdAt,amt:v,title:x.note||'From '+acctName(x.fromId),sub:'Transfer from '+acctName(x.fromId)+' · '+d,moveId:x.id});
      if(x.fromId===id)rows.push({date:x.date,c:x.createdAt,amt:-v,title:x.note||'To '+acctName(x.toId),sub:'Transfer to '+acctName(x.toId)+' · '+d,moveId:x.id});
    }else if(x.toId===id)rows.push({date:x.date,c:x.createdAt,amt:v,title:x.note||(x.kind==='adjust'?'Balance correction':'Money added'),sub:(x.kind==='adjust'?'Correction':'Added')+' · '+d,moveId:x.id});
  });
  expList().forEach(e=>{if(e.accountId===id&&String(e.date||'').startsWith(m))rows.push({date:e.date,c:e.createdAt,amt:-(Number(e.amount)||0),title:e.note||catName(e.category),sub:'Expense · '+catName(e.category)+(S.cards[e.cardId]?' · '+S.cards[e.cardId].name:'')+' · '+dayLabel(e.date)})});
  return rows.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.c||0)-(a.c||0));
}
function vAccounts(){
  const al=acctList(),m=S.month,mname=monthLabel(m).split(' ')[0];
  if(!S.acct||!S.accounts[S.acct])S.acct=al[0]?al[0].id:null;
  let html='<div class="headrow"><div><h1>My money</h1><p>How much is left in each place. Expenses, money you add and transfers update these automatically.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="money-in">+ Add money</button><button class="btn" data-act="money-tr">'+ICON_REPEAT+'Transfer</button></div></div>';
  if(!al.length)return html+'<div class="empty"><b>'+(S.loaded.accts?'No accounts yet':'Loading your accounts…')+'</b>'+(S.loaded.accts?'<button class="btn primary" style="margin-top:10px" data-act="new-acct">New account</button>':'')+'</div>';
  let tin=0,tout=0;al.forEach(a=>{const f=acctFlow(a.id,m);tin+=f.inn;tout+=f.out});
  const tot=totalMoney();
  html+='<section class="hero" aria-label="Total money"><div class="main"><span class="muted" style="font-weight:600">Total money left</span><span class="big num'+(tot<0?' neg':'')+'">'+esc(money(tot))+'</span><span class="muted">Across '+al.length+' account'+(al.length>1?'s':'')+'</span></div>'
    +'<div class="stats"><div class="stat"><span>Came in · '+esc(mname)+'</span><b class="num" style="color:var(--accent)">+'+esc(money(tin))+'</b></div><div class="stat"><span>Went out · '+esc(mname)+'</span><b class="num">−'+esc(money(tout))+'</b></div></div></section>';
  html+='<div class="acctgrid">'+al.map(a=>{const b=balance(a.id),f=acctFlow(a.id,m);
    return '<a class="acct" href="#acct-'+esc(a.id)+'"><span class="top">'+acctIcon(a.type)+'<span class="nm">'+esc(a.name)+'</span>'+(b<0?'<span class="pill bad">Below zero</span>':'<span class="go" aria-hidden="true">›</span>')+'</span><span class="bal num'+(b<0?' neg':'')+'">'+esc(money(b))+'</span><small class="num">+'+esc(money(f.inn))+' in · −'+esc(money(f.out))+' out in '+esc(mname)+'</small></a>'}).join('')
    +'<button class="acct new" data-act="new-acct">+ New account</button></div>';
  return html;
}
function balanceOn(id,d){
  const a=S.accounts[id];if(!a)return 0;let b=Number(a.start)||0;
  moveList().forEach(m=>{if(String(m.date||'')>d)return;const v=Number(m.amount)||0;if(m.kind==='transfer'){if(m.toId===id)b+=v;if(m.fromId===id)b-=v}else if(m.toId===id)b+=v});
  expList().forEach(e=>{if(e.accountId===id&&String(e.date||'')<=d)b-=Number(e.amount)||0});
  return b;
}
function acctBills(id){return recList().filter(r=>{const c=S.cards[r.cardId];return r.cardId&&c?c.accountId===id:r.accountId===id})}
function vAccount(){
  const id=S.pid,a=S.accounts[id],m=S.month,mname=monthLabel(m).split(' ')[0];
  const back='<a class="back" href="#accounts"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>My money</a>';
  if(!a)return back+'<div class="empty"><b>'+(S.loaded.accts?'This account doesn\'t exist anymore':'Loading…')+'</b>'+(S.loaded.accts?'It may have been deleted. Go back to My money to see your accounts.':'')+'</div>';
  const T=ACCT_TYPES[a.type]||ACCT_TYPES.other,b=balance(id),f=acctFlow(id,m),net=f.inn-f.out;
  let html=back;
  html+='<section class="hero acct-hero" aria-label="'+esc(a.name)+' balance"><div class="main"><span class="acct-id">'+acctIcon(a.type,'ai glass')+'<span><b>'+esc(a.name)+'</b><span>'+(a.name.trim().toLowerCase()===T.label.toLowerCase()?'Account':esc(T.label)+' account')+'</span></span></span><span class="muted" style="font-weight:600;margin-top:6px">Money left</span><span class="big num'+(b<0?' neg':'')+'">'+esc(money(b))+'</span></div>'
    +'<div class="stats"><div class="stat"><span>Came in · '+esc(mname)+'</span><b class="num" style="color:var(--accent)">+'+esc(money(f.inn))+'</b></div><div class="stat"><span>Went out · '+esc(mname)+'</span><b class="num">−'+esc(money(f.out))+'</b></div><div class="stat"><span>Net · '+esc(mname)+'</span><b class="num" style="color:'+(net<0?'var(--bad)':'var(--accent)')+'">'+(net<0?'−':'+')+esc(money(Math.abs(net)))+'</b></div></div></section>';
  html+='<div class="actbar"><button class="btn primary" data-act="money-in" data-id="'+esc(id)+'">+ Add money</button><button class="btn" data-act="money-tr" data-id="'+esc(id)+'">'+ICON_REPEAT+'Transfer</button><button class="btn" data-act="add" data-pay="a:'+esc(id)+'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>Add expense</button><button class="btn" data-act="edit-acct" data-id="'+esc(id)+'">'+ICON_EDIT+'Edit</button></div>';
  // balance chart + where it went
  const ex=expList().filter(e=>e.accountId===id&&String(e.date||'').startsWith(m)),spent=sum(ex);
  const byCat=cats().map(c=>({c,s:sum(ex.filter(e=>e.category===c.id))})).filter(x=>x.s>0).sort((x,y)=>y.s-x.s);
  const other=sum(ex.filter(e=>!catOf(e.category)));if(other>0)byCat.push({c:{id:'',name:'Uncategorized'},s:other});
  html+='<div class="grid2"><section class="panel"><h2>BALANCE IN '+esc(mname.toUpperCase())+'</h2><div class="chart" id="ch-bal" role="img" aria-label="'+esc(a.name)+' balance day by day"></div></section>'
    +'<section class="panel"><h2>WHERE IT WENT</h2>'+(byCat.length?'<div>'+byCat.map(({c,s})=>'<div class="catrow"><span class="nm"><span class="dot" style="background:'+catColor(c.id)+'"></span><span>'+esc(c.name)+'</span></span><span class="num muted"><b style="color:var(--fg)">'+esc(money(s))+'</b> · '+Math.round(s/spent*100)+'%</span><div class="bar"><i style="width:'+(s/spent*100)+'%;background:'+catColor(c.id)+'"></i></div></div>').join('')+'</div>':'<div class="empty"><b>No expenses from '+esc(a.name)+' in '+esc(mname)+'</b>Expenses paid from it show up here.</div>')+'</section></div>';
  // linked cards + bills
  const cards=cardList().filter(c=>c.accountId===id),bills=acctBills(id);
  html+='<div class="grid2"><section class="panel"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h2>CARDS THAT PAY FROM '+esc(a.name.toUpperCase())+'</h2><a href="#cards" style="color:var(--accent);font-weight:700;font-size:13px">Cards</a></div>'
    +(cards.length?'<div>'+cards.map(c=>{const cs=sum(expList().filter(e=>e.cardId===c.id&&String(e.date||'').startsWith(m)));return '<div class="txn"><span class="mini" style="background:'+(CARD_BG[c.color]||CARD_BG.green)+'"></span><div class="tx"><b>'+esc(c.name)+'</b><span>'+esc(c.kind)+' ··'+esc(c.last4||'')+(c.frozen?' · Frozen':'')+'</span></div><span class="num muted"><b style="color:var(--fg)">'+esc(money(cs))+'</b> in '+esc(mname)+'</span></div>'}).join('')+'</div>'
      :'<div class="empty"><b>No cards linked</b>On the Cards page, set a card to pay from '+esc(a.name)+'.</div>')+'</section>'
    +'<section class="panel"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h2>BILLS FROM '+esc(a.name.toUpperCase())+'</h2><a href="#budgets" style="color:var(--accent);font-weight:700;font-size:13px">Manage</a></div>'
    +(bills.length?'<div>'+bills.map(r=>{const st=recStatus(r,m);return '<div class="txn"><span class="ic" style="color:var(--accent);background:var(--accent-soft)">'+ICON_REPEAT+'</span><div class="tx"><b>'+esc(r.note||catName(r.category))+'</b><span>'+freqLabel(r)+' on the '+ordinal(r.day||1)+'</span></div><span class="pill '+st.cls+'">'+esc(st.label)+'</span><span class="amt num">'+esc(money(r.amount))+'</span></div>'}).join('')+'</div>'
      :'<div class="empty"><b>No recurring bills</b>Bills set to be paid from '+esc(a.name)+' show up here.</div>')+'</section></div>';
  // history grouped by day
  const rows=acctHistory(id,m),days={};rows.forEach(r=>{(days[r.date]=days[r.date]||[]).push(r)});
  html+='<section class="panel daylist"><h2 style="margin-bottom:4px">HISTORY · '+esc(mname.toUpperCase())+'</h2>'
    +(rows.length?Object.keys(days).sort().reverse().map(d=>{const net=days[d].reduce((t,r)=>t+r.amt,0);return '<div class="daylbl"><span>'+esc(dayLabel(d))+'</span><span class="num">'+(net<0?'−':'+')+esc(money(Math.abs(net)))+'</span></div>'+days[d].map(moneyRow).join('')}).join('')
      :'<div class="empty"><b>Nothing in '+esc(mname)+' yet</b>Money you add, transfers and expenses paid from '+esc(a.name)+' show up here.</div>')
    +(rows.length?'<p class="muted" style="margin:10px 0 0;font-size:12px">Delete expenses from Activity. Deleting an added amount or transfer here puts it back.</p>':'')+'</section>';
  return html;
}
function drawBal(W){
  const id=S.pid,m=S.month,D=dim(m),el=daysElapsed(m);
  if(!S.accounts[id])return '';
  if(!el)return '<div class="empty"><b>'+esc(monthLabel(m))+' hasn\'t started yet</b></div>';
  W=Math.max(260,W);const H=200,padL=60,padR=14,top=14,bot=28,iw=W-padL-padR,ih=H-top-bot;
  const vals=Array.from({length:el},(_,i)=>balanceOn(id,m+'-'+String(i+1).padStart(2,'0')));
  let lo=Math.min(0,...vals),hi=Math.max(...vals);if(hi===lo)hi=lo+1000;
  const pad=(hi-lo)*.12;hi=niceMax(hi+pad);if(lo<0)lo=-niceMax(-lo+pad);
  const X=i=>padL+(D>1?i/(D-1):0)*iw,Y=v=>top+ih-(v-lo)/(hi-lo)*ih;
  let s='<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">';
  [lo,(lo+hi)/2,hi].forEach(v=>{const y=Y(v);s+='<line x1="'+padL+'" x2="'+(W-padR)+'" y1="'+y+'" y2="'+y+'" stroke="var(--grid)"/><text x="'+(padL-8)+'" y="'+(y+4)+'" text-anchor="end">'+esc(short(v))+'</text>'});
  if(lo<0)s+='<line x1="'+padL+'" x2="'+(W-padR)+'" y1="'+Y(0)+'" y2="'+Y(0)+'" stroke="var(--muted)" stroke-dasharray="3 3"/>';
  [1,8,15,22,D].forEach(d=>{s+='<text x="'+X(d-1)+'" y="'+(H-8)+'" text-anchor="middle">'+d+'</text>'});
  const pts=vals.map((v,i)=>X(i)+','+Y(v));
  s+='<path d="M'+X(0)+','+Y(Math.max(lo,0))+'L'+pts.join('L')+'L'+X(el-1)+','+Y(Math.max(lo,0))+'Z" fill="color-mix(in srgb,var(--chart) 14%,transparent)"/>';
  s+='<path d="M'+pts.join('L')+'" fill="none" stroke="var(--chart)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
  s+='<line id="bal-cross" x1="0" x2="0" y1="'+top+'" y2="'+(top+ih)+'" stroke="var(--muted)" visibility="hidden"/>';
  const last=vals[el-1];s+='<circle cx="'+X(el-1)+'" cy="'+Y(last)+'" r="5" fill="var(--chart)" stroke="var(--surface)" stroke-width="2"/>';
  s+='<text x="'+Math.min(X(el-1),W-padR-70)+'" y="'+Math.max(top+10,Y(last)-10)+'" style="fill:var(--fg);font-weight:700">'+esc(short(last))+'</text>';
  const step=D>1?iw/(D-1):iw;
  for(let i=0;i<el;i++){const d=m+'-'+String(i+1).padStart(2,'0'),chg=i?vals[i]-vals[i-1]:null;
    s+='<rect x="'+(X(i)-step/2)+'" y="'+top+'" width="'+step+'" height="'+ih+'" fill="transparent" data-cross="bal-cross" data-cx="'+X(i)+'" data-tip="'+esc(dayLabel(d)+': '+money(vals[i])+(chg?' ('+(chg>0?'+':'−')+money(Math.abs(chg))+')':''))+'"/>'}
  return s+'</svg>';
}
function vActivity(){
  let ex=monthExp();
  if(S.fCat!=='all')ex=ex.filter(e=>e.category===S.fCat);
  if(S.fCard!=='all')ex=ex.filter(e=>(e.cardId||'cash')===S.fCard);
  let html=localBanner()+'<div class="headrow"><div><h1>Activity</h1><p>Every expense in '+esc(monthLabel(S.month))+'.</p></div><span class="num" style="font-size:18px;font-weight:800">'+esc(money(sum(ex)))+'</span></div>';
  html+='<div class="filters"><label class="field" for="f-cat">Category<select id="f-cat" class="input"><option value="all">All categories</option>'+cats().map(c=>'<option value="'+esc(c.id)+'"'+(S.fCat===c.id?' selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></label>'
    +'<label class="field" for="f-card">Card<select id="f-card" class="input"><option value="all">All cards</option>'+cardList().map(c=>'<option value="'+esc(c.id)+'"'+(S.fCard===c.id?' selected':'')+'>'+esc(c.name)+' ··'+esc(c.last4||'')+'</option>').join('')+'<option value="cash"'+(S.fCard==='cash'?' selected':'')+'>Cash / other</option></select></label></div>';
  if(!ex.length)return html+'<div class="empty"><b>Nothing here yet</b>Expenses you add for '+esc(monthLabel(S.month))+' will show up here.</div>';
  const days={};ex.forEach(e=>{(days[e.date]=days[e.date]||[]).push(e)});
  html+='<section class="panel daylist">'+Object.keys(days).sort().reverse().map(d=>'<div class="daylbl"><span>'+esc(dayLabel(d))+'</span><span class="num">'+esc(money(sum(days[d])))+'</span></div>'+days[d].map(e=>txnRow(e,true)).join('')).join('')+'</section>';
  return html;
}

function vBudgets(){
  const ex=monthExp(),cs=cats(),total=cs.reduce((s,c)=>s+(Number(c.budget)||0),0);
  let html=localBanner()+'<div class="headrow"><div><h1>Budgets</h1><p>Set how much you plan to spend each month. Changes save when you leave a field.</p></div><span class="num" style="font-size:18px;font-weight:800">'+esc(money(total))+' / month</span></div>';
  const rl=recList(),recTotal=rl.filter(r=>r.active!==false).reduce((s,r)=>s+(Number(r.amount)||0)/every(r),0);
  html+='<section class="panel"><div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px"><div><h2>RECURRING</h2><p class="muted" style="margin:4px 0 0;font-size:13px">Logged for you on their day, every month or every few months'+(rl.length?' · about <b class="num" style="color:var(--fg)">'+esc(money(recTotal))+'</b> a month':'')+'</p></div><button class="btn small primary" data-act="add-rec">'+ICON_REPEAT+'Add recurring</button></div>'
    +(rl.length?'<div>'+rl.map(r=>{const st=recStatus(r,S.month),card=S.cards[r.cardId],paused=r.active===false;
      const actions=S.confirm==='rec:'+r.id
        ?'<button class="btn small danger solid" data-act="del-rec" data-id="'+r.id+'">Delete</button><button class="btn small" data-act="cancel">Keep</button>'
        :'<button class="btn small" data-act="toggle-rec" data-id="'+r.id+'">'+(paused?'Resume':'Pause')+'</button><button class="iconbtn" style="color:var(--muted)" data-act="edit-rec" data-id="'+r.id+'" aria-label="Edit '+esc(r.note||'recurring expense')+'">'+ICON_EDIT+'</button><button class="iconbtn" data-act="ask" data-key="rec:'+r.id+'" aria-label="Delete '+esc(r.note||'recurring expense')+'">'+ICON_TRASH+'</button>';
      return '<div class="txn" style="flex-wrap:wrap;'+(paused?'opacity:.65':'')+'"><span class="ic" style="color:var(--accent);background:var(--accent-soft)">'+ICON_REPEAT+'</span><div class="tx" style="flex:1 1 160px"><b>'+esc(r.note||catName(r.category))+'</b><span>'+freqLabel(r)+' on the '+ordinal(r.day||1)+(every(r)>1&&r.active!==false?' · next '+esc(monthLabel(nextDue(r),true)):'')+' · '+esc(catName(r.category))+' · '+paidLabel(r)+'</span></div><span class="pill '+st.cls+'">'+esc(st.label)+'</span><span class="amt num">'+esc(money(r.amount))+'</span><span style="display:flex;gap:6px;margin-left:auto">'+actions+'</span></div>'}).join('')+'</div>'
      +(S.confirm&&S.confirm.startsWith('rec:')?'<p class="muted" style="margin:0;font-size:13px">Deleting stops future months. Expenses already logged stay in Activity.</p>':'')
    :'<div class="empty"><b>No recurring expenses yet</b>Add rent, subscriptions or bills once and they get logged for you each month.</div>')
    +'</section>';
  html+='<section class="panel"><h2>CATEGORIES</h2><div class="btable"><div class="brow hd"><span>NAME</span><span>MONTHLY BUDGET</span><span class="spentcell">SPENT IN '+esc(monthLabel(S.month,true).toUpperCase())+'</span><span></span></div>'
    +cs.map(c=>{const s=sum(ex.filter(e=>e.category===c.id)),b=Number(c.budget)||0;
      const delBtn=S.confirm==='cat:'+c.id?'<button class="iconbtn" style="color:var(--surface);background:var(--bad);border-color:var(--bad)" data-act="del-cat" data-id="'+esc(c.id)+'" aria-label="Confirm remove '+esc(c.name)+'">'+ICON_TRASH+'</button>':'<button class="iconbtn" data-act="ask" data-key="cat:'+esc(c.id)+'" aria-label="Remove '+esc(c.name)+'">'+ICON_TRASH+'</button>';
      return '<div class="brow"><span class="namecell"><span class="dot" style="background:'+catColor(c.id)+'"></span><label class="sr" for="cn-'+esc(c.id)+'">Category name</label><input id="cn-'+esc(c.id)+'" class="input" data-cat="'+esc(c.id)+'" data-field="name" value="'+esc(c.name)+'" maxlength="40"></span><span><label class="sr" for="cb-'+esc(c.id)+'">Budget for '+esc(c.name)+'</label><input id="cb-'+esc(c.id)+'" class="input num" type="number" inputmode="decimal" min="0" step="any" data-cat="'+esc(c.id)+'" data-field="budget" value="'+(b||'')+'" placeholder="0"></span><span class="spentcell num '+(b>0&&s>b?'':'muted')+'" style="'+(b>0&&s>b?'color:var(--bad);font-weight:700':'')+'">'+esc(money(s))+'</span>'+delBtn+'</div>'}).join('')
    +'</div>'+(S.confirm&&S.confirm.startsWith('cat:')?'<p class="muted" style="margin:0;font-size:13px">Tap the red button to remove that category. Its past expenses stay, listed as Uncategorized.</p>':'')
    +'<form id="add-cat" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end"><label class="field" for="nc-name" style="flex:2 1 180px">New category<input id="nc-name" class="input" maxlength="40" placeholder="e.g. Pets" required></label><label class="field" for="nc-budget" style="flex:1 1 120px">Budget<input id="nc-budget" class="input num" type="number" inputmode="decimal" min="0" step="any" placeholder="0"></label><button class="btn" type="submit">Add category</button></form></section>';
  html+='<section class="panel"><h2>CURRENCY &amp; PROFILE</h2><div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end"><label class="field" for="set-cur" style="flex:0 1 200px">Currency symbol<input id="set-cur" class="input" maxlength="4" value="'+esc(cur())+'"></label><button class="btn" data-act="profile">Edit name &amp; photo</button></div></section>';
  return html;
}

function renderCards(){
  const view=$('#view');
  if(view.dataset.view!=='cards'){
    view.dataset.view='cards';S.faceId=null;
    view.innerHTML='<div id="cv-banner"></div><div style="display:flex;flex-direction:column;gap:22px"><div class="headrow"><div><h1>My cards</h1><p>Track spending on each card. Freeze one in a second if it goes missing.</p></div><button class="btn primary" data-act="new-card"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>New virtual card</button></div>'
     +'<div class="tabs" role="tablist" aria-label="Card type" id="cv-tabs"></div>'
     +'<div class="cvgrid"><div class="cardlist" id="cv-list"></div><div class="cvmain" id="cv-main">'
     +'<div class="cvtop"><div class="face" id="cv-face"><div class="row"><span style="font-weight:800;font-size:17px;letter-spacing:-.02em">Finlora</span><span id="cv-kind" style="font-size:10px;font-weight:700;letter-spacing:.14em;opacity:.85"></span></div><div class="chip"></div><div class="bottom"><div style="display:flex;flex-direction:column;gap:4px;min-width:0"><span class="pan" id="cv-pan"></span><span id="cv-fname" style="font-size:12px;opacity:.9"></span></div><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="opacity:.8;flex:none"><path d="M8.5 8.5a5 5 0 0 1 0 7M12 6a8.5 8.5 0 0 1 0 12M15.5 3.5a12 12 0 0 1 0 17"/></svg></div>'
     +'<div class="frost" id="cv-frost" aria-hidden="true"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 2v20M4.9 6l14.2 12M19.1 6 4.9 18M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5"/></svg>Card frozen</div></div>'
     +'<div class="info"><span id="cv-status"></span><div><h2 id="cv-name"></h2><span class="muted" id="cv-desc" style="font-size:13px"></span></div>'
     +'<button class="freeze" id="cv-freeze" data-act="freeze"><span class="fi">'+ICON_SNOW+'</span><span class="ft"><b id="cv-ft"></b><span id="cv-fs"></span></span><span class="switch" id="cv-switch"><i></i></span></button>'
     +'<label class="field" for="cv-acct">Pays from<select id="cv-acct" class="input"></select></label>'
     +'<div id="cv-remove"></div></div></div>'
     +'<div class="grid2"><section class="panel" id="cv-limit"><h2>MONTHLY LIMIT</h2><div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px"><span class="muted" style="font-size:13px">Spent in <span id="cv-mon"></span></span><span class="num"><b id="cv-spent"></b> <span class="muted">of <span id="cv-lim"></span></span></span></div><div class="bar"><i id="cv-bar"></i></div><label class="field" for="cv-range">Adjust limit<input type="range" id="cv-range" min="0" step="500"></label><div class="presets" id="cv-presets"></div></section>'
     +'<section class="panel"><h2>WHERE IT WENT</h2><div id="cv-split"></div></section></div>'
     +'</div><div id="cv-empty" hidden style="flex:999 1 420px"></div></div></div>';
  }
  $('#cv-banner').innerHTML=localBanner()+exampleBanner();
  const all=cardList(),groups={Physical:all.filter(c=>c.kind==='Physical'),Virtual:all.filter(c=>c.kind!=='Physical')};
  if(!groups[S.tab].length&&groups[S.tab==='Physical'?'Virtual':'Physical'].length&&!S.tabTouched)S.tab=S.tab==='Physical'?'Virtual':'Physical';
  $('#cv-tabs').innerHTML=[['Physical','Physical cards'],['Virtual','Virtual cards']].map(([k,l])=>'<button role="tab" aria-selected="'+(S.tab===k)+'" data-act="tab" data-tab="'+k+'">'+l+'<em>'+groups[k].length+'</em></button>').join('');
  const list=groups[S.tab];
  if(!list.find(c=>c.id===S.sel))S.sel=list[0]?list[0].id:null;
  const ex=monthExp();
  $('#cv-list').innerHTML=list.length?list.map(c=>'<button class="thumb'+(c.frozen?' frozen':'')+'" data-act="pick" data-id="'+c.id+'" aria-pressed="'+(S.sel===c.id)+'"><span class="mini" style="background:'+(CARD_BG[c.color]||CARD_BG.green)+'"></span><span class="t"><b>'+esc(c.name)+'</b><span>'+esc(c.kind)+' ··'+esc(c.last4||'')+'</span></span>'+(c.frozen?'<span class="pill ice">Frozen</span>':'')+'</button>').join(''):'<div class="empty" style="width:100%"><b>No '+S.tab.toLowerCase()+' cards</b>'+(S.tab==='Virtual'?'Create one with New virtual card.':'Add one with New virtual card and pick Physical.')+'</div>';
  const c=S.cards[S.sel];
  $('#cv-main').hidden=!c;
  if(!c)return;
  const face=$('#cv-face'),frost=$('#cv-frost');
  face.style.background=CARD_BG[c.color]||CARD_BG.green;
  $('#cv-kind').textContent=(c.kind||'').toUpperCase();
  $('#cv-pan').textContent='•••• '+(c.last4||'····');
  $('#cv-fname').textContent=c.name;
  if(S.faceId!==S.sel){frost.classList.add('still');frost.classList.toggle('on',!!c.frozen);void frost.offsetWidth;frost.classList.remove('still');S.faceId=S.sel}
  else frost.classList.toggle('on',!!c.frozen);
  $('#cv-status').innerHTML=c.frozen?'<span class="pill ice">● Frozen</span>':'<span class="pill ok">● Active</span>';
  $('#cv-name').textContent=c.name;
  $('#cv-desc').textContent=c.note||(c.kind==='Virtual'?'Virtual card for online spending':'Physical card');
  const fz=$('#cv-freeze');fz.classList.toggle('on',!!c.frozen);fz.setAttribute('aria-pressed',String(!!c.frozen));
  $('#cv-switch').classList.toggle('on',!!c.frozen);
  $('#cv-ft').textContent=c.frozen?'Unfreeze card':'Freeze card';
  $('#cv-fs').textContent=c.frozen?"You can't log new expenses on it until you unfreeze it":'Blocks new expenses on this card until you unfreeze it';
  $('#cv-acct').innerHTML=acctOptions(c.accountId||'')+'<option value=""'+(c.accountId?'':' selected')+'>Not tracked</option>';
  $('#cv-remove').innerHTML=S.confirm==='card:'+c.id?'<div class="banner" style="background:var(--bad-soft)"><p>Remove <b>'+esc(c.name)+'</b>? Its past expenses stay in Activity.</p><button class="btn small danger solid" data-act="del-card" data-id="'+c.id+'">Remove card</button><button class="btn small" data-act="cancel">Keep</button></div>':'<button class="btn small danger" data-act="ask" data-key="card:'+c.id+'">'+ICON_TRASH+'Remove card</button>';
  const cex=ex.filter(e=>e.cardId===c.id),spent=sum(cex),lim=Number(c.limit)||0;
  $('#cv-mon').textContent=monthLabel(S.month).split(' ')[0];
  $('#cv-spent').textContent=money(spent);
  $('#cv-lim').textContent=lim>0?money(lim):'no limit';
  const bar=$('#cv-bar'),pp=lim>0?spent/lim*100:0;bar.className=pctClass(pp);bar.style.width=Math.min(100,pp)+'%';
  const r=$('#cv-range');r.max=String(Math.max(50000,Math.ceil(lim*1.5/1000)*1000));r.value=String(lim);r.setAttribute('aria-valuetext',money(lim));
  $('#cv-presets').innerHTML=[5000,10000,20000,30000].map(v=>'<button data-act="preset" data-v="'+v+'" aria-pressed="'+(lim===v)+'">'+esc(money(v))+'</button>').join('');
  const split=cats().map(k=>({k,s:sum(cex.filter(e=>e.category===k.id))})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s);
  $('#cv-split').innerHTML=split.length?split.map(({k,s})=>'<div class="catrow"><span class="nm"><span class="dot" style="background:'+catColor(k.id)+'"></span><span>'+esc(k.name)+'</span></span><span class="num"><b>'+esc(money(s))+'</b></span><div class="bar"><i style="width:'+(s/spent*100)+'%;background:'+catColor(k.id)+'"></i></div></div>').join(''):'<div class="empty"><b>No spending on this card</b>Expenses you log on it this month show up here.</div>';
}

/* ---------- modals ---------- */
function openModal(html,focusSel){clearTimeout(closeModal.t);$('#modal').innerHTML='<div class="scrim" data-act="scrim"><div class="sheet" role="dialog" aria-modal="true">'+html+'</div></div>';setTimeout(()=>{const f=$(focusSel||'#modal input');if(f&&!$('#modal').contains(document.activeElement))f.focus()},30)}
function closeModal(){
  const m=$('#modal'),sc=m.querySelector('.scrim');
  if(sc&&!RM&&!sc.classList.contains('closing')){sc.classList.add('closing');clearTimeout(closeModal.t);closeModal.t=setTimeout(()=>{if(m.querySelector('.scrim.closing'))m.innerHTML='';if(S.pending)render()},190);return}
  if(!sc||RM)m.innerHTML='';if(S.pending)render();
}
function openAdd(pay){
  openModal('<h2>Add expense</h2><form id="f-add" novalidate>'
   +'<label class="field" for="a-amt">Amount ('+esc(cur())+')<input id="a-amt" class="input amount num" type="number" inputmode="decimal" min="0" step="any" placeholder="0" required></label>'
   +'<div class="two"><label class="field" for="a-cat">Category<select id="a-cat" class="input">'+cats().map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('')+'</select></label>'
   +'<label class="field" for="a-date">Date<input id="a-date" class="input" type="date" value="'+(S.month===ym(new Date())?today():S.month+'-01')+'" required></label></div>'
   +'<label class="field" for="a-pay">Paid from<select id="a-pay" class="input">'+payOptions(pay||defaultPay())+'</select></label>'
   +'<label class="field" for="a-note">Note<input id="a-note" class="input" maxlength="80" placeholder="e.g. Lunch with client"></label>'
   +'<label for="a-rep" style="display:flex;align-items:center;gap:10px;min-height:44px;padding:8px 12px;border-radius:12px;background:var(--sunk);font-weight:600;cursor:pointer"><input type="checkbox" id="a-rep" style="width:20px;height:20px;accent-color:var(--accent)"><span style="display:flex;flex-direction:column"><span>Repeat this expense</span><span class="muted" id="a-rep-sub" style="font-size:12px;font-weight:500">Logs it automatically on the same day</span></span></label>'
   +'<label class="field" for="a-every" id="a-every-wrap" hidden>How often<select id="a-every" class="input">'+everyOptions(1)+'</select></label>'
   +'<p class="err" id="a-err" hidden></p><div class="actions"><button type="button" class="btn" data-act="close">Cancel</button><button type="submit" class="btn primary">Add expense</button></div></form>','#a-amt');
}
function acctOptions(sel,skip){return acctList().filter(a=>a.id!==skip).map(a=>'<option value="'+esc(a.id)+'"'+(a.id===sel?' selected':'')+'>'+esc(a.name)+' · '+esc(money(balance(a.id)))+'</option>').join('')}
function openMoney(kind,id){
  const al=acctList();
  if(!al.length){toast('Add an account first.');return}
  const tr=kind==='transfer';
  const from=id||S.acct||al[0].id;
  const to=tr?((al.find(a=>a.id!==from&&a.type==='savings')||al.find(a=>a.id!==from)||{}).id):(id||S.acct||al[0].id);
  if(tr&&al.length<2){toast('You need at least two accounts to transfer.');return}
  openModal('<h2>'+(tr?'Transfer money':'Add money')+'</h2><form id="f-move" data-kind="'+(tr?'transfer':'in')+'" novalidate>'
   +'<label class="field" for="m-amt">Amount ('+esc(cur())+')<input id="m-amt" class="input amount num" type="number" inputmode="decimal" min="0" step="any" placeholder="0" required></label>'
   +(tr?'<div class="two"><label class="field" for="m-from">From<select id="m-from" class="input">'+acctOptions(from)+'</select></label><label class="field" for="m-to">To<select id="m-to" class="input">'+acctOptions(to)+'</select></label></div>'
       :'<label class="field" for="m-to">Put it in<select id="m-to" class="input">'+acctOptions(to)+'</select></label>')
   +'<div class="two"><label class="field" for="m-note">Note<input id="m-note" class="input" maxlength="60" placeholder="'+(tr?'e.g. Monthly savings':'e.g. Salary, client payment')+'"></label>'
   +'<label class="field" for="m-date">Date<input id="m-date" class="input" type="date" value="'+(S.month===ym(new Date())?today():S.month+'-01')+'" required></label></div>'
   +'<p class="err" id="m-err" hidden></p><div class="actions"><button type="button" class="btn" data-act="close">Cancel</button><button type="submit" class="btn primary">'+(tr?'Transfer':'Add money')+'</button></div></form>','#m-amt');
}
function openAcct(id){
  const a=id?S.accounts[id]:null;
  openModal('<h2>'+(a?'Edit '+esc(a.name):'New account')+'</h2><form id="f-acct" data-id="'+esc(id||'')+'" novalidate>'
   +'<div class="two"><label class="field" for="ac-name">Name<input id="ac-name" class="input" maxlength="30" placeholder="e.g. GCash, BDO, Piggy bank" value="'+esc(a?a.name:'')+'" required></label>'
   +'<label class="field" for="ac-type">Type<select id="ac-type" class="input">'+Object.entries(ACCT_TYPES).map(([k,T])=>'<option value="'+k+'"'+((a?a.type:'other')===k?' selected':'')+'>'+esc(T.label)+'</option>').join('')+'</select></label></div>'
   +'<label class="field" for="ac-bal">'+(a?'Current balance':'How much is in it now')+' ('+esc(cur())+')<input id="ac-bal" class="input amount num" type="number" inputmode="decimal" step="any" placeholder="0" value="'+(a?balance(id):'')+'"></label>'
   +(a?'<p class="muted" style="margin:0;font-size:12px">Changing the balance adds a correction entry, so your history stays right.</p>':'')
   +'<p class="err" id="ac-err" hidden></p><div class="actions">'+(a?'<button type="button" class="btn danger" data-act="del-acct" data-id="'+esc(id)+'" style="margin-right:auto">'+ICON_TRASH+'Delete</button>':'')+'<button type="button" class="btn" data-act="close">Cancel</button><button type="submit" class="btn primary">'+(a?'Save':'Create account')+'</button></div></form>','#ac-name');
}
function openProfile(){
  const u=S.user||{},name=profileName(),photo=profilePhoto();
  S.draftPhoto=undefined;
  openModal('<h2>Your profile</h2><form id="f-prof" novalidate>'
   +'<div class="prof-top"><span class="avatar prof-av" id="p-av"></span><div class="prof-btns">'
   +'<label class="btn small" for="p-file"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h3l2-3h6l2 3h3v13H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Change photo</label>'
   +'<input type="file" id="p-file" accept="image/*" class="sr">'
   +'<button type="button" class="btn small danger" data-act="photo-remove"'+(photo?'':' hidden')+' id="p-remove">Remove photo</button>'
   +'<span class="muted" style="font-size:12px">JPG or PNG. It\'s cropped to a square.</span></div></div>'
   +'<label class="field" for="p-name">Full name<input id="p-name" class="input" maxlength="40" autocomplete="name" value="'+esc(name===u.email?'':name)+'" placeholder="e.g. Mau Chen"></label>'
   +'<label class="field" for="p-nick">Name for the greeting<input id="p-nick" class="input" maxlength="20" value="'+esc((S.settings&&S.settings.nickname)||'')+'" placeholder="'+esc(firstName()||'e.g. Mau')+'"></label>'
   +'<div class="field">Email<span class="input prof-ro">'+esc(u.email||'—')+'</span></div>'
   +'<p class="err" id="p-err" hidden></p><div class="actions"><button type="button" class="btn danger" data-act="logout" style="margin-right:auto"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>Log out</button><button type="button" class="btn" data-act="close">Cancel</button><button type="submit" class="btn primary">Save profile</button></div></form>','#p-name');
  paintAvatar($('#p-av'),name,photo);
}
/* Shrink a picked photo to a 256px square JPEG so it fits in your Firestore profile. */
function squarePhoto(file){
  return new Promise((res,rej)=>{
    if(!file||!/^image\//.test(file.type))return rej(new Error('type'));
    if(file.size>15*1024*1024)return rej(new Error('size'));
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{const n=256,c=document.createElement('canvas');c.width=c.height=n;const k=Math.min(img.naturalWidth,img.naturalHeight),x=(img.naturalWidth-k)/2,y=(img.naturalHeight-k)/2;
      const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,n,n);g.imageSmoothingQuality='high';g.drawImage(img,x,y,k,k,0,0,n,n);URL.revokeObjectURL(url);res(c.toDataURL('image/jpeg',.86))};
    img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('read'))};img.src=url;
  });
}
function startOptions(day){
  return monthOptions(day,null);
}
function monthOptions(day,sel){
  const cm=ym(new Date()),r={day},passed=dueDate(r,cm)<=today();
  if(!sel)sel=passed?addMonths(cm,1):cm;
  return Array.from({length:13},(_,i)=>addMonths(cm,i)).map((m,i)=>'<option value="'+m+'"'+(m===sel?' selected':'')+'>'+(i===0?'This month':i===1?'Next month':monthLabel(m,true))+' · '+esc(dayLabel(dueDate(r,m)))+(i===0&&passed?' (logs it now)':'')+'</option>').join('');
}
function openRec(id){
  const r=id&&S.recurring[id]?Object.assign({id},S.recurring[id]):null,cl=cardList(),day=r?r.day:new Date().getDate();
  openModal('<h2>'+(r?'Edit recurring':'New recurring expense')+'</h2><form id="f-rec" data-id="'+(id||'')+'" novalidate>'
   +'<label class="field" for="r-note">Name<input id="r-note" class="input" maxlength="60" placeholder="e.g. Rent, Netflix, Phone bill" value="'+esc(r?r.note:'')+'" required></label>'
   +'<label class="field" for="r-amt">Amount each time ('+esc(cur())+')<input id="r-amt" class="input amount num" type="number" inputmode="decimal" min="0" step="any" placeholder="0" value="'+(r?esc(r.amount):'')+'" required></label>'
   +'<div class="two"><label class="field" for="r-cat">Category<select id="r-cat" class="input">'+cats().map(c=>'<option value="'+esc(c.id)+'"'+(r&&r.category===c.id?' selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></label>'
   +'<label class="field" for="r-day">Day of the month<select id="r-day" class="input">'+Array.from({length:31},(_,i)=>i+1).map(d=>'<option value="'+d+'"'+(d===day?' selected':'')+'>'+ordinal(d)+'</option>').join('')+'</select></label></div>'
   +'<label class="field" for="r-pay">Paid from<select id="r-pay" class="input">'+payOptions(r?payValue(r):defaultPay())+'</select></label>'
   +'<div class="two"><label class="field" for="r-every">How often<select id="r-every" class="input">'+everyOptions(r?every(r):1)+'</select></label>'
   +'<label class="field" for="r-start">'+(r?'Next payment':'First payment')+'<select id="r-start" class="input">'+monthOptions(day,r?nextDue(r):null)+'</select></label></div>'
   +'<p class="muted" style="margin:0;font-size:12px">'+(r?'Changes apply from the next payment. Past ones stay as they are. ':'')+'Days past the end of a short month land on its last day. A frozen card waits until you unfreeze it.</p>'
   +'<p class="err" id="r-err" hidden></p><div class="actions"><button type="button" class="btn" data-act="close">Cancel</button><button type="submit" class="btn primary">'+(r?'Save changes':'Add recurring')+'</button></div></form>','#r-note');
}
function openNewCard(){
  openModal('<h2>New card</h2><form id="f-card" novalidate>'
   +'<label class="field" for="n-name">Card name<input id="n-name" class="input" maxlength="30" placeholder="e.g. Subscriptions" required></label>'
   +'<div class="two"><label class="field" for="n-kind">Type<select id="n-kind" class="input"><option value="Virtual">Virtual</option><option value="Physical">Physical</option></select></label>'
   +'<label class="field" for="n-last4">Last 4 digits<input id="n-last4" class="input num" inputmode="numeric" maxlength="4" placeholder="Optional"></label></div>'
   +(acctList().length?'<label class="field" for="n-acct">Pays from<select id="n-acct" class="input">'+acctOptions(S.accounts.bank?'bank':(acctList()[0]||{}).id)+'<option value="">Not tracked</option></select></label>':'')
   +'<label class="field" for="n-limit">Monthly limit ('+esc(cur())+')<input id="n-limit" class="input num" type="number" inputmode="decimal" min="0" step="any" placeholder="0 for no limit"></label>'
   +'<fieldset style="border:0;padding:0;margin:0" class="field"><legend style="margin-bottom:6px">Color</legend><div class="swatches">'+Object.keys(CARD_BG).map((k,i)=>'<label><input type="radio" name="n-color" value="'+k+'"'+(i===0?' checked':'')+' aria-label="'+k+'"><span style="background:'+CARD_BG[k]+'"></span></label>').join('')+'</div></fieldset>'
   +'<p class="muted" style="margin:0;font-size:12px">Only the last 4 digits are kept, to help you tell cards apart. Never enter a full card number.</p>'
   +'<p class="err" id="n-err" hidden></p><div class="actions"><button type="button" class="btn" data-act="close">Cancel</button><button type="submit" class="btn primary">Create card</button></div></form>','#n-name');
}

/* ---------- events ---------- */
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-act]');if(!t)return;
  const act=t.dataset.act;
  if(act==='logout'){closeModal();logOut().then(()=>toast('Logged out')).catch(()=>toast("Couldn't log out. Try again."));return}
  if(act==='scrim'){if(e.target===t)closeModal();return}
  if(act==='close'){closeModal();return}
  if(act==='add'){openAdd(t.dataset.pay);return}
  if(act==='prev'||act==='next'){const [y,m]=S.month.split('-').map(Number);S.month=ym(new Date(y,m-1+(act==='next'?1:-1),1));S.confirm=null;render();return}
  if(act==='tab'){S.tab=t.dataset.tab;S.tabTouched=true;S.confirm=null;render();return}
  if(act==='pick'){S.sel=t.dataset.id;S.confirm=null;render();return}
  if(act==='freeze'){const c=S.cards[S.sel];if(c){patch('cards',S.sel,{frozen:!c.frozen});toast(c.frozen?c.name+' is active again':c.name+' is frozen')}return}
  if(act==='preset'){patch('cards',S.sel,{limit:Number(t.dataset.v)});return}
  if(act==='new-card'){openNewCard();return}
  if(act==='ask'){S.confirm=t.dataset.key;render();return}
  if(act==='cancel'){S.confirm=null;render();return}
  if(act==='del-exp'){
    S.confirm=null;const e=S.expenses[t.dataset.id],r=e&&e.recurringId&&S.recurring[e.recurringId];
    if(r){const m=String(e.date).slice(0,7),sk=(r.skipped||[]).filter(x=>x!==m).concat([m]);patch('recurring',e.recurringId,{skipped:sk})}
    del('expenses',t.dataset.id);toast(r?'Deleted. '+(r.note||'It')+' is skipped for this month only.':'Expense deleted');return}
  if(act==='money-in'){openMoney('in',t.dataset.id);return}
  if(act==='money-tr'){openMoney('transfer',t.dataset.id);return}
  if(act==='new-acct'){openAcct(null);return}
  if(act==='edit-acct'){openAcct(t.dataset.id);return}
  if(act==='del-move'){S.confirm=null;del('moves',t.dataset.id);toast('Entry deleted. The balance is updated.');return}
  if(act==='del-acct'){
    if(!t.dataset.armed){t.dataset.armed='1';t.innerHTML=ICON_TRASH+'Tap again to delete';return}
    const a=S.accounts[t.dataset.id];del('accounts',t.dataset.id);closeModal();if(S.acct===t.dataset.id)S.acct=null;if(S.view==='account')location.hash='accounts';
    toast((a?a.name:'Account')+' deleted. Its past expenses stay in Activity.');return}
  if(act==='profile'){openProfile();return}
  if(act==='photo-remove'){S.draftPhoto='none';paintAvatar($('#p-av'),$('#p-name').value||profileName(),'');t.hidden=true;return}
  if(act==='add-rec'){openRec(null);return}
  if(act==='edit-rec'){openRec(t.dataset.id);return}
  if(act==='toggle-rec'){const r=S.recurring[t.dataset.id];if(!r)return;
    if(r.active===false){const cm=ym(new Date());patch('recurring',t.dataset.id,{active:true,startMonth:nextCycle(r,cm)});toast((r.note||'Recurring expense')+' resumed')}
    else{patch('recurring',t.dataset.id,{active:false});toast((r.note||'Recurring expense')+' paused')}
    return}
  if(act==='del-rec'){S.confirm=null;const r=S.recurring[t.dataset.id];del('recurring',t.dataset.id);toast((r&&r.note||'Recurring expense')+' deleted. Past expenses stay.');return}
  if(act==='del-card'){S.confirm=null;const n=(S.cards[t.dataset.id]||{}).name;del('cards',t.dataset.id);toast((n||'Card')+' removed');return}
  if(act==='del-cat'){S.confirm=null;saveSettings({categories:cats().filter(c=>c.id!==t.dataset.id)});return}
  if(act==='keep-examples'){saveSettings({example:false});return}
  if(act==='clear-examples'){
    Object.entries(S.cards).forEach(([id,c])=>{if(c.example)del('cards',id)});
    Object.entries(S.recurring).forEach(([id,r])=>{if(r.example)del('recurring',id)});
    Object.entries(S.expenses).forEach(([id,x])=>{if(x.example)del('expenses',id)});
    saveSettings({example:false});toast('Examples cleared. Add your first card or expense.');return}
});
document.addEventListener('submit',e=>{
  const f=e.target;e.preventDefault();
  if(f.id==='f-add'){
    const amt=parseFloat($('#a-amt').value),date=$('#a-date').value,payV=$('#a-pay').value,pay=readPay(payV),cardId=pay.cardId,accountId=pay.accountId,err=$('#a-err');
    if(!(amt>0)){err.textContent='Enter an amount above zero.';err.hidden=false;$('#a-amt').focus();return}
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){err.textContent='Pick a date for this expense.';err.hidden=false;return}
    const card=S.cards[cardId];
    if(card&&card.frozen){err.textContent=card.name+' is frozen. Unfreeze it or pick another card.';err.hidden=false;return}
    const cat=$('#a-cat').value;S.lastPay=payV||null;
    if($('#a-rep').checked){
      const rid=newId(),day=Number(date.slice(8,10)),note=$('#a-note').value.trim()||catName(cat);
      const ev=Number($('#a-every').value)||1;
      const data={amount:Math.round(amt*100)/100,note,category:cat,cardId:cardId||'',accountId,day,every:ev,startMonth:date.slice(0,7),active:true,skipped:[],createdAt:Date.now()};
      S.recurring[rid]=data;put('recurring',rid,data);closeModal();
      if(!date.startsWith(S.month))S.month=date.slice(0,7);
      const fl=freqLabel(data).toLowerCase();
      toast(date<=today()?'Added '+note+'. It repeats '+fl+' on the '+ordinal(day)+'.':note+' will be logged on '+dayLabel(date)+', then '+fl+'.');
      render();return;
    }
    const before=card?sum(expList().filter(x=>x.cardId===cardId&&String(x.date).startsWith(date.slice(0,7)))):0;
    const left=accountId?balance(accountId)-amt:null;
    put('expenses',newId(),{amount:Math.round(amt*100)/100,category:cat,cardId:cardId||'',accountId,note:$('#a-note').value.trim(),date,createdAt:Date.now()});
    closeModal();
    if(!date.startsWith(S.month)){S.month=date.slice(0,7)}
    let msg='Added '+money(amt)+' to '+catName(cat);
    if(card&&Number(card.limit)>0){if(before+amt>card.limit)msg+=' · '+card.name+' is over its limit'}
    if(left!==null)msg+=' · '+acctName(accountId)+': '+money(left)+' left';
    toast(msg);render();return;
  }
  if(f.id==='f-card'){
    const name=$('#n-name').value.trim(),last4=$('#n-last4').value.trim(),err=$('#n-err');
    if(!name){err.textContent='Give the card a name.';err.hidden=false;$('#n-name').focus();return}
    if(last4&&!/^\d{4}$/.test(last4)){err.textContent='Last 4 digits should be exactly 4 numbers.';err.hidden=false;return}
    const kind=$('#n-kind').value,id=newId(),order=cardList().reduce((m,c)=>Math.max(m,c.order||0),0)+1;
    put('cards',id,{name,kind,last4,accountId:$('#n-acct')?$('#n-acct').value:'',color:(f.querySelector('input[name="n-color"]:checked')||{}).value||'green',limit:parseFloat($('#n-limit').value)||0,frozen:false,note:'',order});
    S.tab=kind;S.tabTouched=true;S.sel=id;closeModal();toast(name+' created');render();return;
  }
  if(f.id==='f-rec'){
    const id=f.dataset.id,amt=parseFloat($('#r-amt').value),note=$('#r-note').value.trim(),err=$('#r-err');
    if(!note){err.textContent='Give it a name, like Rent or Netflix.';err.hidden=false;$('#r-note').focus();return}
    if(!(amt>0)){err.textContent='Enter an amount above zero.';err.hidden=false;$('#r-amt').focus();return}
    const fields=Object.assign({amount:Math.round(amt*100)/100,note,category:$('#r-cat').value,day:Number($('#r-day').value),every:Number($('#r-every').value)||1,startMonth:$('#r-start').value},readPay($('#r-pay').value));
    if(id){patch('recurring',id,fields);closeModal();toast(note+' updated · '+freqLabel(fields).toLowerCase()+', next '+monthLabel(fields.startMonth,true));return}
    const rid=newId(),data=Object.assign(fields,{active:true,skipped:[],createdAt:Date.now()});
    S.recurring[rid]=data;put('recurring',rid,data);closeModal();
    toast(note+' added. It repeats '+freqLabel(data).toLowerCase()+' on the '+ordinal(data.day)+'.');render();return;
  }
  if(f.id==='f-move'){
    const tr=f.dataset.kind==='transfer',amt=parseFloat($('#m-amt').value),date=$('#m-date').value,toId=$('#m-to').value,fromId=tr?$('#m-from').value:'',err=$('#m-err');
    if(!(amt>0)){err.textContent='Enter an amount above zero.';err.hidden=false;$('#m-amt').focus();return}
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){err.textContent='Pick a date.';err.hidden=false;return}
    if(tr&&fromId===toId){err.textContent='Pick two different accounts.';err.hidden=false;return}
    const v=Math.round(amt*100)/100,fromLeft=tr?balance(fromId)-v:0;
    put('moves',newId(),{kind:tr?'transfer':'in',amount:v,toId,fromId,note:$('#m-note').value.trim(),date,createdAt:Date.now()});
    closeModal();S.acct=tr?fromId:toId;
    toast(tr?'Moved '+money(v)+' from '+acctName(fromId)+' to '+acctName(toId)+(fromLeft<0?' · '+acctName(fromId)+' is now below zero':''):'Added '+money(v)+' to '+acctName(toId)+' · '+money(balance(toId)+v)+' now');
    render();return;
  }
  if(f.id==='f-acct'){
    const id=f.dataset.id,name=$('#ac-name').value.trim(),type=$('#ac-type').value,raw=$('#ac-bal').value.trim(),bal=raw===''?0:parseFloat(raw),err=$('#ac-err');
    if(!name){err.textContent='Give the account a name.';err.hidden=false;$('#ac-name').focus();return}
    if(!isFinite(bal)){err.textContent='Enter the balance as a number.';err.hidden=false;return}
    if(id){
      patch('accounts',id,{name,type});
      const diff=Math.round((bal-balance(id))*100)/100;
      if(Math.abs(diff)>=0.01)put('moves',newId(),{kind:'adjust',amount:diff,toId:id,fromId:'',note:'Balance correction',date:today(),createdAt:Date.now()});
      closeModal();toast(name+' saved');return;
    }
    const nid=newId(),order=acctList().reduce((m,a)=>Math.max(m,a.order||0),0)+1;
    put('accounts',nid,{name,type,start:Math.round(bal*100)/100,order,createdAt:Date.now()});
    S.acct=nid;closeModal();toast(name+' created');render();return;
  }
  if(f.id==='f-prof'){
    const name=$('#p-name').value.trim().slice(0,40),nick=$('#p-nick').value.trim().slice(0,20);
    const data={name,updatedAt:Date.now()};
    if(S.draftPhoto!==undefined)data.photo=S.draftPhoto;else if(S.profile&&S.profile.photo)data.photo=S.profile.photo;
    S.profile=Object.assign({},S.profile||{},data);
    if(S.db)S.db.put('profile','main',S.profile).catch(e=>toast(errMsg(e)));
    if((S.settings&&S.settings.nickname||'')!==nick){S.settings=Object.assign({},S.settings||{},{nickname:nick});saveSettings({nickname:nick})}
    if(name)saveDisplayName(name).catch(()=>{});
    paintUser();closeModal();toast('Profile saved');return;
  }
  if(f.id==='add-cat'){
    const name=$('#nc-name').value.trim();if(!name)return;
    const budget=parseFloat($('#nc-budget').value)||0;
    $('#nc-name').blur();$('#nc-budget').blur();
    saveSettings({categories:cats().concat([{id:'c'+newId(),name,budget}])});toast(name+' added');return;
  }
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='f-cat'){S.fCat=t.value;t.blur();render();return}
  if(t.id==='f-card'){S.fCard=t.value;t.blur();render();return}
  if(t.id==='p-file'){const f=t.files&&t.files[0];if(!f)return;const err=$('#p-err');err.hidden=true;
    squarePhoto(f).then(d=>{S.draftPhoto=d;paintAvatar($('#p-av'),'',d);$('#p-remove').hidden=false}).catch(e=>{err.textContent=e.message==='size'?'That photo is too big. Pick one under 15 MB.':'That file isn\'t a photo we can read. Try a JPG or PNG.';err.hidden=false});t.value='';return}
  if(t.id==='set-cur'){const v=t.value.trim()||'NT$';saveSettings({currency:v});return}
  if(t.id==='set-nick'){const v=t.value.trim().slice(0,20);S.settings=Object.assign({},S.settings||{},{nickname:v});$('#greet').textContent=greeting();saveSettings({nickname:v});toast(v?'Hi, '+v+'! Your greeting is updated.':'Using the name from your account.');return}
  if(t.dataset&&t.dataset.cat){
    const id=t.dataset.cat,field=t.dataset.field;
    const next=cats().map(c=>c.id!==id?c:Object.assign({},c,field==='budget'?{budget:Math.max(0,parseFloat(t.value)||0)}:{name:t.value.trim()||c.name}));
    saveSettings({categories:next});return;
  }
  if(t.id==='cv-range'){patch('cards',S.sel,{limit:Number(t.value)});return}
  if(t.id==='cv-acct'){const c=S.cards[S.sel];patch('cards',S.sel,{accountId:t.value});t.blur();toast(c?(t.value?c.name+' now pays from '+acctName(t.value):c.name+' is no longer linked to an account'):'Saved');return}
  if(t.id==='r-start'){t.dataset.touched='1';return}
  if(t.id==='r-day'&&$('#r-start')){const st=$('#r-start');st.innerHTML=monthOptions(Number(t.value),st.dataset.touched||$('#f-rec').dataset.id?st.value:null);return}
  if(t.id==='a-rep'){$('#a-every-wrap').hidden=!t.checked}
  if((t.id==='a-date'||t.id==='a-rep')&&$('#a-rep-sub')){const d=$('#a-date').value;$('#a-rep-sub').textContent=/^\d{4}-\d{2}-\d{2}$/.test(d)?'Logs it automatically on the '+ordinal(Number(d.slice(8,10)))+' of the month':'Logs it automatically on the same day';return}
});
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='cv-range'){const v=Number(t.value),c=S.cards[S.sel];if(!c)return;
    const spent=sum(monthExp().filter(x=>x.cardId===S.sel)),pp=v>0?spent/v*100:0;
    $('#cv-lim').textContent=v>0?money(v):'no limit';const b=$('#cv-bar');b.className=pctClass(pp);b.style.width=Math.min(100,pp)+'%';t.setAttribute('aria-valuetext',money(v))}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#modal').innerHTML)closeModal()});
function showTip(e){
  const t=e.target.closest&&e.target.closest('[data-tip]'),tip=$('#tip');
  document.querySelectorAll('[id$="-cross"]').forEach(l=>l.setAttribute('visibility','hidden'));
  if(!t){tip.hidden=true;return}
  tip.textContent=t.getAttribute('data-tip');tip.hidden=false;
  if(t.dataset.cross){const l=document.getElementById(t.dataset.cross);if(l){l.setAttribute('x1',t.dataset.cx);l.setAttribute('x2',t.dataset.cx);l.setAttribute('visibility','visible')}}
  const r=tip.getBoundingClientRect(),x=Math.min(Math.max(8,e.clientX-r.width/2),window.innerWidth-r.width-8),y=e.clientY-r.height-14;
  tip.style.left=x+'px';tip.style.top=(y<8?e.clientY+18:y)+'px';
}
document.addEventListener('pointermove',showTip);
document.addEventListener('pointerdown',showTip);
document.addEventListener('pointerleave',()=>{$('#tip').hidden=true});
window.addEventListener('scroll',()=>{$('#tip').hidden=true},{passive:true});
let rz;window.addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{if(S.view==='stats')fillStats();if(S.view==='account'){const c=$('#ch-bal');if(c)c.innerHTML=drawBal(c.clientWidth)}},150)});
$('#view').addEventListener('focusout',()=>setTimeout(()=>{if(S.pending)render()},0));

function route(){const ae=document.activeElement;if(ae&&ae!==document.body&&$('#view').contains(ae))ae.blur();const h=(location.hash||'').slice(1);if(h.startsWith('acct-')){S.view='account';S.pid=h.slice(5)}else S.view=VIEWS.includes(h)?h:'overview';S.confirm=null;render();window.scrollTo(0,0)}
window.addEventListener('hashchange',route);

/* ---------- sign in / sign out ---------- */
let authMode='login';
function show(which){$('#loading').hidden=which!=='loading';$('#auth').hidden=which!=='auth';$('#app').hidden=which!=='app'}
function authMsg(err,ok){const e=$('#auth-err'),o=$('#auth-ok');e.hidden=!err;e.textContent=err||'';o.hidden=!ok;o.textContent=ok||''}
function setMode(m){
  authMode=m;const signup=m==='signup';
  $('#auth-title').textContent=signup?'Create your account':'Log in';
  $('#auth-sub').textContent=signup?'Start tracking your budget. It syncs across all your devices.':'Your budget, cards and bills, saved to your account.';
  $('#auth-submit').textContent=signup?'Create account':'Log in';
  $('#auth-switch').textContent=signup?'Already have an account? Log in':'New here? Create an account';
  $('#auth-pass').setAttribute('autocomplete',signup?'new-password':'current-password');
  $('#auth-reset').hidden=signup;authMsg('','');
}
function authErr(e){
  const c=e&&e.code||'';
  if(c==='auth/popup-closed-by-user'||c==='auth/cancelled-popup-request')return '';
  if(['auth/invalid-credential','auth/wrong-password','auth/user-not-found','auth/invalid-login-credentials'].includes(c))return 'Email or password is wrong.';
  if(c==='auth/email-already-in-use')return 'An account with this email already exists. Log in instead.';
  if(c==='auth/weak-password')return 'Use at least 6 characters for your password.';
  if(c==='auth/invalid-email'||c==='auth/missing-email')return 'Enter a valid email address.';
  if(c==='auth/too-many-requests')return 'Too many tries. Wait a few minutes and try again.';
  if(c==='auth/network-request-failed')return 'No connection. Check your internet and try again.';
  if(c==='auth/unauthorized-domain')return 'This website address isn\'t allowed to sign in yet. Add it under Authentication → Settings → Authorized domains in Firebase.';
  if(c==='auth/operation-not-allowed')return 'This sign-in method is turned off. Turn it on under Authentication → Sign-in method in Firebase.';
  return 'Something went wrong signing in. Try again.';
}
function busy(on){['#auth-submit','#auth-google'].forEach(s=>{$(s).disabled=on})}
function setUser(u){S.user=u;paintUser()}
function profileName(){const u=S.user||{};return (S.profile&&String(S.profile.name||'').trim())||u.displayName||u.email||'Signed in'}
function safePhoto(src){return typeof src==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src)?src:''}
function profilePhoto(){const u=S.user||{};const own=safePhoto(S.profile&&S.profile.photo);if(own)return own;if(S.profile&&S.profile.photo==='none')return '';return /^https:\/\//.test(u.photoURL||'')?u.photoURL:''}
function paintAvatar(el,name,photo){
  if(!el)return;el.textContent='';
  if(photo){const img=document.createElement('img');img.src=photo;img.alt='';img.referrerPolicy='no-referrer';el.appendChild(img)}
  else el.textContent=(String(name).trim()[0]||'?').toUpperCase();
}
function paintUser(){
  if(!S.user)return;const name=profileName(),photo=profilePhoto();
  $('#u-name').textContent=name;paintAvatar($('#u-avatar'),name,photo);paintAvatar($('#m-avatar'),name,photo);
  const g=$('#greet');if(g)g.textContent=greeting();
}
function startAuth(){
  if(!configured){show('auth');busy(true);authMsg("Firebase isn't set up yet. Add your project's keys to the .env file, then restart (see README).",'');return}
  show('loading');
  watchUser(user=>{
    if(user){setUser(user);show('app');connect(user.uid);route()}
    else{S.user=null;disconnect();show('auth');setMode('login')}
  });
  $('#auth-switch').addEventListener('click',()=>setMode(authMode==='login'?'signup':'login'));
  $('#auth-google').addEventListener('click',async()=>{authMsg('','');busy(true);try{await logInWithGoogle()}catch(e){authMsg(authErr(e),'')}finally{busy(false)}});
  $('#auth-reset').addEventListener('click',async()=>{
    const email=$('#auth-email').value.trim();
    if(!email){authMsg('Type your email above first, then tap Forgot password.','');$('#auth-email').focus();return}
    try{await resetPassword(email);authMsg('','We sent a reset link to '+email+'. Check your inbox.')}catch(e){authMsg(authErr(e),'')}
  });
  $('#auth-form').addEventListener('submit',async e=>{
    e.preventDefault();e.stopPropagation();
    const email=$('#auth-email').value.trim(),pass=$('#auth-pass').value;
    if(!email){authMsg('Enter your email.','');return}
    if(pass.length<6){authMsg('Use at least 6 characters for your password.','');return}
    authMsg('','');busy(true);
    try{authMode==='signup'?await signUp(email,pass):await logIn(email,pass);$('#auth-pass').value=''}
    catch(err){authMsg(authErr(err),'')}
    finally{busy(false)}
  });
}
startAuth();

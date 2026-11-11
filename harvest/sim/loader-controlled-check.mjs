// Controlled comparison: only machine-feeder loader capacity toggles after identical tile purchases.
import { World } from '../js/world.js';
import { CFG } from '../js/config.js';
const DT=1/30,HORIZON=540,LOAD=60;
const buyAll=w=>{let changed=true,n=0;while(changed&&n++<300){changed=false;for(const t of w.tiles)if(t.visible&&!t.done){w.completeTile(t,true);changed=true;}}};
function run(li,season,seed,condition){
 const w=new World(li,{quiet:true,season,seed});buyAll(w);
 const feederBefore=w.workers.filter(x=>x.feedFor).map(x=>({id:x.id,feedFor:x.feedFor,loader:x.loader,cap:x.cap,speed:x.speed}));
 if(condition==='baseline'){for(const x of w.workers)if(x.feedFor)x.loader=false;w.refreshStats();}
 if(condition==='legacy-upgraded'){for(const x of w.workers)if(x.feedFor)x.loader=true;w.refreshStats();}
 const feederInitial=w.workers.filter(x=>x.feedFor).map(x=>({id:x.id,feedFor:x.feedFor,loader:x.loader,cap:x.cap,speed:x.speed}));
 const p=w.player,stands=Object.values(w.objs).filter(o=>o.kind==='stand'); let picks=0,drops=0;const events={pick:{},drop:{}};const waitSeconds={},feederWaits={};
 const emit=w.emit.bind(w);w.emit=(name,data={})=>{if(name==='pick'||name==='drop'){events[name][data.item]=(events[name][data.item]||0)+1;if(name==='pick')picks++;else drops++;}return emit(name,data);};p.sources=stands;
 let mode='',source=null,target=null,sink=null,standCursor=0,missingSink=0;const sold0={...w.stats.sold},produced0={...w.stats.produced};
 const inputs=new Set(w.procs.map(q=>q.inItem));const procFor=item=>w.procs.filter(q=>!q.hidden&&q.inItem===item).sort((a,b)=>(a.buf+a.inc)/CFG.proc.inMax-(b.buf+b.inc))[0];
 for(let f=0;f<HORIZON/DT;f++){
   let load=p.stack.length+p.incoming;
   if(mode==='stand'){if(load>=Math.min(LOAD,p.cap)){mode='';source=null;target=null;load=p.stack.length+p.incoming;}else if(source&&source.pile.total+source.pile.pending===0&&p.incoming===0){mode='';source=null;target=null;}}
   else if(mode==='sink'&&load===0){mode='';sink=null;target=null;}
   if(!mode){load=p.stack.length+p.incoming;if(load>0){const item=p.stack[0]||p.lastPick;const proc=procFor(item);const need=proc&&proc.buf+proc.inc<CFG.proc.inMax*.72;const counter=w.counters.find(c=>!c.hidden&&c.items.includes(item));sink=need?proc:counter||proc;if(sink){mode='sink';target=sink.kind==='proc'?{x:sink.inZone.cx,y:sink.inZone.cy}:{x:sink.zone.cx,y:sink.zone.cy};}else{missingSink++;mode='sink';sink=null;target=null;}}
   else{const avail=stands.filter(s=>!s.hidden&&s.pile.total+s.pile.pending>0);const score=s=>{const pr=procFor(s.item),need=pr&&pr.buf+pr.inc<CFG.proc.inMax*.72;const counter=w.counters.find(c=>!c.hidden&&c.items.includes(s.item));const isFinal=!inputs.has(s.item);return isFinal&&counter?30:need?24:counter?15:0;};avail.sort((a,b)=>score(b)-score(a)||Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(p.x-b.x,p.y-b.y));if(avail.length){source=avail[standCursor++%avail.length];const i=source.pile.hottest(p.x,p.y,w.t);target=source.pile.safe(i);mode='stand';}}}
   let ix=0,iy=0;if(target){let dx=target.x-p.x,dy=target.y-p.y,dist=Math.hypot(dx,dy),stop=mode==='stand'?3:6;if(dist>stop){const wp=w.botWay(p,target);dx=wp.x-p.x;dy=wp.y-p.y;const d=Math.hypot(dx,dy)||1;ix=dx/d;iy=dy/d;}}
   for(const worker of w.workers)if(worker.waitReason){waitSeconds[worker.waitReason]=(waitSeconds[worker.waitReason]||0)+DT;if(worker.feedFor){const q=feederWaits[worker.feedFor]||(feederWaits[worker.feedFor]={});q[worker.waitReason]=(q[worker.waitReason]||0)+DT;}}
   w.update(DT,ix,iy);
 }
 const delta=(obj,old)=>Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,v-(old[k]||0)]).filter(([,v])=>v>0));
 const feeds=w.workers.filter(x=>x.feedFor).map(x=>({id:x.id,machine:x.feedFor,cap:x.cap,loader:x.loader,trips:x.trips,done:x.done,stack:x.stack.length,state:x.state,waitReason:x.waitReason}));
 return {level:li+1,season,condition,seed,feedersBefore:feederBefore,feedersAfter:feederInitial,feedersEnd:feeds,feederWaits:Object.fromEntries(Object.entries(feederWaits).map(([m,q])=>[m,Object.fromEntries(Object.entries(q).map(([k,v])=>[k,+v.toFixed(1)]))])),processors:w.procs.map(q=>({id:q.id,buf:q.buf,inc:q.inc,out:q.out,pile:q.outPile?.total})),picks,drops,sold:delta(w.stats.sold,sold0),produced:delta(w.stats.produced,produced0),earned:Math.floor(w.stats.earned),goal:w.L.goal?.n?.[season]??w.L.goal?.n??0,waits:Object.fromEntries(Object.entries(waitSeconds).map(([k,v])=>[k,+v.toFixed(1)])),tableStocks:stands.map(s=>`${s.id}:${s.pile.total+s.pile.pending}/${s.pile.cap}`).join(',')};
}
const levels=(process.env.LEVELS||"53,56,59").split(",").map(Number), seasons=(process.env.SEASONS||"0").split(",").map(Number);
for(const li of levels)for(const season of seasons){const seed=78300+li*10+season;const a=run(li,season,seed,'baseline'),b=run(li,season,seed,'legacy-upgraded'),c=run(li,season,seed,'patched-upgrade');console.log(JSON.stringify({baseline:a,legacyUpgrade:b,patchedUpgrade:c}));}

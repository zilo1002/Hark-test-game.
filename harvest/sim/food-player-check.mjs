// Active-player balance exercise for food levels: real navigation, collecting from the
// dedicated wooden tables, feeding a matching processor when useful, and otherwise checking out.
import { World } from '../js/world.js';
import { CFG } from '../js/config.js';
const DT=1/30,HORIZON=+(process.env.HORIZON||90),LOAD=+(process.env.LOAD||60);
const buyAll=w=>{let changed=true,n=0;while(changed&&n++<300){changed=false;for(const t of w.tiles)if(t.visible&&!t.done){w.completeTile(t,true);changed=true;}}};
function run(li,season,seed){
 const w=new World(li,{quiet:true,season,seed});buyAll(w);const p=w.player,stands=Object.values(w.objs).filter(o=>o.kind==='stand');
 let picks=0,drops=0; const events={pick:{},drop:{}}; const waitSeconds={}; let noReasonCollectSeconds=0;
 const emit=w.emit.bind(w);w.emit=(name,data={})=>{if(name==='pick'||name==='drop'){events[name][data.item]=(events[name][data.item]||0)+1;if(name==='pick')picks++;else drops++;}return emit(name,data);};
 p.sources=stands;
 let mode='',source=null,target=null,sink=null,standCursor=0,missingSink=0;
 const sold0={...w.stats.sold},produced0={...w.stats.produced};
 const count=(obj)=>Object.values(obj).reduce((a,b)=>a+(+b||0),0);
 const inputs=new Set(w.procs.map(q=>q.inItem));
 const procFor=item=>w.procs.filter(q=>!q.hidden&&q.inItem===item).sort((a,b)=>(a.buf+a.inc)/CFG.proc.inMax-(b.buf+b.inc)/CFG.proc.inMax)[0];
 for(let f=0;f<HORIZON/DT;f++){
   let load=p.stack.length+p.incoming;
   if(mode==='stand'){
     if(load>=Math.min(LOAD,p.cap)){mode='';source=null;target=null;load=p.stack.length+p.incoming;}
     else if(source&&source.pile.total+source.pile.pending===0&&p.incoming===0){mode='';source=null;target=null;}
   } else if(mode==='sink'&&load===0){mode='';sink=null;target=null;}
   if(!mode){
     load=p.stack.length+p.incoming;
     if(load>0){
       const item=p.stack[0]||p.lastPick;
       const proc=procFor(item); const need=proc&&proc.buf+proc.inc<CFG.proc.inMax*.72;
       const counter=w.counters.find(c=>!c.hidden&&c.items.includes(item));
       sink=need?proc:counter||proc;
       if(sink){mode='sink';target=sink.kind==='proc'?{x:sink.inZone.cx,y:sink.inZone.cy}:{x:sink.zone.cx,y:sink.zone.cy};}
       else {missingSink++;mode='sink';sink=null;target=null;}
     } else {
       const avail=stands.filter(s=>!s.hidden&&s.pile.total+s.pile.pending>0);
       const score=s=>{
         const pr=procFor(s.item),need=pr&&pr.buf+pr.inc<CFG.proc.inMax*.72;
         const counter=w.counters.find(c=>!c.hidden&&c.items.includes(s.item));
         const isFinal=!inputs.has(s.item);
         return isFinal&&counter?30:need?24:counter?15:0;
       };
       avail.sort((a,b)=>score(b)-score(a)||Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(p.x-b.x,p.y-b.y));
       if(avail.length){source=avail[standCursor++%avail.length];const i=source.pile.hottest(p.x,p.y,w.t);target=source.pile.safe(i);mode='stand';}
     }
   }
   let ix=0,iy=0;
   if(target){let dx=target.x-p.x,dy=target.y-p.y,dist=Math.hypot(dx,dy),stop=mode==='stand'?3:6;if(dist>stop){const wp=w.botWay(p,target);dx=wp.x-p.x;dy=wp.y-p.y;const d=Math.hypot(dx,dy)||1;ix=dx/d;iy=dy/d;}}
   for(const worker of w.workers){if(worker.waitReason)waitSeconds[worker.waitReason]=(waitSeconds[worker.waitReason]||0)+DT;else if(worker.state==='collect'&&worker.stack.length===0&&worker.incoming===0)noReasonCollectSeconds+=DT;}
   w.update(DT,ix,iy);
 }
 const sold=Object.fromEntries(Object.entries(w.stats.sold).map(([k,v])=>[k,v-(sold0[k]||0)]).filter(([,v])=>v>0));
 const produced=Object.fromEntries(Object.entries(w.stats.produced).map(([k,v])=>[k,v-(produced0[k]||0)]).filter(([,v])=>v>0));
 const waits=Object.fromEntries(Object.entries(waitSeconds).map(([k,v])=>[k,+v.toFixed(1)]));
 const impossible=w.workers.filter(x=>x.state==='deliver'&&x.blocked&&!x.waitReason).length;
 const tableStocks=stands.map(s=>`${s.id}:${s.pile.total+s.pile.pending}/${s.pile.cap}`).join(',');
 const logs=w.waitLog||[]; const customer=Object.fromEntries(w.counters.map(c=>{const q=logs.filter(x=>x.c===c.id);return[c.id,{queue:c.queue?.length??0,stock:c.stock?.length??0,served:q.length,avgWait:+(q.reduce((a,x)=>a+x.wait,0)/(q.length||1)).toFixed(1),maxWait:+(Math.max(0,...q.map(x=>x.wait))).toFixed(1),dry:q.filter(x=>x.dry).length,partial:q.filter(x=>x.got<x.want).length}]}));
 const goal=w.L.goal?.n?.[season]??w.L.goal?.n??0; return {level:li+1,season,time:HORIZON,pickups:picks,drops,sold,produced,earned:Math.floor(w.stats.earned),goal,goalPct:goal?Math.floor(w.stats.earned/goal*100):0,playerStack:p.stack.length,playerItem:p.stack[0]||'',tables:tableStocks,customer,waits,noReasonCollectSeconds:+noReasonCollectSeconds.toFixed(1),unexplained:impossible,missingSink};
}
const lo=+(process.env.LOW||53),hi=+(process.env.HIGH||60),seasons=+(process.env.SEASONS||4),rs=[];
for(let li=lo;li<hi;li++)for(let season=0;season<seasons;season++)rs.push(run(li,season,66000+li*10+season));
for(const r of rs)console.log(`L${r.level} S${r.season}: ${r.time}s earned=${r.earned}/${r.goal}(${r.goalPct}%) pickup=${r.pickups} drop=${r.drops} sold=${JSON.stringify(r.sold)} made=${JSON.stringify(r.produced)} hand=${r.playerStack}:${r.playerItem} tables=${r.tables} checkout=${JSON.stringify(r.customer)} waits=${JSON.stringify(r.waits)} emptyCollect=${r.noReasonCollectSeconds}s unexplained=${r.unexplained} noSink=${r.missingSink}`);

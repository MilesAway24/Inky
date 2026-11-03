/* ── MossOS glue (added by mobile/build.mjs) ───────────────────────────
   Small functions the MossOS page calls into this frame. Every number comes
   from Payday OS's own functions, so Money and Today always agree. */
const __finNotify=()=>{try{parent.__finChanged&&parent.__finChanged()}catch(e){}};
{const r0=rerender;rerender=function(){r0();__finNotify()}}
window.__finInfo=()=>({bridge:!!(window.claude&&claude.use),sync:cloud?'cloud':'local',monarch:liveState==='live'?'live':monarch?'file':'none'});
window.__finSummary=()=>{try{
  let A=allowance(),s=safe(),av=avalanche(s.extra);
  return {leftToday:Math.round(A.leftToday),todayAllow:Math.round(A.todayAllow),weekLeft:Math.round(A.weekLeft),
    bills:upcoming(4).map(b=>({name:String(b.title).replace(' minimum',''),amt:b.amount,date:iso(b.date),est:!!b.est})),
    debtFree:av.done?monYr(weekDate(av.done)):null,friday:{done:state.checks.filter(Boolean).length,total:state.checks.length},
    isFriday:today().getDay()===5,live:liveState==='live'}}catch(e){return null}};
window.__finEvents=(y,m)=>{try{return eventsFor(y,m).filter(e=>e.type==='pay'||e.type==='bill').map(e=>({day:e.day,title:String(e.title),amount:e.amount,type:e.type}))}catch(e){return []}};
window.__finImport=text=>{let b;try{b=JSON.parse(String(text).trim())}catch(e){return {ok:false,msg:'That isn\'t a Payday OS backup. In Payday OS, open Settings and tap "Copy JSON backup", then paste it here.'}}
  let st=b&&b.state&&typeof b.state==='object'?b.state:b;
  if(!st||typeof st!=='object'||!(typeof st.pay==='number')||!Array.isArray(st.checks))return {ok:false,msg:'That doesn\'t look like a Payday OS backup. It needs your plan (pay, Friday checklist).'};
  state={...structuredClone(defaults),...structuredClone(st)};normalize();persist();
  if(b.state&&'monarch' in b){monarch=b.monarch?structuredClone(b.monarch):null;persistM()}
  go('today');return {ok:true,msg:'Payday OS data imported'}};
window.__finLog=(amount,merchant,bucket,note)=>{try{let a=Math.round(Number(amount)*100)/100;if(!(a>0))return null;
  let B=Object.keys(BUCKETS),b=B.includes(bucket)?bucket:'allow',id=Date.now().toString(36);
  state.quickLog.push({id,date:iso(today()),amt:a,merchant:String(merchant||'Purchase').slice(0,60),bucket:b,note:String(note||'').slice(0,200)});
  state.quickLog=state.quickLog.slice(-60);state.txCat['q'+id]=b;persist();award(5,'logged a purchase',true);if(!busyTyping())rerender();
  let A=allowance();return {bucket:BUCKETS[b][0],leftToday:Math.round(A.leftToday),weekLeft:Math.round(A.weekLeft)}}catch(e){return null}};
window.__finTheme=t=>{let r=document.documentElement;if(t==='dark'||t==='light')r.setAttribute('data-theme',t);else r.removeAttribute('data-theme')};

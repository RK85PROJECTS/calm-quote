import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";

/* ─── REGION ─── */
function detectRegion() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const lc = navigator.language || "";
    if (/Asia\//i.test(tz)) return "asian";
    if (/America\//i.test(tz)) return "american";
    if (/Europe\//i.test(tz) || /^(fr|de|es|it|nl|pt|pl|sv)/i.test(lc)) return "european";
    return "global";
  } catch { return "global"; }
}
const REGION = detectRegion();
const fmtDate = iso => { try { const d=new Date(iso); return REGION==="american"?d.toLocaleDateString("en-US",{month:"short",day:"numeric"}):d.toLocaleDateString("en-GB",{day:"numeric",month:"short"}); } catch { return iso; } };
const fmtNum  = n   => { try { return new Intl.NumberFormat(navigator.language||"en").format(n); } catch { return String(n); } };

/* ─── DATA ─── */
const W = [
  { id:"time",     label:"Time",     icon:"⏳", color:"#c4b5fd", glow:"rgba(196,181,253,0.3)", grad:"linear-gradient(135deg,#c4b5fd 0%,#8b5cf6 100%)", principle:"Every hour is either an investment or a cost.",           framework:"Time Audit: identify your highest-leverage moments.",        prompts:["What did you truly invest time in today — vs. just spend it?","What was your highest-leverage moment today?","Does your calendar reflect your real priorities?"] },
  { id:"money",    label:"Money",    icon:"💸", color:"#6ee7b7", glow:"rgba(110,231,183,0.3)", grad:"linear-gradient(135deg,#6ee7b7 0%,#059669 100%)", principle:"Money is a tool. Freedom is the goal.",                   framework:"Freedom Fund: every dollar saved is a vote for optionality.",  prompts:["Did any financial decision today move you toward or away from freedom?","Are you building anything that earns while you sleep?","Did your spending align with your values today?"] },
  { id:"mental",   label:"Mental",   icon:"🧠", color:"#93c5fd", glow:"rgba(147,197,253,0.3)", grad:"linear-gradient(135deg,#93c5fd 0%,#2563eb 100%)", principle:"Your mind compounds. Feed it accordingly.",               framework:"Curiosity Flywheel: Curiosity → Learning → Insight → Growth.", prompts:["What spun your Curiosity Flywheel today?","What idea genuinely surprised or challenged you?","What mental weight could you choose to put down?"] },
  { id:"physical", label:"Physical", icon:"⚡", color:"#fdba74", glow:"rgba(253,186,116,0.3)", grad:"linear-gradient(135deg,#fdba74 0%,#c2410c 100%)", principle:"Your body is the vessel for everything else.",            framework:"Energy Pyramid: Sleep → Movement → Nutrition → Mindfulness.", prompts:["Walk through your Energy Pyramid — where is it weakest?","How much did you invest in physical wealth today (1–10)?","Do you have a non-negotiable anchor? Did you honor it?"] },
  { id:"social",   label:"Social",   icon:"🫂", color:"#fcd34d", glow:"rgba(252,211,77,0.3)",  grad:"linear-gradient(135deg,#fcd34d 0%,#d97706 100%)", principle:"Your relationships are compounding assets or slow drains.", framework:"Give, Ask, Thank — with real intention.",                    prompts:["Did you Give, Ask, or Thank someone with real intention today?","Who is a long-term relationship worth investing in? Did you?","Who energizes you — and who quietly drains you?"] },
];
const MOODS = [{e:"💀",l:"depleted"},{e:"😮‍💨",l:"drained"},{e:"😐",l:"neutral"},{e:"✨",l:"energized"},{e:"🔥",l:"thriving"}];
const REFERRAL = "https://calm-quote.vercel.app";

/* ─── AI ─── */
const BASE_SYS = `You are "The Guide" — a wise, warm, philosophical inner coach inside Calm Quote, a journaling app built on 5 types of wealth: Time, Money, Mental, Physical, Social. Voice: clear, occasionally aphoristic, deeply caring. 3–5 sentences. Always be specific. Reference frameworks naturally (Time Audit, Freedom Fund, Curiosity Flywheel, Energy Pyramid, Give-Ask-Thank). Cultural tone — Asian: measured, collective, patient. American: direct, energetic, action-first. European: balanced, nuanced, harmony-focused. Global: universal, philosophical. Region: ${REGION}. English only. No region-specific institutions or currencies.`;

function buildSys(p) {
  const dom=(p.dominantWealth||[]).map(id=>W.find(w=>w.id===id)?.label).filter(Boolean).join(",")||"unknown";
  const neg=(p.neglectedWealth||[]).map(id=>W.find(w=>w.id===id)?.label).filter(Boolean).join(",")||"none";
  return `${BASE_SYS}\n\nUSER: depth=${p.journalDepth||"?"}, time=${p.journalTime||"?"}, focus=${dom}, neglected=${neg}, trend=${p.moodTrend||"stable"}, entries=${p.sessionCount||0}`;
}

/* ─── STORAGE ─── */
function useStore(k,d){const[v,sv]=useState(()=>{try{const x=localStorage.getItem(k);return x?JSON.parse(x):d;}catch{return d;}});const set=useCallback(val=>{sv(prev=>{const n=typeof val==="function"?val(prev):val;try{localStorage.setItem(k,JSON.stringify(n));}catch{}return n;});},[k]);return[v,set];}

/* ─── UTILS ─── */
const toDay  = () => new Date().toISOString().split("T")[0];
const wkAgo  = () => new Date(Date.now()-7*864e5).toISOString().split("T")[0];
const yday   = () => new Date(Date.now()-864e5).toISOString().split("T")[0];
const hr     = () => new Date().getHours();
const wc     = (s="") => s.trim().split(/\s+/).filter(Boolean).length;
const timeOf = h => h>=5&&h<12?"morning":h>=12&&h<17?"afternoon":h>=17&&h<21?"evening":"night";
const vibe   = () => { try{navigator.vibrate&&navigator.vibrate(8);}catch{} };

function recompute(entries,prev={}){
  if(!entries.length)return prev;
  const cnt={};W.forEach(w=>{cnt[w.id]=0;});entries.forEach(e=>{if(cnt[e.type]!==undefined)cnt[e.type]++;});
  const sorted=Object.entries(cnt).sort((a,b)=>b[1]-a[1]);
  const r5=entries.slice(0,5).map(e=>e.mood||2),p5=entries.slice(5,10).map(e=>e.mood||2);
  const aR=r5.length?r5.reduce((a,b)=>a+b,0)/r5.length:2,aP=p5.length?p5.reduce((a,b)=>a+b,0)/p5.length:2;
  const allWc=entries.flatMap(e=>e.answers||[]).map(a=>wc(a));
  const avgW=allWc.length?allWc.reduce((a,b)=>a+b,0)/allWc.length:0;
  return{...prev,dominantWealth:sorted.slice(0,2).filter(([,c])=>c>0).map(([id])=>id),neglectedWealth:sorted.slice(-2).filter(([,c])=>c<2).map(([id])=>id),moodTrend:aR>aP+.3?"rising":aR<aP-.3?"falling":"stable",journalDepth:avgW<20?"shallow":avgW<60?"medium":"deep",totalWords:allWc.reduce((a,b)=>a+b,0),growthAreas:W.filter(w=>{const t=entries.filter(e=>e.type===w.id);if(t.length<4)return false;return t.slice(0,2).reduce((a,e)=>a+(e.mood||2),0)/2>t.slice(2,4).reduce((a,e)=>a+(e.mood||2),0)/2+.4;}).map(w=>w.id),sessionCount:(prev.sessionCount||0)+1,journalTime:timeOf(hr()),lastProfileUpdate:toDay()};
}

async function ask(sys,usr){try{const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:sys,messages:[{role:"user",content:usr}]})});const d=await r.json();return d.content?.[0]?.text||"";}catch{return "";}}

/* ─── VOICE INPUT HOOK ─── */
function useVoice(onResult) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSupported(true);
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = navigator.language || "en-US";
      rec.onresult = e => {
        const transcript = Array.from(e.results).map(r => r[0].transcript).join("");
        onResult(transcript);
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      recRef.current = rec;
    }
  }, []);

  function start() {
    if (!recRef.current || listening) return;
    vibe();
    try { recRef.current.start(); setListening(true); } catch {}
  }

  function stop() {
    if (!recRef.current || !listening) return;
    vibe();
    try { recRef.current.stop(); setListening(false); } catch {}
  }

  function toggle() { listening ? stop() : start(); }

  return { listening, supported, start, stop, toggle };
}

/* ─── VOICE BUTTON ─── */
function VoiceBtn({ onResult, style = {} }) {
  const { listening, supported, toggle, stop } = useVoice(onResult);
  if (!supported) return null;

  return (
    <div
      onPointerDown={toggle}
      onPointerUp={() => {}} // hold-to-talk handled via listening state
      style={{
        width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
        background: listening ? "rgba(196,181,253,0.2)" : "rgba(255,255,255,0.06)",
        border: `1.5px solid ${listening ? "rgba(196,181,253,0.6)" : "rgba(255,255,255,0.1)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", transition: "all .2s",
        boxShadow: listening ? "0 0 16px rgba(196,181,253,0.4)" : "none",
        WebkitTapHighlightColor: "transparent",
        userSelect: "none",
        ...style,
      }}
    >
      <span style={{ fontSize: 18 }}>{listening ? "⏹" : "🎙"}</span>
      {listening && (
        <span style={{
          position: "absolute", width: 40, height: 40, borderRadius: "50%",
          border: "1.5px solid rgba(196,181,253,0.4)",
          animation: "ripple 1s infinite ease-out",
        }} />
      )}
      <style>{`@keyframes ripple{0%{transform:scale(1);opacity:.8}100%{transform:scale(1.8);opacity:0}}`}</style>
    </div>
  );
}
function Dots({color="#c4b5fd"}){
  return(
    <div style={{display:"flex",gap:5,alignItems:"center"}}>
      {[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:color,animation:`dp 1.2s ${i*.2}s infinite ease-in-out`}}/>)}
      <style>{`@keyframes dp{0%,100%{opacity:.15;transform:scale(.7)}50%{opacity:1;transform:scale(1.2)}}`}</style>
    </div>
  );
}

function Tap({children,onTap,style={},disabled}){
  const[p,sp]=useState(false);
  return(
    <div onPointerDown={()=>sp(true)} onPointerUp={()=>sp(false)} onPointerLeave={()=>sp(false)}
      onClick={()=>{if(!disabled){vibe();onTap&&onTap();}}}
      style={{cursor:disabled?"default":"pointer",transform:p&&!disabled?"scale(0.96)":"scale(1)",transition:"transform .12s cubic-bezier(.34,1.56,.64,1)",WebkitTapHighlightColor:"transparent",userSelect:"none",...style}}>
      {children}
    </div>
  );
}

/* ─── NAV ─── */
function Nav({active,go}){
  const tabs=[{id:"home",l:"Home"},{id:"insights",l:"Stats"},{id:"profile",l:"Profile"},{id:"search",l:"Search"},{id:"feedback",l:"Feedback"},{id:"referral",l:"Share"}];
  return(
    <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:9999,paddingBottom:"env(safe-area-inset-bottom)"}}>
      <div style={{background:"rgba(10,10,18,0.95)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",borderTop:"1px solid rgba(255,255,255,0.06)",display:"flex",height:56}}>
        {tabs.map(t=>{
          const on=active===t.id;
          return(
            <button key={t.id} onClick={()=>{vibe();go(t.id);}}
              style={{flex:1,border:"none",background:"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,WebkitTapHighlightColor:"transparent",position:"relative"}}>
              {on&&<div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:20,height:2,borderRadius:"0 0 4px 4px",background:"linear-gradient(90deg,#c4b5fd,#8b5cf6)"}}/>}
              <span style={{fontSize:10,fontWeight:on?700:400,color:on?"#fff":"rgba(255,255,255,0.22)",letterSpacing:.6,textTransform:"uppercase",transition:"color .2s"}}>{t.l}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── ONBOARDING ─── */
function Onboarding({onDone}){
  const[s,ss]=useState(0);
  const slides=[
    {icon:"✦",title:"Calm Quote",   body:"A daily journal for all 5 types of wealth.",         color:"#c4b5fd",grad:"linear-gradient(135deg,#c4b5fd,#8b5cf6)"},
    {icon:"⏳",title:"Time",         body:"Every hour is either an investment or a cost.",       color:"#c4b5fd",grad:"linear-gradient(135deg,#c4b5fd,#8b5cf6)"},
    {icon:"🧠",title:"Mental",       body:"Your mind compounds. Feed it accordingly.",           color:"#93c5fd",grad:"linear-gradient(135deg,#93c5fd,#2563eb)"},
    {icon:"💸",title:"Money",        body:"Money is a tool. Freedom is the goal.",              color:"#6ee7b7",grad:"linear-gradient(135deg,#6ee7b7,#059669)"},
    {icon:"⚡",title:"Physical",     body:"Your body is the vessel for everything else.",       color:"#fdba74",grad:"linear-gradient(135deg,#fdba74,#c2410c)"},
    {icon:"🫂",title:"Social",       body:"Your relationships compound or drain. Choose wisely.",color:"#fcd34d",grad:"linear-gradient(135deg,#fcd34d,#d97706)"},
    {icon:"→",  title:"Let's begin.",body:"One honest reflection a day. That's all it takes.", color:"#c4b5fd",grad:"linear-gradient(135deg,#c4b5fd,#6ee7b7)"},
  ];
  const sl=slides[s];const last=s===slides.length-1;
  return(
    <div style={{minHeight:"100dvh",background:"#09090f",display:"flex",flexDirection:"column",justifyContent:"space-between",padding:"56px 28px calc(48px + env(safe-area-inset-bottom))",fontFamily:"'Inter',-apple-system,sans-serif"}}>
      {/* Ambient glow */}
      <div style={{position:"fixed",top:"-20%",left:"50%",transform:"translateX(-50%)",width:"80%",height:"50%",background:`radial-gradient(ellipse,${sl.color}18 0%,transparent 70%)`,pointerEvents:"none",transition:"background .5s"}}/>
      <div style={{position:"relative",zIndex:1}}>
        <div style={{display:"flex",gap:4,marginBottom:0}}>
          {slides.map((_,i)=><div key={i} style={{flex:1,height:2,borderRadius:99,background:i<=s?sl.color:"rgba(255,255,255,0.08)",transition:"background .3s"}}/>)}
        </div>
      </div>
      <div style={{position:"relative",zIndex:1}}>
        <div style={{fontSize:56,marginBottom:24,lineHeight:1,filter:`drop-shadow(0 0 20px ${sl.color}88)`}}>{sl.icon}</div>
        <h1 style={{color:"#fff",fontSize:32,fontWeight:900,lineHeight:1.1,letterSpacing:"-1.5px",margin:"0 0 14px"}}>{sl.title}</h1>
        <p style={{color:"rgba(255,255,255,0.4)",fontSize:17,lineHeight:1.7,margin:0}}>{sl.body}</p>
      </div>
      <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",gap:12}}>
        <Tap onTap={()=>last?onDone():ss(x=>x+1)}
          style={{background:sl.grad,borderRadius:18,padding:"17px",textAlign:"center",boxShadow:`0 8px 32px ${sl.color}44`}}>
          <span style={{color:"#fff",fontWeight:800,fontSize:17}}>{last?"Start journaling →":"Continue"}</span>
        </Tap>
        {!last&&<div onClick={()=>{vibe();onDone();}} style={{textAlign:"center",color:"rgba(255,255,255,0.2)",fontSize:13,cursor:"pointer",padding:"8px",WebkitTapHighlightColor:"transparent"}}>Skip intro</div>}
      </div>
    </div>
  );
}

/* ─── WEALTH CARD (home grid) ─── */
function WCard({w,cnt,neglected,growing,onTap}){
  const[hov,sh]=useState(false);
  return(
    <Tap onTap={onTap} style={{position:"relative",overflow:"hidden",borderRadius:20,background:"rgba(255,255,255,0.03)",border:`1px solid rgba(255,255,255,${hov?.1:.05})`,padding:"16px",transition:"border-color .2s"}}
      {...{onMouseEnter:()=>sh(true),onMouseLeave:()=>sh(false)}}>
      {/* subtle gradient corner */}
      <div style={{position:"absolute",top:0,right:0,width:80,height:80,background:`radial-gradient(ellipse at top right,${w.color}18,transparent 70%)`,pointerEvents:"none"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div style={{fontSize:26,filter:`drop-shadow(0 0 8px ${w.glow})`}}>{w.icon}</div>
        <div style={{display:"flex",gap:4,alignItems:"center"}}>
          {growing   &&<span style={{color:w.color,fontSize:11,fontWeight:800,background:`${w.color}18`,borderRadius:99,padding:"1px 6px"}}>↑</span>}
          {neglected &&<span style={{color:"rgba(255,120,120,0.7)",fontSize:10,fontWeight:700,background:"rgba(255,80,80,0.08)",borderRadius:99,padding:"1px 6px"}}>!</span>}
        </div>
      </div>
      <p style={{color:"#fff",fontWeight:700,fontSize:14,margin:"0 0 4px",letterSpacing:"-.2px"}}>{w.label}</p>
      <p style={{color:"rgba(255,255,255,0.22)",fontSize:11,margin:"0 0 10px",lineHeight:1.45,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{w.principle}</p>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <div style={{flex:1,height:2,borderRadius:99,background:"rgba(255,255,255,0.06)"}}>
          <div style={{width:cnt>0?"100%":"0%",height:"100%",borderRadius:99,background:w.grad,opacity:.8,transition:"width .6s"}}/>
        </div>
        <span style={{color:cnt>0?w.color:"rgba(255,255,255,0.15)",fontSize:11,fontWeight:600,flexShrink:0}}>{cnt}</span>
      </div>
    </Tap>
  );
}

/* ─── STATS SCREEN ─── */
function StatsScreen({entries,streak,weekly,wLoad,onGenWeekly}){
  const[showP,sP]=useState(null);
  const cnt=useMemo(()=>{const c={};W.forEach(w=>{c[w.id]=0;});entries.forEach(e=>{if(c[e.type]!==undefined)c[e.type]++;});return c;},[entries]);
  const maxC=Math.max(...Object.values(cnt),1);
  const thisWeek=entries.filter(e=>e.date>=wkAgo()).length;
  return(
    <div style={{padding:"52px 20px calc(80px + env(safe-area-inset-bottom))",paddingTop:"calc(52px + env(safe-area-inset-top,0px))"}}>
      <p style={{color:"rgba(255,255,255,0.2)",fontSize:10,textTransform:"uppercase",letterSpacing:2.5,marginBottom:6}}>Your Progress</p>
      <h2 style={{color:"#fff",fontSize:24,fontWeight:900,margin:"0 0 24px",letterSpacing:"-1px"}}>Wealth Stats</h2>
      {/* Hero numbers */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:28}}>
        {[
          {l:"Total",    v:fmtNum(entries.length), c:"#fff"},
          {l:"Streak",   v:`🔥 ${streak.count}`,    c:"#fcd34d"},
          {l:"This week",v:fmtNum(thisWeek),         c:"#6ee7b7"},
        ].map(x=>(
          <div key={x.l} style={{background:"rgba(255,255,255,0.04)",borderRadius:16,padding:"14px 10px",textAlign:"center",border:"1px solid rgba(255,255,255,0.05)"}}>
            <div style={{color:x.c,fontSize:20,fontWeight:900,letterSpacing:"-0.5px"}}>{x.v}</div>
            <div style={{color:"rgba(255,255,255,0.2)",fontSize:10,marginTop:4,textTransform:"uppercase",letterSpacing:.5}}>{x.l}</div>
          </div>
        ))}
      </div>
      {/* Weekly debrief */}
      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:20,padding:"18px",marginBottom:24}}>
        <p style={{color:"rgba(255,255,255,0.2)",fontSize:10,textTransform:"uppercase",letterSpacing:2,marginBottom:10}}>Weekly Debrief</p>
        {weekly.text?<p style={{color:"rgba(255,255,255,0.5)",fontSize:14,lineHeight:1.8,fontStyle:"italic",marginBottom:14}}>{weekly.text}</p>
          :<p style={{color:"rgba(255,255,255,0.2)",fontSize:14,marginBottom:14,lineHeight:1.5}}>Generate your first personalised weekly debrief — The Guide will analyse your patterns and identify your next focus.</p>}
        <Tap onTap={thisWeek>0&&!wLoad?onGenWeekly:undefined}
          style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.07)",borderRadius:12,padding:"10px 16px",opacity:thisWeek===0||wLoad?.4:1}}>
          {wLoad?<Dots/>:<span style={{color:"rgba(255,255,255,0.55)",fontSize:13,fontWeight:600}}>Generate Debrief</span>}
        </Tap>
      </div>
      {/* Allocation */}
      <div style={{marginBottom:24}}>
        <p style={{color:"rgba(255,255,255,0.2)",fontSize:10,textTransform:"uppercase",letterSpacing:2,marginBottom:16}}>Wealth Allocation</p>
        {W.map(w=>(
          <div key={w.id} style={{marginBottom:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{color:"rgba(255,255,255,0.6)",fontSize:13,fontWeight:500}}>{w.icon} {w.label}</span>
              <span style={{color:"rgba(255,255,255,0.2)",fontSize:12}}>{cnt[w.id]} entries</span>
            </div>
            <div style={{background:"rgba(255,255,255,0.05)",borderRadius:99,height:5,overflow:"hidden"}}>
              <div style={{background:w.grad,width:`${(cnt[w.id]/maxC)*100}%`,height:"100%",borderRadius:99,transition:"width .7s cubic-bezier(.34,1.56,.64,1)",boxShadow:`0 0 8px ${w.glow}`}}/>
            </div>
            <button onClick={()=>{vibe();sP(showP===w.id?null:w.id);}} style={{background:"none",border:"none",color:"rgba(255,255,255,0.18)",fontSize:10,cursor:"pointer",padding:"4px 0 0",letterSpacing:.5,textTransform:"uppercase",WebkitTapHighlightColor:"transparent"}}>
              {showP===w.id?"hide ▲":"principle ▼"}
            </button>
            {showP===w.id&&<p style={{color:"rgba(255,255,255,0.3)",fontSize:12,lineHeight:1.6,margin:"6px 0 0",paddingLeft:12,borderLeft:`2px solid ${w.color}55`}}>{w.principle}</p>}
          </div>
        ))}
      </div>
      {/* Mood grid */}
      <div>
        <p style={{color:"rgba(255,255,255,0.2)",fontSize:10,textTransform:"uppercase",letterSpacing:2,marginBottom:12}}>Energy by Type</p>
        <div style={{display:"flex",gap:8}}>
          {W.map(w=>{const te=entries.filter(e=>e.type===w.id);const avg=te.length?Math.round(te.reduce((s,e)=>s+e.mood,0)/te.length):null;return(
            <div key={w.id} style={{flex:1,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:14,padding:"12px 4px",textAlign:"center"}}>
              <div style={{fontSize:16}}>{w.icon}</div>
              <div style={{fontSize:18,margin:"5px 0 3px"}}>{avg!==null?MOODS[avg].e:"—"}</div>
              <div style={{color:"rgba(255,255,255,0.15)",fontSize:8,textTransform:"uppercase"}}>{avg!==null?MOODS[avg].l:"—"}</div>
            </div>
          );})}
        </div>
      </div>
    </div>
  );
}

/* ─── PROFILE SCREEN ─── */
function ProfileScreen({profile,entries,onInsight}){
  const[load,sl]=useState(false);
  const latest=(profile.insights||[]).slice(-1)[0]||"";
  const dom=(profile.dominantWealth||[]).map(id=>W.find(w=>w.id===id)).filter(Boolean);
  const neg=(profile.neglectedWealth||[]).map(id=>W.find(w=>w.id===id)).filter(Boolean);
  async function refresh(){sl(true);const t=await ask(buildSys(profile),`Write ONE personal insight (2–3 sentences) about this user's wealth journey based on their behaviour and reflections.\n\nProfile: ${JSON.stringify(profile)}\n\nRecent: ${entries.slice(0,6).map(e=>`[${e.type}] ${e.answers?.filter(Boolean).join("|")}`).join("\n")}`);if(t)onInsight(t);sl(false);}
  const Row=({l,v,c="rgba(255,255,255,0.55)"})=>(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
      <span style={{color:"rgba(255,255,255,0.25)",fontSize:13}}>{l}</span>
      <span style={{color:c,fontSize:13,fontWeight:600}}>{v}</span>
    </div>
  );
  return(
    <div style={{padding:"52px 20px calc(80px + env(safe-area-inset-bottom))",paddingTop:"calc(52px + env(safe-area-inset-top,0px))"}}>
      <p style={{color:"rgba(255,255,255,0.2)",fontSize:10,textTransform:"uppercase",letterSpacing:2.5,marginBottom:6}}>Your Identity</p>
      <h2 style={{color:"#fff",fontSize:24,fontWeight:900,margin:"0 0 24px",letterSpacing:"-1px"}}>Wealth Profile</h2>
      {/* AI Insight */}
      <div style={{background:"linear-gradient(135deg,rgba(196,181,253,0.08),rgba(147,197,253,0.05))",border:"1px solid rgba(196,181,253,0.15)",borderRadius:20,padding:"18px",marginBottom:24}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:"#c4b5fd",boxShadow:"0 0 8px #c4b5fd"}}/>
          <p style={{color:"rgba(196,181,253,0.7)",fontSize:10,textTransform:"uppercase",letterSpacing:2,margin:0}}>The Guide Sees</p>
        </div>
        {load?<Dots color="#c4b5fd"/>:latest
          ?<p style={{color:"rgba(255,255,255,0.6)",fontSize:14,lineHeight:1.8,fontStyle:"italic",margin:"0 0 14px"}}>{latest}</p>
          :<p style={{color:"rgba(255,255,255,0.2)",fontSize:13,margin:"0 0 14px"}}>No insight yet — generate your first below.</p>}
        <Tap onTap={refresh} style={{display:"inline-block",background:"rgba(196,181,253,0.1)",border:"1px solid rgba(196,181,253,0.2)",borderRadius:12,padding:"8px 16px"}}>
          <span style={{color:"#c4b5fd",fontSize:12,fontWeight:700}}>{load?"Thinking...":"Refresh Insight"}</span>
        </Tap>
      </div>
      {/* Focus/Neglected chips */}
      {dom.length>0&&<div style={{marginBottom:16}}>
        <p style={{color:"rgba(255,255,255,0.2)",fontSize:10,textTransform:"uppercase",letterSpacing:2,marginBottom:10}}>You Focus On</p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {dom.map(w=><span key={w.id} style={{color:w.color,fontSize:13,fontWeight:600,background:`${w.color}15`,border:`1px solid ${w.color}30`,borderRadius:99,padding:"5px 14px"}}>{w.icon} {w.label}</span>)}
        </div>
      </div>}
      {neg.length>0&&<div style={{marginBottom:24}}>
        <p style={{color:"rgba(255,255,255,0.2)",fontSize:10,textTransform:"uppercase",letterSpacing:2,marginBottom:10}}>Often Neglected</p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {neg.map(w=><span key={w.id} style={{color:"rgba(255,255,255,0.3)",fontSize:13,fontWeight:600,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:99,padding:"5px 14px"}}>{w.icon} {w.label}</span>)}
        </div>
      </div>}
      <Row l="Total reflections" v={fmtNum(entries.length)}/>
      <Row l="Words written" v={fmtNum(profile.totalWords||0)}/>
      <Row l="Journal depth" v={profile.journalDepth||"—"}/>
      <Row l="Usually journals" v={profile.journalTime||"—"}/>
      <Row l="Mood trend" v={profile.moodTrend||"—"} c={profile.moodTrend==="rising"?"#6ee7b7":profile.moodTrend==="falling"?"#f87171":"rgba(255,255,255,0.55)"}/>
      <Row l="Best streak" v={`${profile.streakBest||0} days`} c="#fcd34d"/>
    </div>
  );
}

/* ─── SEARCH SCREEN ─── */
function SearchScreen({entries,fType,setFType,search,setSearch}){
  return(
    <div style={{padding:"52px 20px calc(80px + env(safe-area-inset-bottom))",paddingTop:"calc(52px + env(safe-area-inset-top,0px))"}}>
      <h2 style={{color:"#fff",fontSize:24,fontWeight:900,margin:"0 0 20px",letterSpacing:"-1px"}}>Search</h2>
      <div style={{position:"relative",marginBottom:16}}>
        <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"rgba(255,255,255,0.2)",fontSize:15,pointerEvents:"none"}}>⊙</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search your reflections..."
          style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,color:"rgba(255,255,255,0.8)",padding:"13px 14px 13px 38px",fontSize:15,outline:"none",boxSizing:"border-box",fontFamily:"inherit",WebkitAppearance:"none"}}/>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:22}}>
        {[{id:"all",label:"All",icon:"·",color:"rgba(255,255,255,0.3)"},...W].map(w=>(
          <button key={w.id} onClick={()=>{vibe();setFType(w.id);}}
            style={{padding:"5px 13px",borderRadius:99,border:`1px solid ${fType===w.id?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.06)"}`,cursor:"pointer",fontSize:11,fontWeight:600,background:fType===w.id?"rgba(255,255,255,0.1)":"transparent",color:fType===w.id?"#fff":"rgba(255,255,255,0.3)",WebkitTapHighlightColor:"transparent",transition:"all .15s"}}>
            {w.icon} {w.label}
          </button>
        ))}
      </div>
      {entries.length===0&&<div style={{textAlign:"center",padding:"60px 0"}}>
        <p style={{color:"rgba(255,255,255,0.15)",fontSize:15}}>No entries found</p>
      </div>}
      {entries.map(e=>{const w=W.find(x=>x.id===e.type);return(
        <div key={e.id} style={{borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:18,marginBottom:18}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
            <span style={{color:w.color,fontSize:13,fontWeight:600}}>{w.icon} {w.label}</span>
            <span style={{color:"rgba(255,255,255,0.2)",fontSize:12}}>{fmtDate(e.date)} · {MOODS[e.mood]?.e}</span>
          </div>
          {e.answers?.map((a,i)=>a&&(
            <div key={i} style={{marginBottom:10}}>
              <p style={{color:"rgba(255,255,255,0.15)",fontSize:11,marginBottom:3,lineHeight:1.4}}>{e.prompts?.[i]}</p>
              <p style={{color:"rgba(255,255,255,0.5)",fontSize:14,lineHeight:1.65,margin:0}}>{a}</p>
            </div>
          ))}
        </div>
      );})}
    </div>
  );
}

/* ─── FEEDBACK FORM SCREEN ─── */
function FeedbackScreen() {
  const [rating, setRating] = useState(null);
  const [use, setUse] = useState(null);
  const [comments, setComments] = useState("");
  const [bugs, setBugs] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const ratings = ["😞","😕","😐","🙂","😄"];
  const useOptions = ["Daily","Few times a week","Weekly","Not sure yet"];

  function submit() {
    if (rating === null) return;
    vibe();

    // 1. Always save locally first — works on every device
    const entry = {
      id: Date.now(),
      date: toDay(),
      rating: rating + 1,
      ratingEmoji: ratings[rating],
      use: use || "Not answered",
      comments: comments || "",
      bugs: bugs || "",
      region: REGION,
    };
    try {
      const existing = JSON.parse(localStorage.getItem("cq_feedback") || "[]");
      localStorage.setItem("cq_feedback", JSON.stringify([...existing, entry]));
    } catch {}

    // 2. Try to open email app — works on Android, may not on iOS
    const body = `CALM QUOTE BETA FEEDBACK\n------------------------\nRating: ${ratings[rating]} (${rating+1}/5)\nUsage: ${use||"Not answered"}\nComments: ${comments||"None"}\nBugs: ${bugs||"None"}\nDate: ${toDay()}\nRegion: ${REGION}`.trim();
    try {
      window.location.href = `mailto:YOUR_EMAIL_HERE?subject=${encodeURIComponent("Calm Quote Beta Feedback")}&body=${encodeURIComponent(body)}`;
    } catch {}

    setSubmitted(true);
  }

  function copyFeedback() {
    vibe();
    try {
      const all = JSON.parse(localStorage.getItem("cq_feedback") || "[]");
      const txt = all.map(f =>
        `[${f.date}] Rating: ${f.ratingEmoji} ${f.rating}/5 | Usage: ${f.use} | Comments: ${f.comments || "—"} | Bugs: ${f.bugs || "—"} | Region: ${f.region}`
      ).join("\n\n");
      navigator.clipboard.writeText(txt || "No feedback yet.");
    } catch {}
  }

  if (submitted) {
    return (
      <div style={{ padding:"52px 20px calc(80px + env(safe-area-inset-bottom))", paddingTop:"calc(52px + env(safe-area-inset-top,0px))", textAlign:"center" }}>
        <div style={{ fontSize:52, marginBottom:20 }}>🙏</div>
        <h2 style={{ color:"#fff", fontSize:22, fontWeight:900, margin:"0 0 12px", letterSpacing:"-.5px" }}>Thank you!</h2>
        <p style={{ color:"rgba(255,255,255,0.4)", fontSize:15, lineHeight:1.7, margin:"0 0 8px" }}>Your feedback has been saved.</p>
        <p style={{ color:"rgba(255,255,255,0.25)", fontSize:13, lineHeight:1.6, margin:"0 0 28px" }}>If your email app didn't open, tap below to copy your feedback and send it manually.</p>
        <Tap onTap={copyFeedback}
          style={{ display:"block", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:14, padding:"13px 24px", marginBottom:12 }}>
          <span style={{ color:"rgba(255,255,255,0.6)", fontWeight:700, fontSize:14 }}>📋 Copy feedback to send</span>
        </Tap>
        <Tap onTap={() => { setSubmitted(false); setRating(null); setUse(null); setComments(""); setBugs(""); }}
          style={{ display:"block", background:"transparent", borderRadius:14, padding:"10px" }}>
          <span style={{ color:"rgba(255,255,255,0.2)", fontWeight:600, fontSize:13 }}>Submit another</span>
        </Tap>
      </div>
    );
  }

  return (
    <div style={{ padding:"52px 20px calc(80px + env(safe-area-inset-bottom))", paddingTop:"calc(52px + env(safe-area-inset-top,0px))" }}>
      <p style={{ color:"rgba(255,255,255,0.2)", fontSize:10, textTransform:"uppercase", letterSpacing:2.5, marginBottom:6 }}>Beta Program</p>
      <h2 style={{ color:"#fff", fontSize:24, fontWeight:900, margin:"0 0 6px", letterSpacing:"-1px" }}>Share Feedback</h2>
      <p style={{ color:"rgba(255,255,255,0.3)", fontSize:14, margin:"0 0 28px", lineHeight:1.6 }}>Takes 2 minutes. Every response shapes the next version.</p>

      {/* Rating */}
      <div style={{ marginBottom:24 }}>
        <p style={{ color:"rgba(255,255,255,0.2)", fontSize:10, textTransform:"uppercase", letterSpacing:2, marginBottom:14 }}>
          Overall experience <span style={{ color:"rgba(255,80,80,0.6)" }}>*</span>
        </p>
        <div style={{ display:"flex", gap:10 }}>
          {ratings.map((r, i) => (
            <Tap key={i} onTap={() => setRating(i)}
              style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:6, padding:"12px 4px", background: rating===i ? "rgba(196,181,253,0.1)" : "rgba(255,255,255,0.03)", border:`1px solid ${rating===i ? "rgba(196,181,253,0.3)" : "rgba(255,255,255,0.06)"}`, borderRadius:16, transition:"all .15s" }}>
              <span style={{ fontSize:24 }}>{r}</span>
              <span style={{ color: rating===i ? "#c4b5fd" : "rgba(255,255,255,0.15)", fontSize:9, fontWeight:600 }}>{i+1}/5</span>
            </Tap>
          ))}
        </div>
      </div>

      {/* Usage */}
      <div style={{ marginBottom:24 }}>
        <p style={{ color:"rgba(255,255,255,0.2)", fontSize:10, textTransform:"uppercase", letterSpacing:2, marginBottom:14 }}>How often would you use this?</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {useOptions.map(o => (
            <Tap key={o} onTap={() => setUse(o)}
              style={{ padding:"12px 14px", background: use===o ? "rgba(110,231,183,0.1)" : "rgba(255,255,255,0.03)", border:`1px solid ${use===o ? "rgba(110,231,183,0.3)" : "rgba(255,255,255,0.06)"}`, borderRadius:14, textAlign:"center", transition:"all .15s" }}>
              <span style={{ color: use===o ? "#6ee7b7" : "rgba(255,255,255,0.4)", fontSize:13, fontWeight:600 }}>{o}</span>
            </Tap>
          ))}
        </div>
      </div>

      {/* What's working */}
      <div style={{ marginBottom:20 }}>
        <p style={{ color:"rgba(255,255,255,0.2)", fontSize:10, textTransform:"uppercase", letterSpacing:2, marginBottom:12 }}>What's working well?</p>
        <div style={{position:"relative"}}>
          <textarea value={comments} onChange={e => setComments(e.target.value)}
            placeholder="What did you enjoy or find valuable..."
            style={{ width:"100%", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, color:"rgba(255,255,255,0.8)", padding:"14px 56px 14px 16px", fontSize:14, lineHeight:1.65, resize:"none", outline:"none", boxSizing:"border-box", fontFamily:"inherit", minHeight:90, WebkitAppearance:"none", transition:"border-color .2s" }}
            onFocus={e => e.target.style.borderColor="rgba(196,181,253,0.4)"}
            onBlur={e => e.target.style.borderColor="rgba(255,255,255,0.07)"}
          />
          <div style={{position:"absolute",bottom:10,right:10}}>
            <VoiceBtn onResult={text => setComments(text)} />
          </div>
        </div>
      </div>

      {/* Bugs */}
      <div style={{ marginBottom:28 }}>
        <p style={{ color:"rgba(255,255,255,0.2)", fontSize:10, textTransform:"uppercase", letterSpacing:2, marginBottom:12 }}>Any bugs or issues?</p>
        <div style={{position:"relative"}}>
          <textarea value={bugs} onChange={e => setBugs(e.target.value)}
            placeholder="Anything broken or confusing..."
            style={{ width:"100%", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, color:"rgba(255,255,255,0.8)", padding:"14px 56px 14px 16px", fontSize:14, lineHeight:1.65, resize:"none", outline:"none", boxSizing:"border-box", fontFamily:"inherit", minHeight:80, WebkitAppearance:"none", transition:"border-color .2s" }}
            onFocus={e => e.target.style.borderColor="rgba(253,186,116,0.4)"}
            onBlur={e => e.target.style.borderColor="rgba(255,255,255,0.07)"}
          />
          <div style={{position:"absolute",bottom:10,right:10}}>
            <VoiceBtn onResult={text => setBugs(text)} />
          </div>
        </div>
      </div>

      {/* Submit */}
      <Tap onTap={rating !== null ? submit : undefined}
        style={{ background: rating !== null ? "linear-gradient(135deg,#c4b5fd,#8b5cf6)" : "rgba(255,255,255,0.05)", borderRadius:18, padding:"17px", textAlign:"center", opacity: rating === null ? .4 : 1, boxShadow: rating !== null ? "0 8px 28px rgba(196,181,253,0.35)" : "none", transition:"all .2s", marginBottom:12 }}>
        <span style={{ color: rating !== null ? "#fff" : "rgba(255,255,255,0.3)", fontWeight:800, fontSize:16 }}>Save Feedback ✦</span>
      </Tap>
      {rating === null && <p style={{ color:"rgba(255,255,255,0.15)", fontSize:12, textAlign:"center", marginBottom:16 }}>Please select a rating to continue</p>}

      {/* Copy all feedback — for you as the developer */}
      <Tap onTap={copyFeedback}
        style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"12px", textAlign:"center" }}>
        <span style={{ color:"rgba(255,255,255,0.2)", fontSize:12, fontWeight:600 }}>📋 Copy all feedback (developer only)</span>
      </Tap>
    </div>
  );
}
function ShareScreen(){
  const[copied,sc]=useState(false);
  function copy(){vibe();try{navigator.clipboard.writeText(REFERRAL);}catch{const el=document.createElement("textarea");el.value=REFERRAL;el.style.position="absolute";el.style.left="-9999px";document.body.appendChild(el);el.select();document.execCommand("copy");document.body.removeChild(el);}sc(true);setTimeout(()=>sc(false),2500);}
  async function share(){vibe();if(navigator.share){try{await navigator.share({title:"Calm Quote",text:"A daily journal for the 5 types of wealth.",url:REFERRAL});}catch{}}else copy();}
  const channels=[
    {l:"WhatsApp",i:"💬",h:`https://wa.me/?text=${encodeURIComponent(`Calm Quote — a daily wealth journal 👇 ${REFERRAL}`)}`},
    {l:"X / Twitter",i:"𝕏",h:`https://twitter.com/intent/tweet?text=${encodeURIComponent("Reflecting on all 5 types of wealth daily with Calm Quote.")}&url=${encodeURIComponent(REFERRAL)}`},
    {l:"Telegram",i:"✈️",h:`https://t.me/share/url?url=${encodeURIComponent(REFERRAL)}&text=${encodeURIComponent("Check out Calm Quote 🧠")}`},
    {l:"Email",i:"📧",h:`mailto:?subject=${encodeURIComponent("Try Calm Quote")}&body=${encodeURIComponent(`Hey,\n\nI've been journaling daily on Calm Quote — built around the 5 types of wealth.\n\n${REFERRAL}`)}`},
  ];
  return(
    <div style={{padding:"52px 20px calc(80px + env(safe-area-inset-bottom))",paddingTop:"calc(52px + env(safe-area-inset-top,0px))"}}>
      <p style={{color:"rgba(255,255,255,0.2)",fontSize:10,textTransform:"uppercase",letterSpacing:2.5,marginBottom:6}}>Spread the Wealth</p>
      <h2 style={{color:"#fff",fontSize:24,fontWeight:900,margin:"0 0 8px",letterSpacing:"-1px"}}>Invite Friends</h2>
      <p style={{color:"rgba(255,255,255,0.3)",fontSize:14,margin:"0 0 28px",lineHeight:1.6}}>Share with people serious about building all 5 types of wealth.</p>
      <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,padding:"18px",marginBottom:12}}>
        <p style={{color:"rgba(255,255,255,0.2)",fontSize:10,textTransform:"uppercase",letterSpacing:2,marginBottom:12}}>Your Link</p>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <p style={{color:"rgba(255,255,255,0.4)",fontSize:13,margin:0,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{REFERRAL}</p>
          <Tap onTap={copy} style={{background:copied?"rgba(110,231,183,0.15)":"rgba(255,255,255,0.08)",border:`1px solid ${copied?"rgba(110,231,183,0.3)":"rgba(255,255,255,0.1)"}`,borderRadius:10,padding:"7px 14px"}}>
            <span style={{color:copied?"#6ee7b7":"rgba(255,255,255,0.5)",fontSize:12,fontWeight:700}}>{copied?"✓ Copied":"Copy"}</span>
          </Tap>
        </div>
        <Tap onTap={share} style={{background:"linear-gradient(135deg,#c4b5fd,#8b5cf6)",borderRadius:14,padding:"14px",textAlign:"center",boxShadow:"0 6px 24px rgba(196,181,253,0.3)"}}>
          <span style={{color:"#fff",fontWeight:800,fontSize:15}}>Share Now ✦</span>
        </Tap>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {channels.map(c=>(
          <a key={c.l} href={c.h} target="_blank" rel="noopener noreferrer" onClick={vibe}
            style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"13px 14px",textDecoration:"none",WebkitTapHighlightColor:"transparent"}}>
            <span style={{fontSize:18}}>{c.i}</span>
            <span style={{color:"rgba(255,255,255,0.4)",fontSize:13,fontWeight:500}}>{c.l}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

/* ─── MAIN APP ─── */
export default function App(){
  const[ob,sOb]   = useStore("cq10_ob",false);
  const[ent,sEnt] = useStore("cq10_e", []);
  const[str,sStr] = useStore("cq10_s", {count:0,last:"",best:0});
  const[qt,sQt]   = useStore("cq10_q", {date:"",text:""});
  const[sg,sSg]   = useStore("cq10_sg",{date:"",typeId:"",reason:""});
  const[wk,sWk]   = useStore("cq10_w", {date:"",text:""});
  const[pf,sPf]   = useStore("cq10_p", {});
  const[dis,sDis] = useStore("cq10_dm",[]);

  const[view,sView]   = useState("home");
  const[tab,sTab]     = useState("home");
  const[sel,sSel]     = useState(null);
  const[step,sStep]   = useState(0);
  const[ans,sAns]     = useState(["","",""]);
  const[mood,sMood]   = useState(2);
  const[fb,sFb]       = useState("");
  const[fbL,sFbL]     = useState(false);
  const[qL,sQL]       = useState(false);
  const[wL,sWL]       = useState(false);
  const[srch,sSrch]   = useState("");
  const[fType,sFType] = useState("all");
  const[warn,sWarn]   = useState(false);

  useEffect(()=>{if(!ob)return;sPf(p=>({...p,openedAt:[...(p.openedAt||[]),Date.now()].slice(-20),journalTime:timeOf(hr())}));},[ob]);

  const sys = useMemo(()=>buildSys(pf),[pf]);
  const ctx = useMemo(()=>ent.slice(0,12).map(e=>{const w=W.find(x=>x.id===e.type);return`[${e.date}] ${w?.label}(${MOODS[e.mood]?.l}): ${e.answers?.filter(Boolean).join("|")}`;}).join("\n"),[ent]);

  useEffect(()=>{const t=toDay();if(!ob||qt.date===t||qL)return;sQL(true);ask(sys,`ONE original philosophical quote (1–2 sentences, aphoristic) personalized to this user. Just the quote.\n\n${ctx||"New user starting their wealth journey."}`).then(x=>{sQt({date:t,text:x||qt.text});sQL(false);});},[ob,qt.date]);
  useEffect(()=>{const t=toDay();if(!ob||sg.date===t)return;ask(sys,`Which ONE wealth type should this person focus on today? One sentence reason. JSON: {"typeId":"...","reason":"..."}\n\n${ctx||"New user."}`).then(x=>{try{const p=JSON.parse(x.replace(/```json|```/g,"").trim());sSg({date:t,...p});}catch{sSg({date:t,typeId:"mental",reason:"The Curiosity Flywheel is always the best place to begin."});}});},[ob,sg.date]);

  const go = useCallback((v)=>{sTab(v);sView(v);},[]);

  function startJ(w){vibe();sSel(w);sStep(0);sAns(["","",""]);sMood(2);sFb("");sFbL(false);sWarn(false);sView("journal");}

  async function doSave(){
    const t=toDay();
    const e={id:Date.now(),date:t,type:sel.id,answers:ans,mood,prompts:sel.prompts};
    sEnt(p=>[e,...p]);
    sStr(s=>{if(s.last===t)return s;const n=s.last===yday()?s.count+1:1;return{count:n,last:t,best:Math.max(n,s.best||0)};});
    const all=[e,...ent];const np=recompute(all,pf);np.streakBest=Math.max(str.best||0,str.count+(str.last===yday()?1:0));sPf(np);
    sFbL(true);sView("feedback");
    const txt=await ask(buildSys(np),`User completed a ${sel.label} reflection. Respond as The Guide — warm, specific, philosophical. Framework: "${sel.framework}". Mood: ${MOODS[mood].l}. 3–5 sentences.\n\n${sel.prompts.map((p,i)=>`Q:${p}\nA:${ans[i]}`).join("\n")}\n\nContext:\n${ctx}`);
    sFb(txt);sFbL(false);
  }

  async function doWeekly(){
    const we=ent.filter(e=>e.date>=wkAgo());if(!we.length)return;sWL(true);
    const c=we.map(e=>{const w=W.find(x=>x.id===e.type);return`[${e.date}] ${w?.label}: ${e.answers?.filter(Boolean).join("|")} (${MOODS[e.mood]?.l})`;}).join("\n");
    const t=await ask(sys,`Weekly wealth debrief as The Guide. Reference frameworks. Patterns, wins, ONE next-week focus. 5–7 sentences.\n\n${c}`);
    if(t)sWk({date:toDay(),text:t});sWL(false);
  }

  const cnt   = useMemo(()=>{const c={};W.forEach(w=>{c[w.id]=0;});ent.forEach(e=>{if(c[e.type]!==undefined)c[e.type]++;});return c;},[ent]);
  const sugW  = W.find(w=>w.id===sg.typeId);
  const tried = useMemo(()=>[...new Set(ent.map(e=>e.type))],[ent]);
  const days  = useMemo(()=>{const o=pf.openedAt||[];return o.length?Math.floor((Date.now()-o[0])/864e5):0;},[pf.openedAt]);
  const filt  = useMemo(()=>ent.filter(e=>(fType==="all"||e.type===fType)&&(!srch||e.answers?.some(a=>a?.toLowerCase().includes(srch.toLowerCase())))),[ent,fType,srch]);

  const NUDGES=[
    {id:"d1a",show:days===0&&ent.length===0,             icon:"→",title:"Start here. Right now.",    body:"Pick a wealth type and answer 3 honest questions. The first entry is always the hardest.",act:"Begin",col:"#c4b5fd",fn:()=>startJ(W.find(w=>w.id==="mental"))},
    {id:"d1b",show:days===0&&ent.length>=1&&ent.length<3,icon:"↑",title:"One down. Do one more.",    body:"One reflection is awareness. Two is a pattern. Pick a different wealth type.",           act:"Try another",col:"#6ee7b7",fn:()=>{const u=W.find(w=>!tried.includes(w.id));if(u)startJ(u);}},
    {id:"d2a",show:days===1&&ent.length>=1,              icon:"◎",title:"Day 2. Stay consistent.",   body:"Consistency beats intensity every time. Reflect again, then check your Stats.",            act:"See Stats",col:"#93c5fd",fn:()=>go("insights")},
    {id:"d2b",show:days===1&&ent.length>=2,              icon:"◉",title:"Your profile is forming.",  body:"Head to Profile — The Guide is learning from your behaviour. Generate your first insight.", act:"Profile",col:"#fdba74",fn:()=>go("profile")},
    {id:"d3a",show:days===2&&tried.length<5,             icon:"⚡",title:"Complete the picture.",    body:`${tried.length}/5 wealth types reflected on. Hit the ones you've missed today.`,          act:"Try a new type",col:"#fcd34d",fn:()=>{const u=W.find(w=>!tried.includes(w.id));if(u)startJ(u);}},
    {id:"d3b",show:days===2&&ent.length>=3,              icon:"✦",title:"First debrief awaits.",     body:"3 days of data. Generate your Weekly Debrief in Stats — The Guide will break it down.",   act:"Go to Stats",col:"#c4b5fd",fn:()=>go("insights")},
  ];
  const nudge=NUDGES.find(n=>n.show&&!dis.includes(n.id));

  const ROOT={minHeight:"100dvh",background:"#09090f",fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,sans-serif",maxWidth:480,margin:"0 auto",overflowX:"hidden",position:"relative"};

  if(!ob)return <Onboarding onDone={()=>sOb(true)}/>;

  /* ── FEEDBACK ── */
  if(view==="feedback"&&sel){
    const w=sel;
    return(
      <div style={ROOT}>
        {/* Ambient */}
        <div style={{position:"fixed",top:0,left:"50%",transform:"translateX(-50%)",width:"100%",height:"40%",background:`radial-gradient(ellipse at top,${w.glow} 0%,transparent 70%)`,pointerEvents:"none"}}/>
        <div style={{position:"relative",zIndex:1,padding:"52px 20px calc(40px + env(safe-area-inset-bottom))",paddingTop:"calc(52px + env(safe-area-inset-top,0px))"}}>
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{fontSize:40,marginBottom:14,filter:`drop-shadow(0 0 16px ${w.glow})`}}>✦</div>
            <h2 style={{color:"#fff",fontSize:22,fontWeight:900,margin:"0 0 8px",letterSpacing:"-.5px"}}>Reflection saved</h2>
            <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(252,211,77,0.1)",border:"1px solid rgba(252,211,77,0.2)",borderRadius:99,padding:"5px 14px"}}>
              <span style={{fontSize:14}}>🔥</span>
              <span style={{color:"#fcd34d",fontWeight:700,fontSize:13}}>{str.count} day streak</span>
            </div>
          </div>
          <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:18,padding:"16px 18px",marginBottom:14}}>
            <p style={{color:"rgba(255,255,255,0.18)",fontSize:10,textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>Framework</p>
            <p style={{color:"rgba(255,255,255,0.3)",fontSize:13,lineHeight:1.65,margin:0}}>{w.framework}</p>
          </div>
          <div style={{background:`linear-gradient(135deg,${w.color}0d,transparent)`,border:`1px solid ${w.color}22`,borderRadius:18,padding:"16px 18px",marginBottom:28}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:w.color,boxShadow:`0 0 8px ${w.glow}`}}/>
              <p style={{color:w.color,fontSize:10,textTransform:"uppercase",letterSpacing:2,margin:0,opacity:.8}}>The Guide</p>
            </div>
            {fbL?<Dots color={w.color}/>:<p style={{color:"rgba(255,255,255,0.65)",fontSize:15,lineHeight:1.85,margin:0,fontStyle:"italic"}}>{fb}</p>}
          </div>
          <Tap onTap={()=>go("home")} style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:16,padding:"15px",textAlign:"center"}}>
            <span style={{color:"rgba(255,255,255,0.6)",fontWeight:700,fontSize:15}}>Back to Home</span>
          </Tap>
        </div>
      </div>
    );
  }

  /* ── JOURNAL ── */
  if(view==="journal"&&sel){
    const w=sel;const last=step===w.prompts.length-1;
    return(
      <div style={ROOT}>
        {/* Top glow */}
        <div style={{position:"fixed",top:0,left:"50%",transform:"translateX(-50%)",width:"80%",height:"30%",background:`radial-gradient(ellipse at top,${w.glow} 0%,transparent 70%)`,pointerEvents:"none"}}/>
        {warn&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:200,display:"flex",alignItems:"flex-end",padding:`0 16px calc(20px + env(safe-area-inset-bottom))`}}>
            <div style={{background:"#111120",border:"1px solid rgba(255,255,255,0.08)",borderRadius:24,padding:24,width:"100%"}}>
              <p style={{color:"#fff",fontWeight:800,fontSize:17,marginBottom:6}}>Leave?</p>
              <p style={{color:"rgba(255,255,255,0.3)",fontSize:13,marginBottom:20,lineHeight:1.5}}>Your answers will be lost.</p>
              <div style={{display:"flex",gap:10}}>
                <Tap onTap={()=>sWarn(false)} style={{flex:1,background:"rgba(255,255,255,0.06)",borderRadius:14,padding:"13px",textAlign:"center"}}><span style={{color:"rgba(255,255,255,0.5)",fontWeight:700}}>Stay</span></Tap>
                <Tap onTap={()=>{sWarn(false);go("home");}} style={{flex:1,background:"rgba(220,38,38,0.15)",border:"1px solid rgba(220,38,38,0.3)",borderRadius:14,padding:"13px",textAlign:"center"}}><span style={{color:"#f87171",fontWeight:700}}>Leave</span></Tap>
              </div>
            </div>
          </div>
        )}
        <div style={{position:"relative",zIndex:1,padding:"0 0 32px"}}>
          <div style={{padding:"20px 20px 0",paddingTop:"calc(20px + env(safe-area-inset-top,0px))",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <Tap onTap={()=>ans.some(a=>a.trim())?sWarn(true):go("home")} style={{color:"rgba(255,255,255,0.35)",fontSize:14,fontWeight:600,padding:"4px 0"}}>← Back</Tap>
            <div style={{display:"flex",alignItems:"center",gap:6,background:`${w.color}15`,border:`1px solid ${w.color}30`,borderRadius:99,padding:"5px 14px"}}>
              <span style={{fontSize:14}}>{w.icon}</span>
              <span style={{color:w.color,fontSize:12,fontWeight:700}}>{w.label}</span>
            </div>
            <span style={{color:"rgba(255,255,255,0.2)",fontSize:13}}>{step+1}/{w.prompts.length}</span>
          </div>
          {/* Progress */}
          <div style={{display:"flex",gap:3,padding:"14px 20px 0"}}>
            {w.prompts.map((_,i)=>(
              <div key={i} style={{flex:1,height:2,borderRadius:99,background:i<=step?w.color:"rgba(255,255,255,0.07)",boxShadow:i===step?`0 0 6px ${w.glow}`:"none",transition:"background .3s"}}/>
            ))}
          </div>
          <div style={{padding:"24px 20px 0"}}>
            <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"12px 14px",marginBottom:20}}>
              <p style={{color:"rgba(255,255,255,0.18)",fontSize:10,textTransform:"uppercase",letterSpacing:2,marginBottom:4}}>Framework</p>
              <p style={{color:"rgba(255,255,255,0.3)",fontSize:12,lineHeight:1.6,margin:0}}>{w.framework}</p>
            </div>
            <p style={{color:"rgba(255,255,255,0.85)",fontSize:17,lineHeight:1.75,fontWeight:500,marginBottom:18}}>{w.prompts[step]}</p>
            <div style={{position:"relative"}}>
              <textarea value={ans[step]} onChange={e=>{const a=[...ans];a[step]=e.target.value;sAns(a);}}
                onFocus={e=>e.target.style.borderColor=`${w.color}55`} onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.07)"}
                placeholder="Write or speak your answer..." autoFocus
                style={{width:"100%",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,color:"rgba(255,255,255,0.85)",padding:"16px 56px 16px 16px",fontSize:16,lineHeight:1.75,resize:"none",outline:"none",boxSizing:"border-box",fontFamily:"inherit",minHeight:150,WebkitAppearance:"none",transition:"border-color .2s"}}/>
              <div style={{position:"absolute",bottom:12,right:12}}>
                <VoiceBtn onResult={text=>{const a=[...ans];a[step]=text;sAns(a);}} />
              </div>
            </div>
            {last&&(
              <div style={{marginTop:20}}>
                <p style={{color:"rgba(255,255,255,0.2)",fontSize:10,textTransform:"uppercase",letterSpacing:2,marginBottom:12}}>How do you feel?</p>
                <div style={{display:"flex",gap:8}}>
                  {MOODS.map((m,i)=>(
                    <Tap key={i} onTap={()=>sMood(i)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"11px 4px",background:mood===i?"rgba(255,255,255,0.07)":"transparent",border:`1px solid ${mood===i?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.05)"}`,borderRadius:14,transition:"all .15s"}}>
                      <span style={{fontSize:20}}>{m.e}</span>
                      <span style={{color:mood===i?"rgba(255,255,255,0.6)":"rgba(255,255,255,0.15)",fontSize:9,fontWeight:600,textTransform:"uppercase"}}>{m.l}</span>
                    </Tap>
                  ))}
                </div>
              </div>
            )}
            <div style={{display:"flex",gap:10,marginTop:20,paddingBottom:"calc(16px + env(safe-area-inset-bottom))"}}>
              {step>0&&<Tap onTap={()=>sStep(s=>s-1)} style={{flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"14px",textAlign:"center"}}><span style={{color:"rgba(255,255,255,0.4)",fontWeight:600,fontSize:15}}>← Prev</span></Tap>}
              <Tap onTap={ans[step].trim()?(last?doSave:()=>sStep(s=>s+1)):undefined}
                style={{flex:2,background:ans[step].trim()?w.grad:"rgba(255,255,255,0.04)",borderRadius:14,padding:"14px",textAlign:"center",opacity:ans[step].trim()?1:.4,boxShadow:ans[step].trim()?`0 6px 20px ${w.glow}`:"none",transition:"all .2s"}}>
                <span style={{color:ans[step].trim()?"#fff":"rgba(255,255,255,0.2)",fontWeight:800,fontSize:15}}>{last?"Save reflection":"Next →"}</span>
              </Tap>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── TABS ── */
  if(view==="insights") return <div style={ROOT}><StatsScreen entries={ent} streak={str} weekly={wk} wLoad={wL} onGenWeekly={doWeekly}/><Nav active={tab} go={go}/></div>;
  if(view==="profile")  return <div style={ROOT}><ProfileScreen profile={pf} entries={ent} onInsight={t=>sPf(p=>({...p,insights:[...(p.insights||[]).slice(-4),t]}))}/><Nav active={tab} go={go}/></div>;
  if(view==="search")   return <div style={ROOT}><SearchScreen entries={filt} fType={fType} setFType={sFType} search={srch} setSearch={sSrch}/><Nav active={tab} go={go}/></div>;
  if(view==="feedback") return <div style={ROOT}><FeedbackScreen/><Nav active={tab} go={go}/></div>;
  if(view==="referral") return <div style={ROOT}><ShareScreen/><Nav active={tab} go={go}/></div>;

  /* ── HOME ── */
  return(
    <div style={ROOT}>
      {/* Ambient background glow */}
      <div style={{position:"fixed",top:"-10%",left:"50%",transform:"translateX(-50%)",width:"120%",height:"50%",background:"radial-gradient(ellipse,rgba(196,181,253,0.07) 0%,transparent 70%)",pointerEvents:"none"}}/>
      <div style={{position:"fixed",bottom:"15%",right:"-10%",width:"50%",height:"30%",background:"radial-gradient(ellipse,rgba(110,231,183,0.05) 0%,transparent 70%)",pointerEvents:"none"}}/>

      <div style={{position:"relative",zIndex:1,paddingBottom:"calc(72px + env(safe-area-inset-bottom))"}}>

        {/* ── HEADER ── */}
        <div style={{padding:"44px 20px 0",paddingTop:"calc(44px + env(safe-area-inset-top,0px))"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
            <div>
              <p style={{color:"rgba(255,255,255,0.18)",fontSize:10,textTransform:"uppercase",letterSpacing:3,margin:"0 0 8px"}}>5 Types of Wealth</p>
              <h1 style={{color:"#fff",fontSize:30,fontWeight:900,lineHeight:1,margin:0,letterSpacing:"-1.5px"}}>Calm Quote</h1>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
              <div style={{background:"rgba(252,211,77,0.1)",border:"1px solid rgba(252,211,77,0.2)",borderRadius:12,padding:"8px 14px",textAlign:"center"}}>
                <div style={{color:"#fcd34d",fontWeight:900,fontSize:18,lineHeight:1}}>🔥{str.count}</div>
                <div style={{color:"rgba(252,211,77,0.4)",fontSize:9,textTransform:"uppercase",letterSpacing:.5,marginTop:3}}>Streak</div>
              </div>
            </div>
          </div>

          {/* ── QUOTE CARD ── */}
          <div style={{background:"linear-gradient(135deg,rgba(196,181,253,0.08) 0%,rgba(147,197,253,0.05) 100%)",border:"1px solid rgba(196,181,253,0.12)",borderRadius:22,padding:"18px 20px",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:12}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:"#c4b5fd",boxShadow:"0 0 8px rgba(196,181,253,0.8)"}}/>
              <p style={{color:"rgba(196,181,253,0.6)",fontSize:10,textTransform:"uppercase",letterSpacing:2.5,margin:0}}>Today's Quote</p>
            </div>
            {qL?<Dots color="#c4b5fd"/>:qt.text
              ?<p style={{color:"rgba(255,255,255,0.7)",fontSize:15,fontStyle:"italic",lineHeight:1.75,margin:0}}>"{qt.text}"</p>
              :<p style={{color:"rgba(255,255,255,0.18)",fontSize:14,margin:0,lineHeight:1.5}}>Complete your first reflection to unlock your daily quote.</p>}
          </div>

          {/* ── COACH NUDGE ── */}
          {nudge&&(
            <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:18,padding:"14px 16px",marginBottom:16,position:"relative"}}>
              <button onClick={()=>{vibe();sDis(d=>[...d,nudge.id]);}} style={{position:"absolute",top:12,right:14,background:"none",border:"none",color:"rgba(255,255,255,0.15)",fontSize:18,cursor:"pointer",lineHeight:1,WebkitTapHighlightColor:"transparent"}}>×</button>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                <span style={{color:nudge.col,fontSize:13}}>{nudge.icon}</span>
                <p style={{color:"rgba(255,255,255,0.2)",fontSize:10,textTransform:"uppercase",letterSpacing:1.5,margin:0}}>Day {days+1} · Coach</p>
              </div>
              <p style={{color:"#fff",fontSize:14,fontWeight:700,margin:"0 0 4px",letterSpacing:"-.2px"}}>{nudge.title}</p>
              <p style={{color:"rgba(255,255,255,0.35)",fontSize:12,lineHeight:1.55,margin:"0 0 12px"}}>{nudge.body}</p>
              <Tap onTap={()=>{sDis(d=>[...d,nudge.id]);nudge.fn();}} style={{display:"inline-block",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"7px 14px"}}>
                <span style={{color:"rgba(255,255,255,0.6)",fontSize:12,fontWeight:600}}>{nudge.act} →</span>
              </Tap>
            </div>
          )}

          {/* ── SUGGESTED ── */}
          {sugW&&sg.reason&&!nudge&&(
            <Tap onTap={()=>startJ(sugW)} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"13px 15px",marginBottom:16}}>
              <div style={{fontSize:22,filter:`drop-shadow(0 0 8px ${sugW.glow})`}}>{sugW.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{color:"rgba(255,255,255,0.2)",fontSize:10,textTransform:"uppercase",letterSpacing:1.5,margin:"0 0 3px"}}>Suggested today</p>
                <p style={{color:"#fff",fontWeight:600,fontSize:14,margin:"0 0 2px"}}>{sugW.label}</p>
                <p style={{color:"rgba(255,255,255,0.3)",fontSize:12,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sg.reason}</p>
              </div>
              <span style={{color:"rgba(255,255,255,0.15)",fontSize:18,flexShrink:0}}>›</span>
            </Tap>
          )}

          {/* ── PORTFOLIO STRIP ── */}
          <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0",marginBottom:4,borderTop:"1px solid rgba(255,255,255,0.05)",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
            {W.map(w=>(
              <div key={w.id} style={{textAlign:"center"}}>
                <div style={{fontSize:17,filter:cnt[w.id]>0?`drop-shadow(0 0 6px ${w.glow})`:"none"}}>{w.icon}</div>
                <div style={{color:cnt[w.id]>0?w.color:"rgba(255,255,255,0.12)",fontSize:12,fontWeight:700,marginTop:3}}>{cnt[w.id]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── WEALTH GRID ── */}
        <div style={{padding:"16px 20px 0"}}>
          <p style={{color:"rgba(255,255,255,0.15)",fontSize:10,textTransform:"uppercase",letterSpacing:2.5,marginBottom:12}}>Reflect</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {W.map(w=>(
              <WCard key={w.id} w={w} cnt={cnt[w.id]}
                neglected={(pf.neglectedWealth||[]).includes(w.id)}
                growing={(pf.growthAreas||[]).includes(w.id)}
                onTap={()=>startJ(w)}/>
            ))}
          </div>
        </div>
      </div>

      <Nav active={tab} go={go}/>
    </div>
  );
}
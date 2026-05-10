import { useState, useEffect, useMemo, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════════
   WEALTH DATA
═══════════════════════════════════════════════ */
const WEALTH = [
  { id:"time",     label:"Time",     icon:"⏳", color:"#c084fc", dark:"#7c3aed", grad:"linear-gradient(135deg,#c084fc,#7c3aed)", bg:"rgba(192,132,252,0.07)", tag:"your scarcest asset",       principle:"Every hour is either an investment or a cost.",           framework:"The Time Audit: identify your highest-leverage moments.",      prompts:["Run a Time Audit — what did you invest vs. merely spend time on today?","What was your single highest-leverage moment today?","Does your calendar reflect your actual priorities? What's misaligned?"] },
  { id:"money",    label:"Money",    icon:"💸", color:"#34d399", dark:"#059669", grad:"linear-gradient(135deg,#34d399,#059669)", bg:"rgba(52,211,153,0.07)",  tag:"a tool, not the goal",     principle:"Money is a tool. Freedom is the goal.",                   framework:"Freedom Fund: every dollar saved is a vote for optionality.",  prompts:["Did any financial decision today move you toward or away from true freedom?","Are you building any asset that works while you sleep?","Spend on experiences, invest in assets, cut costs misaligned with values. How did today measure up?"] },
  { id:"mental",   label:"Mental",   icon:"🧠", color:"#60a5fa", dark:"#2563eb", grad:"linear-gradient(135deg,#60a5fa,#2563eb)", bg:"rgba(96,165,250,0.07)",  tag:"compound your mind",       principle:"Your mind compounds. Feed it accordingly.",               framework:"Curiosity Flywheel: Curiosity → Learning → Insight → Growth.", prompts:["What spun your Curiosity Flywheel today — an idea, book, or question?","What idea genuinely surprised or challenged you recently?","What mental weight could you consciously choose to put down?"] },
  { id:"physical", label:"Physical", icon:"⚡", color:"#fb923c", dark:"#c2410c", grad:"linear-gradient(135deg,#fb923c,#c2410c)", bg:"rgba(251,146,60,0.07)",  tag:"your base OS",             principle:"Your body is the vessel for everything else.",            framework:"Energy Pyramid: Sleep → Movement → Nutrition → Mindfulness.", prompts:["Walk through your Energy Pyramid — where is it weakest today?","On 1–10, how much did you invest in your physical wealth today?","Do you have a non-negotiable daily anchor? Did you honor it?"] },
  { id:"social",   label:"Social",   icon:"🫂", color:"#fbbf24", dark:"#d97706", grad:"linear-gradient(135deg,#fbbf24,#d97706)", bg:"rgba(251,191,36,0.07)",  tag:"your invisible net worth", principle:"Your relationships are compounding assets or slow drains.", framework:"Give, Ask, Thank — with real intention.",                    prompts:["Give, Ask, Thank — did you do any of these with intention today?","Who is a long-term relationship worth investing in? Did you invest today?","Who energizes you — and who quietly drains you?"] },
];
const MOODS = [{e:"💀",l:"depleted"},{e:"😮‍💨",l:"drained"},{e:"😐",l:"neutral"},{e:"✨",l:"energized"},{e:"🔥",l:"thriving"}];
const REFERRAL_URL = "https://calmquote.app/join";

/* ═══════════════════════════════════════════════
   USER PROFILE SCHEMA (stored locally)
  profile = {
    name: string,
    journalTime: "morning"|"afternoon"|"evening"|"night",  // when they usually journal
    dominantWealth: string[],      // most-journaled types
    neglectedWealth: string[],     // least-journaled types
    avgMoodByType: {},             // avg mood per wealth type
    moodTrend: "rising"|"falling"|"stable",
    streakBest: number,
    totalWords: number,
    sessionCount: number,
    lastActiveHour: number,        // 0-23
    journalDepth: "shallow"|"medium"|"deep", // avg word count per answer
    openedAt: [],                  // timestamps of app opens (last 20)
    wealthCycleDays: {},           // last date each type was journaled
    growthAreas: string[],         // types with improving mood trend
    preferredPromptStyle: "reflective"|"analytical"|"forward-looking",
    insights: [],                  // AI-generated profile insights (last 5)
    lastProfileUpdate: string,
  }
═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   STORAGE
═══════════════════════════════════════════════ */
function useStore(k, d) {
  const [v, setV] = useState(() => {
    try { const x = localStorage.getItem(k); return x ? JSON.parse(x) : d; }
    catch { return d; }
  });
  const set = useCallback((val) => {
    setV(prev => {
      const next = typeof val === "function" ? val(prev) : val;
      try { localStorage.setItem(k, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [k]);
  return [v, set];
}

/* ═══════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════ */
const today = () => new Date().toISOString().split("T")[0];
const weekAgo = () => new Date(Date.now() - 7*864e5).toISOString().split("T")[0];
const yesterday = () => new Date(Date.now() - 864e5).toISOString().split("T")[0];
const hour = () => new Date().getHours();
const wordCount = (s="") => s.trim().split(/\s+/).filter(Boolean).length;

function inferJournalTime(h) {
  if (h >= 5  && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

function computeProfile(entries, existing = {}) {
  if (!entries.length) return existing;

  // counts per type
  const counts = {}; WEALTH.forEach(w => counts[w.id] = 0);
  entries.forEach(e => { if (counts[e.type] !== undefined) counts[e.type]++; });
  const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]);
  const dominant = sorted.slice(0,2).filter(([,c])=>c>0).map(([id])=>id);
  const neglected = sorted.slice(-2).filter(([,c])=>c<2).map(([id])=>id);

  // avg mood per type
  const moodSums = {}; const moodCounts = {};
  WEALTH.forEach(w => { moodSums[w.id]=0; moodCounts[w.id]=0; });
  entries.forEach(e => { moodSums[e.type]+=e.mood||2; moodCounts[e.type]++; });
  const avgMoodByType = {};
  WEALTH.forEach(w => { avgMoodByType[w.id] = moodCounts[w.id] ? +(moodSums[w.id]/moodCounts[w.id]).toFixed(2) : null; });

  // mood trend (compare last 5 vs prior 5)
  const moodRecent = entries.slice(0,5).map(e=>e.mood||2);
  const moodPrior  = entries.slice(5,10).map(e=>e.mood||2);
  const avgR = moodRecent.length ? moodRecent.reduce((a,b)=>a+b,0)/moodRecent.length : 2;
  const avgP = moodPrior.length  ? moodPrior.reduce((a,b)=>a+b,0)/moodPrior.length  : 2;
  const moodTrend = avgR > avgP+.3 ? "rising" : avgR < avgP-.3 ? "falling" : "stable";

  // word count / depth
  const allWords = entries.flatMap(e => e.answers||[]).map(a=>wordCount(a));
  const avgWords = allWords.length ? allWords.reduce((a,b)=>a+b,0)/allWords.length : 0;
  const journalDepth = avgWords < 20 ? "shallow" : avgWords < 60 ? "medium" : "deep";
  const totalWords = allWords.reduce((a,b)=>a+b,0);

  // last cycle per type
  const wealthCycleDays = {};
  WEALTH.forEach(w => {
    const last = entries.find(e=>e.type===w.id);
    wealthCycleDays[w.id] = last ? last.date : null;
  });

  // growth areas (types where mood improved in last 3 entries vs prior)
  const growthAreas = WEALTH.filter(w => {
    const te = entries.filter(e=>e.type===w.id);
    if (te.length < 4) return false;
    const r = te.slice(0,2).reduce((a,e)=>a+(e.mood||2),0)/2;
    const p = te.slice(2,4).reduce((a,e)=>a+(e.mood||2),0)/2;
    return r > p + .4;
  }).map(w=>w.id);

  // session count
  const sessionCount = (existing.sessionCount||0) + 1;

  // journal hour
  const h = hour();
  const lastActiveHour = h;
  const journalTime = inferJournalTime(h);

  return {
    ...existing,
    dominantWealth: dominant,
    neglectedWealth: neglected,
    avgMoodByType,
    moodTrend,
    journalDepth,
    totalWords,
    wealthCycleDays,
    growthAreas,
    sessionCount,
    lastActiveHour,
    journalTime,
    lastProfileUpdate: today(),
  };
}

async function ai(sys, usr) {
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:sys,messages:[{role:"user",content:usr}]})});
    const d = await r.json(); return d.content?.[0]?.text||"";
  } catch { return ""; }
}

function haptic() { try { if(navigator.vibrate) navigator.vibrate(8); } catch {} }

/* ═══════════════════════════════════════════════
   SYSTEM PROMPT — profile-aware
═══════════════════════════════════════════════ */
function buildSys(profile) {
  const dom = (profile.dominantWealth||[]).map(id=>WEALTH.find(w=>w.id===id)?.label).filter(Boolean).join(", ")||"unknown";
  const neg = (profile.neglectedWealth||[]).map(id=>WEALTH.find(w=>w.id===id)?.label).filter(Boolean).join(", ")||"none";
  const growth = (profile.growthAreas||[]).map(id=>WEALTH.find(w=>w.id===id)?.label).filter(Boolean).join(", ")||"none";
  return `You are "The Guide" — a wise, direct, philosophical inner coach inside Calm Quote, a journaling app built on 5 types of wealth: Time, Money, Mental, Physical, Social.

Voice: clear, warm, occasionally aphoristic. 3–5 sentences. Specific to what the user shared. Reference internal frameworks (Time Audit, Freedom Fund, Curiosity Flywheel, Energy Pyramid, Give-Ask-Thank) naturally.

USER PROFILE (use this to deeply personalize every response):
- Journal depth: ${profile.journalDepth||"unknown"} (avg word count per answer)
- Usually journals in the: ${profile.journalTime||"unknown"}
- Most-journaled wealth types: ${dom}
- Neglected wealth types: ${neg}
- Mood trend: ${profile.moodTrend||"stable"}
- Growth areas (improving): ${growth}
- Total reflections: ${profile.sessionCount||0}
- Total words written: ${profile.totalWords||0}

Adapt your tone and depth to match the user's journal depth. If mood trend is falling, be warmer and more supportive. If rising, celebrate and challenge. If they neglect certain types, occasionally (not always) invite curiosity about those areas.`;
}

/* ═══════════════════════════════════════════════
   MICRO COMPONENTS
═══════════════════════════════════════════════ */
function Pulse({color="#c084fc"}) {
  return <div style={{display:"flex",gap:5,alignItems:"center",padding:"6px 0"}}>
    {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:color,animation:`pls 1.2s ${i*.2}s infinite ease-in-out`}}/>)}
    <style>{`@keyframes pls{0%,100%{opacity:.15;transform:scale(.7)}50%{opacity:1;transform:scale(1.2)}}`}</style>
  </div>;
}

function Card({children,style={},onClick}) {
  const [p,setP]=useState(false);
  return <div onClick={()=>{haptic();onClick&&onClick();}} onPointerDown={()=>setP(true)} onPointerUp={()=>setP(false)} onPointerLeave={()=>setP(false)}
    style={{background:p&&onClick?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.03)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:24,padding:20,transform:p&&onClick?"scale(0.975)":"scale(1)",transition:"transform 0.12s ease,background 0.15s",cursor:onClick?"pointer":"default",WebkitTapHighlightColor:"transparent",userSelect:"none",...style}}>
    {children}
  </div>;
}

function Orb({w,size=44}) {
  return <div style={{width:size,height:size,borderRadius:size*.32,background:w.grad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.44,flexShrink:0,boxShadow:`0 4px 16px ${w.color}50`}}>{w.icon}</div>;
}

function Bar({value,grad,height=8}) {
  return <div style={{background:"rgba(255,255,255,0.06)",borderRadius:99,height,overflow:"hidden"}}>
    <div style={{background:grad,width:`${Math.max(value,0)}%`,height:"100%",borderRadius:99,transition:"width .7s cubic-bezier(.34,1.56,.64,1)"}}/>
  </div>;
}

function Badge({label,color}) {
  return <span style={{background:`${color}18`,color,fontSize:9,fontWeight:800,padding:"2px 9px",borderRadius:99,textTransform:"uppercase",letterSpacing:.8}}>{label}</span>;
}

function Label({children}) {
  return <p style={{color:"rgba(255,255,255,0.2)",fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:2.5,margin:"0 0 12px"}}>{children}</p>;
}

function TabBar({active,go}) {
  const tabs=[{id:"home",icon:"⬡",label:"Home"},{id:"insights",icon:"◈",label:"Stats"},{id:"profile",icon:"◉",label:"Profile"},{id:"search",icon:"◎",label:"Search"},{id:"referral",icon:"✦",label:"Share"}];
  return <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,zIndex:100,paddingBottom:"env(safe-area-inset-bottom)"}}>
    <div style={{margin:"0 10px 10px",background:"rgba(10,10,20,0.9)",backdropFilter:"blur(30px)",WebkitBackdropFilter:"blur(30px)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:24,display:"flex",padding:"8px 2px"}}>
      {tabs.map(t=>{const on=active===t.id;return(
        <button key={t.id} onClick={()=>{haptic();go(t.id);}} style={{flex:1,border:"none",cursor:"pointer",borderRadius:18,padding:"8px 0",display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:on?"rgba(255,255,255,0.1)":"transparent",transition:"all 0.2s",WebkitTapHighlightColor:"transparent"}}>
          <span style={{fontSize:14,opacity:on?1:.3}}>{t.icon}</span>
          <span style={{fontSize:8,fontWeight:800,letterSpacing:.5,color:on?"#fff":"rgba(255,255,255,0.25)",textTransform:"uppercase"}}>{t.label}</span>
        </button>
      );})}
    </div>
  </div>;
}

/* ═══════════════════════════════════════════════
   ONBOARDING
═══════════════════════════════════════════════ */
function Onboarding({onDone}) {
  const [step,setStep]=useState(0);
  const slides=[
    {icon:"✦",title:"Welcome to\nCalm Quote",sub:"A daily wealth journal for the 5 dimensions of a truly rich life.",color:"#c084fc",grad:"linear-gradient(135deg,#c084fc,#7c3aed)"},
    {icon:"⏳",title:"Time Wealth",sub:"Every hour is either an investment or a cost. The Time Audit helps you tell the difference.",color:"#c084fc",grad:"linear-gradient(135deg,#c084fc,#7c3aed)"},
    {icon:"🧠",title:"Mental Wealth",sub:"Your mind compounds. The Curiosity Flywheel keeps you growing every single day.",color:"#60a5fa",grad:"linear-gradient(135deg,#60a5fa,#2563eb)"},
    {icon:"💸",title:"Money Wealth",sub:"Money is a tool. The Freedom Fund principle turns every dollar saved into optionality.",color:"#34d399",grad:"linear-gradient(135deg,#34d399,#059669)"},
    {icon:"⚡",title:"Physical Wealth",sub:"Your body is the vessel for everything else. The Energy Pyramid is your foundation.",color:"#fb923c",grad:"linear-gradient(135deg,#fb923c,#c2410c)"},
    {icon:"🫂",title:"Social Wealth",sub:"Give, Ask, Thank — three words that transform every relationship.",color:"#fbbf24",grad:"linear-gradient(135deg,#fbbf24,#d97706)"},
    {icon:"🔥",title:"Let's Begin",sub:"Reflect daily. Compound daily. Thrive.",color:"#c084fc",grad:"linear-gradient(135deg,#c084fc,#60a5fa,#34d399)"},
  ];
  const s=slides[step]; const isLast=step===slides.length-1;
  return <div style={{minHeight:"100dvh",background:"#080810",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 28px calc(40px + env(safe-area-inset-bottom))",fontFamily:"'Inter',-apple-system,sans-serif",textAlign:"center"}}>
    <div style={{width:"100%",maxWidth:380}}>
      <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:48}}>
        {slides.map((_,i)=><div key={i} style={{height:4,borderRadius:99,background:i===step?s.color:"rgba(255,255,255,0.1)",width:i===step?24:6,transition:"all 0.3s"}}/>)}
      </div>
      <div style={{fontSize:72,marginBottom:28,lineHeight:1}}>{s.icon}</div>
      <h1 style={{color:"#fff",fontSize:30,fontWeight:900,lineHeight:1.15,letterSpacing:"-1px",margin:"0 0 16px",whiteSpace:"pre-line"}}>{s.title}</h1>
      <p style={{color:"rgba(255,255,255,0.45)",fontSize:16,lineHeight:1.7,margin:"0 0 52px"}}>{s.sub}</p>
      <button onClick={()=>{haptic();isLast?onDone():setStep(s=>s+1);}} style={{width:"100%",padding:"18px",borderRadius:20,border:"none",background:s.grad,color:"#fff",fontWeight:900,fontSize:17,cursor:"pointer",boxShadow:`0 10px 40px ${s.color}50`,WebkitTapHighlightColor:"transparent"}}>
        {isLast?"Start Journaling →":"Next →"}
      </button>
      {!isLast&&<button onClick={()=>{haptic();onDone();}} style={{background:"none",border:"none",color:"rgba(255,255,255,0.2)",fontSize:14,marginTop:20,cursor:"pointer",padding:"10px",WebkitTapHighlightColor:"transparent"}}>Skip</button>}
    </div>
  </div>;
}

/* ═══════════════════════════════════════════════
   PROFILE SCREEN
═══════════════════════════════════════════════ */
function ProfileScreen({profile,entries,onRefreshInsight}) {
  const [insightLoad,setInsightLoad]=useState(false);
  const dom=(profile.dominantWealth||[]).map(id=>WEALTH.find(w=>w.id===id)).filter(Boolean);
  const neg=(profile.neglectedWealth||[]).map(id=>WEALTH.find(w=>w.id===id)).filter(Boolean);
  const growth=(profile.growthAreas||[]).map(id=>WEALTH.find(w=>w.id===id)).filter(Boolean);
  const moodLabel={rising:"📈 Rising",falling:"📉 Needs care",stable:"➡ Stable"}[profile.moodTrend||"stable"];
  const depthLabel={shallow:"Quick & light",medium:"Thoughtful",deep:"Deeply reflective"}[profile.journalDepth||"shallow"];
  const timeEmoji={morning:"🌅",afternoon:"☀️",evening:"🌆",night:"🌙"}[profile.journalTime||"evening"];
  const latestInsight=(profile.insights||[]).slice(-1)[0]||"";

  async function refreshInsight(){
    setInsightLoad(true);
    const sys=buildSys(profile);
    const text=await ai(sys,`Based on this user's behavior and journal patterns, write ONE short personal insight (2–3 sentences) that reveals something meaningful about their wealth journey — something they might not have noticed themselves. Be specific, warm, and surprising.\n\nProfile:\n${JSON.stringify(profile,null,2)}\n\nRecent entries:\n${entries.slice(0,6).map(e=>`[${e.type}] ${e.answers?.filter(Boolean).join(" | ")}`).join("\n")}`);
    if(text) onRefreshInsight(text);
    setInsightLoad(false);
  }

  const statRow=(label,val,color="#fff")=>(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
      <span style={{color:"rgba(255,255,255,0.3)",fontSize:13}}>{label}</span>
      <span style={{color,fontSize:13,fontWeight:700}}>{val}</span>
    </div>
  );

  return <div style={{padding:"44px 20px 140px",paddingTop:"calc(44px + env(safe-area-inset-top,0px))"}}>
    <Label>Your Identity</Label>
    <h2 style={{color:"#fff",fontSize:26,fontWeight:900,margin:"0 0 6px",letterSpacing:-.5}}>Wealth Profile</h2>
    <p style={{color:"rgba(255,255,255,0.3)",fontSize:14,margin:"0 0 24px"}}>Built from your behaviour — updated after every reflection.</p>

    {/* AI Insight */}
    <Card style={{marginBottom:16,borderColor:"rgba(192,132,252,0.25)",background:"linear-gradient(135deg,rgba(192,132,252,0.08),rgba(96,165,250,0.05))"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <div style={{width:30,height:30,borderRadius:10,background:"linear-gradient(135deg,#c084fc,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>✦</div>
        <Label>The Guide Sees</Label>
      </div>
      {insightLoad?<Pulse color="#c084fc"/>
        :latestInsight?<p style={{color:"rgba(255,255,255,0.65)",fontSize:14,lineHeight:1.8,margin:"0 0 14px",fontStyle:"italic"}}>{latestInsight}</p>
        :<p style={{color:"rgba(255,255,255,0.2)",fontSize:14,margin:"0 0 14px"}}>Generate your first personal insight below.</p>}
      <button onClick={refreshInsight} style={{background:"rgba(192,132,252,0.15)",border:"1px solid rgba(192,132,252,0.3)",borderRadius:12,color:"#c084fc",padding:"10px 16px",fontSize:13,fontWeight:800,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
        {insightLoad?"generating...":"✦ Refresh Insight"}
      </button>
    </Card>

    {/* Wealth focus */}
    {dom.length>0&&<Card style={{marginBottom:12}}>
      <Label>You Focus On</Label>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        {dom.map(w=><div key={w.id} style={{display:"flex",alignItems:"center",gap:8,background:w.bg,border:`1px solid ${w.color}33`,borderRadius:14,padding:"8px 14px"}}>
          <span style={{fontSize:18}}>{w.icon}</span><span style={{color:w.color,fontWeight:800,fontSize:14}}>{w.label}</span>
        </div>)}
      </div>
    </Card>}
    {neg.length>0&&<Card style={{marginBottom:12}}>
      <Label>Often Neglected</Label>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        {neg.map(w=><div key={w.id} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"8px 14px"}}>
          <span style={{fontSize:18}}>{w.icon}</span><span style={{color:"rgba(255,255,255,0.4)",fontWeight:700,fontSize:14}}>{w.label}</span>
        </div>)}
      </div>
    </Card>}
    {growth.length>0&&<Card style={{marginBottom:16}}>
      <Label>Growing</Label>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        {growth.map(w=><div key={w.id} style={{display:"flex",alignItems:"center",gap:8,background:w.bg,border:`1px solid ${w.color}44`,borderRadius:14,padding:"8px 14px"}}>
          <span style={{fontSize:18}}>{w.icon}</span><span style={{color:w.color,fontWeight:800,fontSize:14}}>{w.label} ↑</span>
        </div>)}
      </div>
    </Card>}

    {/* Stats */}
    <Card style={{marginBottom:16}}>
      <Label>Behaviour Stats</Label>
      {statRow("Total reflections",entries.length,"#c084fc")}
      {statRow("Total words written",(profile.totalWords||0).toLocaleString(),"#60a5fa")}
      {statRow("Journal depth",depthLabel,"#34d399")}
      {statRow("Usually journals",`${timeEmoji} ${profile.journalTime||"—"}`,"#fbbf24")}
      {statRow("Mood trend",moodLabel,profile.moodTrend==="rising"?"#34d399":profile.moodTrend==="falling"?"#f87171":"#94a3b8")}
      {statRow("Best streak",(profile.streakBest||0)+" days","#fbbf24")}
    </Card>

    {/* Per-type mood */}
    <Card>
      <Label>Avg Mood by Wealth</Label>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
        {WEALTH.map(w=>{
          const avg=profile.avgMoodByType?.[w.id];
          const idx=avg!=null?Math.round(avg):null;
          return <div key={w.id} style={{background:w.bg,border:`1px solid ${w.color}22`,borderRadius:16,padding:"12px 4px",textAlign:"center"}}>
            <div style={{fontSize:18}}>{w.icon}</div>
            <div style={{fontSize:20,margin:"6px 0 4px"}}>{idx!=null?MOODS[idx].e:"—"}</div>
            <div style={{color:"rgba(255,255,255,0.2)",fontSize:8,textTransform:"uppercase"}}>{idx!=null?MOODS[idx].l:"no data"}</div>
          </div>;
        })}
      </div>
    </Card>
  </div>;
}

/* ═══════════════════════════════════════════════
   REFERRAL SCREEN
═══════════════════════════════════════════════ */
function ReferralScreen() {
  const [copied,setCopied]=useState(false);
  const [shared,setShared]=useState(false);
  function copyLink(){
    haptic();
    try{navigator.clipboard.writeText(REFERRAL_URL);}
    catch{const el=document.createElement("textarea");el.value=REFERRAL_URL;el.style.position="absolute";el.style.left="-9999px";document.body.appendChild(el);el.select();document.execCommand("copy");document.body.removeChild(el);}
    setCopied(true);setTimeout(()=>setCopied(false),2500);
  }
  async function nativeShare(){
    haptic();
    if(navigator.share){try{await navigator.share({title:"Calm Quote",text:"I've been journaling daily on Calm Quote — built around the 5 types of wealth. Join me 👇",url:REFERRAL_URL});setShared(true);}catch{}}
    else copyLink();
  }
  const channels=[
    {label:"WhatsApp",icon:"💬",color:"#25d366",href:`https://wa.me/?text=${encodeURIComponent(`I've been using Calm Quote to reflect on all 5 types of wealth. Join me 👇 ${REFERRAL_URL}`)}`},
    {label:"X / Twitter",icon:"𝕏",color:"#fff",href:`https://twitter.com/intent/tweet?text=${encodeURIComponent("Reflecting on all 5 types of wealth daily with Calm Quote. This app is different. 🔥")}&url=${encodeURIComponent(REFERRAL_URL)}`},
    {label:"Telegram",icon:"✈️",color:"#2aabee",href:`https://t.me/share/url?url=${encodeURIComponent(REFERRAL_URL)}&text=${encodeURIComponent("Reflecting on 5 types of wealth daily — join me on Calm Quote 🧠")}`},
    {label:"Email",icon:"📧",color:"#fb923c",href:`mailto:?subject=${encodeURIComponent("You should try Calm Quote")}&body=${encodeURIComponent(`Hey,\n\nI've been journaling daily on Calm Quote — it's built around the 5 types of wealth and has genuinely changed how I think about time, money, and growth.\n\nJoin here: ${REFERRAL_URL}`)}`},
  ];
  return <div style={{padding:"44px 20px 140px",paddingTop:"calc(44px + env(safe-area-inset-top,0px))"}}>
    <Label>Spread the Wealth</Label>
    <h2 style={{color:"#fff",fontSize:26,fontWeight:900,margin:"0 0 6px",letterSpacing:-.5}}>Invite Friends</h2>
    <p style={{color:"rgba(255,255,255,0.3)",fontSize:14,lineHeight:1.6,margin:"0 0 24px"}}>Share Calm Quote with people serious about building all 5 types of wealth.</p>
    <div style={{background:"linear-gradient(135deg,rgba(192,132,252,0.12),rgba(96,165,250,0.08))",border:"1px solid rgba(192,132,252,0.25)",borderRadius:24,padding:22,marginBottom:16}}>
      <Label>Your Referral Link</Label>
      <div style={{display:"flex",alignItems:"center",gap:10,background:"rgba(0,0,0,0.3)",borderRadius:14,padding:"12px 16px",marginBottom:14}}>
        <p style={{color:"rgba(255,255,255,0.7)",fontSize:14,fontWeight:600,margin:0,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{REFERRAL_URL}</p>
        <button onClick={copyLink} style={{background:copied?"#34d399":"rgba(255,255,255,0.1)",border:"none",borderRadius:10,color:"#fff",padding:"8px 14px",fontSize:12,fontWeight:800,cursor:"pointer",flexShrink:0,transition:"background .2s",WebkitTapHighlightColor:"transparent"}}>{copied?"✓ Copied":"Copy"}</button>
      </div>
      <button onClick={nativeShare} style={{width:"100%",padding:"16px",borderRadius:16,border:"none",background:"linear-gradient(135deg,#c084fc,#7c3aed)",color:"#fff",fontWeight:900,fontSize:15,cursor:"pointer",boxShadow:"0 8px 30px rgba(192,132,252,0.35)",WebkitTapHighlightColor:"transparent"}}>{shared?"🎉 Shared!":"✦ Share Now"}</button>
    </div>
    <Label>Share Via</Label>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:24}}>
      {channels.map(c=><a key={c.label} href={c.href} target="_blank" rel="noopener noreferrer" onClick={haptic}
        style={{display:"flex",alignItems:"center",gap:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:18,padding:"14px 16px",textDecoration:"none",WebkitTapHighlightColor:"transparent"}}>
        <span style={{fontSize:20}}>{c.icon}</span><span style={{color:"rgba(255,255,255,0.7)",fontSize:13,fontWeight:700}}>{c.label}</span>
      </a>)}
    </div>
    <Card>
      <Label>Message Template</Label>
      <p style={{color:"rgba(255,255,255,0.5)",fontSize:14,lineHeight:1.75,margin:"0 0 14px",fontStyle:"italic"}}>"I've been journaling on Calm Quote daily — built around the 5 types of wealth and has genuinely shifted how I think about time, money, and growth. You should try it 👇 {REFERRAL_URL}"</p>
      <button onClick={()=>{haptic();const msg=`I've been journaling on Calm Quote daily — built around the 5 types of wealth and has genuinely shifted how I think about time, money, and growth. You should try it 👇 ${REFERRAL_URL}`;try{navigator.clipboard.writeText(msg);}catch{}setCopied(true);setTimeout(()=>setCopied(false),2500);}} style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,color:"rgba(255,255,255,0.6)",padding:"10px 16px",fontSize:13,fontWeight:700,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>{copied?"✓ Copied!":"Copy Message"}</button>
    </Card>
  </div>;
}

/* ═══════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════ */
export default function App() {
  const [onboarded,setOnboarded] = useStore("cq6_ob",false);
  const [entries,  setEntries]   = useStore("cq6_e", []);
  const [streak,   setStreak]    = useStore("cq6_s", {count:0,last:"",best:0});
  const [quote,    setQuote]     = useStore("cq6_q", {date:"",text:""});
  const [suggest,  setSuggest]   = useStore("cq6_sg",{date:"",typeId:"",reason:""});
  const [weekly,   setWeekly]    = useStore("cq6_w", {date:"",text:""});
  const [profile,  setProfile]   = useStore("cq6_p", {});

  const [view,   setView]   = useState("home");
  const [tab,    setTab]    = useState("home");
  const [sel,    setSel]    = useState(null);
  const [step,   setStep]   = useState(0);
  const [ans,    setAns]    = useState(["","",""]);
  const [mood,   setMood]   = useState(2);
  const [fbText, setFbText] = useState("");
  const [fbLoad, setFbLoad] = useState(false);
  const [qLoad,  setQLoad]  = useState(false);
  const [wLoad,  setWLoad]  = useState(false);
  const [search, setSearch] = useState("");
  const [fType,  setFType]  = useState("all");
  const [warn,   setWarn]   = useState(false);
  const [showP,  setShowP]  = useState(null);

  // Track app opens for behaviour profiling
  useEffect(() => {
    if (!onboarded) return;
    const now = Date.now();
    setProfile(p => {
      const opens = [...(p.openedAt||[]), now].slice(-20);
      return { ...p, openedAt: opens, lastActiveHour: hour(), journalTime: inferJournalTime(hour()) };
    });
  }, [onboarded]);

  const sys = useMemo(() => buildSys(profile), [profile]);

  const ctx = useMemo(() =>
    entries.slice(0,12).map(e=>{const w=WEALTH.find(x=>x.id===e.type);return `[${e.date}] ${w?.label} (${MOODS[e.mood]?.l}): ${e.answers?.filter(Boolean).join(" | ")}`;}).join("\n"),
  [entries]);

  // Daily quote
  useEffect(() => {
    const t=today();
    if (quote.date===t||!onboarded) return;
    setQLoad(true);
    ai(sys,`Generate ONE original short philosophical quote (1–2 sentences, aphoristic) deeply personalized to this user's wealth journey. Just the quote.\n\n${ctx||"New user starting their wealth journey."}`
    ).then(text=>{if(text)setQuote({date:t,text});setQLoad(false);});
  }, [entries.length, onboarded]);

  // Daily suggestion — profile-aware
  useEffect(() => {
    const t=today();
    if (suggest.date===t||!onboarded) return;
    ai(sys,`Which ONE wealth type (time,money,mental,physical,social) should this person focus on today? Consider their neglected areas and mood trend. One sentence reason. JSON only: {"typeId":"...","reason":"..."}\n\n${ctx||"New user."}`
    ).then(text=>{
      try{const p=JSON.parse(text.replace(/```json|```/g,"").trim());setSuggest({date:t,...p});}
      catch{setSuggest({date:t,typeId:"mental",reason:"The Curiosity Flywheel is always the best place to begin."});}
    });
  }, [entries.length, onboarded]);

  const go = useCallback((v)=>{setTab(v);setView(v);},[]);

  function startJournal(w) {
    haptic(); setSel(w); setStep(0); setAns(["","",""]); setMood(2);
    setFbText(""); setFbLoad(false); setWarn(false); setView("journal");
  }

  async function save() {
    const t=today();
    const entry={id:Date.now(),date:t,type:sel.id,answers:ans,mood,prompts:sel.prompts};
    setEntries(p=>[entry,...p]);

    // Update streak
    const yest=yesterday();
    setStreak(s=>{
      if(s.last===t) return s;
      const newCount=s.last===yest?s.count+1:1;
      return {count:newCount,last:t,best:Math.max(newCount,s.best||0)};
    });

    // Recompute profile from all entries + new one
    const allEntries=[entry,...entries];
    const newProfile=computeProfile(allEntries, profile);
    newProfile.streakBest=Math.max(streak.best||0, streak.count+(streak.last===yest?1:0));
    setProfile(newProfile);

    // AI feedback with profile context
    setFbLoad(true); setView("feedback");
    const text=await ai(buildSys(newProfile),
      `User completed a ${sel.label} reflection. Respond as The Guide — warm, specific, philosophical. Reference framework: "${sel.framework}" if natural. Their mood: ${MOODS[mood].l}. 3–5 sentences. Use the user profile to deeply personalize.\n\n${sel.prompts.map((p,i)=>`Q: ${p}\nA: ${ans[i]}`).join("\n\n")}\n\nRecent context:\n${ctx}`
    );
    setFbText(text); setFbLoad(false);
  }

  async function genWeekly() {
    const we=entries.filter(e=>e.date>=weekAgo());
    if(!we.length) return;
    setWLoad(true);
    const c=we.map(e=>{const w=WEALTH.find(x=>x.id===e.type);return`[${e.date}] ${w?.label}: ${e.answers?.filter(Boolean).join(" | ")} (${MOODS[e.mood]?.l})`;}).join("\n");
    const text=await ai(sys,`Write a weekly wealth debrief as The Guide — philosophical, specific, warm. Reference frameworks. Use the user profile. Identify compounding patterns, celebrate wins, name ONE focus for next week. 5–7 sentences.\n\n${c}`);
    if(text) setWeekly({date:today(),text});
    setWLoad(false);
  }

  function onRefreshInsight(text) {
    setProfile(p=>({...p,insights:[...(p.insights||[]).slice(-4),text]}));
  }

  const counts=useMemo(()=>{const c={};WEALTH.forEach(w=>c[w.id]=0);entries.forEach(e=>{if(c[e.type]!==undefined)c[e.type]++;});return c;},[entries]);
  const maxC=Math.max(...Object.values(counts),1);
  const sugW=WEALTH.find(w=>w.id===suggest.typeId);
  const filtered=useMemo(()=>entries.filter(e=>(fType==="all"||e.type===fType)&&(!search||e.answers?.some(a=>a?.toLowerCase().includes(search.toLowerCase())))),[entries,fType,search]);

  const ROOT={minHeight:"100dvh",background:"#080810",fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",maxWidth:480,margin:"0 auto",position:"relative",overflowX:"hidden"};

  if(!onboarded) return <Onboarding onDone={()=>setOnboarded(true)}/>;

  /* ── Feedback ── */
  if(view==="feedback"&&sel){const w=sel;return(
    <div style={{...ROOT,background:`radial-gradient(ellipse at top,${w.dark}22 0%,#080810 60%)`}}>
      <div style={{padding:"50px 20px",paddingTop:"calc(50px + env(safe-area-inset-top,0px))",paddingBottom:"calc(50px + env(safe-area-inset-bottom))"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:60,lineHeight:1}}>✦</div>
          <h2 style={{color:"#fff",fontSize:24,fontWeight:900,margin:"16px 0 8px",letterSpacing:-.5}}>Reflection Complete</h2>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.06)",borderRadius:99,padding:"6px 16px"}}>
            <span style={{fontSize:16}}>🔥</span>
            <span style={{color:"#fbbf24",fontWeight:800,fontSize:14}}>{streak.count} day streak</span>
          </div>
        </div>
        <Card style={{borderColor:`${w.color}22`,marginBottom:12}}>
          <p style={{color:"rgba(255,255,255,0.2)",fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>Framework</p>
          <p style={{color:"rgba(255,255,255,0.4)",fontSize:13,lineHeight:1.7,margin:0}}>{w.framework}</p>
        </Card>
        <Card style={{borderColor:`${w.color}44`,background:w.bg,marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <div style={{width:30,height:30,borderRadius:10,background:w.grad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>✦</div>
            <p style={{color:w.color,fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:2,margin:0}}>The Guide</p>
          </div>
          {fbLoad?<Pulse color={w.color}/>:<p style={{color:"rgba(255,255,255,0.75)",fontSize:15,lineHeight:1.8,margin:0,fontStyle:"italic"}}>{fbText}</p>}
        </Card>
        <button onClick={()=>{haptic();go("home");}} style={{width:"100%",padding:"18px",borderRadius:20,border:"none",background:w.grad,color:"#fff",fontWeight:900,fontSize:16,cursor:"pointer",boxShadow:`0 8px 30px ${w.color}40`,WebkitTapHighlightColor:"transparent"}}>Back to Home →</button>
      </div>
    </div>
  );}

  /* ── Journal ── */
  if(view==="journal"&&sel){const w=sel;const isLast=step===w.prompts.length-1;return(
    <div style={{...ROOT,background:`radial-gradient(ellipse at top,${w.dark}18 0%,#080810 55%)`}}>
      {warn&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:200,display:"flex",alignItems:"flex-end",padding:`0 16px calc(16px + env(safe-area-inset-bottom))`}}>
        <div style={{background:"#0f0f1a",border:"1px solid rgba(255,255,255,0.1)",borderRadius:28,padding:28,width:"100%"}}>
          <p style={{color:"#fff",fontWeight:900,fontSize:18,marginBottom:8}}>Leave reflection?</p>
          <p style={{color:"rgba(255,255,255,0.3)",fontSize:14,marginBottom:24,lineHeight:1.6}}>Your answers will be lost. Unfinished reflection is still just thinking.</p>
          <div style={{display:"flex",gap:10}}>
            <button style={{flex:1,padding:"15px",borderRadius:16,border:"1px solid rgba(255,255,255,0.1)",background:"none",color:"rgba(255,255,255,0.5)",fontWeight:700,fontSize:15,cursor:"pointer",WebkitTapHighlightColor:"transparent"}} onClick={()=>{haptic();setWarn(false);}}>Stay</button>
            <button style={{flex:1,padding:"15px",borderRadius:16,border:"none",background:"#dc2626",color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",WebkitTapHighlightColor:"transparent"}} onClick={()=>{haptic();setWarn(false);go("home");}}>Leave</button>
          </div>
        </div>
      </div>}
      <div style={{padding:"0 0 40px"}}>
        <div style={{padding:"20px 20px 0",paddingTop:"calc(20px + env(safe-area-inset-top,0px))",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <button style={{background:"none",border:"none",color:"rgba(255,255,255,0.35)",cursor:"pointer",fontSize:14,fontWeight:600,padding:"8px 0",WebkitTapHighlightColor:"transparent"}} onClick={()=>{haptic();ans.some(a=>a.trim())?setWarn(true):go("home");}}>← Back</button>
          <div style={{background:w.grad,borderRadius:20,padding:"5px 16px",fontSize:12,fontWeight:800,color:"#fff"}}>{w.icon} {w.label}</div>
          <span style={{color:"rgba(255,255,255,0.2)",fontSize:13}}>{step+1}/{w.prompts.length}</span>
        </div>
        <div style={{display:"flex",gap:4,padding:"14px 20px 0"}}>
          {w.prompts.map((_,i)=><div key={i} style={{flex:1,height:2,borderRadius:99,background:i<=step?w.color:"rgba(255,255,255,0.08)",transition:"background .3s"}}/>)}
        </div>
        <div style={{padding:"20px 20px 0"}}>
          <div style={{background:w.bg,border:`1px solid ${w.color}22`,borderRadius:18,padding:"12px 16px",marginBottom:18}}>
            <p style={{color:w.color,fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:2,marginBottom:4}}>Framework</p>
            <p style={{color:"rgba(255,255,255,0.3)",fontSize:12,lineHeight:1.65,margin:0}}>{w.framework}</p>
          </div>
          <p style={{color:"rgba(255,255,255,0.85)",fontSize:17,lineHeight:1.75,fontWeight:500,marginBottom:18}}>{w.prompts[step]}</p>
          <textarea style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1.5px solid ${w.color}44`,borderRadius:18,color:"rgba(255,255,255,0.9)",padding:"18px",fontSize:16,lineHeight:1.75,resize:"none",outline:"none",boxSizing:"border-box",fontFamily:"inherit",minHeight:150,WebkitAppearance:"none"}}
            placeholder="Reflect honestly here..." value={ans[step]}
            onChange={e=>{const a=[...ans];a[step]=e.target.value;setAns(a);}}
            onFocus={e=>e.target.style.borderColor=w.color} onBlur={e=>e.target.style.borderColor=`${w.color}44`} autoFocus/>
          {isLast&&<div style={{marginTop:22}}>
            <p style={{color:"rgba(255,255,255,0.2)",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>Current State</p>
            <div style={{display:"flex",gap:8}}>
              {MOODS.map((m,i)=><button key={i} onClick={()=>{haptic();setMood(i);}} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"12px 4px",background:mood===i?w.bg:"rgba(255,255,255,0.03)",border:mood===i?`1.5px solid ${w.color}`:"1.5px solid rgba(255,255,255,0.06)",borderRadius:16,cursor:"pointer",transition:"all .15s",WebkitTapHighlightColor:"transparent"}}>
                <span style={{fontSize:22}}>{m.e}</span>
                <span style={{color:mood===i?w.color:"rgba(255,255,255,0.2)",fontSize:9,fontWeight:700,textTransform:"uppercase"}}>{m.l}</span>
              </button>)}
            </div>
          </div>}
          <div style={{display:"flex",gap:10,marginTop:22,paddingBottom:"calc(20px + env(safe-area-inset-bottom))"}}>
            {step>0&&<button style={{flex:1,padding:"16px",borderRadius:18,border:"1px solid rgba(255,255,255,0.1)",background:"none",color:"rgba(255,255,255,0.5)",fontWeight:700,fontSize:15,cursor:"pointer",WebkitTapHighlightColor:"transparent"}} onClick={()=>{haptic();setStep(s=>s-1);}}>← Prev</button>}
            <button style={{flex:2,padding:"16px",borderRadius:18,border:"none",background:ans[step].trim()?w.grad:"rgba(255,255,255,0.06)",color:ans[step].trim()?"#fff":"rgba(255,255,255,0.2)",fontWeight:900,fontSize:15,cursor:ans[step].trim()?"pointer":"default",boxShadow:ans[step].trim()?`0 8px 24px ${w.color}40`:"none",transition:"all .2s",WebkitTapHighlightColor:"transparent"}}
              disabled={!ans[step].trim()} onClick={()=>{haptic();isLast?save():setStep(s=>s+1);}}>
              {isLast?"Lock It In 🔒":"Next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );}

  /* ── Insights ── */
  if(view==="insights")return(
    <div style={ROOT}>
      <div style={{padding:"44px 20px 140px",paddingTop:"calc(44px + env(safe-area-inset-top,0px))"}}>
        <Label>Your Overview</Label>
        <h2 style={{color:"#fff",fontSize:26,fontWeight:900,margin:"0 0 24px",letterSpacing:-.5}}>Wealth Stats</h2>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <Card style={{textAlign:"center",padding:"22px 16px"}}><div style={{fontSize:34,fontWeight:900,color:"#fff",letterSpacing:-1}}>{entries.length}</div><div style={{color:"rgba(255,255,255,0.25)",fontSize:12,fontWeight:600,marginTop:4}}>Reflections</div></Card>
          <Card style={{textAlign:"center",padding:"22px 16px"}}><div style={{fontSize:32,fontWeight:900,color:"#fbbf24",letterSpacing:-1}}>🔥{streak.count}</div><div style={{color:"rgba(255,255,255,0.25)",fontSize:12,fontWeight:600,marginTop:4}}>Day Streak</div></Card>
        </div>
        <Card style={{marginBottom:16,borderColor:"rgba(192,132,252,0.2)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <div style={{width:30,height:30,borderRadius:10,background:"linear-gradient(135deg,#c084fc,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>✦</div>
            <Label>Weekly Debrief</Label>
          </div>
          {weekly.text?<p style={{color:"rgba(255,255,255,0.55)",fontSize:14,lineHeight:1.8,margin:"0 0 16px",fontStyle:"italic"}}>{weekly.text}</p>
            :<p style={{color:"rgba(255,255,255,0.2)",fontSize:14,margin:"0 0 16px"}}>Generate your personalized weekly debrief below.</p>}
          <button style={{width:"100%",padding:"14px",borderRadius:16,border:"none",background:entries.filter(e=>e.date>=weekAgo()).length>0&&!wLoad?"linear-gradient(135deg,#c084fc,#7c3aed)":"rgba(255,255,255,0.06)",color:wLoad||!entries.filter(e=>e.date>=weekAgo()).length?"rgba(255,255,255,0.3)":"#fff",fontWeight:800,fontSize:14,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}
            disabled={!entries.filter(e=>e.date>=weekAgo()).length||wLoad} onClick={genWeekly}>
            {wLoad?<Pulse color="#c084fc"/>:"✦ Generate Weekly Debrief"}
          </button>
        </Card>
        <Card style={{marginBottom:16}}>
          <Label>Wealth Allocation</Label>
          {WEALTH.map(w=><div key={w.id} style={{marginBottom:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:18}}>{w.icon}</span><span style={{color:"rgba(255,255,255,0.8)",fontSize:14,fontWeight:700}}>{w.label}</span></div>
              <span style={{color:w.color,fontSize:13,fontWeight:800}}>{counts[w.id]}×</span>
            </div>
            <Bar value={(counts[w.id]/maxC)*100} grad={w.grad}/>
            <button onClick={()=>{haptic();setShowP(showP===w.id?null:w.id);}} style={{background:"none",border:"none",color:w.color,fontSize:11,cursor:"pointer",padding:"5px 0 0",fontWeight:700,WebkitTapHighlightColor:"transparent"}}>{showP===w.id?"▲ hide":"▼ principle"}</button>
            {showP===w.id&&<div style={{background:w.bg,border:`1px solid ${w.color}22`,borderRadius:12,padding:"10px 14px",marginTop:8}}><p style={{color:"rgba(255,255,255,0.45)",fontSize:13,lineHeight:1.65,margin:0}}>{w.principle}</p></div>}
          </div>)}
        </Card>
        <Card>
          <Label>Energy by Type</Label>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
            {WEALTH.map(w=>{const te=entries.filter(e=>e.type===w.id);const avg=te.length?Math.round(te.reduce((s,e)=>s+e.mood,0)/te.length):null;return(
              <div key={w.id} style={{background:w.bg,border:`1px solid ${w.color}22`,borderRadius:16,padding:"12px 4px",textAlign:"center"}}>
                <div style={{fontSize:18}}>{w.icon}</div>
                <div style={{fontSize:20,margin:"6px 0 4px"}}>{avg!==null?MOODS[avg].e:"—"}</div>
                <div style={{color:"rgba(255,255,255,0.2)",fontSize:8,textTransform:"uppercase"}}>{avg!==null?MOODS[avg].l:"no data"}</div>
              </div>);
            })}
          </div>
        </Card>
      </div>
      <TabBar active={tab} go={go}/>
    </div>
  );

  /* ── Search ── */
  if(view==="search")return(
    <div style={ROOT}>
      <div style={{padding:"44px 20px 140px",paddingTop:"calc(44px + env(safe-area-inset-top,0px))"}}>
        <Label>Your Archive</Label>
        <h2 style={{color:"#fff",fontSize:26,fontWeight:900,margin:"0 0 20px",letterSpacing:-.5}}>Search</h2>
        <div style={{position:"relative",marginBottom:14}}>
          <span style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",color:"rgba(255,255,255,0.2)",fontSize:16,pointerEvents:"none"}}>◎</span>
          <input style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1.5px solid rgba(255,255,255,0.08)",borderRadius:18,color:"rgba(255,255,255,0.85)",padding:"15px 16px 15px 44px",fontSize:15,outline:"none",boxSizing:"border-box",fontFamily:"inherit",WebkitAppearance:"none"}}
            placeholder="Search your thoughts..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
          {[{id:"all",label:"All",icon:"⚡",color:"rgba(255,255,255,0.5)"},...WEALTH].map(w=>(
            <button key={w.id} onClick={()=>{haptic();setFType(w.id);}} style={{padding:"7px 14px",borderRadius:99,border:"none",cursor:"pointer",fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:.5,background:fType===w.id?(w.color||"rgba(255,255,255,0.8)"):"rgba(255,255,255,0.06)",color:fType===w.id?"#080810":"rgba(255,255,255,0.4)",transition:"all .15s",WebkitTapHighlightColor:"transparent"}}>
              {w.icon} {w.short||w.label}
            </button>
          ))}
        </div>
        {filtered.length===0&&<div style={{textAlign:"center",padding:"60px 0",color:"rgba(255,255,255,0.15)",fontSize:15}}>No entries found 👻</div>}
        {filtered.map(e=>{const w=WEALTH.find(x=>x.id===e.type);return(
          <Card key={e.id} style={{borderLeft:`3px solid ${w.color}`,marginBottom:12,borderRadius:20}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}><Orb w={w} size={26}/><span style={{color:w.color,fontWeight:800,fontSize:13}}>{w.label}</span></div>
              <span style={{color:"rgba(255,255,255,0.2)",fontSize:12}}>{e.date} · {MOODS[e.mood]?.e}</span>
            </div>
            {e.answers?.map((a,i)=>a&&<div key={i} style={{marginBottom:10}}>
              <p style={{color:"rgba(255,255,255,0.18)",fontSize:11,marginBottom:4,lineHeight:1.5}}>{e.prompts?.[i]}</p>
              <p style={{color:"rgba(255,255,255,0.6)",fontSize:14,lineHeight:1.7,margin:0}}>{a}</p>
            </div>)}
          </Card>
        );})}
      </div>
      <TabBar active={tab} go={go}/>
    </div>
  );

  if(view==="referral")return(<div style={ROOT}><ReferralScreen/><TabBar active={tab} go={go}/></div>);
  if(view==="profile")return(<div style={ROOT}><ProfileScreen profile={profile} entries={entries} onRefreshInsight={onRefreshInsight}/><TabBar active={tab} go={go}/></div>);

  /* ── Home ── */
  const moodTrendColor={rising:"#34d399",falling:"#f87171",stable:"#60a5fa"}[profile.moodTrend||"stable"];
  const moodTrendLabel={rising:"↑ Rising",falling:"↓ Needs care",stable:"→ Stable"}[profile.moodTrend||"stable"];

  return(
    <div style={ROOT}>
      <div style={{position:"fixed",top:-120,right:-80,width:320,height:320,borderRadius:"50%",background:"radial-gradient(circle,rgba(192,132,252,0.09) 0%,transparent 70%)",pointerEvents:"none",zIndex:0}}/>
      <div style={{position:"fixed",bottom:150,left:-80,width:260,height:260,borderRadius:"50%",background:"radial-gradient(circle,rgba(96,165,250,0.05) 0%,transparent 70%)",pointerEvents:"none",zIndex:0}}/>
      <div style={{position:"relative",zIndex:1,padding:"0 0 140px"}}>
        <div style={{padding:"44px 20px 0",paddingTop:"calc(44px + env(safe-area-inset-top,0px))"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
            <div>
              <p style={{color:"rgba(255,255,255,0.18)",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:2.5,margin:"0 0 8px"}}>5 Types of Wealth</p>
              <h1 style={{color:"#fff",fontSize:38,fontWeight:900,lineHeight:.95,margin:0,letterSpacing:"-2px"}}>Calm<br/>
                <span style={{background:"linear-gradient(90deg,#c084fc,#60a5fa,#34d399)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Quote</span>
              </h1>
              <p style={{color:"rgba(255,255,255,0.16)",fontSize:12,marginTop:8,letterSpacing:.5}}>reflect · compound · thrive</p>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end"}}>
              <Card style={{padding:"12px 16px",textAlign:"center",borderRadius:20}}>
                <div style={{fontSize:22}}>🔥</div>
                <div style={{color:"#fbbf24",fontWeight:900,fontSize:20,lineHeight:1,marginTop:3}}>{streak.count}</div>
                <div style={{color:"rgba(255,255,255,0.2)",fontSize:9,textTransform:"uppercase",letterSpacing:1,marginTop:2}}>Streak</div>
              </Card>
              {profile.moodTrend&&<div style={{background:`${moodTrendColor}18`,border:`1px solid ${moodTrendColor}44`,borderRadius:99,padding:"4px 10px"}}>
                <span style={{color:moodTrendColor,fontSize:10,fontWeight:800}}>{moodTrendLabel}</span>
              </div>}
            </div>
          </div>

          {/* Quote */}
          <div style={{background:"linear-gradient(135deg,rgba(192,132,252,0.1),rgba(96,165,250,0.07))",border:"1px solid rgba(192,132,252,0.18)",borderRadius:24,padding:"20px",marginBottom:12,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:"#c084fc",boxShadow:"0 0 8px #c084fc"}}/>
              <p style={{color:"rgba(192,132,252,0.7)",fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:2.5,margin:0}}>Your Quote Today</p>
            </div>
            {qLoad?<Pulse color="#c084fc"/>
              :quote.text?<p style={{color:"rgba(255,255,255,0.82)",fontSize:16,fontStyle:"italic",lineHeight:1.75,margin:0}}>"{quote.text}"</p>
              :<p style={{color:"rgba(255,255,255,0.18)",fontSize:14,margin:0}}>Complete your first reflection to unlock your daily quote.</p>}
          </div>

          {/* Suggested */}
          {sugW&&suggest.reason&&(
            <Card onClick={()=>startJournal(sugW)} style={{marginBottom:12,borderColor:`${sugW.color}33`,background:sugW.bg}}>
              <p style={{color:sugW.color,fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:2,marginBottom:12}}>✦ Suggested for Today</p>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <Orb w={sugW} size={44}/>
                <div>
                  <p style={{color:"#fff",fontWeight:900,fontSize:16,margin:"0 0 4px",letterSpacing:-.3}}>{sugW.label} Wealth</p>
                  <p style={{color:"rgba(255,255,255,0.35)",fontSize:13,margin:0,lineHeight:1.5}}>{suggest.reason}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Portfolio */}
          <Card style={{padding:"14px 18px",marginBottom:24}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <p style={{color:"rgba(255,255,255,0.18)",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:2.5,margin:0}}>Portfolio</p>
              {profile.journalDepth&&<Badge label={profile.journalDepth+" depth"} color="#60a5fa"/>}
            </div>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              {WEALTH.map(w=><div key={w.id} style={{textAlign:"center"}}>
                <div style={{fontSize:20}}>{w.icon}</div>
                <div style={{color:w.color,fontSize:13,fontWeight:800,marginTop:4}}>{counts[w.id]}</div>
              </div>)}
            </div>
          </Card>
        </div>

        {/* Wealth cards */}
        <div style={{padding:"0 20px"}}>
          <p style={{color:"rgba(255,255,255,0.18)",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:2,marginBottom:14}}>Choose Your Wealth</p>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {WEALTH.map(w=>{
              const isNeglected=(profile.neglectedWealth||[]).includes(w.id);
              const isGrowth=(profile.growthAreas||[]).includes(w.id);
              return(
                <Card key={w.id} onClick={()=>startJournal(w)} style={{display:"flex",alignItems:"center",gap:16,padding:"16px 18px",borderColor:suggest.typeId===w.id?`${w.color}44`:"rgba(255,255,255,0.06)"}}>
                  <Orb w={w} size={50}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                      <span style={{color:"#fff",fontWeight:800,fontSize:15,letterSpacing:-.3}}>{w.label}</span>
                      {isGrowth&&<Badge label="↑ growing" color={w.color}/>}
                      {isNeglected&&<Badge label="needs love" color="#f87171"/>}
                    </div>
                    <p style={{color:"rgba(255,255,255,0.28)",fontSize:12,margin:0,lineHeight:1.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{w.principle}</p>
                  </div>
                  <span style={{color:"rgba(255,255,255,0.18)",fontSize:20,flexShrink:0}}>›</span>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
      <TabBar active={tab} go={go}/>
    </div>
  );
}
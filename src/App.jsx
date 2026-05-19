import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
/* ─── ERROR BOUNDARY ─── */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  // Log just the message — never the full error object (which could include user content)
  // and never the componentStack to a remote service. Console stays local to the browser.
  componentDidCatch(err) { console.error("App crashed:", err?.message || err); }
  render() {
    if (this.state.err) return (
      <div style={{ minHeight:"100dvh", background:"#09090f", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32, fontFamily:"'Inter',-apple-system,sans-serif", textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:20 }}>✦</div>
        <h2 style={{ color:"#fff", fontSize:20, fontWeight:800, marginBottom:10 }}>Something went wrong</h2>
        <p style={{ color:"rgba(255,255,255,0.35)", fontSize:14, lineHeight:1.65, marginBottom:28 }}>Your reflections are safe — they're stored on your device. Try refreshing the app.</p>
        <div onClick={() => window.location.reload()} style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:14, padding:"13px 24px", cursor:"pointer", color:"rgba(255,255,255,0.6)", fontWeight:700, fontSize:15 }}>Refresh</div>
      </div>
    );
    return this.props.children;
  }
}
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
const fmtDate = iso => { try { const d=new Date(iso+"T00:00:00"); return REGION==="american"?d.toLocaleDateString("en-US",{month:"short",day:"numeric"}):d.toLocaleDateString("en-GB",{day:"numeric",month:"short"}); } catch { return iso; } };
const fmtNum  = n   => { try { return new Intl.NumberFormat(navigator.language||"en").format(n); } catch { return String(n); } };
/* ─── DATA ─── */
// Voice-first reflections are classified into one of these five wealth types by the AI.
// `prompts` was a v1-era concept (3-prompt walkthrough) — removed in the Sanctuary refactor.
const W = [
  { id:"time",     label:"Time",     icon:"⏳", color:"#c4b5fd", glow:"rgba(196,181,253,0.3)", grad:"linear-gradient(135deg,#c4b5fd 0%,#8b5cf6 100%)", principle:"Every hour is either an investment or a cost.",           framework:"Time Audit: identify your highest-leverage moments." },
  { id:"money",    label:"Money",    icon:"💸", color:"#6ee7b7", glow:"rgba(110,231,183,0.3)", grad:"linear-gradient(135deg,#6ee7b7 0%,#059669 100%)", principle:"Money is a tool. Freedom is the goal.",                   framework:"Freedom Fund: every dollar saved is a vote for optionality." },
  { id:"mental",   label:"Mental",   icon:"🧠", color:"#93c5fd", glow:"rgba(147,197,253,0.3)", grad:"linear-gradient(135deg,#93c5fd 0%,#2563eb 100%)", principle:"Your mind compounds. Feed it accordingly.",               framework:"Curiosity Flywheel: Curiosity → Learning → Insight → Growth." },
  { id:"physical", label:"Physical", icon:"⚡", color:"#fdba74", glow:"rgba(253,186,116,0.3)", grad:"linear-gradient(135deg,#fdba74 0%,#c2410c 100%)", principle:"Your body is the vessel for everything else.",            framework:"Energy Pyramid: Sleep → Movement → Nutrition → Mindfulness." },
  { id:"social",   label:"Social",   icon:"🫂", color:"#fcd34d", glow:"rgba(252,211,77,0.3)",  grad:"linear-gradient(135deg,#fcd34d 0%,#d97706 100%)", principle:"Your relationships are compounding assets or slow drains.", framework:"Give, Ask, Thank — with real intention." },
];
const MOODS = [{e:"💀",l:"depleted"},{e:"😮‍💨",l:"drained"},{e:"😐",l:"neutral"},{e:"✨",l:"energized"},{e:"🔥",l:"thriving"}];
const REFERRAL = "https://calm-quote.vercel.app";
/* ─── AI ─── */
const BASE_SYS = `You are "The Guide" — a wise, warm, philosophical inner coach inside SndR, a voice-first reflection app built on 5 types of wealth: Time, Money, Mental, Physical, Social. Voice: clear, occasionally aphoristic, deeply caring. 3–5 sentences. Always be specific. Reference frameworks naturally (Time Audit, Freedom Fund, Curiosity Flywheel, Energy Pyramid, Give-Ask-Thank). Cultural tone — Asian: measured, collective, patient. American: direct, energetic, action-first. European: balanced, nuanced, harmony-focused. Global: universal, philosophical. Region: ${REGION}. English only. No region-specific institutions or currencies.`;
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
async function ask(sys, usr) {
  // Single attempt with 30s timeout via AbortController. Throws on any failure
  // (HTTP error, timeout, abort, JSON parse) so the outer retry can decide.
  const tryOnce = async () => {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 30000);
    try {
      const r = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: sys,
          messages: [{ role: "user", content: usr }],
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      return d.content?.[0]?.text || "";
    } finally {
      clearTimeout(tid);
    }
  };
  // One silent retry after 1.5s — absorbs transient blips without surfacing failure.
  try { return await tryOnce(); }
  catch {
    await new Promise(r => setTimeout(r, 1500));
    try { return await tryOnce(); }
    catch { return ""; }
  }
}
/* ─── VOICE INPUT ─── */
let voiceActive = false;
function useVoice(onResult, getCurrent, opts = {}) {
  const { autoRestart = false, onStop } = opts;
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const [hint, setHint] = useState("");
  const recRef = useRef(null);
  const cbRef = useRef(onResult);
  const getRef = useRef(getCurrent);
  const onStopRef = useRef(onStop);
  const baseRef = useRef("");
  const userStoppedRef = useRef(false);
  const autoRestartRef = useRef(autoRestart);
  const restartPendingRef = useRef(false); // true between an unexpected onend and the scheduled rec.start()
  cbRef.current = onResult;
  getRef.current = getCurrent;
  onStopRef.current = onStop;
  autoRestartRef.current = autoRestart;
  const hintTimerRef = useRef(null);
  const restartTimerRef = useRef(null);
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    rec.onresult = e => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join("");
      const base = baseRef.current;
      cbRef.current(base ? `${base.trim()} ${transcript}`.trim() : transcript);
    };
    rec.onend = () => {
      voiceActive = false;
      const wasUserStopped = userStoppedRef.current;
      userStoppedRef.current = false;
      if (!wasUserStopped && autoRestartRef.current) {
        // Graceful background buffer — silently restart after an iOS auto-cutoff
        // so the user can pause to think, sigh, breathe without losing the session.
        // Keep `listening` true through the gap so a user tap during this window
        // is correctly interpreted as "stop", not "start a new session".
        restartPendingRef.current = true;
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          if (!restartPendingRef.current) return; // canceled by user stop during the gap
          restartPendingRef.current = false;
          baseRef.current = (getRef.current && getRef.current()) || baseRef.current;
          voiceActive = true;
          try { rec.start(); /* listening already true — visually continuous */ }
          catch { voiceActive = false; setListening(false); }
        }, 150);
        return;
      }
      // No restart pending — finalise the session
      setListening(false);
      if (wasUserStopped && onStopRef.current) {
        // User-initiated stop — pass control back to caller with final transcript
        onStopRef.current((getRef.current && getRef.current()) || "");
      } else if (!wasUserStopped) {
        clearTimeout(hintTimerRef.current);
        setHint("Tap 🎙 to keep dictating");
        hintTimerRef.current = setTimeout(() => setHint(""), 3000);
      }
    };
    rec.onerror = e => {
      restartPendingRef.current = false;
      clearTimeout(restartTimerRef.current);
      setListening(false);
      voiceActive = false;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setPermDenied(true);
    };
    recRef.current = rec;
    return () => {
      clearTimeout(hintTimerRef.current);
      clearTimeout(restartTimerRef.current);
      restartPendingRef.current = false;
      try { rec.abort(); } catch {}
    };
  }, []);
  function start() {
    if (!recRef.current || listening || voiceActive) return;
    setPermDenied(false); // clear stale denial
    baseRef.current = getRef.current ? getRef.current() : "";
    userStoppedRef.current = false;
    restartPendingRef.current = false;
    voiceActive = true;
    vibe();
    try { recRef.current.start(); setListening(true); }
    catch { voiceActive = false; }
  }
  function stop() {
    if (!recRef.current || !listening) return;
    vibe();
    // If we're inside the autoRestart gap, no real session is active.
    // Cancel the pending restart and finalise directly — no onend will fire to do it for us.
    if (restartPendingRef.current) {
      restartPendingRef.current = false;
      clearTimeout(restartTimerRef.current);
      setListening(false);
      voiceActive = false;
      if (onStopRef.current) onStopRef.current((getRef.current && getRef.current()) || "");
      return;
    }
    userStoppedRef.current = true;
    clearTimeout(restartTimerRef.current);
    try { recRef.current.stop(); } catch {}
    setListening(false);
    voiceActive = false;
  }
  return { listening, supported, permDenied, hint, toggle: () => listening ? stop() : start() };
}
function VoiceBtn({ onResult, getCurrent, style = {} }) {
  const { listening, supported, permDenied, hint, toggle } = useVoice(onResult, getCurrent);
  const [showConsent, setShowConsent] = useState(false);
  const [consentDone, setConsentDone] = useState(() => {
    try { return !!localStorage.getItem("cq_voice_consent"); } catch { return false; }
  });
  if (!supported) return null;
  function handleTap() {
    if (!consentDone) { setShowConsent(true); return; }
    toggle();
  }
  function acceptConsent() {
    try { localStorage.setItem("cq_voice_consent", "1"); } catch {}
    setConsentDone(true);
    setShowConsent(false);
    toggle();
  }
  return (
    <>
      {showConsent && (
        <div style={{ position:"absolute", bottom:52, right:0, background:"#1a1a2e", border:"1px solid rgba(196,181,253,0.3)", borderRadius:14, padding:"12px 14px", width:220, zIndex:9998, boxShadow:"0 8px 24px rgba(0,0,0,0.5)" }}>
          <p style={{ color:"rgba(255,255,255,0.7)", fontSize:12, lineHeight:1.6, marginBottom:10 }}>🎙 Voice is processed by your browser's speech service. Only the transcript is saved locally.</p>
          <div style={{ display:"flex", gap:8 }}>
            <Tap onTap={acceptConsent} style={{ flex:1, background:"rgba(196,181,253,0.15)", border:"1px solid rgba(196,181,253,0.3)", borderRadius:10, padding:"7px", textAlign:"center" }}>
              <span style={{ color:"#c4b5fd", fontSize:12, fontWeight:700 }}>Got it</span>
            </Tap>
            <Tap onTap={() => setShowConsent(false)} style={{ flex:1, background:"rgba(255,255,255,0.05)", borderRadius:10, padding:"7px", textAlign:"center" }}>
              <span style={{ color:"rgba(255,255,255,0.3)", fontSize:12 }}>Cancel</span>
            </Tap>
          </div>
        </div>
      )}
      {permDenied && (
        <div style={{ position:"absolute", bottom:52, right:0, background:"#1a1a2e", border:"1px solid rgba(248,113,113,0.3)", borderRadius:12, padding:"10px 12px", width:200, zIndex:9998 }}>
          <p style={{ color:"#f87171", fontSize:11, lineHeight:1.5, margin:0 }}>Mic permission denied — enable it in your browser settings.</p>
        </div>
      )}
      {hint && (
        <div style={{ position:"absolute", bottom:52, right:0, background:"#1a1a2e", border:"1px solid rgba(196,181,253,0.2)", borderRadius:12, padding:"8px 12px", zIndex:9998, whiteSpace:"nowrap" }}>
          <p style={{ color:"rgba(255,255,255,0.5)", fontSize:11, margin:0 }}>{hint}</p>
        </div>
      )}
      <div onClick={handleTap}
        style={{ position:"relative", width:40, height:40, borderRadius:"50%", flexShrink:0, background: listening ? "rgba(196,181,253,0.2)" : "rgba(255,255,255,0.06)", border:`1.5px solid ${listening ? "rgba(196,181,253,0.6)" : "rgba(255,255,255,0.1)"}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"all .2s", boxShadow: listening ? "0 0 16px rgba(196,181,253,0.4)" : "none", WebkitTapHighlightColor:"transparent", userSelect:"none", ...style }}>
        <span style={{ fontSize:18 }}>{listening ? "⏹" : "🎙"}</span>
        {listening && <span style={{ position:"absolute", width:40, height:40, borderRadius:"50%", border:"1.5px solid rgba(196,181,253,0.4)", animation:"ripple 1s infinite ease-out", pointerEvents:"none" }}/>}
      </div>
    </>
  );
}
/* ─── TEXT FALLBACK (Firefox / unsupported browsers) ─── */
function TextFallback({ onComplete, processing }) {
  const [text, setText] = useState("");
  function send() {
    const v = text.trim();
    if (!v || processing) return;
    setText("");
    onComplete(v);
  }
  return (
    <div style={{ width:"100%", maxWidth:340, display:"flex", flexDirection:"column", alignItems:"center", gap:14 }}>
      <textarea
        value={text}
        onChange={e=>setText(e.target.value)}
        placeholder="Write what's on your mind..."
        disabled={processing}
        autoFocus
        style={{
          width:"100%",
          background:"rgba(255,255,255,0.03)",
          border:"1px solid rgba(196,181,253,0.18)",
          borderRadius:18,
          color:"rgba(255,255,255,0.85)",
          padding:"16px 18px",
          fontSize:16, /* >=16 prevents iOS auto-zoom on focus */
          lineHeight:1.6,
          resize:"none",
          outline:"none",
          boxSizing:"border-box",
          fontFamily:"inherit",
          minHeight:120,
          WebkitAppearance:"none",
        }}/>
      <Tap onTap={send} disabled={processing||!text.trim()}
        style={{
          background: text.trim() && !processing ? "linear-gradient(135deg,#c4b5fd,#8b5cf6)" : "rgba(255,255,255,0.05)",
          borderRadius:14,
          padding:"12px 28px",
          opacity: text.trim() && !processing ? 1 : .4,
          transition:"opacity .2s",
        }}>
        <span style={{ color: text.trim() && !processing ? "#fff" : "rgba(255,255,255,0.3)", fontWeight:700, fontSize:14 }}>
          {processing ? "Listening..." : "Reflect"}
        </span>
      </Tap>
    </div>
  );
}
/* ─── BIG RECORD BUTTON (voice-first home centerpiece) ─── */
function BigRecordButton({ onComplete, processing }) {
  const transcriptRef = useRef("");
  const { listening, supported, permDenied, toggle } = useVoice(
    text => { transcriptRef.current = text; },
    () => transcriptRef.current,
    {
      autoRestart: true,
      onStop: final => {
        const text = (final || transcriptRef.current || "").trim();
        transcriptRef.current = "";
        if (text) onComplete(text);
      },
    }
  );
  const [showConsent, setShowConsent] = useState(false);
  const [consentDone, setConsentDone] = useState(() => {
    try { return !!localStorage.getItem("cq_voice_consent"); } catch { return false; }
  });
  function handleTap() {
    if (processing) return;
    if (!consentDone) { setShowConsent(true); return; }
    toggle();
  }
  function acceptConsent() {
    try { localStorage.setItem("cq_voice_consent", "1"); } catch {}
    setConsentDone(true);
    setShowConsent(false);
    toggle();
  }
  // Browsers without Web Speech (Firefox) — quiet text fallback, same UX shape.
  if (!supported) return <TextFallback onComplete={onComplete} processing={processing}/>;
  const size = 160;
  return (
    <div style={{ position:"relative", display:"flex", flexDirection:"column", alignItems:"center", gap:18 }}>
      {showConsent && (
        <div style={{ position:"absolute", bottom:size+22, left:"50%", transform:"translateX(-50%)", background:"#1a1a2e", border:"1px solid rgba(196,181,253,0.3)", borderRadius:14, padding:"14px 16px", width:"min(280px, calc(100vw - 40px))", boxSizing:"border-box", zIndex:9998, boxShadow:"0 8px 24px rgba(0,0,0,0.5)" }}>
          <p style={{ color:"rgba(255,255,255,0.7)", fontSize:12, lineHeight:1.6, marginBottom:12 }}>🎙 Voice is processed by your browser's speech service. Only the transcript is saved locally on your device.</p>
          <div style={{ display:"flex", gap:8 }}>
            <Tap onTap={acceptConsent} style={{ flex:1, background:"rgba(196,181,253,0.15)", border:"1px solid rgba(196,181,253,0.3)", borderRadius:10, padding:"8px", textAlign:"center" }}>
              <span style={{ color:"#c4b5fd", fontSize:12, fontWeight:700 }}>Begin</span>
            </Tap>
            <Tap onTap={() => setShowConsent(false)} style={{ flex:1, background:"rgba(255,255,255,0.05)", borderRadius:10, padding:"8px", textAlign:"center" }}>
              <span style={{ color:"rgba(255,255,255,0.3)", fontSize:12 }}>Not yet</span>
            </Tap>
          </div>
        </div>
      )}
      {permDenied && (
        <div style={{ position:"absolute", bottom:size+22, left:"50%", transform:"translateX(-50%)", background:"#1a1a2e", border:"1px solid rgba(248,113,113,0.3)", borderRadius:12, padding:"10px 14px", width:"min(240px, calc(100vw - 40px))", boxSizing:"border-box", zIndex:9998, textAlign:"center" }}>
          <p style={{ color:"#f87171", fontSize:11, lineHeight:1.5, margin:0 }}>Microphone permission denied. Enable it in your browser settings to speak.</p>
        </div>
      )}
      {/* The button itself — concentric breathing orb */}
      <button onClick={handleTap}
        type="button"
        aria-label={listening ? "Stop recording reflection" : "Start recording reflection"}
        aria-pressed={listening}
        disabled={processing}
        style={{
          position:"relative",
          width:size, height:size, borderRadius:"50%",
          display:"flex", alignItems:"center", justifyContent:"center",
          cursor: processing ? "default" : "pointer",
          WebkitTapHighlightColor:"transparent", userSelect:"none",
          opacity: processing ? 0.5 : 1,
          transition:"opacity .3s",
          background:"transparent", border:"none", padding:0,
        }}>
        {/* Outer breathing ring */}
        <div style={{
          position:"absolute", inset:0, borderRadius:"50%",
          border: `1px solid ${listening ? "rgba(196,181,253,0.5)" : "rgba(196,181,253,0.18)"}`,
          animation: listening ? "br-pulse 1.4s ease-in-out infinite" : "br-breathe 4s ease-in-out infinite",
        }}/>
        {/* Middle ring */}
        <div style={{
          position:"absolute", inset:18, borderRadius:"50%",
          border: `1px solid ${listening ? "rgba(196,181,253,0.35)" : "rgba(196,181,253,0.1)"}`,
          animation: listening ? "br-pulse 1.4s ease-in-out infinite .25s" : "br-breathe 4s ease-in-out infinite .4s",
        }}/>
        {/* Inner orb */}
        <div style={{
          width: listening ? 64 : 56, height: listening ? 64 : 56,
          borderRadius:"50%",
          background: listening
            ? "radial-gradient(circle at 35% 35%, rgba(255,255,255,0.95), rgba(196,181,253,0.85) 60%, rgba(139,92,246,0.7) 100%)"
            : "radial-gradient(circle at 35% 35%, rgba(255,255,255,0.55), rgba(196,181,253,0.35) 60%, rgba(139,92,246,0.18) 100%)",
          boxShadow: listening
            ? "0 0 36px rgba(196,181,253,0.55), inset 0 0 14px rgba(255,255,255,0.25)"
            : "0 0 22px rgba(196,181,253,0.18), inset 0 0 10px rgba(255,255,255,0.1)",
          transition: "width .25s, height .25s, box-shadow .3s, background .3s",
        }}/>
      </button>
      {/* Micro-copy */}
      <p style={{ color: listening ? "rgba(196,181,253,0.8)" : "rgba(255,255,255,0.42)", fontSize:14, letterSpacing:.4, margin:0, fontWeight:500, transition:"color .3s" }}>
        {processing ? "The Guide is listening..." : (listening ? "Listening..." : "Tap to speak")}
      </p>
    </div>
  );
}
function Dots({color="#c4b5fd"}){
  return(
    <div style={{display:"flex",gap:5,alignItems:"center"}}>
      {[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:color,animation:`dp 1.2s ${i*.2}s infinite ease-in-out`}}/>)}
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
              aria-current={on ? "page" : undefined}
              aria-label={t.l}
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
    {icon:"◉",title:"SndR",        body:"A voice-first mirror for all 5 types of wealth. Speak. The Guide listens.",         color:"#c4b5fd",grad:"linear-gradient(135deg,#c4b5fd,#8b5cf6)"},
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
          <span style={{color:"#fff",fontWeight:800,fontSize:17}}>{last?"Begin →":"Continue"}</span>
        </Tap>
        {!last&&<div onClick={()=>{vibe();onDone();}} style={{textAlign:"center",color:"rgba(255,255,255,0.2)",fontSize:13,cursor:"pointer",padding:"8px",WebkitTapHighlightColor:"transparent"}}>Skip intro</div>}
      </div>
    </div>
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
function ProfileScreen({profile,entries,onInsight,nudge,onDismissNudge}){
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
      <h2 style={{color:"#fff",fontSize:24,fontWeight:900,margin:"0 0 18px",letterSpacing:"-1px"}}>Wealth Profile</h2>
      {/* Quiet note from The Guide — like a thoughtful friend checking in */}
      {nudge && (
        <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:22,padding:"2px 4px"}}>
          <span style={{color:"rgba(196,181,253,0.5)",fontSize:14,lineHeight:1.6,marginTop:1}}>·</span>
          <p style={{color:"rgba(255,255,255,0.45)",fontSize:13,lineHeight:1.7,margin:0,fontStyle:"italic",flex:1}}>{nudge.body}</p>
          <button onClick={()=>{vibe();onDismissNudge&&onDismissNudge(nudge.id);}} aria-label="Dismiss" style={{background:"none",border:"none",color:"rgba(255,255,255,0.15)",fontSize:16,cursor:"pointer",lineHeight:1,padding:"0 2px",WebkitTapHighlightColor:"transparent"}}>×</button>
        </div>
      )}
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
      <Row l="Reflection depth" v={profile.journalDepth||"—"}/>
      <Row l="Usually reflects" v={profile.journalTime||"—"}/>
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
          style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,color:"rgba(255,255,255,0.8)",padding:"13px 14px 13px 38px",fontSize:16,outline:"none",boxSizing:"border-box",fontFamily:"inherit",WebkitAppearance:"none"}}/>
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
    // 2. POST to backend — non-blocking, localStorage is the fallback
    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    }).catch(() => {});
    // 3. Try mailto as secondary path for Android users
    const body = `SNDR BETA FEEDBACK\n-------------------\nRating: ${ratings[rating]} (${rating+1}/5)\nUsage: ${use||"Not answered"}\nComments: ${comments||"None"}\nBugs: ${bugs||"None"}\nDate: ${toDay()}\nRegion: ${REGION}`.trim();
    try {
      window.location.href = `mailto:rahulkanety@gmail.com?subject=${encodeURIComponent("SndR Beta Feedback")}&body=${encodeURIComponent(body)}`;
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
            style={{ width:"100%", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, color:"rgba(255,255,255,0.8)", padding:"14px 56px 14px 16px", fontSize:16, lineHeight:1.55, resize:"none", outline:"none", boxSizing:"border-box", fontFamily:"inherit", minHeight:90, WebkitAppearance:"none", transition:"border-color .2s" }}
            onFocus={e => e.target.style.borderColor="rgba(196,181,253,0.4)"}
            onBlur={e => e.target.style.borderColor="rgba(255,255,255,0.07)"}
          />
          <div style={{position:"absolute",bottom:10,right:10}}>
                <VoiceBtn getCurrent={() => comments} onResult={text => setComments(text)} />
              </div>
        </div>
      </div>
      {/* Bugs */}
      <div style={{ marginBottom:28 }}>
        <p style={{ color:"rgba(255,255,255,0.2)", fontSize:10, textTransform:"uppercase", letterSpacing:2, marginBottom:12 }}>Any bugs or issues?</p>
        <div style={{position:"relative"}}>
          <textarea value={bugs} onChange={e => setBugs(e.target.value)}
            placeholder="Anything broken or confusing..."
            style={{ width:"100%", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, color:"rgba(255,255,255,0.8)", padding:"14px 56px 14px 16px", fontSize:16, lineHeight:1.55, resize:"none", outline:"none", boxSizing:"border-box", fontFamily:"inherit", minHeight:80, WebkitAppearance:"none", transition:"border-color .2s" }}
            onFocus={e => e.target.style.borderColor="rgba(253,186,116,0.4)"}
            onBlur={e => e.target.style.borderColor="rgba(255,255,255,0.07)"}
          />
          <div style={{position:"absolute",bottom:10,right:10}}>
                <VoiceBtn getCurrent={() => bugs} onResult={text => setBugs(text)} />
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
  async function share(){vibe();if(navigator.share){try{await navigator.share({title:"SndR",text:"A voice-first mirror for the 5 types of wealth.",url:REFERRAL});}catch{}}else copy();}
  const channels=[
    {l:"WhatsApp",i:"💬",h:`https://wa.me/?text=${encodeURIComponent(`SndR — a voice-first mirror for the 5 types of wealth 👇 ${REFERRAL}`)}`},
    {l:"X / Twitter",i:"𝕏",h:`https://twitter.com/intent/tweet?text=${encodeURIComponent("Reflecting on all 5 types of wealth daily with SndR.")}&url=${encodeURIComponent(REFERRAL)}`},
    {l:"Telegram",i:"✈️",h:`https://t.me/share/url?url=${encodeURIComponent(REFERRAL)}&text=${encodeURIComponent("Check out SndR — a voice-first wealth mirror")}`},
    {l:"Email",i:"📧",h:`mailto:?subject=${encodeURIComponent("Try SndR")}&body=${encodeURIComponent(`Hey,\n\nI've been using SndR — a voice-first reflection app built around the 5 types of wealth. You just speak. The Guide listens.\n\n${REFERRAL}`)}`},
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
function AppInner(){
  const[ob,sOb]   = useStore("cq10_ob",false);
  const[ent,sEnt] = useStore("cq10_e", []);
  const[str,sStr] = useStore("cq10_s", {count:0,last:"",best:0,gracesAvailable:1,gracesUsedAt:""});
  const[qt,sQt]   = useStore("cq10_q", {date:"",text:""});
  const[sg,sSg]   = useStore("cq10_sg",{date:"",typeId:"",reason:""});
  const[wk,sWk]   = useStore("cq10_w", {date:"",text:""});
  const[pf,sPf]   = useStore("cq10_p", {});
  const[dis,sDis] = useStore("cq10_dm",[]);
  const[view,sView]   = useState("home");
  const[tab,sTab]     = useState("home");
  const[sel,sSel]     = useState(null);
  const[fb,sFb]       = useState("");
  const[fbL,sFbL]     = useState(false);
  const[qL,sQL]       = useState(false);
  const[wL,sWL]       = useState(false);
  const[srch,sSrch]   = useState("");
  const[fType,sFType] = useState("all");
  useEffect(()=>{
    if(!ob)return;
    sPf(p=>({
      ...p,
      firstOpenedAt: p.firstOpenedAt || (p.openedAt?.[0]) || Date.now(),
      openedAt:[...(p.openedAt||[]),Date.now()].slice(-20),
      journalTime:timeOf(hr())
    }));
  },[ob]);
  const sys = useMemo(() => buildSys(pf), [pf]);
  const ctx = useMemo(() => ent.slice(0,12).map(e => { const w=W.find(x=>x.id===e.type); return `[${e.date}] ${w?.label}(${MOODS[e.mood]?.l}): ${e.answers?.filter(Boolean).join("|")}`; }).join("\n"), [ent]);
  // Ref-based guards prevent double-fire under React 18
  const qFetching = useRef(false);
  const sgFetching = useRef(false);
  useEffect(() => {
    const t = toDay();
    if (!ob || qt.date === t || qFetching.current) return;
    qFetching.current = true; sQL(true);
    ask(sys, `ONE original philosophical quote (1–2 sentences, aphoristic) personalized to this user. Just the quote.\n\n${ctx || "New user starting their wealth journey."}`)
      .then(x => { sQt({ date:t, text:x||qt.text }); sQL(false); qFetching.current = false; });
  }, [ob, qt.date]);
  useEffect(() => {
    const t = toDay();
    if (!ob || sg.date === t || sgFetching.current) return;
    sgFetching.current = true;
    ask(sys, `Which ONE wealth type should this person focus on today? One sentence reason. JSON: {"typeId":"...","reason":"..."}\n\n${ctx || "New user."}`)
      .then(x => {
        try { const p = JSON.parse(x.replace(/```json|```/g,"").trim()); sSg({ date:t, ...p }); }
        catch { sSg({ date:t, typeId:"mental", reason:"The Curiosity Flywheel is always the best place to begin." }); }
        sgFetching.current = false;
      });
  }, [ob, sg.date]);
  const go = useCallback((v) => { sTab(v); sView(v); sSel(null); }, []);
  // Voice-first save: take a free-form transcript, ask Claude to classify it
  // into a wealth type, infer mood, and respond as The Guide — all in one JSON call.
  async function doSave(transcript){
    const text = (transcript || "").trim();
    if (!text) return;
    const t = toDay();
    // Compute new streak once — reused for sStr and profile.streakBest.
    // Defensive Number coercions guard against corrupted localStorage state.
    const newStreak = (() => {
      if (str.last === t) return str;
      const twoDaysAgo = new Date(Date.now() - 2*864e5).toISOString().split("T")[0];
      let count = Number(str.count) || 0;
      let gracesAvailable = Number.isFinite(str.gracesAvailable) ? str.gracesAvailable : 1;
      let gracesUsedAt = str.gracesUsedAt || "";
      if (str.last === yday()) {
        count = count + 1;
      } else if (str.last === twoDaysAgo && gracesAvailable > 0) {
        count = count + 1;
        gracesAvailable = gracesAvailable - 1;
        gracesUsedAt = t;
      } else {
        count = 1;
        gracesAvailable = 1;
        gracesUsedAt = "";
      }
      if (count > 0 && count % 7 === 0 && gracesAvailable < 1) gracesAvailable = 1;
      return { count, last: t, best: Math.max(count, Number(str.best) || 0), gracesAvailable, gracesUsedAt };
    })();
    sStr(newStreak);
    // Switch to the post-save view immediately so the user sees motion
    sFbL(true);
    sFb("");
    sSel(null);
    sView("saved");
    // Ask Claude to do all three jobs in one round-trip
    const prompt = `The user just spoke this reflection aloud. Do three jobs and return ONLY a JSON object — no markdown, no preamble.

1. Classify the reflection into ONE wealth type: time | money | mental | physical | social
2. Infer their mood as an integer 0–4 from content and tone:
   0=depleted, 1=drained, 2=neutral, 3=energized, 4=thriving
3. Respond as The Guide — warm, philosophical, 3–5 sentences. Reference the relevant framework naturally (Time Audit / Freedom Fund / Curiosity Flywheel / Energy Pyramid / Give-Ask-Thank). Never lecture. Mirror back what you heard.

Return exactly: {"type":"<type>","mood":<0-4>,"response":"<text>"}

Reflection:
${text}

Recent context:
${ctx || "(this is the user's first reflection)"}`;
    const raw = await ask(buildSys(pf), prompt);
    // Parse defensively. If the model returns broken JSON, we'd rather show the
    // post-save view's "Guide is quiet" message than dump raw JSON syntax at the user.
    let inferredType = "mental";
    let inferredMood = 2;
    let response = "";
    try {
      const cleaned = (raw || "").replace(/```json|```/g, "").trim();
      const m = cleaned.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(m ? m[0] : cleaned);
      if (parsed.type && W.find(w => w.id === parsed.type)) inferredType = parsed.type;
      if (typeof parsed.mood === "number" && parsed.mood >= 0 && parsed.mood <= 4) inferredMood = parsed.mood;
      if (typeof parsed.response === "string") response = parsed.response;
    } catch {
      // Last-resort salvage: try to extract just the response field from broken JSON.
      // If even that fails, leave response empty so the UI shows the calm fallback.
      const m = (raw || "").match(/"response"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (m) response = m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
    }
    // Persist the entry with the inferred classification
    const wealth = W.find(w => w.id === inferredType) || W[2];
    const entry = {
      id: Date.now(),
      date: t,
      type: inferredType,
      answers: [text],
      mood: inferredMood,
      prompts: ["What was on your mind?"],
    };
    sEnt(p => [entry, ...p]);
    const all = [entry, ...ent];
    const np = recompute(all, pf);
    np.streakBest = newStreak.best;
    sPf(np);
    // Stash the inferred wealth on sel so the post-save view can render its chip + glow
    sSel(wealth);
    sFb(response);
    sFbL(false);
  }
  async function doWeekly(){
    const we=ent.filter(e=>e.date>=wkAgo());if(!we.length)return;sWL(true);
    const c=we.map(e=>{const w=W.find(x=>x.id===e.type);return`[${e.date}] ${w?.label}: ${e.answers?.filter(Boolean).join("|")} (${MOODS[e.mood]?.l})`;}).join("\n");
    const t=await ask(sys,`Weekly wealth debrief as The Guide. Reference frameworks. Patterns, wins, ONE next-week focus. 5–7 sentences.\n\n${c}`);
    if(t)sWk({date:toDay(),text:t});sWL(false);
  }
  const tried = useMemo(()=>[...new Set(ent.map(e=>e.type))],[ent]);
  const days = useMemo(() => {
    return pf.firstOpenedAt ? Math.floor((Date.now() - pf.firstOpenedAt) / 864e5) : 0;
  }, [pf.firstOpenedAt]);
  const filt  = useMemo(()=>ent.filter(e=>(fType==="all"||e.type===fType)&&(!srch||e.answers?.some(a=>a?.toLowerCase().includes(srch.toLowerCase())))),[ent,fType,srch]);
  // Soft, informational nudges — they speak like a thoughtful friend, not a coach with a CTA.
  // Surface on Profile (the place where reflection-on-self lives), never on home.
  const NUDGES=[
    {id:"d1a",show:days===0&&ent.length===0,              body:"The first reflection is always the hardest. Whenever you're ready — even one breath of thought counts."},
    {id:"d1b",show:days===0&&ent.length>=1&&ent.length<3, body:"One reflection is awareness. Two is the start of a pattern. The mirror is sharpening."},
    {id:"d2a",show:days===1&&ent.length>=1,               body:"Day two. Consistency, not intensity, is what builds the picture of who you are."},
    {id:"d2b",show:days===1&&ent.length>=2,               body:"Your profile is forming. The Guide is quietly learning the shape of your days."},
    {id:"d3a",show:days===2&&tried.length<5,              body:`So far The Guide has heard reflections across ${tried.length} of the 5 wealths. The rest will come in their own time.`},
    {id:"d3b",show:days===2&&ent.length>=3,               body:"Three days in. Your first weekly debrief is ready to be conjured on the Stats screen, if you're curious."},
  ];
  const nudge=NUDGES.find(n=>n.show&&!dis.includes(n.id));
  const ROOT={minHeight:"100dvh",background:"#09090f",fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,sans-serif",maxWidth:480,margin:"0 auto",overflowX:"hidden",position:"relative"};
  if(!ob)return <Onboarding onDone={()=>sOb(true)}/>;
  /* ── POST-SAVE (THE MIRROR) ── */
  // Renders both while we're waiting for the AI (sel=null) and after (sel=wealth).
  // The transitional state shows the streak + a calm "Listening" caption so the user
  // sees motion immediately after they stop speaking, instead of staring at a dimmed home.
  if(view==="saved"){
    // Generic palette while we wait for the AI to classify. Soft lavender feels right.
    const w = sel || { color:"#c4b5fd", glow:"rgba(196,181,253,0.3)", icon:"✦", label:"", framework:"" };
    const ready = !!sel;
    return(
      <div style={ROOT}>
        {/* Wealth-tinted ambient glow — gentle while loading, fuller once sel resolves */}
        <div style={{position:"fixed",top:0,left:"50%",transform:"translateX(-50%)",width:"100%",height:"40%",background:`radial-gradient(ellipse at top,${w.glow} 0%,transparent 70%)`,pointerEvents:"none",transition:"opacity .5s"}}/>
        <div style={{position:"relative",zIndex:1,padding:"52px 20px calc(40px + env(safe-area-inset-bottom))",paddingTop:"calc(52px + env(safe-area-inset-top,0px))"}}>
          <div style={{textAlign:"center",marginBottom:28}}>
            <div style={{fontSize:34,marginBottom:14,filter:`drop-shadow(0 0 16px ${w.glow})`}}>✦</div>
            <h2 style={{color:"#fff",fontSize:22,fontWeight:900,margin:"0 0 12px",letterSpacing:"-.5px"}}>Reflection saved</h2>
            {/* Wealth chip appears once the AI has classified */}
            {ready ? (
              <div style={{display:"inline-flex",alignItems:"center",gap:6,background:`${w.color}15`,border:`1px solid ${w.color}30`,borderRadius:99,padding:"5px 14px",marginBottom:10}}>
                <span style={{fontSize:13}}>{w.icon}</span>
                <span style={{color:w.color,fontWeight:700,fontSize:12,letterSpacing:.3}}>{w.label} wealth</span>
              </div>
            ) : (
              <div style={{display:"inline-flex",alignItems:"center",gap:8,marginBottom:10,padding:"5px 0"}}>
                <Dots color="#c4b5fd"/>
                <span style={{color:"rgba(196,181,253,0.6)",fontSize:12,letterSpacing:.3}}>The Guide is listening</span>
              </div>
            )}
            <div style={{display:"flex",justifyContent:"center"}}>
              <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(252,211,77,0.08)",border:"1px solid rgba(252,211,77,0.18)",borderRadius:99,padding:"4px 12px"}}>
                <span style={{fontSize:12}}>🔥</span>
                <span style={{color:"#fcd34d",fontWeight:600,fontSize:12}}>{str.count} day streak</span>
              </div>
            </div>
            {str.gracesUsedAt===toDay()&&<p style={{color:"rgba(196,181,253,0.65)",fontSize:12,fontWeight:500,marginTop:10,marginBottom:0}}>🛡 Your grace day kept the streak alive.</p>}
          </div>
          {/* The Guide's response — the mirror */}
          <div style={{background:`linear-gradient(135deg,${w.color}0d,transparent)`,border:`1px solid ${w.color}22`,borderRadius:18,padding:"18px 20px",marginBottom:28,minHeight:120}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:w.color,boxShadow:`0 0 8px ${w.glow}`}}/>
              <p style={{color:w.color,fontSize:10,textTransform:"uppercase",letterSpacing:2,margin:0,opacity:.8}}>The Guide</p>
            </div>
            {fbL
              ? <Dots color={w.color}/>
              : fb
                ? <p style={{color:"rgba(255,255,255,0.72)",fontSize:15,lineHeight:1.85,margin:0,fontStyle:"italic"}}>{fb}</p>
                : <p style={{color:"rgba(255,255,255,0.25)",fontSize:14,lineHeight:1.7,margin:0}}>The Guide is quiet right now. Your reflection is still saved — come back tomorrow.</p>
            }
          </div>
          {/* Done button stays disabled while The Guide is still composing — protects the moment */}
          <Tap onTap={fbL ? undefined : ()=>go("home")} disabled={fbL}
            style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:16,padding:"15px",textAlign:"center",opacity:fbL?.5:1,transition:"opacity .3s"}}>
            <span style={{color:"rgba(255,255,255,0.6)",fontWeight:700,fontSize:15}}>Done</span>
          </Tap>
        </div>
      </div>
    );
  }
  /* ── TABS ── */
  if(view==="insights") return <div style={ROOT}><StatsScreen entries={ent} streak={str} weekly={wk} wLoad={wL} onGenWeekly={doWeekly}/><Nav active={tab} go={go}/></div>;
  if(view==="profile")  return <div style={ROOT}><ProfileScreen profile={pf} entries={ent} nudge={nudge} onDismissNudge={id=>sDis(d=>[...d,id])} onInsight={t=>sPf(p=>({...p,insights:[...(p.insights||[]).slice(-4),t]}))}/><Nav active={tab} go={go}/></div>;
  if(view==="search")   return <div style={ROOT}><SearchScreen entries={filt} fType={fType} setFType={sFType} search={srch} setSearch={sSrch}/><Nav active={tab} go={go}/></div>;
  if(view==="feedback") return <div style={ROOT}><FeedbackScreen/><Nav active={tab} go={go}/></div>;
  if(view==="referral") return <div style={ROOT}><ShareScreen/><Nav active={tab} go={go}/></div>;
  /* ── HOME — THE SANCTUARY ── */
  // Single solitary button. Ghost icons in corners. One quiet line of context.
  // Bottom nav suppressed here on purpose; corner icons are the only utility.
  const h = hr();
  const ctxLine = fbL
    ? "" // already processing — the button copy carries this
    : (h>=5&&h<12 ? "What is the focus for today?"
      : h>=12&&h<17 ? "How is your day moving?"
      : h>=17&&h<21 ? "Unload your day before bed."
      : "What's still on your mind tonight?");
  return(
    <div style={ROOT}>
      {/* Ambient background — kept warm but more diffuse */}
      <div style={{position:"fixed",top:"-15%",left:"50%",transform:"translateX(-50%)",width:"140%",height:"60%",background:"radial-gradient(ellipse,rgba(196,181,253,0.09) 0%,transparent 70%)",pointerEvents:"none"}}/>
      <div style={{position:"fixed",bottom:"-10%",left:"-10%",width:"60%",height:"35%",background:"radial-gradient(ellipse,rgba(139,92,246,0.05) 0%,transparent 70%)",pointerEvents:"none"}}/>
      {/* Ghost navigation — Profile (left), Search (right). Real <button> elements
          for keyboard + screen-reader accessibility; visual style stays whisper-quiet. */}
      <button onClick={()=>{vibe();go("profile");}} aria-label="Open profile"
        style={{position:"fixed",top:"calc(18px + env(safe-area-inset-top,0px))",left:18,zIndex:5,width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.02)",border:"none",cursor:"pointer",padding:0,WebkitTapHighlightColor:"transparent"}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="4"/>
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>
        </svg>
      </button>
      <button onClick={()=>{vibe();go("search");}} aria-label="Search reflections"
        style={{position:"fixed",top:"calc(18px + env(safe-area-inset-top,0px))",right:18,zIndex:5,width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.02)",border:"none",cursor:"pointer",padding:0,WebkitTapHighlightColor:"transparent"}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7"/>
          <path d="m20 20-3.5-3.5"/>
        </svg>
      </button>
      {/* Sanctuary — centred orb */}
      <div style={{position:"relative",zIndex:1,minHeight:"100dvh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 24px",paddingTop:"calc(60px + env(safe-area-inset-top,0px))",paddingBottom:"calc(80px + env(safe-area-inset-bottom))"}}>
        <BigRecordButton processing={fbL} onComplete={t=>doSave(t)}/>
        {/* Single quiet context line — time-of-day, then quote after a reflection lands */}
        <div style={{position:"absolute",bottom:"calc(48px + env(safe-area-inset-bottom))",left:24,right:24,textAlign:"center",pointerEvents:"none"}}>
          {qt.text
            ? <p style={{color:"rgba(255,255,255,0.32)",fontSize:13,fontStyle:"italic",lineHeight:1.6,margin:0,letterSpacing:.2}}>{qt.text.replace(/^["'"'\s]+|["'"'\s]+$/g,"")}</p>
            : <p style={{color:"rgba(255,255,255,0.28)",fontSize:13,lineHeight:1.6,margin:0,letterSpacing:.2}}>{ctxLine}</p>}
        </div>
      </div>
    </div>
  );
}
/* ─── GLOBAL KEYFRAMES (defined once, consumed by Dots / VoiceBtn / BigRecordButton) ─── */
function GlobalKeyframes() {
  return (
    <style>{`
      @keyframes br-pulse   { 0%, 100% { transform: scale(1); opacity: .6;  } 50% { transform: scale(1.06); opacity: 1; } }
      @keyframes br-breathe { 0%, 100% { transform: scale(1); opacity: .65; } 50% { transform: scale(1.03); opacity: 1; } }
      @keyframes ripple     { 0% { transform: scale(1);   opacity: .8; } 100% { transform: scale(1.8); opacity: 0; } }
      @keyframes dp         { 0%, 100% { opacity: .15; transform: scale(.7); } 50% { opacity: 1; transform: scale(1.2); } }
      @media (prefers-reduced-motion: reduce) {
        @keyframes br-pulse   { 0%, 100% { transform: scale(1); opacity: .9; } }
        @keyframes br-breathe { 0%, 100% { transform: scale(1); opacity: .9; } }
        @keyframes ripple     { 0%, 100% { opacity: 0; } }
        @keyframes dp         { 0%, 100% { opacity: .5; transform: scale(1); } }
      }
    `}</style>
  );
}
/* ─── EXPORT WITH ERROR BOUNDARY ─── */
export default function App() {
  return (
    <ErrorBoundary>
      <GlobalKeyframes/>
      <AppInner/>
    </ErrorBoundary>
  );
}

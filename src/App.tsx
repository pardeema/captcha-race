import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Copy, TimerReset, Trophy, CheckCircle2, Shield, Zap, Share2 } from "lucide-react";

// =============================
// Types & Utils
// =============================

type ScoreRow = {
  id: string;
  name: string;
  captchaSeconds: number;
  kasadaSeconds: number;
  retries: number;
  rageClicks: number;
  date: string;
};

const fmt = (s: number) => `${s.toFixed(1)}s`;
const uid = () => Math.random().toString(36).slice(2, 9);

// Local leaderboard helpers
const LS_KEY = "kasada-vs-captcha-leaderboard";
function loadScores(): ScoreRow[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}
function saveScores(rows: ScoreRow[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(rows.slice(0, 25)));
}

// Rage click detector
function useRageClicks(active: boolean) {
  const [rage, setRage] = useState(0);
  useEffect(() => {
    if (!active) return;
    let clicks = 0;
    const handler = () => {
      clicks++;
      if (clicks >= 5) { setRage(r => r + 1); clicks = 0; }
      setTimeout(() => { clicks = 0; }, 1500);
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [active]);
  return rage;
}

// Sanity tests (lightweight runtime assertions)
function runSanityTests() {
  // Border neighbors shape (3..8) on a 4x4 grid
  const neighborsCount = (idx: number) => {
    const size = 4; const r = Math.floor(idx/size), c = idx%size; let n = 0;
    for (let dr=-1; dr<=1; dr++) for (let dc=-1; dc<=1; dc++) {
      if (dr===0 && dc===0) continue; const rr=r+dr, cc=c+dc; if (rr>=0&&rr<size&&cc>=0&&cc<size) n++;
    }
    return n;
  };
  console.assert(neighborsCount(5) >= 3 && neighborsCount(5) <= 8, "Border test: neighbor count reasonable");

  // Rotation tolerance test
  const within = (x:number,t:number)=>Math.abs(x-t)<=1;
  console.assert(within(10,11) && !within(10,12), "Rotation tolerance ±1 works");
}

// =============================
// Main App
// =============================

export default function App() {
  useEffect(() => { runSanityTests(); }, []);
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-white to-slate-50 text-slate-900">
      <div className="max-w-5xl mx-auto p-6">
        <header className="flex items-center gap-3 mb-6">
          <Shield className="w-7 h-7"/>
          <h1 className="text-2xl font-semibold tracking-tight">Kasada vs CAPTCHA</h1>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
          <CaptchaColumn label="CAPTCHA Flow" />
          <KasadaColumn label="Kasada Flow" />
        </div>

        <ResultsAndShare brand="Kasada" />
      </div>
    </div>
  );
}

// =============================
// CAPTCHA Column (multi-round, randomized)
// =============================

function CaptchaColumn({ label }: { label: string }) {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const roundsParam = Math.min(10, Math.max(5, Number(params.get('rounds') || 7))); // default 7 (between 5–10)

  const [roundIdx, setRoundIdx] = useState<number>(-1); // -1 = not started
  const [retries, setRetries] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [sequence, setSequence] = useState<React.ComponentType<any>[]>([]);
  const rage = useRageClicks(running);
  const t0 = useRef<number | null>(null);

  // Pool of challenge components
  const pool: React.ComponentType<any>[] = [
    (props:any)=> <CaptchaFrustratedEmojis {...props} />,
    (props:any)=> <CaptchaSlider {...props} />,
    (props:any)=> <CaptchaWord {...props} />,
    (props:any)=> <CaptchaDragPiece {...props} />,
    (props:any)=> <CaptchaBorder {...props} />,
    (props:any)=> <CaptchaHold {...props} />,
  ];

  // Timer
  useEffect(() => {
    let raf: number;
    if (running) {
      const loop = (ts: number) => {
        if (t0.current == null) t0.current = ts;
        setElapsed(((ts - t0.current) / 1000));
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(raf);
  }, [running]);

  // Reset on stop
  useEffect(() => {
    if (!running && roundIdx < 0) { setElapsed(0); t0.current = null; }
  }, [running, roundIdx]);

  const start = () => {
    // Build a randomized sequence of length roundsParam
    const seq: React.ComponentType<any>[] = [];
    for (let i=0; i<roundsParam; i++) seq.push(pool[Math.floor(Math.random()*pool.length)]);
    setSequence(seq);
    setRoundIdx(0);
    setRetries(0);
    setElapsed(0);
    setRunning(true);
    t0.current = null;
  };

  const onFail = () => setRetries(r => r + 1);
  const onPass = () => {
    const next = roundIdx + 1;
    if (next >= sequence.length) {
      setRunning(false);
      setRoundIdx(sequence.length); // finished
      // persist metrics
      (window as any).KASADA_GAME = {
        ...(window as any).KASADA_GAME,
        captcha: { seconds: elapsed, retries, rage }
      };
    } else {
      setRoundIdx(next);
    }
  };

  const current = roundIdx >= 0 && roundIdx < sequence.length ? sequence[roundIdx] : null;

  return (
    <Card className="rounded-2xl shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{label}</span>
          <span className="text-sm font-normal text-slate-500 flex items-center gap-2"><TimerReset className="w-4 h-4"/>{fmt(elapsed)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {roundIdx < 0 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Complete <b>{roundsParam}</b> deliberately frustrating challenges.</p>
            <Button onClick={start}>Start challenges</Button>
            <div className="text-xs text-slate-500">Rage clicks are tracked automatically.</div>
          </div>
        )}

        {running && current && (
          React.createElement(current, { onFail, onPass })
        )}

        {(!running && roundIdx >= sequence.length && sequence.length>0) && (
          <div className="text-sm text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> All {sequence.length} challenges completed.</div>
        )}

        {(roundIdx >= 0) && (
          <div className="mt-4 text-xs text-slate-500">Round {Math.min(roundIdx+1, sequence.length)} / {sequence.length || roundsParam} · Retries: {retries} · Rage events: {rage}</div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================
// Kasada Column
// =============================

function KasadaColumn({ label }: { label: string }) {
  const [done, setDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const t = useRef<number | null>(null);

  const start = () => {
    t.current = performance.now();
    setTimeout(() => {
      const secs = (performance.now() - (t.current || performance.now())) / 1000;
      setElapsed(secs);
      setDone(true);
      (window as any).KASADA_GAME = {
        ...(window as any).KASADA_GAME,
        kasada: { seconds: secs }
      };
    }, 300);
  };

  return (
    <Card className="rounded-2xl shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{label}</span>
          <span className="text-sm font-normal text-slate-500 flex items-center gap-2"><Zap className="w-4 h-4"/>{done ? fmt(elapsed) : '—'}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!done ? (
          <div className="space-y-4">
            <p className="text-sm">Frictionless verification. One click.</p>
            <Button onClick={start}>Continue</Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-emerald-600">
            <CheckCircle2 className="w-5 h-5"/>
            <span className="text-sm">Verified silently. You're in.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================
// Challenges
// =============================

// 1) Frustrated emoji grid — only 😡 😤 😠 appear. One is chosen as the correct class.
function CaptchaFrustratedEmojis({ onPass, onFail }: { onPass: () => void; onFail: () => void }) {
  const EMOJIS = ['😡','😤','😠'] as const;
  const target = useMemo(() => EMOJIS[Math.floor(Math.random()*EMOJIS.length)], []);
  const grid = useMemo(() => Array.from({ length: 9 }, () => EMOJIS[Math.floor(Math.random()*EMOJIS.length)]), []);
  const [picked, setPicked] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const correctIdx = grid.map((e, i) => e === target ? i : -1).filter(i => i>=0);
  const submit = () => {
    const pickedSorted = [...picked].sort().join(',');
    const correctSorted = [...correctIdx].sort().join(',');
    if (pickedSorted === correctSorted) { setFeedback(null); onPass(); }
    else {
      const pickedCorrect = picked.filter(i => correctIdx.includes(i)).length;
      const pickedWrong = picked.length - pickedCorrect;
      const remaining = Math.max(0, correctIdx.length - pickedCorrect);
      setFeedback(`Need ${remaining} more frustrated emoji tile${remaining===1?'':'s'}. You selected ${pickedWrong} wrong.`);
      onFail();
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-sm">Select all tiles with <span className="font-medium">the frustrated emoji</span>.</div>
      <div className="grid grid-cols-3 gap-2">
        {grid.map((emoji, idx) => (
          <button key={idx} className={`aspect-square rounded-lg border flex items-center justify-center text-3xl ${picked.includes(idx) ? 'bg-slate-200' : 'bg-white'}`}
            onClick={() => setPicked(p => p.includes(idx) ? p.filter(i => i!==idx) : [...p, idx])}>{emoji}</button>
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <Button onClick={submit}>Verify</Button>
        {feedback && <div className="text-xs text-rose-600">{feedback}</div>}
      </div>
    </div>
  );
}

// 2) Slider — must be within ±1°; show submitted value on error.
function CaptchaSlider({ onPass, onFail }: { onPass: () => void; onFail: (angle:number)=>void }) {
  const target = useMemo(() => Math.floor(5 + Math.random() * 85), []);
  const [val, setVal] = useState([0]);
  const tol = 1;

  const submit = () => {
    const angle = val[0] ?? 0;
    const ok = Math.abs(angle - target) <= tol;
    if (ok) onPass(); else { alert(`Incorrect: you submitted ${angle}° (need ${target}° ±${tol}°)`); onFail(angle); }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm">Rotate the object to <span className="font-medium">{target}°</span> (±{tol}°).</div>
      <div className="h-24 flex items-center justify-center">
        <div className="w-16 h-16 border rounded-xl bg-slate-200" style={{ transform: `rotate(${val[0]}deg)` }} />
      </div>
      <Slider value={val} onValueChange={setVal} min={0} max={180} step={1} />
      <div className="flex gap-2 items-center">
        <Button onClick={submit}>Verify</Button>
      </div>
    </div>
  );
}

// 3) Distorted word (no random fail)
function CaptchaWord({ onPass, onFail }: { onPass: () => void; onFail: () => void }) {
  const base = useMemo(() => {
    const words = ["kAs4dA", "fr1ct10n", "0mn1", "hum4n", "s3cur1ty", "res1l13nt"]; return words[Math.floor(Math.random()*words.length)];
  }, []);
  const [val, setVal] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const verify = () => { if (val === base) onPass(); else { setErr("Not quite, try again"); onFail(); } };
  return (
    <div className="space-y-3">
      <div className="text-sm">Type the characters you see:</div>
      <div className="w-full h-16 rounded-lg border grid place-items-center bg-[repeating-linear-gradient(45deg,rgba(0,0,0,.06),rgba(0,0,0,.06)_4px,transparent_4px,transparent_8px)]">
        <div className="text-2xl tracking-widest select-none" style={{ filter: 'blur(0.4px) contrast(1.2)', transform: 'skewX(6deg)', letterSpacing: '0.5rem' }}>{base}</div>
      </div>
      <Input value={val} onChange={e => setVal(e.target.value)} placeholder="Enter text"/>
      <div className="flex gap-2 items-center">
        <Button onClick={verify}>Verify</Button>
        {err && <span className="text-xs text-rose-600">{err}</span>}
      </div>
      <div className="text-xs text-slate-500">Pro tip: That was annoying on purpose.</div>
    </div>
  );
}

// 4) Drag piece into target
function CaptchaDragPiece({ onPass, onFail }: { onPass: () => void; onFail: () => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x: 10, y: 10 });
  const [dragging, setDragging] = useState(false);
  const target = { x: 140, y: 40 };

  useEffect(() => {
    const move = (e: MouseEvent | TouchEvent) => {
      if (!dragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = (e as TouchEvent).touches ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = (e as TouchEvent).touches ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
      setPos({ x: Math.max(0, Math.min(280, clientX - rect.left - 16)), y: Math.max(0, Math.min(120, clientY - rect.top - 16)) });
    };
    const up = () => setDragging(false);
    window.addEventListener('mousemove', move as any);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move as any);
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', move as any);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move as any);
      window.removeEventListener('touchend', up);
    };
  }, [dragging]);

  const verify = () => {
    const dx = (pos.x + 16) - (target.x + 16);
    const dy = (pos.y + 16) - (target.y + 16);
    const dist = Math.hypot(dx, dy);
    if (dist <= 16) onPass(); else { alert(`Drop closer to the outline. You were off by ~${Math.round(dist)}px.`); onFail(); }
  };

  return (
    <div className="space-y-3">
      <div className="text-sm">Drag the square into the outlined target.</div>
      <div ref={containerRef} className="relative w-[320px] h-[160px] border rounded-lg bg-slate-50 overflow-hidden">
        <div className="absolute left-[140px] top-[40px] w-8 h-8 rounded-lg border-2 border-dashed"/>
        <div
          className={`absolute w-8 h-8 rounded-lg bg-slate-300 border cursor-grab active:cursor-grabbing`}
          style={{ left: pos.x, top: pos.y }}
          onMouseDown={() => setDragging(true)}
          onTouchStart={() => setDragging(true)}
        />
      </div>
      <Button onClick={verify}>Verify</Button>
    </div>
  );
}

// 5) Border squares — select all neighbors around 🎯
function CaptchaBorder({ onPass, onFail }: { onPass: () => void; onFail: () => void }) {
  const size = 4; // 4x4 grid
  const [targetIdx] = useState(() => {
    const choices: number[] = [];
    for (let r=1;r<size-1;r++) for (let c=1;c<size-1;c++) choices.push(r*size+c);
    return choices[Math.floor(Math.random()*choices.length)];
  });
  const [picked, setPicked] = useState<number[]>([]);

  const neighbors = useMemo(() => {
    const r = Math.floor(targetIdx/size), c = targetIdx%size;
    const idxs: number[] = [];
    for (let dr=-1; dr<=1; dr++) for (let dc=-1; dc<=1; dc++) {
      if (dr===0 && dc===0) continue;
      const rr=r+dr, cc=c+dc;
      if (rr>=0&&rr<size&&cc>=0&&cc<size) idxs.push(rr*size+cc);
    }
    return idxs;
  }, [targetIdx]);

  const verify = () => {
    const ok = [...picked].sort().join(',') === [...neighbors].sort().join(',');
    if (ok) onPass(); else {
      const pickedCorrect = picked.filter(i => neighbors.includes(i)).length;
      const remaining = neighbors.length - pickedCorrect;
      alert(`Select all squares that border the 🎯 tile. ${remaining} remaining.`);
      onFail();
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-sm">Select all squares that border the <span className="font-medium">🎯</span> tile.</div>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({length:size*size}).map((_, idx) => (
          <button key={idx}
            onClick={() => setPicked(p => p.includes(idx) ? p.filter(i=>i!==idx) : [...p, idx])}
            className={`aspect-square rounded-lg border text-xl flex items-center justify-center ${picked.includes(idx)?'bg-slate-200':'bg-white'}`}>
            {idx===targetIdx ? '🎯' : ''}
        </button>
        ))}
      </div>
      <Button onClick={verify}>Verify</Button>
    </div>
  );
}

// 6) Hold steady (2s)
function CaptchaHold({ onPass, onFail }: { onPass: () => void; onFail: () => void }) {
  const REQUIRED = 2000; // ms
  const [holding, setHolding] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const tRef = useRef<number | null>(null);

  useEffect(() => {
    let raf: number;
    const loop = () => {
      if (holding && tRef.current!=null) {
        setElapsed(performance.now() - tRef.current);
        raf = requestAnimationFrame(loop);
      }
    };
    if (holding) raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [holding]);

  const down = () => { setElapsed(0); tRef.current = performance.now(); setHolding(true); };
  const up = () => {
    const ms = elapsed;
    setHolding(false);
    if (ms >= REQUIRED) onPass(); else { alert(`Hold steady for 2 seconds. You held ${Math.round(ms)}ms.`); onFail(); }
  };

  return (
    <div className="space-y-3">
      <div className="text-sm">Press and hold the button for <b>2 seconds</b>.</div>
      <Button onMouseDown={down} onMouseUp={up} onMouseLeave={() => holding && up()} onTouchStart={down} onTouchEnd={up}>
        {holding ? `Holding… ${Math.round(elapsed)}ms` : 'Hold'}
      </Button>
    </div>
  );
}

// =============================
// Results & Sharing
// =============================

function ResultsAndShare({ brand }: { brand: string }) {
  const [name, setName] = useState("");
  const [rows, setRows] = useState<ScoreRow[]>(() => loadScores());
  const [saved, setSaved] = useState(false);
  const [delta, setDelta] = useState<{saved: number, percent: number}>({ saved: 0, percent: 0 });

  useEffect(() => {
    const g = (window as any).KASADA_GAME;
    if (!g?.captcha?.seconds || !g?.kasada?.seconds) return;
    const savedSecs = Math.max(0, g.captcha.seconds - g.kasada.seconds);
    const pct = g.captcha.seconds > 0 ? (savedSecs / g.captcha.seconds) * 100 : 0;
    setDelta({ saved: savedSecs, percent: pct });
  }, [rows]);

  const save = () => {
    const g = (window as any).KASADA_GAME;
    if (!g?.captcha?.seconds || !g?.kasada?.seconds) return;
    const row: ScoreRow = {
      id: uid(),
      name: name || 'Anonymous',
      captchaSeconds: g.captcha.seconds,
      kasadaSeconds: g.kasada.seconds,
      retries: g.captcha.retries ?? 0,
      rageClicks: g.captcha.rage ?? 0,
      date: new Date().toISOString(),
    };
    const next = [row, ...rows].sort((a,b) => a.captchaSeconds - b.captchaSeconds);
    setRows(next); saveScores(next); setSaved(true); setTimeout(() => setSaved(false), 1200);
  };

  const copyLink = async () => {
    const u = new URL(window.location.href);
    const g = (window as any).KASADA_GAME;
    if (g?.captcha?.seconds) u.searchParams.set('last_captcha', String(g.captcha.seconds.toFixed(1)));
    if (g?.kasada?.seconds) u.searchParams.set('last_kasada', String(g.kasada.seconds.toFixed(1)));
    try { await navigator.clipboard.writeText(u.toString()); } catch {}
  };

  const g = (window as any).KASADA_GAME;
  const ready = Boolean(g?.captcha?.seconds && g?.kasada?.seconds);

  return (
    <Card className="rounded-2xl shadow-md mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5"/> Results & Leaderboard</CardTitle>
      </CardHeader>
      <CardContent>
        {!ready ? (
          <div className="text-sm text-slate-500">Complete both columns to see results.</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6 items-start">
            <div className="md:col-span-2 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Stat label="CAPTCHA time" value={fmt(g.captcha.seconds)} />
                <Stat label={`${brand} time`} value={fmt(g.kasada.seconds)} />
                <Stat label="Time saved" value={fmt(Math.max(0, g.captcha.seconds - g.kasada.seconds))} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Retries" value={String(g.captcha.retries ?? 0)} />
                <Stat label="Rage events" value={String(g.captcha.rage ?? 0)} />
                <Stat label="CX improvement" value={`${Math.round(delta.percent)}% faster`} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Input className="max-w-[200px]" value={name} onChange={e => setName(e.target.value)} placeholder="Your name (optional)"/>
                <Button onClick={save}>Save to leaderboard</Button>
                <Button variant="secondary" onClick={copyLink}><Copy className="w-4 h-4 mr-2"/>Copy share link</Button>
                <Button variant="ghost" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><Share2 className="w-4 h-4 mr-2"/>Replay</Button>
                {saved && <span className="text-emerald-600 text-sm">Saved!</span>}
              </div>
            </div>
            <div className="md:col-span-1">
              <Leaderboard rows={rows} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-xl border bg-white">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function Leaderboard({ rows }: { rows: ScoreRow[] }) {
  if (!rows.length) return (
    <div className="text-sm text-slate-500">No entries yet. Be the first!</div>
  );
  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="grid grid-cols-5 bg-slate-50 text-xs px-3 py-2 text-slate-600">
        <div>Player</div>
        <div>CAPTCHA</div>
        <div>Retries</div>
        <div>Rage</div>
        <div>Date</div>
      </div>
      <div className="divide-y">
        {rows.slice(0, 10).map(r => (
          <div className="grid grid-cols-5 px-3 py-2 text-sm" key={r.id}>
            <div className="truncate">{r.name}</div>
            <div>{fmt(r.captchaSeconds)}</div>
            <div>{r.retries}</div>
            <div>{r.rageClicks}</div>
            <div className="text-xs text-slate-500">{new Date(r.date).toLocaleDateString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

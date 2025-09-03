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
  attempts: number;
  failures: number;
  skips: number;
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
// Frustration Popup Component
// =============================

function FrustrationPopup({ onKeepTrying, onSkip, correctText }: { onKeepTrying: () => void; onSkip: () => void; correctText?: string }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md mx-4 shadow-2xl">
        <div className="text-center space-y-4">
          <div className="text-6xl">😤</div>
          <h2 className="text-2xl font-bold text-slate-900">Frustrated?</h2>
          <p className="text-lg text-slate-600">
            Imagine this happening to your users
          </p>
          {correctText && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500 mb-2">Correct spelling:</p>
              <p className="text-lg font-mono" style={{ fontFamily: 'serif' }}>
                {correctText}
              </p>
            </div>
          )}
          <div className="flex gap-3">
            <Button onClick={onKeepTrying} variant="secondary" className="flex-1">
              Keep trying
            </Button>
            <Button onClick={onSkip} className="flex-1">
              Skip
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
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
  const [showFrustrationPopup, setShowFrustrationPopup] = useState(false);
  const [currentChallengeFailures, setCurrentChallengeFailures] = useState(0);
  const [challengeStats, setChallengeStats] = useState<{attempts: number, failures: number}>({attempts: 0, failures: 0});

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
    // Build a randomized sequence ensuring no consecutive duplicates
    const seq: React.ComponentType<any>[] = [];
    let lastChallenge: React.ComponentType<any> | null = null;
    
    for (let i = 0; i < roundsParam; i++) {
      let availableChallenges = pool;
      
      // If we have a previous challenge, exclude it from the next selection
      if (lastChallenge) {
        availableChallenges = pool.filter(challenge => challenge !== lastChallenge);
      }
      
      // Select a random challenge from available ones
      const selectedChallenge = availableChallenges[Math.floor(Math.random() * availableChallenges.length)];
      seq.push(selectedChallenge);
      lastChallenge = selectedChallenge;
    }
    
    setSequence(seq);
    setRoundIdx(0);
    setRetries(0);
    setElapsed(0);
    setRunning(true);
    t0.current = null;
  };

  const onFail = () => {
    setRetries(r => r + 1);
    setCurrentChallengeFailures(f => f + 1);
    setChallengeStats(s => ({...s, attempts: s.attempts + 1, failures: s.failures + 1}));
    
    if (currentChallengeFailures >= 2) { // 3rd failure (0-indexed)
      setShowFrustrationPopup(true);
    }
  };
  
  const onPass = () => {
    setChallengeStats(s => ({...s, attempts: s.attempts + 1}));
    const next = roundIdx + 1;
    if (next >= sequence.length) {
      setRunning(false);
      setRoundIdx(sequence.length); // finished
      // persist metrics immediately when CAPTCHA is completed
      (window as any).KASADA_GAME = {
        ...(window as any).KASADA_GAME,
        captcha: { 
          seconds: elapsed, 
          retries, 
          rage, 
          attempts: challengeStats.attempts + 1, 
          failures: challengeStats.failures,
          skips: (window as any).KASADA_GAME?.captcha?.skips || 0
        }
      };
      // Trigger a custom event to notify the leaderboard component
      window.dispatchEvent(new CustomEvent('captchaCompleted', { 
        detail: { 
          seconds: elapsed, 
          retries, 
          rage, 
          attempts: challengeStats.attempts + 1, 
          failures: challengeStats.failures,
          skips: (window as any).KASADA_GAME?.captcha?.skips || 0
        } 
      }));
    } else {
      setRoundIdx(next);
      setCurrentChallengeFailures(0); // Reset failures for next challenge
    }
  };
  
  const handleKeepTrying = () => {
    setShowFrustrationPopup(false);
    setCurrentChallengeFailures(0); // Reset failure count to give them a fresh start
  };

  const handleSkip = () => {
    setShowFrustrationPopup(false);
    setCurrentChallengeFailures(0);
    // Track the skip
    (window as any).KASADA_GAME = {
      ...(window as any).KASADA_GAME,
      captcha: {
        ...(window as any).KASADA_GAME?.captcha,
        skips: ((window as any).KASADA_GAME?.captcha?.skips || 0) + 1
      }
    };
    onPass(); // Move to next challenge
  };

  const current = roundIdx >= 0 && roundIdx < sequence.length ? sequence[roundIdx] : null;

  return (
    <>
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
      {showFrustrationPopup && (
        <FrustrationPopup 
          onKeepTrying={handleKeepTrying}
          onSkip={handleSkip}
          correctText={current === CaptchaWord ? (CaptchaWord as any).correctText : undefined}
        />
      )}
    </>
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
      setFeedback(`You selected ${pickedWrong} wrong emojis.`);
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
    const words = ["c4ptch4", "v3rify", "s3cur1ty", "4cc3ss", "c0nf1rm", "v4l1d4t3", "pr0t3ct", "4uth3nt1c", "p4ssw0rd", "l0g1n", "s3cur3", "4cc3pt", "r3j3ct", "4ppr0v3", "d3n1ed"]; return words[Math.floor(Math.random()*words.length)];
  }, []);
  const [val, setVal] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const verify = () => { if (val === base) onPass(); else { setErr("Not quite, try again"); onFail(); } };
  
  // Expose the correct text for the popup
  (CaptchaWord as any).correctText = base;
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
    // Calculate overlap between dragged square and target
    const squareSize = 32; // 8 * 4 (w-8 h-8 = 32px)
    const targetSize = 32; // Same size
    
    // Get the intersection rectangle
    const left = Math.max(pos.x, target.x);
    const top = Math.max(pos.y, target.y);
    const right = Math.min(pos.x + squareSize, target.x + targetSize);
    const bottom = Math.min(pos.y + squareSize, target.y + targetSize);
    
    // Calculate intersection area
    const intersectionWidth = Math.max(0, right - left);
    const intersectionHeight = Math.max(0, bottom - top);
    const intersectionArea = intersectionWidth * intersectionHeight;
    
    // Calculate target area
    const targetArea = targetSize * targetSize;
    
    // Calculate coverage percentage
    const coveragePercent = (intersectionArea / targetArea) * 100;
    
    if (coveragePercent >= 95) {
      onPass();
    } else {
      alert(`Need 95% coverage. You achieved ${coveragePercent.toFixed(1)}% coverage.`);
      onFail();
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-sm">Drag the square to cover the outlined target.</div>
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
        {Array.from({length:size*size}).map((_, idx) => {
          const isTarget = idx === targetIdx;
          const isNeighbor = neighbors.includes(idx);
          const isPicked = picked.includes(idx);
          
          return (
            <button key={idx}
              onClick={() => setPicked(p => p.includes(idx) ? p.filter(i=>i!==idx) : [...p, idx])}
              className={`aspect-square rounded-lg text-xl flex items-center justify-center relative ${
                isTarget 
                  ? 'bg-yellow-100 border-2 border-yellow-400' 
                  : 'bg-white border border-gray-300'
              } ${isPicked ? 'ring-2 ring-green-400' : ''}`}>
              {isTarget ? '🎯' : ''}
            </button>
          );
        })}
      </div>
      <Button onClick={verify}>Verify</Button>
    </div>
  );
}

// 6) Hold steady (2s ±50ms)
function CaptchaHold({ onPass, onFail }: { onPass: () => void; onFail: () => void }) {
  const REQUIRED = 2000; // ms
  const TOLERANCE = 50; // ±50ms
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
    setHolding(false);
    const minTime = REQUIRED - TOLERANCE;
    const maxTime = REQUIRED + TOLERANCE;
    if (elapsed >= minTime && elapsed <= maxTime) {
      onPass();
    } else {
      alert(`Hold for exactly 2 seconds (within a small margin).`);
      onFail();
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-sm">Press and hold the button for <b>exactly 2 seconds</b>.</div>
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
  const [ready, setReady] = useState(false);
  const [hasSubmittedScore, setHasSubmittedScore] = useState(false);

  // Listen for CAPTCHA completion event
  useEffect(() => {
    const handleCaptchaCompleted = () => {
      setReady(true);
    };

    const handleGameReset = () => {
      setReady(false);
      setHasSubmittedScore(false);
    };

    window.addEventListener('captchaCompleted', handleCaptchaCompleted);
    window.addEventListener('gameReset', handleGameReset);
    
    // Also check if already completed on mount
    const g = (window as any).KASADA_GAME;
    if (g?.captcha?.seconds) {
      setReady(true);
    }

    return () => {
      window.removeEventListener('captchaCompleted', handleCaptchaCompleted);
      window.removeEventListener('gameReset', handleGameReset);
    };
  }, []);

  useEffect(() => {
    const g = (window as any).KASADA_GAME;
    if (!g?.captcha?.seconds || !g?.kasada?.seconds) return;
    const savedSecs = Math.max(0, g.captcha.seconds - g.kasada.seconds);
    const pct = g.captcha.seconds > 0 ? (savedSecs / g.captcha.seconds) * 100 : 0;
    setDelta({ saved: savedSecs, percent: pct });
  }, [rows, ready]);

  const save = async () => {
    const g = (window as any).KASADA_GAME;
    if (!g?.captcha?.seconds || hasSubmittedScore) return; // Only require CAPTCHA completion and prevent duplicates
    
    const row: ScoreRow = {
      id: uid(),
      name: name || 'Anonymous',
      captchaSeconds: g.captcha.seconds,
      kasadaSeconds: g.kasada?.seconds ?? 0,
      retries: g.captcha.retries ?? 0,
      rageClicks: g.captcha.rage ?? 0,
      attempts: g.captcha.attempts ?? 0,
      failures: g.captcha.failures ?? 0,
      skips: g.captcha.skips ?? 0,
      date: new Date().toISOString(),
    };
    
    // Mark as submitted to prevent duplicates
    setHasSubmittedScore(true);
    
    // Save locally first
    const next = [row, ...rows].sort((a,b) => a.captchaSeconds - b.captchaSeconds);
    setRows(next); 
    saveScores(next); 
    setSaved(true); 
    setTimeout(() => setSaved(false), 1200);
    
    // Try to save to API (Cloudflare Pages Functions)
    try {
      const response = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(row),
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.leaderboard) {
          setRows(result.leaderboard);
          saveScores(result.leaderboard);
        }
      }
    } catch (error) {
      console.log('API save failed, using localStorage only:', error);
    }
  };

  const replay = () => {
    // Reset the game state
    (window as any).KASADA_GAME = {};
    setName("");
    setSaved(false);
    
    // Dispatch reset event to notify other components
    window.dispatchEvent(new CustomEvent('gameReset'));
    
    // Scroll to top and reload the page to reset everything
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const copyLink = async () => {
    const u = new URL(window.location.href);
    const g = (window as any).KASADA_GAME;
    if (g?.captcha?.seconds) u.searchParams.set('last_captcha', String(g.captcha.seconds.toFixed(1)));
    if (g?.kasada?.seconds) u.searchParams.set('last_kasada', String(g.kasada.seconds.toFixed(1)));
    try { await navigator.clipboard.writeText(u.toString()); } catch {}
  };

  // Load leaderboard from API on mount
  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const response = await fetch('/api/leaderboard');
        if (response.ok) {
          const apiRows = await response.json();
          if (apiRows.length > 0) {
            setRows(apiRows);
            saveScores(apiRows);
          }
        }
      } catch (error) {
        console.log('API load failed, using localStorage only:', error);
      }
    };
    
    loadLeaderboard();
  }, []);

  const g = (window as any).KASADA_GAME;

  return (
    <Card className="rounded-2xl shadow-md mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5"/> Results & Leaderboard</CardTitle>
      </CardHeader>
      <CardContent>
        {!ready ? (
          <div className="text-sm text-slate-500">Complete the CAPTCHA challenges to see results and save to leaderboard.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Stat label="CAPTCHA time" value={fmt(g.captcha.seconds)} />
                <Stat label="Success rate" value={`${g.captcha.attempts ? Math.round(((g.captcha.attempts - g.captcha.failures) / g.captcha.attempts) * 100) : 0}%`} />
              </div>
              <div className="grid grid-cols-4 gap-3">
                <Stat label="Retries" value={String(g.captcha.retries ?? 0)} />
                <Stat label="Rage events" value={String(g.captcha.rage ?? 0)} />
                <Stat label="Skips" value={String(g.captcha.skips ?? 0)} />
                <Stat label="Total attempts" value={String(g.captcha.attempts ?? 0)} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Input className="max-w-[200px]" value={name} onChange={e => setName(e.target.value)} placeholder="Your name (optional)"/>
                <Button onClick={save} disabled={hasSubmittedScore}>
                  {hasSubmittedScore ? "Score Saved" : "Save to leaderboard"}
                </Button>
                <Button variant="secondary" onClick={copyLink}><Copy className="w-4 h-4 mr-2"/>Copy share link</Button>
                <Button variant="outline" onClick={replay} className="bg-white hover:bg-gray-50 text-gray-700 border-gray-300">
                  <Share2 className="w-4 h-4 mr-2"/>Replay
                </Button>
                {saved && <span className="text-emerald-600 text-sm">Saved!</span>}
              </div>
            </div>
            <div>
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
      <div className="bg-slate-50 text-xs px-4 py-3 text-slate-600">
        <div className="flex items-center gap-2">
          <div className="w-12 flex-shrink-0">Rank</div>
          <div className="flex-1 min-w-0">Player</div>
          <div className="w-16 text-center flex-shrink-0">Time</div>
          <div className="w-16 text-center flex-shrink-0">Attempts</div>
          <div className="w-14 text-center flex-shrink-0">Skips</div>
          <div className="w-16 text-center flex-shrink-0">Success%</div>
          <div className="w-20 text-center flex-shrink-0">Date</div>
        </div>
      </div>
      <div className="divide-y max-h-96 overflow-y-auto">
        {rows.slice(0, 25).map((r, index) => {
          const successRate = r.attempts > 0 ? Math.round(((r.attempts - r.failures) / r.attempts) * 100) : 0;
          return (
            <div className="flex items-center gap-2 px-4 py-3 text-sm" key={r.id}>
              <div className="w-12 flex-shrink-0 font-medium text-slate-600">#{index + 1}</div>
              <div className="flex-1 min-w-0 text-left font-medium truncate" title={r.name || 'Anonymous'}>{r.name || 'Anonymous'}</div>
              <div className="w-16 font-mono text-center flex-shrink-0">{fmt(r.captchaSeconds)}</div>
              <div className="w-16 text-center flex-shrink-0">{r.attempts}</div>
              <div className="w-14 text-center flex-shrink-0">{r.skips}</div>
              <div className={`w-16 text-center flex-shrink-0 font-medium ${successRate >= 80 ? 'text-green-600' : successRate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                {successRate}%
              </div>
              <div className="w-20 text-xs text-slate-500 text-center flex-shrink-0">{new Date(r.date).toLocaleDateString()}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

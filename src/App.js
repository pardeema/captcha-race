import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Copy, TimerReset, Trophy, CheckCircle2, Shield, Zap, Share2 } from "lucide-react";
const fmt = (s) => `${s.toFixed(1)}s`;
const uid = () => Math.random().toString(36).slice(2, 9);
// Local leaderboard helpers
const LS_KEY = "kasada-vs-captcha-leaderboard";
function loadScores() {
    try {
        return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    }
    catch {
        return [];
    }
}
function saveScores(rows) {
    localStorage.setItem(LS_KEY, JSON.stringify(rows.slice(0, 25)));
}
// Rage click detector
function useRageClicks(active) {
    const [rage, setRage] = useState(0);
    useEffect(() => {
        if (!active)
            return;
        let clicks = 0;
        const handler = () => {
            clicks++;
            if (clicks >= 5) {
                setRage(r => r + 1);
                clicks = 0;
            }
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
    const neighborsCount = (idx) => {
        const size = 4;
        const r = Math.floor(idx / size), c = idx % size;
        let n = 0;
        for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0)
                    continue;
                const rr = r + dr, cc = c + dc;
                if (rr >= 0 && rr < size && cc >= 0 && cc < size)
                    n++;
            }
        return n;
    };
    console.assert(neighborsCount(5) >= 3 && neighborsCount(5) <= 8, "Border test: neighbor count reasonable");
    // Rotation tolerance test
    const within = (x, t) => Math.abs(x - t) <= 1;
    console.assert(within(10, 11) && !within(10, 12), "Rotation tolerance ±1 works");
}
// =============================
// Frustration Popup Component
// =============================
function FrustrationPopup({ onKeepTrying, onSkip, correctText }) {
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsx("div", { className: "bg-white rounded-2xl p-8 max-w-md mx-4 shadow-2xl", children: _jsxs("div", { className: "text-center space-y-4", children: [_jsx("div", { className: "text-6xl", children: "\uD83D\uDE24" }), _jsx("h2", { className: "text-2xl font-bold text-slate-900", children: "Frustrated?" }), _jsx("p", { className: "text-lg text-slate-600", children: "Imagine this happening to your users" }), correctText && (_jsxs("div", { className: "mt-4 p-4 bg-slate-50 rounded-lg", children: [_jsx("p", { className: "text-sm text-slate-500 mb-2", children: "Correct spelling:" }), _jsx("p", { className: "text-lg font-mono", style: { fontFamily: 'serif' }, children: correctText })] })), _jsxs("div", { className: "flex gap-3", children: [_jsx(Button, { onClick: onKeepTrying, variant: "secondary", className: "flex-1", children: "Keep trying" }), _jsx(Button, { onClick: onSkip, className: "flex-1", children: "Skip" })] })] }) }) }));
}
// =============================
// Main App
// =============================
export default function App() {
    useEffect(() => { runSanityTests(); }, []);
    return (_jsx("div", { className: "min-h-screen w-full bg-gradient-to-b from-white to-slate-50 text-slate-900", children: _jsxs("div", { className: "max-w-5xl mx-auto p-6", children: [_jsxs("header", { className: "flex items-center gap-3 mb-6", children: [_jsx(Shield, { className: "w-7 h-7" }), _jsx("h1", { className: "text-2xl font-semibold tracking-tight", children: "Kasada vs CAPTCHA" })] }), _jsxs("div", { className: "grid md:grid-cols-2 gap-6", children: [_jsx(CaptchaColumn, { label: "CAPTCHA Flow" }), _jsx(KasadaColumn, { label: "Kasada Flow" })] }), _jsx(ResultsAndShare, { brand: "Kasada" })] }) }));
}
// =============================
// CAPTCHA Column (multi-round, randomized)
// =============================
function CaptchaColumn({ label }) {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const roundsParam = Math.min(10, Math.max(5, Number(params.get('rounds') || 7))); // default 7 (between 5–10)
    const [roundIdx, setRoundIdx] = useState(-1); // -1 = not started
    const [retries, setRetries] = useState(0);
    const [elapsed, setElapsed] = useState(0);
    const [running, setRunning] = useState(false);
    const [sequence, setSequence] = useState([]);
    const rage = useRageClicks(running);
    const t0 = useRef(null);
    const [showFrustrationPopup, setShowFrustrationPopup] = useState(false);
    const [currentChallengeFailures, setCurrentChallengeFailures] = useState(0);
    const [challengeStats, setChallengeStats] = useState({ attempts: 0, failures: 0 });
    // Pool of challenge components
    const pool = [
        (props) => _jsx(CaptchaFrustratedEmojis, { ...props }),
        (props) => _jsx(CaptchaSlider, { ...props }),
        (props) => _jsx(CaptchaWord, { ...props }),
        (props) => _jsx(CaptchaDragPiece, { ...props }),
        (props) => _jsx(CaptchaBorder, { ...props }),
        (props) => _jsx(CaptchaHold, { ...props }),
    ];
    // Timer
    useEffect(() => {
        let raf;
        if (running) {
            const loop = (ts) => {
                if (t0.current == null)
                    t0.current = ts;
                setElapsed(((ts - t0.current) / 1000));
                raf = requestAnimationFrame(loop);
            };
            raf = requestAnimationFrame(loop);
        }
        return () => cancelAnimationFrame(raf);
    }, [running]);
    // Reset on stop
    useEffect(() => {
        if (!running && roundIdx < 0) {
            setElapsed(0);
            t0.current = null;
        }
    }, [running, roundIdx]);
    const start = () => {
        // Build a randomized sequence ensuring no consecutive duplicates
        const seq = [];
        let lastChallenge = null;
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
        setChallengeStats(s => ({ ...s, attempts: s.attempts + 1, failures: s.failures + 1 }));
        if (currentChallengeFailures >= 2) { // 3rd failure (0-indexed)
            setShowFrustrationPopup(true);
        }
    };
    const onPass = () => {
        setChallengeStats(s => ({ ...s, attempts: s.attempts + 1 }));
        const next = roundIdx + 1;
        if (next >= sequence.length) {
            setRunning(false);
            setRoundIdx(sequence.length); // finished
            // persist metrics immediately when CAPTCHA is completed
            window.KASADA_GAME = {
                ...window.KASADA_GAME,
                captcha: {
                    seconds: elapsed,
                    retries,
                    rage,
                    attempts: challengeStats.attempts + 1,
                    failures: challengeStats.failures,
                    skips: window.KASADA_GAME?.captcha?.skips || 0
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
                    skips: window.KASADA_GAME?.captcha?.skips || 0
                }
            }));
        }
        else {
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
        window.KASADA_GAME = {
            ...window.KASADA_GAME,
            captcha: {
                ...window.KASADA_GAME?.captcha,
                skips: (window.KASADA_GAME?.captcha?.skips || 0) + 1
            }
        };
        onPass(); // Move to next challenge
    };
    const current = roundIdx >= 0 && roundIdx < sequence.length ? sequence[roundIdx] : null;
    return (_jsxs(_Fragment, { children: [_jsxs(Card, { className: "rounded-2xl shadow-md", children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center justify-between", children: [_jsx("span", { children: label }), _jsxs("span", { className: "text-sm font-normal text-slate-500 flex items-center gap-2", children: [_jsx(TimerReset, { className: "w-4 h-4" }), fmt(elapsed)] })] }) }), _jsxs(CardContent, { children: [roundIdx < 0 && (_jsxs("div", { className: "space-y-4", children: [_jsxs("p", { className: "text-sm text-slate-600", children: ["Complete ", _jsx("b", { children: roundsParam }), " deliberately frustrating challenges."] }), _jsx(Button, { onClick: start, children: "Start challenges" }), _jsx("div", { className: "text-xs text-slate-500", children: "Rage clicks are tracked automatically." })] })), running && current && (React.createElement(current, { onFail, onPass })), (!running && roundIdx >= sequence.length && sequence.length > 0) && (_jsxs("div", { className: "text-sm text-emerald-700 flex items-center gap-2", children: [_jsx(CheckCircle2, { className: "w-4 h-4" }), " All ", sequence.length, " challenges completed."] })), (roundIdx >= 0) && (_jsxs("div", { className: "mt-4 text-xs text-slate-500", children: ["Round ", Math.min(roundIdx + 1, sequence.length), " / ", sequence.length || roundsParam, " \u00B7 Retries: ", retries, " \u00B7 Rage events: ", rage] }))] })] }), showFrustrationPopup && (_jsx(FrustrationPopup, { onKeepTrying: handleKeepTrying, onSkip: handleSkip, correctText: current === CaptchaWord ? CaptchaWord.correctText : undefined }))] }));
}
// =============================
// Kasada Column
// =============================
function KasadaColumn({ label }) {
    const [done, setDone] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const t = useRef(null);
    const start = () => {
        t.current = performance.now();
        setTimeout(() => {
            const secs = (performance.now() - (t.current || performance.now())) / 1000;
            setElapsed(secs);
            setDone(true);
            window.KASADA_GAME = {
                ...window.KASADA_GAME,
                kasada: { seconds: secs }
            };
        }, 300);
    };
    return (_jsxs(Card, { className: "rounded-2xl shadow-md", children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center justify-between", children: [_jsx("span", { children: label }), _jsxs("span", { className: "text-sm font-normal text-slate-500 flex items-center gap-2", children: [_jsx(Zap, { className: "w-4 h-4" }), done ? fmt(elapsed) : '—'] })] }) }), _jsx(CardContent, { children: !done ? (_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-sm", children: "Frictionless verification. One click." }), _jsx(Button, { onClick: start, children: "Continue" })] })) : (_jsxs("div", { className: "flex items-center gap-3 text-emerald-600", children: [_jsx(CheckCircle2, { className: "w-5 h-5" }), _jsx("span", { className: "text-sm", children: "Verified silently. You're in." })] })) })] }));
}
// =============================
// Challenges
// =============================
// 1) Frustrated emoji grid — only 😡 😤 😠 appear. One is chosen as the correct class.
function CaptchaFrustratedEmojis({ onPass, onFail }) {
    const EMOJIS = ['😡', '😤', '😠'];
    const target = useMemo(() => EMOJIS[Math.floor(Math.random() * EMOJIS.length)], []);
    const grid = useMemo(() => Array.from({ length: 9 }, () => EMOJIS[Math.floor(Math.random() * EMOJIS.length)]), []);
    const [picked, setPicked] = useState([]);
    const [feedback, setFeedback] = useState(null);
    const correctIdx = grid.map((e, i) => e === target ? i : -1).filter(i => i >= 0);
    const submit = () => {
        const pickedSorted = [...picked].sort().join(',');
        const correctSorted = [...correctIdx].sort().join(',');
        if (pickedSorted === correctSorted) {
            setFeedback(null);
            onPass();
        }
        else {
            const pickedCorrect = picked.filter(i => correctIdx.includes(i)).length;
            const pickedWrong = picked.length - pickedCorrect;
            const remaining = Math.max(0, correctIdx.length - pickedCorrect);
            setFeedback(`You selected ${pickedWrong} wrong emojis.`);
            onFail();
        }
    };
    return (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "text-sm", children: ["Select all tiles with ", _jsx("span", { className: "font-medium", children: "the frustrated emoji" }), "."] }), _jsx("div", { className: "grid grid-cols-3 gap-2", children: grid.map((emoji, idx) => (_jsx("button", { className: `aspect-square rounded-lg border flex items-center justify-center text-3xl ${picked.includes(idx) ? 'bg-slate-200' : 'bg-white'}`, onClick: () => setPicked(p => p.includes(idx) ? p.filter(i => i !== idx) : [...p, idx]), children: emoji }, idx))) }), _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx(Button, { onClick: submit, children: "Verify" }), feedback && _jsx("div", { className: "text-xs text-rose-600", children: feedback })] })] }));
}
// 2) Slider — must be within ±1°; show submitted value on error.
function CaptchaSlider({ onPass, onFail }) {
    const target = useMemo(() => Math.floor(5 + Math.random() * 85), []);
    const [val, setVal] = useState([0]);
    const tol = 1;
    const submit = () => {
        const angle = val[0] ?? 0;
        const ok = Math.abs(angle - target) <= tol;
        if (ok)
            onPass();
        else {
            alert(`Incorrect: you submitted ${angle}° (need ${target}° ±${tol}°)`);
            onFail(angle);
        }
    };
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "text-sm", children: ["Rotate the object to ", _jsxs("span", { className: "font-medium", children: [target, "\u00B0"] }), " (\u00B1", tol, "\u00B0)."] }), _jsx("div", { className: "h-24 flex items-center justify-center", children: _jsx("div", { className: "w-16 h-16 border rounded-xl bg-slate-200", style: { transform: `rotate(${val[0]}deg)` } }) }), _jsx(Slider, { value: val, onValueChange: setVal, min: 0, max: 180, step: 1 }), _jsx("div", { className: "flex gap-2 items-center", children: _jsx(Button, { onClick: submit, children: "Verify" }) })] }));
}
// 3) Distorted word (no random fail)
function CaptchaWord({ onPass, onFail }) {
    const base = useMemo(() => {
        const words = ["c4ptch4", "v3rify", "s3cur1ty", "4cc3ss", "c0nf1rm", "v4l1d4t3", "pr0t3ct", "4uth3nt1c", "p4ssw0rd", "l0g1n", "s3cur3", "4cc3pt", "r3j3ct", "4ppr0v3", "d3n1ed"];
        return words[Math.floor(Math.random() * words.length)];
    }, []);
    const [val, setVal] = useState("");
    const [err, setErr] = useState(null);
    const verify = () => { if (val === base)
        onPass();
    else {
        setErr("Not quite, try again");
        onFail();
    } };
    // Expose the correct text for the popup
    CaptchaWord.correctText = base;
    return (_jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "text-sm", children: "Type the characters you see:" }), _jsx("div", { className: "w-full h-16 rounded-lg border grid place-items-center bg-[repeating-linear-gradient(45deg,rgba(0,0,0,.06),rgba(0,0,0,.06)_4px,transparent_4px,transparent_8px)]", children: _jsx("div", { className: "text-2xl tracking-widest select-none", style: { filter: 'blur(0.4px) contrast(1.2)', transform: 'skewX(6deg)', letterSpacing: '0.5rem' }, children: base }) }), _jsx(Input, { value: val, onChange: e => setVal(e.target.value), placeholder: "Enter text" }), _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx(Button, { onClick: verify, children: "Verify" }), err && _jsx("span", { className: "text-xs text-rose-600", children: err })] }), _jsx("div", { className: "text-xs text-slate-500", children: "Pro tip: That was annoying on purpose." })] }));
}
// 4) Drag piece into target
function CaptchaDragPiece({ onPass, onFail }) {
    const containerRef = useRef(null);
    const [pos, setPos] = useState({ x: 10, y: 10 });
    const [dragging, setDragging] = useState(false);
    const target = { x: 140, y: 40 };
    useEffect(() => {
        const move = (e) => {
            if (!dragging || !containerRef.current)
                return;
            const rect = containerRef.current.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            setPos({ x: Math.max(0, Math.min(280, clientX - rect.left - 16)), y: Math.max(0, Math.min(120, clientY - rect.top - 16)) });
        };
        const up = () => setDragging(false);
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
        window.addEventListener('touchmove', move);
        window.addEventListener('touchend', up);
        return () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            window.removeEventListener('touchmove', move);
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
        }
        else {
            alert(`Need 95% coverage. You achieved ${coveragePercent.toFixed(1)}% coverage.`);
            onFail();
        }
    };
    return (_jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "text-sm", children: "Drag the square to cover the outlined target." }), _jsxs("div", { ref: containerRef, className: "relative w-[320px] h-[160px] border rounded-lg bg-slate-50 overflow-hidden", children: [_jsx("div", { className: "absolute left-[140px] top-[40px] w-8 h-8 rounded-lg border-2 border-dashed" }), _jsx("div", { className: `absolute w-8 h-8 rounded-lg bg-slate-300 border cursor-grab active:cursor-grabbing`, style: { left: pos.x, top: pos.y }, onMouseDown: () => setDragging(true), onTouchStart: () => setDragging(true) })] }), _jsx(Button, { onClick: verify, children: "Verify" })] }));
}
// 5) Border squares — select all neighbors around 🎯
function CaptchaBorder({ onPass, onFail }) {
    const size = 4; // 4x4 grid
    const [targetIdx] = useState(() => {
        const choices = [];
        for (let r = 1; r < size - 1; r++)
            for (let c = 1; c < size - 1; c++)
                choices.push(r * size + c);
        return choices[Math.floor(Math.random() * choices.length)];
    });
    const [picked, setPicked] = useState([]);
    const neighbors = useMemo(() => {
        const r = Math.floor(targetIdx / size), c = targetIdx % size;
        const idxs = [];
        for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0)
                    continue;
                const rr = r + dr, cc = c + dc;
                if (rr >= 0 && rr < size && cc >= 0 && cc < size)
                    idxs.push(rr * size + cc);
            }
        return idxs;
    }, [targetIdx]);
    const verify = () => {
        const ok = [...picked].sort().join(',') === [...neighbors].sort().join(',');
        if (ok)
            onPass();
        else {
            const pickedCorrect = picked.filter(i => neighbors.includes(i)).length;
            const remaining = neighbors.length - pickedCorrect;
            alert(`Select all squares that border the 🎯 tile. ${remaining} remaining.`);
            onFail();
        }
    };
    return (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "text-sm", children: ["Select all squares that border the ", _jsx("span", { className: "font-medium", children: "\uD83C\uDFAF" }), " tile."] }), _jsx("div", { className: "grid grid-cols-4 gap-2", children: Array.from({ length: size * size }).map((_, idx) => {
                    const isTarget = idx === targetIdx;
                    const isNeighbor = neighbors.includes(idx);
                    const isPicked = picked.includes(idx);
                    return (_jsx("button", { onClick: () => setPicked(p => p.includes(idx) ? p.filter(i => i !== idx) : [...p, idx]), className: `aspect-square rounded-lg text-xl flex items-center justify-center relative ${isTarget
                            ? 'bg-yellow-100 border-2 border-yellow-400'
                            : 'bg-white border border-gray-300'} ${isPicked ? 'ring-2 ring-green-400' : ''}`, children: isTarget ? '🎯' : '' }, idx));
                }) }), _jsx(Button, { onClick: verify, children: "Verify" })] }));
}
// 6) Hold steady (2s ±50ms)
function CaptchaHold({ onPass, onFail }) {
    const REQUIRED = 2000; // ms
    const TOLERANCE = 50; // ±50ms
    const [holding, setHolding] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const tRef = useRef(null);
    useEffect(() => {
        let raf;
        const loop = () => {
            if (holding && tRef.current != null) {
                setElapsed(performance.now() - tRef.current);
                raf = requestAnimationFrame(loop);
            }
        };
        if (holding)
            raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [holding]);
    const down = () => { setElapsed(0); tRef.current = performance.now(); setHolding(true); };
    const up = () => {
        setHolding(false);
        const minTime = REQUIRED - TOLERANCE;
        const maxTime = REQUIRED + TOLERANCE;
        if (elapsed >= minTime && elapsed <= maxTime) {
            onPass();
        }
        else {
            alert(`Hold for exactly 2 seconds (within a small margin).`);
            onFail();
        }
    };
    return (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "text-sm", children: ["Press and hold the button for ", _jsx("b", { children: "exactly 2 seconds" }), "."] }), _jsx(Button, { onMouseDown: down, onMouseUp: up, onMouseLeave: () => holding && up(), onTouchStart: down, onTouchEnd: up, children: holding ? `Holding… ${Math.round(elapsed)}ms` : 'Hold' })] }));
}
// =============================
// Results & Sharing
// =============================
function ResultsAndShare({ brand }) {
    const [name, setName] = useState("");
    const [rows, setRows] = useState(() => loadScores());
    const [saved, setSaved] = useState(false);
    const [delta, setDelta] = useState({ saved: 0, percent: 0 });
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
        const g = window.KASADA_GAME;
        if (g?.captcha?.seconds) {
            setReady(true);
        }
        return () => {
            window.removeEventListener('captchaCompleted', handleCaptchaCompleted);
            window.removeEventListener('gameReset', handleGameReset);
        };
    }, []);
    useEffect(() => {
        const g = window.KASADA_GAME;
        if (!g?.captcha?.seconds || !g?.kasada?.seconds)
            return;
        const savedSecs = Math.max(0, g.captcha.seconds - g.kasada.seconds);
        const pct = g.captcha.seconds > 0 ? (savedSecs / g.captcha.seconds) * 100 : 0;
        setDelta({ saved: savedSecs, percent: pct });
    }, [rows, ready]);
    const save = async () => {
        const g = window.KASADA_GAME;
        if (!g?.captcha?.seconds || hasSubmittedScore)
            return; // Only require CAPTCHA completion and prevent duplicates
        const row = {
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
        const next = [row, ...rows].sort((a, b) => a.captchaSeconds - b.captchaSeconds);
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
        }
        catch (error) {
            console.log('API save failed, using localStorage only:', error);
        }
    };
    const replay = () => {
        // Reset the game state
        window.KASADA_GAME = {};
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
        const g = window.KASADA_GAME;
        if (g?.captcha?.seconds)
            u.searchParams.set('last_captcha', String(g.captcha.seconds.toFixed(1)));
        if (g?.kasada?.seconds)
            u.searchParams.set('last_kasada', String(g.kasada.seconds.toFixed(1)));
        try {
            await navigator.clipboard.writeText(u.toString());
        }
        catch { }
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
            }
            catch (error) {
                console.log('API load failed, using localStorage only:', error);
            }
        };
        loadLeaderboard();
    }, []);
    const g = window.KASADA_GAME;
    return (_jsxs(Card, { className: "rounded-2xl shadow-md mt-6", children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Trophy, { className: "w-5 h-5" }), " Results & Leaderboard"] }) }), _jsx(CardContent, { children: !ready ? (_jsx("div", { className: "text-sm text-slate-500", children: "Complete the CAPTCHA challenges to see results and save to leaderboard." })) : (_jsxs("div", { className: "grid md:grid-cols-3 gap-6 items-start", children: [_jsxs("div", { className: "md:col-span-2 space-y-4", children: [_jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsx(Stat, { label: "CAPTCHA time", value: fmt(g.captcha.seconds) }), _jsx(Stat, { label: `${brand} time`, value: g.kasada?.seconds ? fmt(g.kasada.seconds) : "—" }), _jsx(Stat, { label: "Time saved", value: g.kasada?.seconds ? fmt(Math.max(0, g.captcha.seconds - g.kasada.seconds)) : "—" })] }), _jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsx(Stat, { label: "Retries", value: String(g.captcha.retries ?? 0) }), _jsx(Stat, { label: "Rage events", value: String(g.captcha.rage ?? 0) }), _jsx(Stat, { label: "Skips", value: String(g.captcha.skips ?? 0) })] }), _jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsx(Stat, { label: "Total attempts", value: String(g.captcha.attempts ?? 0) }), _jsx(Stat, { label: "Failed attempts", value: String(g.captcha.failures ?? 0) }), _jsx(Stat, { label: "Success rate", value: `${g.captcha.attempts ? Math.round(((g.captcha.attempts - g.captcha.failures) / g.captcha.attempts) * 100) : 0}%` })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(Input, { className: "max-w-[200px]", value: name, onChange: e => setName(e.target.value), placeholder: "Your name (optional)" }), _jsx(Button, { onClick: save, disabled: hasSubmittedScore, children: hasSubmittedScore ? "Score Saved" : "Save to leaderboard" }), _jsxs(Button, { variant: "secondary", onClick: copyLink, children: [_jsx(Copy, { className: "w-4 h-4 mr-2" }), "Copy share link"] }), _jsxs(Button, { variant: "outline", onClick: replay, className: "bg-white hover:bg-gray-50 text-gray-700 border-gray-300", children: [_jsx(Share2, { className: "w-4 h-4 mr-2" }), "Replay"] }), saved && _jsx("span", { className: "text-emerald-600 text-sm", children: "Saved!" })] })] }), _jsx("div", { className: "md:col-span-1", children: _jsx(Leaderboard, { rows: rows }) })] })) })] }));
}
function Stat({ label, value }) {
    return (_jsxs("div", { className: "p-4 rounded-xl border bg-white", children: [_jsx("div", { className: "text-xs text-slate-500", children: label }), _jsx("div", { className: "text-lg font-semibold", children: value })] }));
}
function Leaderboard({ rows }) {
    if (!rows.length)
        return (_jsx("div", { className: "text-sm text-slate-500", children: "No entries yet. Be the first!" }));
    return (_jsxs("div", { className: "border rounded-xl overflow-hidden", children: [_jsxs("div", { className: "grid grid-cols-7 bg-slate-50 text-xs px-3 py-2 text-slate-600", children: [_jsx("div", { children: "Rank" }), _jsx("div", { children: "Player" }), _jsx("div", { children: "Time" }), _jsx("div", { children: "Attempts" }), _jsx("div", { children: "Skips" }), _jsx("div", { children: "Success%" }), _jsx("div", { children: "Date" })] }), _jsx("div", { className: "divide-y max-h-96 overflow-y-auto", children: rows.slice(0, 25).map((r, index) => {
                    const successRate = r.attempts > 0 ? Math.round(((r.attempts - r.failures) / r.attempts) * 100) : 0;
                    return (_jsxs("div", { className: "grid grid-cols-7 px-3 py-2 text-sm", children: [_jsxs("div", { className: "font-medium text-slate-600", children: ["#", index + 1] }), _jsx("div", { className: "truncate", children: r.name }), _jsx("div", { className: "font-mono", children: fmt(r.captchaSeconds) }), _jsx("div", { children: r.attempts }), _jsx("div", { children: r.skips }), _jsxs("div", { className: successRate >= 80 ? 'text-green-600' : successRate >= 60 ? 'text-yellow-600' : 'text-red-600', children: [successRate, "%"] }), _jsx("div", { className: "text-xs text-slate-500", children: new Date(r.date).toLocaleDateString() })] }, r.id));
                }) })] }));
}

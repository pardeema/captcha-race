// Storage utility for leaderboard data
// Supports both localStorage (fallback) and remote API
const LS_KEY = "kasada-vs-captcha-leaderboard";
const API_BASE = "/api/leaderboard";
// Local storage helpers
export function loadScoresLocal() {
    try {
        const data = localStorage.getItem(LS_KEY);
        return data ? JSON.parse(data) : [];
    }
    catch {
        return [];
    }
}
export function saveScoresLocal(rows) {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(rows.slice(0, 25)));
    }
    catch {
        // Ignore localStorage errors
    }
}
// Remote API helpers
export async function loadScoresRemote() {
    try {
        const response = await fetch(API_BASE);
        if (!response.ok)
            throw new Error('Failed to load scores');
        return await response.json();
    }
    catch (error) {
        console.warn('Failed to load remote scores, falling back to local:', error);
        return loadScoresLocal();
    }
}
export async function saveScoreRemote(score) {
    try {
        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(score),
        });
        if (!response.ok)
            throw new Error('Failed to save score');
        const result = await response.json();
        return result.leaderboard || [];
    }
    catch (error) {
        console.warn('Failed to save remote score, falling back to local:', error);
        // Fallback to local storage
        const localScores = loadScoresLocal();
        const newScores = [score, ...localScores].sort((a, b) => a.captchaSeconds - b.captchaSeconds);
        saveScoresLocal(newScores);
        return newScores;
    }
}
// Hybrid approach - try remote first, fallback to local
export async function loadScores() {
    // Try remote first
    const remoteScores = await loadScoresRemote();
    // If we got remote scores, also sync to local storage
    if (remoteScores.length > 0) {
        saveScoresLocal(remoteScores);
        return remoteScores;
    }
    // Fallback to local
    return loadScoresLocal();
}
export async function saveScore(score) {
    // Try remote first
    const remoteScores = await saveScoreRemote(score);
    // If remote worked, sync to local
    if (remoteScores.length > 0) {
        saveScoresLocal(remoteScores);
        return remoteScores;
    }
    // Fallback to local only
    const localScores = loadScoresLocal();
    const newScores = [score, ...localScores].sort((a, b) => a.captchaSeconds - b.captchaSeconds);
    saveScoresLocal(newScores);
    return newScores;
}

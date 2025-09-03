// Simple API for leaderboard storage
// This can be deployed to Cloudflare Pages Functions or GitHub Pages with serverless functions

const LEADERBOARD_KEY = 'captcha-race-leaderboard';

// For Cloudflare Pages Functions
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  if (request.method === 'GET') {
    // Get leaderboard data
    try {
      const data = await env['CAPTCHA-LEADERBOARD'].get(LEADERBOARD_KEY);
      const leaderboard = data ? JSON.parse(data) : [];
      return new Response(JSON.stringify(leaderboard), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  if (request.method === 'POST') {
    // Add new score
    try {
      const newScore = await request.json();
      
      // Get existing leaderboard
      const data = await env['CAPTCHA-LEADERBOARD'].get(LEADERBOARD_KEY);
      const leaderboard = data ? JSON.parse(data) : [];
      
      // Add new score and sort by CAPTCHA time
      leaderboard.push(newScore);
      leaderboard.sort((a, b) => a.captchaSeconds - b.captchaSeconds);
      
      // Keep only top 25
      const top25 = leaderboard.slice(0, 25);
      
      // Save back to storage
      await env['CAPTCHA-LEADERBOARD'].put(LEADERBOARD_KEY, JSON.stringify(top25));
      
      return new Response(JSON.stringify({ success: true, leaderboard: top25 }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to save score' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  return new Response('Method not allowed', { status: 405 });
}

// For GitHub Pages with serverless functions (Vercel/Netlify style)
export default async function handler(req, res) {
  // This would be used for GitHub Pages with serverless functions
  // For now, we'll use localStorage as fallback
  res.status(200).json({ message: 'Use localStorage fallback' });
}

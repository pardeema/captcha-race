// Cloudflare Pages Functions API for leaderboard
const LEADERBOARD_KEY = 'captcha-race-leaderboard';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
  
  if (request.method === 'GET') {
    // Get leaderboard data
    try {
      // Debug: Check available bindings
      const availableBindings = Object.keys(env);
      
      if (!env['KV']) {
        return new Response(JSON.stringify({ 
          error: 'KV binding not found in GET', 
          availableBindings: availableBindings,
          debug: 'KV binding is missing in GET request'
        }), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        });
      }
      
      const data = await env['KV'].get(LEADERBOARD_KEY);
      const leaderboard = data ? JSON.parse(data) : [];
      return new Response(JSON.stringify(leaderboard), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'GET request failed', 
        details: error.message,
        availableBindings: Object.keys(env)
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }
  }
  
  if (request.method === 'POST') {
    // Add new score
    try {
      const newScore = await request.json();
      
      // Validate required fields
      if (!newScore.captchaSeconds || !newScore.name) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        });
      }
      
      // Debug: Check if KV binding exists
      if (!env['KV']) {
        return new Response(JSON.stringify({ 
          error: 'KV binding not found', 
          availableBindings: Object.keys(env),
          debug: 'KV binding is missing'
        }), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        });
      }
      
      // Get existing leaderboard
      const data = await env['KV'].get(LEADERBOARD_KEY);
      const leaderboard = data ? JSON.parse(data) : [];
      
      // Add new score and sort by CAPTCHA time (ascending - fastest first)
      leaderboard.push(newScore);
      leaderboard.sort((a, b) => a.captchaSeconds - b.captchaSeconds);
      
      // Keep only top 25
      const top25 = leaderboard.slice(0, 25);
      
      // Save back to storage
      await env['KV'].put(LEADERBOARD_KEY, JSON.stringify(top25));
      
      return new Response(JSON.stringify({ success: true, leaderboard: top25 }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'Failed to save score', 
        details: error.message,
        stack: error.stack 
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }
  }
  
  return new Response('Method not allowed', { 
    status: 405,
    headers: {
      'Access-Control-Allow-Origin': '*',
    }
  });
}

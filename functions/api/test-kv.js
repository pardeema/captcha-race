// Test endpoint to verify KV binding
export async function onRequest(context) {
  const { request, env } = context;
  
  try {
    // Check available bindings
    const availableBindings = Object.keys(env);
    const kvBindingExists = !!env['CAPTCHA-LEADERBOARD'];
    
    // Try to read from KV
    let kvTest = null;
    if (env['CAPTCHA-LEADERBOARD']) {
      try {
        kvTest = await env['CAPTCHA-LEADERBOARD'].get('test-key');
      } catch (error) {
        kvTest = { error: error.message };
      }
    }
    
    // Try to write to KV
    let writeTest = null;
    if (env['CAPTCHA-LEADERBOARD']) {
      try {
        await env['CAPTCHA-LEADERBOARD'].put('test-key', 'test-value');
        writeTest = 'success';
      } catch (error) {
        writeTest = { error: error.message };
      }
    }
    
    return new Response(JSON.stringify({
      availableBindings,
      kvBindingExists,
      kvTest,
      writeTest,
      timestamp: new Date().toISOString()
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack,
      availableBindings: Object.keys(env)
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}

# Deployment Guide

This guide covers deploying the CAPTCHA Race application to both Cloudflare Pages and GitHub Pages with persistent leaderboard storage.

## Features Implemented

✅ **Immediate Leaderboard Access**: The leaderboard appears as soon as the user completes the CAPTCHA challenge
✅ **Comprehensive Tracking**: Tracks attempts, skips, failures, and total completion time
✅ **Persistent Storage**: Uses Cloudflare KV storage for cross-visitor leaderboard persistence
✅ **Top 25 Display**: Shows the top 25 fastest completions with detailed metrics
✅ **Success Rate Calculation**: Displays success percentage with color coding

## Deployment Options

### Option 1: Cloudflare Pages (Recommended)

Cloudflare Pages provides serverless functions and KV storage for persistent leaderboard data.

#### Prerequisites
1. Install Wrangler CLI: `npm install -g wrangler`
2. Login to Cloudflare: `wrangler login`
3. Create a KV namespace: `wrangler kv:namespace create "LEADERBOARD"`

#### Setup Steps

1. **Update wrangler.toml**:
   ```bash
   # Replace the KV namespace IDs in wrangler.toml with your actual IDs
   wrangler kv:namespace list
   ```

2. **Deploy**:
   ```bash
   npm run deploy:cloudflare
   ```

3. **Configure KV Binding**:
   - Go to your Cloudflare Pages project dashboard
   - Navigate to Settings > Functions
   - Add KV namespace binding: `LEADERBOARD` → your namespace ID

#### Benefits
- ✅ Persistent leaderboard storage across all visitors
- ✅ Global CDN for fast loading
- ✅ Serverless functions for API endpoints
- ✅ Free tier with generous limits

### Option 2: GitHub Pages

GitHub Pages provides static hosting with localStorage fallback.

#### Setup Steps

1. **Install gh-pages**:
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Deploy**:
   ```bash
   npm run deploy:github
   ```

3. **Configure GitHub Pages**:
   - Go to your repository Settings > Pages
   - Select "Deploy from a branch"
   - Choose `gh-pages` branch

#### Benefits
- ✅ Free static hosting
- ✅ Automatic deployments on push
- ⚠️ Leaderboard data is per-browser (localStorage only)

## API Endpoints

### GET /api/leaderboard
Returns the current leaderboard (top 25 entries).

**Response**:
```json
[
  {
    "id": "abc123",
    "name": "Player Name",
    "captchaSeconds": 45.2,
    "kasadaSeconds": 0.3,
    "retries": 3,
    "rageClicks": 1,
    "attempts": 8,
    "failures": 3,
    "skips": 1,
    "date": "2024-01-15T10:30:00.000Z"
  }
]
```

### POST /api/leaderboard
Adds a new score to the leaderboard.

**Request Body**:
```json
{
  "id": "abc123",
  "name": "Player Name",
  "captchaSeconds": 45.2,
  "kasadaSeconds": 0.3,
  "retries": 3,
  "rageClicks": 1,
  "attempts": 8,
  "failures": 3,
  "skips": 1,
  "date": "2024-01-15T10:30:00.000Z"
}
```

**Response**:
```json
{
  "success": true,
  "leaderboard": [...]
}
```

## Leaderboard Metrics

The leaderboard tracks and displays:

- **Time**: Total CAPTCHA completion time (primary sort)
- **Attempts**: Total number of challenge attempts
- **Skips**: Number of challenges skipped via frustration popup
- **Success Rate**: Percentage of successful attempts (color-coded)
  - 🟢 Green: 80%+ success rate
  - 🟡 Yellow: 60-79% success rate
  - 🔴 Red: <60% success rate

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Troubleshooting

### Cloudflare Pages Issues

1. **KV Binding Not Working**:
   - Ensure KV namespace is created and bound correctly
   - Check that the binding name matches in both wrangler.toml and function code

2. **CORS Errors**:
   - The middleware function handles CORS headers
   - Ensure functions/_middleware.js is deployed

3. **Function Not Found**:
   - Verify functions/api/leaderboard.js is in the correct location
   - Check that the file exports the onRequest function

### GitHub Pages Issues

1. **Build Fails**:
   - Ensure all dependencies are installed
   - Check for TypeScript errors: `npm run lint`

2. **Leaderboard Not Persisting**:
   - GitHub Pages only supports static files
   - Leaderboard data is stored in localStorage per browser

## Environment Variables

For Cloudflare Pages, configure these in your dashboard:

- `LEADERBOARD` (KV namespace binding) - automatically configured

## Performance Considerations

- Leaderboard is limited to top 25 entries to minimize storage and loading time
- API calls are cached in localStorage as fallback
- Images and assets are optimized for fast loading
- CDN distribution ensures global performance

## Security Notes

- No authentication required for leaderboard access
- Input validation prevents malicious data injection
- CORS headers are properly configured
- KV storage provides data isolation per deployment

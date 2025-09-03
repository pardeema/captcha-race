# CAPTCHA Race

A demonstration app comparing traditional CAPTCHA challenges with Kasada's frictionless verification. Users complete frustrating CAPTCHA challenges and then experience Kasada's seamless verification to see the time difference.

## Features

- 🎯 **Multiple CAPTCHA Challenges**: 6 different types of deliberately frustrating challenges
- 🏆 **Persistent Leaderboard**: Cloudflare KV storage for cross-visitor leaderboard
- 📊 **Detailed Metrics**: Tracks time, attempts, failures, skips, and success rates
- 🎨 **Modern UI**: Built with React, TypeScript, and Tailwind CSS

## Quick Start

1. **Clone and Install**:
   ```bash
   git clone <your-repo>
   cd captcha-race
   npm install
   ```

2. **Setup Cloudflare Configuration**:
   ```bash
   # Copy the template and update with your KV namespace IDs
   cp wrangler.toml.template wrangler.toml
   
   # Create KV namespace and get IDs
   wrangler kv namespace create "CAPTCHA-LEADERBOARD"
   wrangler kv namespace list
   
   # Edit wrangler.toml with your actual namespace IDs
   ```

3. **Run Locally**:
   ```bash
   npm run dev
   ```

4. **Deploy to Cloudflare Pages**:
   ```bash
   npm run deploy:cloudflare
   ```

## Development

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

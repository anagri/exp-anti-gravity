# GitHub Pages Deployment

## Setup Instructions

### 1. Enable GitHub Pages in Repository Settings

1. Go to repository **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions**
3. Save changes

### 2. Push Changes to GitHub

```bash
git add .github/workflows/deploy.yml vite.config.ts
git commit -m "feat: add GitHub Pages deployment workflow"
git push origin main
```

### 3. Monitor Deployment

- Go to **Actions** tab in GitHub repository
- Watch "Deploy to GitHub Pages" workflow
- Once complete, app will be available at: `https://anagri.github.io/exp-anti-gravity/`

## Configuration Details

### Base Path

- Configured in `vite.config.ts` as `base: '/exp-anti-gravity/'`
- Matches repository name for GitHub Pages subdirectory deployment

### Workflow Triggers

- **Push to main branch**: Auto-deploys on every push
- **Manual dispatch**: Can trigger manually via Actions tab

### Build Process

1. Checkout code
2. Setup Node.js 20
3. Install dependencies with `npm ci`
4. Build with `npm run build`
5. Upload `dist/` directory
6. Deploy to GitHub Pages

## Local Testing

Test production build locally:

```bash
npm run build
npm run preview
```

Visit: http://127.0.0.1:4173

## Troubleshooting

**404 on GitHub Pages?**

- Verify base path in `vite.config.ts` matches repo name
- Check GitHub Pages is enabled in Settings
- Wait 1-2 minutes for DNS propagation

**Build failing?**

- Check Actions tab for error logs
- Verify all dependencies in package.json
- Test build locally first

**Assets not loading?**

- Ensure base path is correct
- Check browser console for 404 errors
- Verify asset paths use relative imports

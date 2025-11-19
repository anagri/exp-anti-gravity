# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

React + TypeScript chat application using OpenAI API with streaming chat completions, built with Vite. Uses shadcn/ui components with Tailwind CSS v4.

## Architecture

### State Management
- **ApiKeyContext** (`src/contexts/ApiKeyContext.tsx`): Manages OpenAI API key in localStorage
- **useChat** hook (`src/hooks/useChat.ts`): Handles chat state, OpenAI streaming API calls, model selection

### Routing
- `/` - WelcomePage: API key input
- `/chat` - ChatPage: Protected route, requires API key to access

### Key Technical Details
- OpenAI SDK configured with `dangerouslyAllowBrowser: true` for client-side usage
- Streaming responses handled via OpenAI's streaming API
- Model selection persisted in localStorage
- MSW (Mock Service Worker) used for testing API calls (`src/mocks/`)

## Commands

### Development
```bash
npm run dev          # Start dev server at http://127.0.0.1:5173
npm run build        # TypeScript compilation + Vite build
npm run preview      # Preview production build at http://127.0.0.1:4173
npm run lint         # ESLint with TypeScript
```

### Testing
```bash
npm test             # Run Vitest unit tests
npm run test:e2e     # Run Playwright e2e tests (builds app first)
```

#### Running Single Tests
```bash
npx vitest run src/path/to/test.test.ts        # Single unit test file
npx playwright test e2e/welcome.spec.ts         # Single e2e test file
```

### Test Configuration
- **Vitest**: Uses jsdom environment, setup at `src/test/setup.ts` with MSW server
- **Playwright**: Runs against preview server (port 4173), tests in `e2e/` directory
- **MSW Handlers**: Mock OpenAI API endpoints at `src/mocks/handlers.ts`

## UI Components

Uses shadcn/ui component pattern with path alias `@/` -> `./src/`:
- Components in `src/components/ui/`
- Tailwind CSS variables defined in `src/index.css` using CSS custom properties
- Styling uses `cn()` utility from `src/lib/utils.ts` (clsx + tailwind-merge)

## Styling System

Using Tailwind CSS v4 with Vite plugin:
- Theme colors defined as CSS custom properties (HSL values)
- No `@apply` directives (removed for v4 compatibility)
- CSS theme configuration in `src/index.css`

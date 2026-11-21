# Dependencies

This document tracks all approved dependencies for Thread Messenger. Builders must not add new runtime or development dependencies without documenting them here with rationale.

## Production Dependencies

| Package | Version | Purpose |
| :--- | :--- | :--- |
| `react` | `^18.3.1` | Core UI library |
| `react-dom` | `^18.3.1` | React DOM renderer |
| `@supabase/supabase-js` | `^2.49.1` | Official client for Supabase Auth, PostgreSQL PostgREST API, and Realtime WebSocket changes |
| `react-router-dom` | `^7.18.6` | Client-side routing for `/chats`, `/chats/:conversationId`, `/chats/new`, `/login`, etc. |
| `lucide-react` | `^1.77.0` | Accessible SVG icons for navigation, message states, modals, and actions |

## Development Dependencies

| Package | Version | Purpose |
| :--- | :--- | :--- |
| `vite` | `^6.2.0` | Frontend build tool and development server |
| `@vitejs/plugin-react` | `^4.3.4` | Vite plugin for React JSX/TSX compilation and Fast Refresh |
| `typescript` | `^5.8.2` | Static type checking and compiler |
| `@types/react` | `^18.3.18` | TypeScript definitions for React |
| `@types/react-dom` | `^18.3.5` | TypeScript definitions for React DOM |
| `@types/node` | `^22.13.9` | TypeScript definitions for Node.js runtime and testing |
| `tailwindcss` | `^3.4.17` | Utility-first CSS framework for styling |
| `postcss` | `^8.5.3` | Tool for transforming CSS with plugins |
| `autoprefixer` | `^10.4.20` | PostCSS plugin to parse CSS and add vendor prefixes |
| `vitest` | `^3.0.7` | Fast unit and integration test runner compatible with Vite |
| `eslint` | `^8.57.1` | Static code analysis and linting |
| `@typescript-eslint/eslint-plugin` | `^8.26.0` | TypeScript-specific linting rules |
| `@typescript-eslint/parser` | `^8.26.0` | ESLint parser for TypeScript AST |
| `eslint-plugin-react-hooks` | `^5.1.0` | ESLint enforcement of React Hooks rules |
| `ws` | `^8.18.1` | WebSocket implementation for Node.js integration test runner (Node < 22) |
| `@types/ws` | `^8.18.0` | TypeScript definitions for `ws` |
| `vite-plugin-pwa` | `^2.0.0` | PWA options type and service worker manifest support |
| `@playwright/test` | `^1.65.1` | End-to-end browser testing framework for client flows in mock mode |

# Scripts & E2E Testing Guide

This directory documents how to execute operator utilities and browser-based end-to-end tests for Thread Messenger.

> **Hard Security Rule**: Never commit, log, or hard-code secrets into the repository or client-side bundles. Environment variables must be supplied at runtime only.

---

## 1. Review User Reports CLI (`scripts/review-reports.mjs`)

A lightweight Node CLI for the project owner to inspect user reports and moderation requests.

### Prerequisites
- Node.js (v18+)
- Environment variables:
  - `SUPABASE_URL`: The Supabase project API URL.
  - `SUPABASE_SERVICE_ROLE_KEY`: The administrative service-role secret key (bypasses RLS to query the private `public.reports` table).

### Commands

**macOS / Linux (bash/zsh):**
```bash
SUPABASE_URL="https://your-project.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
node scripts/review-reports.mjs
```

**Windows (PowerShell):**
```powershell
$env:SUPABASE_URL = "https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key"
node scripts/review-reports.mjs
```

**Custom Limit Flag (`--limit`):**
```bash
node scripts/review-reports.mjs --limit 50
```

**Local Supabase Environment:**
```bash
SUPABASE_URL="http://127.0.0.1:54321" \
SUPABASE_SERVICE_ROLE_KEY="<local_service_role_key_from_supabase_status>" \
node scripts/review-reports.mjs
```

### Output Table Format
The tool prints the latest reports matching the specified limit:
- `created_at`: ISO timestamp of the report.
- `reporter username`: `@username` handle of the reporting user.
- `reported username`: `@username` handle of the reported user or message sender.
- `reported message text`: Message content (truncated to 120 characters) or `[no message]`.
- `reason`: Explanation submitted with the report.

---

## 2. Playwright E2E Test Suite (`tests/e2e/`)

Runs end-to-end tests in simulated mock mode (`VITE_USE_MOCK_API=true`), verifying user journeys without live backend dependencies.

### Prerequisites
- Install dependencies:
  ```bash
  npm install
  ```
- Install Playwright browsers (first-time setup):
  ```bash
  npx playwright install chromium
  ```

### Commands

**Run all E2E tests:**
```bash
npm run test:e2e
```
*(or directly with Playwright CLI:)*
```bash
npx playwright test -c tests/e2e/playwright.config.ts
```

**Run with visual UI mode (interactive debugging):**
```bash
npx playwright test -c tests/e2e/playwright.config.ts --ui
```

**Run in headed browser:**
```bash
npx playwright test -c tests/e2e/playwright.config.ts --headed
```

**View HTML test execution report:**
```bash
npx playwright show-report
```

### Coverage
The suite exercises:
1. **Landing Page**: Verifies tagline, three feature bullets, honest unencrypted message disclosure, and CTA.
2. **Sign In**: Simulates mock Google OAuth login.
3. **Choose Username**: Asserts inline validation (length limits, invalid characters) and successful handle claim.
4. **Chat List**: Validates loaded seeded conversations and username copy button.
5. **Messaging**: Optimistic send state transitions from `· sending...` to `· sent`.
6. **Rate Limiting**: Simulates `/fail-rate` trigger and verifies the friendly UI alert.
7. **Blocking**: Opens conversation actions dropdown, blocks user via modal dialog, confirms redirect.
8. **Settings**: Displays blocked users, executes unblock, and updates list state.
9. **Sign Out**: Clears session and returns to the landing page.

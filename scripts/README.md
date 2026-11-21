# Review user reports

Needs Node.js and SUPABASE_URL plus SUPABASE_SERVICE_ROLE_KEY already set in the shell environment. The owner-only script reads public.reports and joins profiles and messages using the repository foreign keys. No credentials belong in this repository.

node scripts/review-reports.mjs
node scripts/review-reports.mjs --limit 50

# Run end-to-end tests

Needs the @playwright/test development dependency and Chromium. The Playwright webServer starts npm run dev with VITE_USE_MOCK_API=true.

npm ci
npx playwright install chromium
npx playwright test --config=tests/e2e/playwright.config.ts

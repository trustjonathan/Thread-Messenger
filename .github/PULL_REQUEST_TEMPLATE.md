## Summary

<!-- What changed and why? Keep it short. -->

## Linked issue

<!-- Use "Closes #123" when the PR fully resolves the issue, otherwise "Refs #123". -->

## Area touched

- [ ] UI
- [ ] Tests
- [ ] Docs
- [ ] Backend contract (needs maintainer approval and the `contract` label)

## Contract check

- [ ] I did not edit `supabase/migrations/*`, `src/types/*`, `src/lib/api.ts`, `src/lib/apiClient.ts`, or `.env.example`.
- [ ] All backend calls in app code go through `@/lib/apiClient`.
- [ ] Any new backend/schema need is described in `NEEDS_API.md` or in the linked issue for a maintainer to add.

If you checked "Backend contract" above, stop and confirm approval before requesting review — the Contract Guard workflow will block the PR without the `contract` label.

## Tests run

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] `npm run test:integration` (local Supabase stack)
- [ ] `npm run test:e2e` (browser journeys / PWA)
- [ ] RLS or API smoke scripts, if relevant
- [ ] `npm run build`

Commands actually run (include output details for anything that failed or could not run):

<!-- e.g. npm run typecheck && npm run lint && npm run test && npm run build -->

## Screenshots (UI changes only)

<!-- Before/after images or a short screen recording. Remove personal data first. -->

- [ ] Not applicable — no UI changes

## Accessibility check

- [ ] Interactive elements have accessible names/labels.
- [ ] Keyboard focus is visible and dialogs/menus can be used with the keyboard.
- [ ] Color/dark-mode changes keep adequate contrast.

<!-- Anything reviewers should know? -->

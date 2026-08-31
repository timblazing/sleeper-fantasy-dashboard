# Plan 003: Add API route boundary coverage

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 318cc17..HEAD -- src/app/api/leagues/route.ts 'src/app/api/leagues/[leagueId]/players/route.ts' src/app/api/avatar/route.ts src/lib/account-lookup.ts src/lib/player-market.ts src/lib/utils.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `318cc17`, 2026-08-31

## Why this matters

The application has four API routes, but only the trade route has direct route-level tests. The three remaining public boundaries handle user input, external data, and binary proxy responses; regressions there would not be caught by the existing library tests. Add focused tests around validation, success, and upstream-failure behavior without changing route implementation or making network calls.

## Current state

- `src/app/api/leagues/route.ts:4-18` accepts a `username` query parameter, rejects empty or overlong input with 400, calls `getNflLeaguesForUsername`, maps no leagues to 404, and classifies thrown failures through `classifyLookupFailure`.
- `src/app/api/leagues/[leagueId]/players/route.ts:4-21` validates the dynamic league ID with `isLeagueId`, requires a non-empty query of at most 80 characters, calls `searchMarketPlayers`, and maps failures to a generic 503.
- `src/app/api/avatar/route.ts:6-23` accepts only a hexadecimal avatar ID up to 64 characters, fetches the fixed Sleeper CDN URL returned by `leagueAvatarUrl`, maps non-OK/no-body results to 404, and returns the upstream body with content type and immutable cache headers.
- Existing tests use Vitest and module mocking. `src/lib/trade-lab.test.ts:39-43` dynamically imports a route after `vi.doMock`, while `src/components/connect-account-dialog.test.tsx:33` verifies the `/api/leagues?username=...` client contract. Follow the dynamic route-import approach for server route tests so real upstream modules are never called.
- `src/lib/account-lookup.test.ts` already covers `classifyLookupFailure`; route tests should verify that the route uses those results, not duplicate every classifier case.
- The route directory currently contains only `route.ts` files; create sibling test files under each route directory. Vitest includes `src/**/*.test.ts`, so no config change is needed.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| League route tests | `bun run test -- 'src/app/api/leagues/route.test.ts'` | All league lookup route tests pass |
| Player route tests | `bun run test -- 'src/app/api/leagues/[leagueId]/players/route.test.ts'` | All player search route tests pass |
| Avatar route tests | `bun run test -- 'src/app/api/avatar/route.test.ts'` | All avatar proxy route tests pass |
| Typecheck | `bun run typecheck` | Exit 0 with no TypeScript errors |
| Lint | `bun run lint` | Exit 0; existing warnings in `.agents/skills` may remain |
| Full tests | `bun run test` | All tests pass |

## Scope

**In scope** (the only files to create or modify):

- `src/app/api/leagues/route.test.ts` (create)
- `src/app/api/leagues/[leagueId]/players/route.test.ts` (create)
- `src/app/api/avatar/route.test.ts` (create)

**Out of scope** (do not touch):

- All route implementations and shared library code.
- `src/lib/account-lookup.test.ts`, `src/lib/trade-lab.test.ts`, and component tests; reuse their patterns but do not duplicate or rewrite them.
- Vitest configuration, network access, snapshots, and browser/E2E tooling.

## Git workflow

- Branch: `codex/003-api-route-boundary-tests` if a branch is needed.
- Match the repository's short imperative commit style if committing.
- Do not push or open a PR unless the operator explicitly instructs you to.

## Steps

### Step 1: Add `/api/leagues` route tests

Create `src/app/api/leagues/route.test.ts`. Mock `@/lib/sleeper` before dynamically importing the route and provide a helper that constructs a `Request` with a configurable URL. Cover:

1. missing username returns 400 and does not call `getNflLeaguesForUsername`;
2. a username longer than 50 characters returns 400 and does not call the dependency;
3. a successful account returns 200 with the account JSON;
4. an account with no leagues returns 404 with the existing no-leagues message;
5. a classifier result for a not-found error produces the classifier's 404 message;
6. an unavailable/upstream error produces the classifier's 503 response.

Assert both status and the relevant JSON payload. Do not call the real Sleeper API.

**Verify**: `bun run test -- 'src/app/api/leagues/route.test.ts'` → all new league route tests pass.

### Step 2: Add league player-search route tests

Create `src/app/api/leagues/[leagueId]/players/route.test.ts`. Mock `@/lib/player-market` and dynamically import the route. Pass the route context as `{ params: Promise.resolve({ leagueId }) }`. Cover:

1. an invalid league ID returns 400 without calling `searchMarketPlayers`;
2. a missing/empty query returns 400 without calling the dependency;
3. a query longer than 80 characters returns 400 without calling the dependency;
4. a valid request calls `searchMarketPlayers` with the exact league ID and trimmed query, then returns `{ players }` with 200;
5. a rejected dependency returns 503 with the existing generic error and does not expose the rejection message.

Use the existing `isLeagueId` contract; do not add new validation rules in this test plan.

**Verify**: `bun run test -- 'src/app/api/leagues/[leagueId]/players/route.test.ts'` → all new player-search route tests pass.

### Step 3: Add avatar proxy route tests

Create `src/app/api/avatar/route.test.ts`. Mock `globalThis.fetch` with `vi.stubGlobal` or `vi.spyOn` and restore it after each test. Cover:

1. missing, empty, non-hex, and overlong IDs return 400 without calling fetch;
2. a valid ID calls the fixed avatar URL generated by `leagueAvatarUrl` and returns the upstream body with the upstream content type and `cache-control: public, max-age=86400, immutable`;
3. a non-OK upstream response returns 404;
4. an OK response with no body returns 404.

Use a small `Response` body in memory. Do not make a real CDN request. If testing a rejected fetch, first confirm the route's current uncaught rejection behavior; do not change the route implementation under this tests-only plan. If the desired behavior is to map network rejection to a response, stop and report it as a separate bug plan.

**Verify**: `bun run test -- 'src/app/api/avatar/route.test.ts'` → all new avatar route tests pass.

### Step 4: Run application gates and inspect scope

Run typecheck, lint, full tests, and `git diff --check`. Confirm test files contain no live URLs, secrets, sleeps, or assertions that merely check a mock's own return value without exercising the route branch.

**Verify**: `bun run typecheck && bun run lint && bun run test && git diff --check` → all commands exit 0 and the diff check is clean.

## Test plan

- Three route-sibling test files cover all currently untested public route boundaries.
- Each route has validation, success, and failure coverage; each external dependency is mocked before dynamic import.
- Preserve the existing tests for `classifyLookupFailure`, `isLeagueId`, `trade` route behavior, and the connect dialog's URL contract.
- Verification: run each focused command, then `bun run test`.

## Done criteria

- [ ] `/api/leagues` has direct tests for input validation, success, empty result, and classified failures.
- [ ] `/api/leagues/[leagueId]/players` has direct tests for league/query validation, success, and dependency failure.
- [ ] `/api/avatar` has direct tests for ID validation, successful proxy headers/body, and upstream 404/no-body behavior.
- [ ] No test performs a real network request.
- [ ] `bun run typecheck` exits 0.
- [ ] `bun run lint` exits 0.
- [ ] `bun run test` exits 0.
- [ ] Only the three in-scope test files and the status update in `plans/README.md` are modified.

## STOP conditions

Stop and report back if:

- A route's current behavior differs from the excerpts enough that the test would encode a new implementation decision rather than characterize existing behavior.
- A test requires changing production code, adding a dependency, changing Vitest configuration, or making a network request.
- The avatar route's rejected-fetch behavior cannot be tested without deciding a new error response; report that separately.
- A mock leaks between tests or requires order-dependent cleanup.
- Any verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- Keep route tests next to the route they protect so changes to status codes, validation limits, and response headers are visible in the same diff.
- When adding a new API route, add direct boundary tests for invalid input, successful dependency mapping, and dependency failure before relying on library tests.
- Reviewers should ensure tests assert the public contract without copying implementation internals or making the external services part of CI.
- This plan intentionally does not add browser/E2E coverage; the route contracts are deterministic and cheaper to protect at the server boundary.

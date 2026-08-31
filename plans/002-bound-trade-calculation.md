# Plan 002: Bound public trade-calculation requests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 318cc17..HEAD -- src/app/api/roster-audit/trade/route.ts src/lib/roster-audit/client.ts src/lib/roster-audit/endpoints.ts src/lib/trade-lab.ts src/lib/trade-lab.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `318cc17`, 2026-08-31

## Why this matters

`POST /api/roster-audit/trade` is a public route with schema validation but no application-level request throttling. A caller can repeatedly invoke it and make the server spend the RosterAudit key's upstream trade quota; the current code comments identify that endpoint as rate-limited to 120 requests per hour with a key. Add a bounded, testable request guard before `evaluateTrade` so bursts are limited per client identity, while keeping the existing 400/429/503/200 response contract intact. Because the repository does not identify a shared deployment store, the application guard is a best-effort in-process layer and must be documented as such; a platform/edge limiter remains the stronger production control.

## Current state

- `src/app/api/roster-audit/trade/route.ts:30-49` parses the body, validates `leagueId` and both asset sides, then calls `evaluateTrade` for every valid request. There is no check before line 40 that limits callers or concurrent work.
- `src/lib/roster-audit/client.ts:24-34` reads the server-only `ROSTERAUDIT_API_KEY` and attaches it to the upstream POST request. The key never goes to the browser, but the public route can cause it to be used.
- `src/lib/roster-audit/endpoints.ts:96-107` sends the rate-limited `/trade/calculate` request with `ttl: 0` and no retry, so upstream protection alone does not prevent a client from consuming the quota.
- `src/lib/trade-lab.ts:66-69` derives league settings server-side and calls `calculateTrade`; do not move settings trust back to the client.
- Existing `src/lib/trade-lab.test.ts:36-77` dynamically imports the route and mocks `@/lib/trade-lab`. It already verifies invalid bodies, settings stripping, rate-limit mapping, and missing-key mapping. Extend this structure rather than introducing a second route harness.
- The route already caps each side at 12 assets and each player ID at 32 characters. Keep those limits. The limiter should run after body validation so malformed traffic does not consume the valid-request budget, and before `evaluateTrade` so rejected requests do not reach Sleeper or RosterAudit.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused tests | `bun run test -- src/lib/trade-lab.test.ts` | All route and trade-lab tests pass, including limiter cases |
| Typecheck | `bun run typecheck` | Exit 0 with no TypeScript errors |
| Lint | `bun run lint` | Exit 0; existing warnings in `.agents/skills` may remain |
| Full tests | `bun run test` | All tests pass |

## Scope

**In scope** (the only files to modify):

- `src/app/api/roster-audit/trade/route.ts`
- `src/lib/trade-lab.test.ts`
- `src/lib/request-rate-limit.ts` (create)
- `src/lib/request-rate-limit.test.ts` (create)

**Out of scope** (do not touch):

- `src/lib/roster-audit/client.ts` and `src/lib/roster-audit/endpoints.ts` — preserve server-only key handling and upstream request semantics.
- `src/lib/trade-lab.ts` — preserve server-derived league settings.
- `next.config.ts`, middleware, authentication, billing, or deployment-provider configuration. If production requires a shared limiter, report that as a separate follow-up rather than inventing a provider integration.
- Any change to the request body or success/error response shapes.

## Git workflow

- Branch: `codex/002-bound-trade-calculation` if a branch is needed.
- Match the repository's short imperative commit style if committing.
- Do not push or open a PR unless the operator explicitly instructs you to.

## Steps

### Step 1: Add a bounded, injectable in-process limiter

Create `src/lib/request-rate-limit.ts` with a small helper that accepts a request key and an optional timestamp, returns whether the request is allowed, and maintains a bounded map of recent valid-request timestamps. Use a sliding window or token-bucket implementation with these fixed defaults:

- window: 10 minutes;
- maximum: 20 accepted requests per key per window;
- stale-entry cleanup and a hard maximum map size so attacker-controlled keys cannot grow memory without bound.

Expose a reset/clear function only for tests if needed; do not expose internal state. The helper must not log keys or request contents. Derive the key in the route from the platform-provided client address: prefer the first valid address in `x-forwarded-for`, then `x-real-ip`, then the literal `anonymous`. Treat headers as hints, not authentication; this is an application guard, not a claim of strong identity.

**Verify**: `bun run test -- src/lib/request-rate-limit.test.ts` → the new helper tests pass once added in Step 2.

### Step 2: Test limiter behavior without waiting in real time

Create `src/lib/request-rate-limit.test.ts` using the repository's Vitest style. Cover:

1. the first request is accepted;
2. requests up to the configured maximum are accepted;
3. the next request in the same window is rejected;
4. advancing the supplied timestamp beyond the window allows a new request;
5. stale keys are evicted and the map remains bounded;
6. distinct keys have independent budgets.

Use explicit timestamps or a supplied clock; do not use real sleeps or global fake timers unless the helper cannot be tested otherwise.

**Verify**: `bun run test -- src/lib/request-rate-limit.test.ts` → all new limiter tests pass.

### Step 3: Enforce the guard in the trade route

In `src/app/api/roster-audit/trade/route.ts`, call the existing `request.json().catch(...)` and `requestSchema.safeParse(...)` first. For a valid body, derive the request key from the request headers and call the limiter immediately before `evaluateTrade`. If rejected, return `Response.json({ error: "Trade calculations are temporarily limited. Try again shortly." }, { status: 429, headers: { "retry-after": "600" } })` without calling `evaluateTrade`.

Keep the existing upstream `rate-limited` branch and message unchanged for requests that pass the local guard but are rejected by RosterAudit. Do not include the client key, API key, upstream message, or request body in the response.

**Verify**: `bun run test -- src/lib/trade-lab.test.ts` → existing mapping tests pass and the route-level limiter test added in Step 4 confirms the mocked evaluator is not called after the local budget is exhausted.

### Step 4: Add route-level regression coverage

Extend `src/lib/trade-lab.test.ts` with tests that:

1. send valid requests from one client address until the local limit is reached and assert the next response is 429 with a `retry-after` header;
2. assert `evaluateTrade` is not called for the locally rejected request;
3. assert an invalid body still returns 400 and does not consume the limiter budget;
4. assert a different client address has an independent budget.

Reset the limiter between tests through its test-only reset function or another explicit injection seam. Do not let tests depend on execution order or on state left by another test.

**Verify**: `bun run test -- src/lib/trade-lab.test.ts` → all existing and new tests pass.

### Step 5: Run application gates and inspect scope

Run typecheck, lint, full tests, and `git diff --check`. Review the diff to ensure the limiter is only invoked after successful schema validation and before `evaluateTrade`, and that no secret or request payload is logged.

**Verify**: `bun run typecheck && bun run lint && bun run test && git diff --check` → all commands exit 0 and the diff check is clean.

## Test plan

- `src/lib/request-rate-limit.test.ts`: deterministic unit tests for window, capacity, key isolation, eviction, and bounded storage.
- `src/lib/trade-lab.test.ts`: route integration-style tests with mocked `evaluateTrade`, modeled after the existing dynamic route import helper.
- Preserve existing tests for validation, client-supplied settings being ignored, upstream 429 mapping, and missing-key mapping.
- Verification: focused helper and route commands, followed by `bun run test`.

## Done criteria

- [ ] Valid trade requests are locally limited to 20 accepted requests per client key per 10-minute window.
- [ ] Invalid requests do not consume the valid-request budget.
- [ ] Locally rejected requests return 429 with `retry-after: 600` and do not call `evaluateTrade`.
- [ ] Existing upstream error mapping and request/response shapes remain unchanged.
- [ ] Limiter memory is bounded and stale keys are removed.
- [ ] `bun run typecheck` exits 0.
- [ ] `bun run lint` exits 0.
- [ ] `bun run test` exits 0.
- [ ] Only the four in-scope files and the status update in `plans/README.md` are modified.

## STOP conditions

Stop and report back if:

- The deployment supplies no usable request headers and the implementation would need to trust an unverified client-controlled identity for security-critical enforcement.
- The requested protection requires a shared Redis/edge/provider service or a change to deployment configuration; that is outside this plan.
- The route's existing response shape or server-side settings derivation would need to change.
- Tests become order-dependent or require real time delays.
- Any verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- An in-process limiter resets on process restart and is not shared across instances. Production owners should add an edge/platform limit at or below the same budget before treating this as the sole abuse control.
- Reviewers should inspect trusted-proxy assumptions around `x-forwarded-for`; never use an arbitrary user header as authentication.
- If the UI later increases automatic trade recalculation frequency, revisit the 20-per-10-minute budget and the client debounce together. Do not silently raise the limit without checking the upstream quota.
- This plan does not add authentication because the current app intentionally has no server session; authentication is a separate product decision.

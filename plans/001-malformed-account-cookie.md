# Plan 001: Make malformed account cookies fail closed

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 318cc17..HEAD -- src/lib/account-storage.ts src/lib/account-storage.test.ts src/app/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `318cc17`, 2026-08-31

## Why this matters

The remembered account is stored in a client-written cookie, so the server must treat its contents as untrusted input. A malformed percent escape currently throws from `decodeURIComponent` before the root page can render the connect dialog. The change should preserve valid encoded usernames and league IDs while converting every malformed cookie into `null`, which makes `/` continue normally without a remembered account.

## Current state

- `src/lib/account-storage.ts` owns the cookie format and parser. It currently decodes both cookie segments without catching decoding errors:

  ```ts
  export function parseStoredAccount(value: string | undefined): StoredAccount | null {
    if (!value) return null;
    const [username, leagueId] = value.split(":").map(decodeURIComponent);
    return username && leagueId && isLeagueId(leagueId) ? { username, leagueId } : null;
  }
  ```

  This is at `src/lib/account-storage.ts:17-20` in the planned baseline.
- `src/app/page.tsx:13-15` reads the request cookie and immediately calls `parseStoredAccount`; a thrown decode error therefore escapes the page before the normal `getShowcase()` path.
- `src/lib/league-id.ts:12-14` is the existing validation boundary for the league ID. Do not weaken or replace it.
- Existing tests in `src/lib/account-storage.test.ts` cover valid values, encoded colon/space usernames, undefined/empty values, and unsafe decoded league IDs, but not malformed percent-encoding.
- Match the repository's existing Vitest style: imports from `vitest`, `describe` blocks around one pure function, and direct `expect(...).toEqual`/`toBeNull` assertions. Keep the parser pure and do not introduce a new dependency.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused tests | `bun run test -- src/lib/account-storage.test.ts` | All account-storage tests pass, including the new malformed-input cases |
| Typecheck | `bun run typecheck` | Exit 0 with no TypeScript errors |
| Lint | `bun run lint` | Exit 0; existing warnings in `.agents/skills` may remain |
| Full tests | `bun run test` | 367 baseline tests plus new tests pass, with no failures |

## Scope

**In scope** (the only files to modify):

- `src/lib/account-storage.ts`
- `src/lib/account-storage.test.ts`

**Out of scope** (do not touch):

- `src/app/page.tsx` — its caller is already correctly using the parser; the fix belongs at the parser boundary.
- `src/lib/league-id.ts` — its validation rule is an established security boundary.
- Cookie attributes, account persistence format, redirects, or any UI copy.

## Git workflow

- Branch: `codex/001-malformed-account-cookie` if a branch is needed.
- The repository uses short imperative commit subjects such as `Lead the README with screenshots`; match that style if committing.
- Do not push or open a PR unless the operator explicitly instructs you to.

## Steps

### Step 1: Make decoding total and fail closed

Update `parseStoredAccount` so malformed percent-encoding in either the username or league ID returns `null` rather than throwing. Preserve the existing behavior for valid values: split the cookie at the first format delimiter as currently intended, decode the stored segments, require both non-empty segments, and continue to call `isLeagueId` on the decoded league ID. Do not catch errors outside this parser or return partially decoded account data.

**Verify**: `bun run test -- src/lib/account-storage.test.ts` → existing tests pass before adding the new regression cases.

### Step 2: Add regression tests for malformed cookie values

Extend `src/lib/account-storage.test.ts` with at least these cases:

1. A malformed percent escape in the username returns `null` and does not throw.
2. A malformed percent escape in the league ID returns `null` and does not throw.
3. A value with a valid username but no valid league segment returns `null`.

Use `expect(() => parseStoredAccount(...)).not.toThrow()` together with `expect(parseStoredAccount(...)).toBeNull()` where useful. Keep the existing valid encoded-colon and encoded-space tests unchanged.

**Verify**: `bun run test -- src/lib/account-storage.test.ts` → all existing and new tests pass.

### Step 3: Run the application gates

Run the typecheck and lint commands, then the full test suite. Inspect `git diff --check` for whitespace errors and `git status --short` to confirm that only the two in-scope files changed.

**Verify**: `bun run typecheck && bun run lint && bun run test && git diff --check` → typecheck, lint, and tests exit 0; diff check is clean.

## Test plan

- Add malformed percent-encoding cases to `src/lib/account-storage.test.ts`, following the existing `describe("parseStoredAccount")` block.
- Preserve coverage of valid encoded delimiters and unsafe league IDs so the defensive guard does not regress into rejecting legitimate usernames or accepting redirect/path payloads.
- Verification: `bun run test -- src/lib/account-storage.test.ts` and then `bun run test` must pass.

## Done criteria

- [ ] `parseStoredAccount` never throws for arbitrary string input supplied as a cookie value.
- [ ] Malformed username or league ID encoding returns `null`.
- [ ] Existing valid and unsafe-input tests remain passing.
- [ ] `bun run typecheck` exits 0.
- [ ] `bun run lint` exits 0.
- [ ] `bun run test` exits 0.
- [ ] `git status --short` shows no modified files outside the two in-scope files and `plans/README.md` status is updated.

## STOP conditions

Stop and report back if:

- The parser no longer uses `isLeagueId` for the decoded league ID, or the valid encoded-colon test fails.
- The cookie format needs to change to fix the issue; this plan only hardens parsing of the existing format.
- Fixing the issue appears to require modifying a caller, cookie attributes, or any out-of-scope file.
- Any verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- Keep this parser as the single reader of `ACCOUNT_COOKIE`; future cookie-format changes must add malformed-input tests before changing the server redirect path.
- Reviewers should check that the catch boundary covers both decode operations and that no raw cookie content is logged or returned.
- This plan does not add cookie signing or server sessions; those are separate product/security decisions because the current cookie stores only routing context and the app has no server session.

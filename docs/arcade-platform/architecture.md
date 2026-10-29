# Arcade platform architecture

## Status and boundaries

On October 29, 2026, with owner approval, the Arcade database migrations were applied to Supabase project `ibiwrmcehgbjjnrebwnp` and `arcade-api` version 1 was deployed. Rewards, exchange, and competitive rankings remain disabled. Hosted Auth redirects, a 12-character password minimum, verified-domain Resend SMTP, and Turnstile CAPTCHA enforcement are saved. A real CAPTCHA/recovery request through the local frontend reached the owner's Gmail inbox. Broader live account-flow checks and scheduling remain pending. GitHub and the live website remain unchanged. See [release review](release-review.md) for the remaining deployment gates. The owner requires free services only; never purchase plans, upgrades, or add-ons.

The existing five-page static site and three Three.js games remain in place. GitHub Pages serves HTML, CSS, and JavaScript. Supabase supplies hosted Auth, PostgreSQL, and an Edge Function. No runtime server on the owner's computer is required. A temporary localhost server is only a development preview.

Account UI lives in `arcade.html`. Public Home, About, Projects, and Résumé pages do not load the account client. Each standalone game's common boot module verifies a signed-in, email-confirmed, non-anonymous user and an existing player profile before importing the game. This is an experience gate; JavaScript on static hosting is publicly downloadable. Data protection is enforced by database grants/RLS and server authorization.

## Files

- `js/arcade-platform/config.js`: browser-safe project URL and publishable key only.
- `js/arcade-platform/client.js`: one pinned Supabase SDK, PKCE Auth, checked RPC/function calls.
- `js/arcade-platform/account.js`: sign-in/up, verification resend, recovery, profile/privacy, statistics, wallet/exchange, achievements, rankings, and deletion UI.
- `js/arcade-platform/vendor.js`: generated, committed browser SDK bundle for static deployment.
- `games/shared/services/ArcadeServices.js`: game gate, per-player storage, cloud save revisions, sessions, request retry, auth revocation, and pending shot recovery.
- `games/shared/services/golf-validator.js`: pure server-authoritative RipaGolf decisions and simulation.
- `supabase/functions/arcade-api/`: JWT-validated API, server simulation, deletion, generated physics bundle.
- `supabase/migrations/`: schema, grants, RLS, transactions, aggregates, configuration, and maintenance.
- `tests/arcade/`: isolated PostgreSQL, Edge, integration, and desktop/mobile browser tests.

## Database model

All exposed tables enable RLS. Browsers receive owner-only SELECT on private records and SELECT on game/statistic/achievement/period catalogs. No direct INSERT, UPDATE, or DELETE privileges are granted to browsers. Narrow RPCs are explicitly granted to authenticated users; all service operations and private helpers revoke default PUBLIC execution. SECURITY DEFINER RPCs deliberately implement controlled writes, pin an empty search path, qualify objects, and check identity/ownership. `arcade_private` is not exposed through the Data API.

| Table | Purpose |
| --- | --- |
| arcade_profiles | Unique case-insensitive username, independent public-profile and ranking consent, administrative ranking suspension |
| arcade_games | Registry, category, validator version, enabled/competitive switches |
| arcade_saves | Owner-only, size-limited, explicitly unverified preference/presentation saves with compare-and-swap revisions |
| arcade_sessions | Server-issued seed, one active session per user/game, immutable validator version, revision, state, expiry |
| arcade_events | Server decision audit, sequence and idempotency key, original request and response |
| arcade_stat_definitions | Registered sum/max/min aggregation and ascending/descending ranking definitions |
| arcade_stats | Preaggregated owner/game/statistic/period records, separate verified and practice rows |
| arcade_periods | UTC all-time/week/month periods, historical freeze and optional explicitly configured seasons |
| arcade_achievement_definitions / arcade_achievements | Existing golf streak milestones, unique validated unlocks |
| arcade_wallets | Spendable points, casino chips, lifetime earned, lifetime spent as separate integers |
| arcade_operations / arcade_ledger | Idempotent operations and immutable-by-API currency deltas/balances |
| arcade_casino_rounds | Dormant open/settled/refunded lifecycle, stake/payout and trusted outcome |
| arcade_casino_stats | Overall/per-game/per-period round, win, stake, payout, refund, streak and net-winnings rollups |
| private economy_config / reward_rules | Disabled-until-approved rates, exchange limits, metric-based event and daily reward caps |
| private rate_limits | Per-account fixed-minute request reservations; periodically pruned |

## Authentication and privacy

Supabase handles password hashing, registration, email verification, recovery, token refresh, and persistent sessions. The browser SDK uses PKCE and a distinct Arcade storage key. Password recovery returns to the Arcade. The account page does not infer successful registration from an existing account response. Public profiles and ranking participation default off. Public-profile RPCs return only permitted identity, verified records and achievements, never email, saves, wallets, or transactions.

Sensitive RPCs check `auth.users`, verified email, anonymous status, account bans, and the JWT session ID against `auth.sessions`. The Edge handler calls Auth `getUser`, then the session-checking RPC; an API key alone never identifies a player. Deletion additionally requires a recent password authentication method, revokes sessions and deletes the Auth user. Foreign-key cascades remove the player's platform data, including balances and ranking records. Profile visibility and leaderboard consent apply to historical results as well. Administrative ranking suspension excludes a player without exposing private information.

Access tokens/session material are stored by the official SDK in browser storage. This makes preventing XSS important. Account UI uses DOM text nodes rather than interpolated HTML. No secret/service-role keys are in the site. Privileged database access is limited to the Edge environment. Existing site-wide theme keys stay device-local. This implementation does not add a CSP or HTTP security headers; review host-compatible headers/CSP separately before public release.

## Game validation

RipaGolf uses a server-issued seed and versioned session. The player locks a prediction before shots. Each shot submits only a bounded club/power/aim/error/spin/shape/loft decision and a bounded wait. The server restores its own ball, simulates fixed 120 Hz physics, derives penalties/cup entry/strokes/results/streaks, and commits the next revision and derived statistics atomically. The browser animates and reconciles to the authoritative final state. Interrupted requests retain the same key and body for replay. Cloud/local presentation data cannot submit a position, score, achievement or reward.

This verifies game rules, not human input. An automated client can choose perfect inputs, inspect the public seeded course, or optimize shots. Rankings and reward rules remain disabled pending validation/rule review and hosted CPU/load tests. RipaGolf's existing run-score points are game score, not universal Arcade Points.

Cruise and Cutup currently use variable-frame browser simulation; Cutup traffic also uses uncontrolled randomness and graphics/traffic settings affect conditions. They record bounded, explicitly UNVERIFIED practice summaries, never competitive rewards/achievements/rankings. Restart, a Cutup crash, or Finish & Save Run closes the practice session. Closing a tab is not treated as a completed run. Do not enable their competitive switches until deterministic rules, replay verification, fairness and anti-AFK policies are approved and implemented.

Old device-wide local saves remain untouched and are not imported into wallets or rankings. New storage keys are isolated by player/game. Golf cloud restore uses authoritative session state for the course, ball, prediction and outcome; ordinary cloud save payloads are presentation/preferences, not proof of gameplay.

## Rankings and periods

Rank queries read aggregates, not all session history. Only verified records from opted-in, unsuspended players qualify, and definitions/game competitive switches must be enabled explicitly. Equal values share `rank()`; displayed ties use first attainment then stable player ID. Pages contain 25 players, with own rank and total. Ascending definitions support future best-time categories. Balances never determine progression ranks; the global metric is lifetime verified earned points.

Weeks start Monday at 00:00 UTC, months on the first at 00:00 UTC. Aggregation uses server transaction timestamps. Past period records are retained, and maintenance freezes completed periods. Changing privacy or deleting an account intentionally removes it from any visible period. Active seasonal rows can be created explicitly after approval; no seasons, resets or rewards are introduced by this migration. Wallets are independent of ranking periods.

## Economy and future casino

All currencies are integer, virtual and nonredeemable. A single wallet-row lock serializes every operation for an account, including both currencies. An exchange performs deduction, credit, immutable transaction recording and lifetime-spent update in one transaction. Repeated request keys return the prior operation; a different payload for the same key is rejected. Insufficient funds or errors roll everything back. Reward credits come only from trusted verified commits, approved per-game metric rules, event caps and serialized daily caps. Lifetime earnings stay separate when points are spent.

Casino operations are service-only, with no browser payout RPC. No casino registry entries, games or fabricated production results are created. Opening validates an enabled casino game with a validator and locks/deducts a stake. Settlement or refund transitions exactly once under the wallet/round locks; conflicting repeat outcomes fail. Refunds do not count as wins, stakes or payouts in performance totals. Net winnings exclude conversions, and a win means payout greater than stake (a returned stake is a push). A refund preserves the current streak. Win-rate minimum sample requirements and future ranked definitions need approval before activation.

Future casino games still require their own trusted decision/outcome handlers, cryptographically secure randomness where relevant, approved limits, recovery rules and policy/jurisdiction review. The scaffolding does not authorize an arbitrary caller to choose a payout. No purchases, real-money funding, cash prizes, crypto, redemption or player transfers are implemented.

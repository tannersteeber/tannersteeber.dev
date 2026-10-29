# Game integration contract

## Registering an Arcade game

1. Register the card in `games/library.js` with a stable ID and existing visual/theme conventions.
2. Add an additive migration for arcade_games and its statistic definitions. Start competitive_enabled and ranked definitions false. Never create a reward rule with guessed economics.
3. Use the shared boot module and assign `instance.platform`. Its gate requires a verified account/profile, scopes local saves to that player/game, and restores cloud revisions. Non-Arcade pages must not load this module.
4. Start a recognized session with a retained UUID request key. Explicitly replacing a session abandons the prior active session. Do not silently take over another device's active run. The current Play/New Run action explicitly starts a replacement; Resume restores the authoritative RipaGolf session.
5. Supply a versioned trusted validation strategy before enabling competitive records or rewards. For practice-only games, declare bounded metrics, implement runMetrics and use Finish & Save Run/restart/natural end. Practice data never enters verified records, public profiles, achievements or wallets.
6. A trusted handler must validate identity, active Auth session, game ownership, immutable validator version, session expiry/revision, allowed state transition, payload size and input bounds. It must persist a rate reservation before costly work. It derives outcomes and sends only authoritative metrics to the service-only commit RPC. Browser-supplied scores/outcomes are never forwarded as verified metrics.
7. Use stable idempotency keys for requests. Store the request before sending. Retry the same body/key after response loss; reject key reuse with changed content. Commit uses a row lock and revision check; do not overwrite another device's state. Recover conflicts by loading the current cloud state and explicitly discarding stale uncommitted input.
8. Aggregate only registered metrics, distinguishing additive counters and personal maxima/minima. SQL updates all-time, current UTC week/month and explicitly configured active seasons in the same transaction as the accepted event. Achievements derive only from these verified totals.
9. Reward activation needs approved statistic-based units, integer points and event/daily caps; it is independent of raw game score. Callers never choose the amount credited. Wallet APIs are shared and game code never writes balances.
10. Add deterministic logic, malicious input, duplicate request, ownership, conflict, concurrency and browser regression tests. Test the real hosted handler and CPU usage in staging before activation. Document bot/input limitations honestly.

## Current service API

- `requireArcade(game, root)` — verified player gate, cloud preferences and current run; null means the gate rendered recovery instructions.
- `platform.start(replace)` — recognized session; persisted start key survives a lost response.
- `platform.golf(operation, data)` — prediction, shot or next-hole decision, with persisted request key and revision.
- `platform.retry(task)` — blocks on connection errors until explicit retry, without inventing an offline reward/result.
- `platform.save()` — compare-and-swap unverified presentation/preferences snapshot; save conflicts require reload.
- `platform.practice(metrics)` — finalize a Cruise/Cutup practice session exactly once.
- `platform.abandon()` — explicitly end the active session without a reward.

Account code uses checked client reads, narrow RPCs and `invoke`. Account UI is never rendered over active gameplay; only an actionable network/auth failure overlay can interrupt it.

## Future casino handlers

There are no casino games or browser-accessible settlement endpoints. A future game must register an approved validator and implement server-side rounds and permitted decisions before its registry entry is enabled. Call service-only arcade_casino_open to debit the stake, then arcade_casino_settle once with the trusted outcome and payout or refund. Both operations serialize on the wallet row; round locks follow the same order. Repeated settlement returns the confirmed outcome; changed payout/refund/outcome requests fail.

Never let a request choose an arbitrary payout, seed a claimed win, or choose the randomness after betting. Use server cryptographic randomness and record enough information to audit/recover interrupted rounds. Define disconnect timeouts and refund conditions, stakes/payout limits, cancellation policy, and ranking eligibility before activation. A push returns the stake but is not a win. A refunded round is excluded from played/won/stake/payout performance totals, increments refund counts, and preserves the streak. Casino net winnings derive only from settled payouts minus settled stakes, not chip balance or Arcade exchanges.

The dormant casino rollup table has overall/per-game/per-period counters suitable for future net winnings, rounds won, maximum payout, and streak rankings. Approve minimum played-round eligibility for win rates and add only actual game categories/definitions; the UI currently explains that Casino rankings are unavailable. All-time/weekly/monthly/explicit-season period keys can be reused. No new season is implicitly launched and balances are never reset with periods.

## Versioning physics

The current validator identifier is golf-v1. Keep shared mathematical/physics source and generated Edge bundle in the same reviewed release. Changes affecting outcomes require a new validator version and a decision about existing active sessions (retain the old implementation until they expire, or explicitly close/reset them with an approved migration). Never silently replay a saved session under different rules.

The current RipaGolf browser first obtains a confirmed server result, then animates locally and reconciles the final ball/strokes. Server data wins after reload or interruption, including pending responses. It does not prove the client timing/error came from a human. Keep competitive/reward activation subject to the documented policy review.

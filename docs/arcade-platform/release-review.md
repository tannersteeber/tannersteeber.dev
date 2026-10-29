# Arcade platform release review

## Deployment status

On October 29, 2026, the owner approved applying the prepared migration and deploying the Edge Function. Both migrations are now recorded in hosted Supabase and `arcade-api` version 1 is active. All 18 application tables have RLS enabled; exchange, reward rules and competitive rankings remain off. Verified-domain SMTP and Turnstile enforcement are configured; a recovery email through the real local frontend and hosted Auth reached the owner's Gmail inbox. GitHub and the live website are unchanged. Remaining hosted release checks, scheduling, and website publication are still pending.

## Implemented

- Existing static site preserved; account UI stays in Arcade and direct game entries are gated.
- Email/password sign-in/up, verification resend, recovery, persistence and logout through the pinned official SDK.
- Player username, private-by-default public profile and independent ranking opt-in.
- Turnstile frontend widget and hosted enforcement, verified with a real recovery request and inbox receipt.
- Account password change, all-device logout and fresh-password-protected deletion.
- Cloud presentation/preferences saves with player/game storage isolation and revision conflicts.
- Private statistics, profiles, achievements, wallet/exchange and leaderboard UI using existing themes.
- Owner-scoped RLS, explicit grants and server-only game/casino operations.
- Versioned server sessions, bounded RipaGolf decision simulation, duplicate prevention and authoritative restore.
- Cruise/Cutup practice summaries and Finish & Save Run; competitive results/rewards remain disabled for these games.
- Integer wallets, independent lifetime earned/spent metrics, atomic idempotent exchange and auditable ledger.
- Configurable per-event/daily reward caps; reward rules and exchange start disabled with no invented rates.
- Indexed verified leaderboards, shared ties, own position, pagination, UTC historical periods and optional-season support.
- Dormant casino opening/settlement/refund/rollup contracts; no casino games, purchases or fake production data.
- Automated SQL security/logic tests, shared physics tests, Edge authorization tests, game integration tests and desktop/mobile browser tests.

## Approvals/configuration still needed

1. A separate free hosted staging resource for broader tests when available. The owner prohibits purchases, paid upgrades, and add-ons. Local isolated tests do not replace multi-connection concurrency testing.
2. Review email confirmation flags and authentication rate limits against the free provider's quota. SMTP, sender/DNS verification, and exact redirect URLs are already configured; email delivery is verified.
3. Repeat the account/CAPTCHA smoke test on the production domain after approved static-site publication. The real local-preview CAPTCHA and hosted recovery path already passed.
4. Hosted validation of registration, email confirmation/resend, recovery, expired/revoked sessions, password changes, deletion, cross-device saves and malicious/duplicate/concurrent wallet requests.
5. CPU/latency/load measurements for server golf simulation and abuse-control review. Browser tests use a mocked transport; no production users were created.
6. Approved per-game reward formulas/caps, exchange rate and eligibility/fairness rules. Until then points/chips remain zero and exchange is unavailable.
7. Competitive ranking activation decisions. Cruise/Cutup need deterministic replay/fairness work before activation; existing practice results must never be promoted automatically.
8. Privacy/retention/backup choices; moderation and correction procedures. A full administrative moderation UI and automatic correction/reversal engine are future work.
9. Database migration, Edge deployment, SMTP, and CAPTCHA setup were approved and completed. Separate website publication and scheduler configuration still require review. GitHub and the live site have not been changed.

## Test scope

Local verification on October 29, 2026: 51 Node/SQL/API/game checks and 12 desktop/mobile browser checks passed. The Edge Function passed Deno type checking with its frozen dependency lockfile. Dependency audit reported no known vulnerabilities at installation time.

Run `npm run check` and `npm run test:ui`. Node tests cover the existing engine/golf physics plus database grants/RLS, owner isolation, save conflicts, revoked sessions, forged writes, reward caps, ledger reconciliation, duplicate exchanges, deterministic ranking ties, privacy, seasons and casino settlement idempotency. Edge tests cover authentication/origins/size limits, ownership, revision conflicts, canonical request retries and fresh-password deletion. Browser tests cover desktop/mobile account flows, themes, direct-entry gates, public-page isolation, authenticated driving menus and a server-calculated golf shot through a mocked Supabase transport.

PGlite is a single embedded PostgreSQL connection: these tests validate SQL and retry behavior but do not claim real multi-connection lock-stress coverage. Mocked Edge/browser tests do not validate real email delivery. Separately, the real Turnstile widget, hosted CAPTCHA enforcement, and recovery email delivery were verified through the local frontend and owner-confirmed Gmail receipt. All destructive fixtures are isolated from the hosted project.

## Deployment order

Review → hosted staging configuration/migration/function → live integration/security/concurrency tests → final production approval → production backend/Auth setup → smoke tests → static GitHub Pages publish → monitor. Do not publish only the sign-in gate while the database/email backend is unavailable.

See [architecture](architecture.md), [operations](operations.md), and [game integration](game-integration.md) for exact boundaries and setup details.

## Hosted deployment verification — October 29, 2026

- Applied migrations: `20261029181545_arcade_platform`, `20261029181706_arcade_deployment_hardening`; local filenames match the remote history.
- Edge Function `arcade-api` version 1 is ACTIVE. The handler performs its own bearer-user and active-session validation.
- All 18 application tables have row-level security enabled. There are no player profiles or wallet transactions.
- Exchange is disabled; no enabled reward rules, competitive games, or ranked definitions exist.
- Anonymous wallet reads and privileged commit RPC calls return 401/permission denied. Requests with no user token or an invalid token are rejected. Browser preflight/origin handling was checked without creating accounts or game records.
- Added the two foreign-key indexes flagged by the performance advisor and removed unnecessary API execution privileges from Supabase's existing `rls_auto_enable` event-trigger helper. Its automatic RLS trigger remains installed.
- Remaining advisor notices: internal/event tables intentionally use default-deny RLS without browser policies; narrow authenticated SECURITY DEFINER RPCs intentionally check users/ownership and have pinned search paths; unused indexes are expected before traffic. See [RPC advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) and [default-deny RLS advisory](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- Auth leaked-password protection remains disabled and should be reviewed with email/CAPTCHA configuration: [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- The complete migration chain passed the six isolated database regression tests after deployment. Full signed-in hosted flows, email delivery and concurrency stress tests remain pending; no destructive tests were run against this hosted project.

## Hosted Auth setup progress — October 29, 2026

- Saved the production Site URL as `https://tannersteeber.dev/arcade.html`.
- Saved six exact redirect URLs: verification and `?recovery=1` paths on production, `http://127.0.0.1:8766`, and `http://localhost:8766`.
- Raised the hosted minimum password length from 6 to 12; the dashboard confirmed the settings update.
- Confirmed the project is on Free. Leaked-password protection requires Pro or above; no upgrade was purchased.
- Added Resend's DKIM TXT record and the `rsend`/`send` CNAME records in Porkbun. All three values were verified through public DNS; Resend marks the domain Verified. Existing GitHub Pages A and `www` records are preserved.
- Created the Managed `Tanner Steeber Arcade` Turnstile widget for `tannersteeber.dev`, `localhost`, and `127.0.0.1`; its public site key is configured in the frontend. The owner entered and saved its matching hosted secret.
- Created the `Supabase Arcade Auth SMTP` Resend API key with Sending access restricted to `tannersteeber.dev`. The owner entered and saved it in Supabase; no secret was saved to this repository.
- Reopened hosted SMTP settings and confirmed the saved sender `arcade@tannersteeber.dev`, name `Tanner Steeber Arcade`, host `smtp.resend.com`, port 465, username `resend`, and stored-password indication. Save changes is disabled with no pending edits.
- Reloaded Attack Protection and confirmed Turnstile with a stored masked secret. A live password-sign-in probe using a nonexistent `.invalid` test address, without a CAPTCHA token, returned HTTP 400 / `captcha_failed` / `request disallowed (no captcha_token found)`. No test account was created. This verifies enforcement, not successful challenge validation or email delivery.
- Verification after configuring the public site key: 51 core tests and 12 desktop/mobile UI tests passed. UI tests mock Cloudflare and Supabase; the new test confirms sign-in is blocked until verification and the token reaches the Auth request. The separate live recovery test below verifies real CAPTCHA and delivery.
- Live local-preview check: the real Turnstile widget displayed Success, and recovery requests completed with the expected confirmation message. The first authorized address had no Arcade account (verified with an existence-only query), so those generic responses did not establish email delivery. The owner then authorized testing their existing Gmail Arcade account. Its request produced a hosted Auth `user_recovery_requested` event and HTTP 200 with no reported error at `2026-10-29T22:53:43Z`; the real CAPTCHA token was accepted. The owner confirmed receipt in Gmail. The request originated in the in-app browser after Dia's native inputs proved unreliable; open its recovery link in the same browser for PKCE, or start a fresh recovery request in the browser you intend to use. No password was changed during this test.

The owner approved adding the three email DNS records, creating a sending-only Resend API key for Supabase, and creating the Managed Arcade Turnstile widget; these actions and the owner credential-entry handoff are complete. No paid subscriptions were purchased. The owner explicitly requires free services only: never purchase plans, upgrades, or add-ons. Both hosted settings and real CAPTCHA/recovery delivery are verified. Broader registration/confirmation/resend and signed-in game flows remain release checks; this setup does not by itself establish full launch readiness.

Dia automation intermittently loses window access. Its native Window menu's named browser window item restored control, followed by screenshot-based coordinate clicks when accessibility controls were stale. Re-observe after each action; an attempted click alone does not prove a setting saved.

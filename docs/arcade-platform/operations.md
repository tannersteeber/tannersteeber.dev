# Setup, deployment and operations

## Local checks

Use Node 22+ (implementation tested with Node 26). Run `npm ci`, `npm run check`, `npm run check:edge`, then `npx playwright install chromium`. Start a temporary static preview with `python3 -m http.server 8766 --bind 127.0.0.1`; in another terminal run `npm run test:ui`.

The SQL suite runs a real PostgreSQL engine through PGlite with isolated Auth fixtures and actual role/grant/RLS behavior. This needs no Docker, production data, or permanently running personal backend. It is not a hosted Supabase Auth test or proof of multi-connection lock behavior. Browser tests mock the Supabase HTTP transport; they verify the real SDK/UI/game integration, not live email delivery. The Edge handler is tested with injected clients. Hosted staging tests remain necessary before launch.

`npm run build` regenerates the committed browser SDK bundle and Edge golf physics from the existing source. The physics build replaces only the renderer-bound road module with its exact pure random/smoothstep functions. Existing game logic tests verify unchanged physics. Do not edit generated files manually. Keep the lockfile and generated artifacts in a deployment commit; GitHub Pages needs no Node server or framework build at runtime.

## Deployment status and remaining setup

Target project: `ibiwrmcehgbjjnrebwnp`. On October 29, 2026, the approved migrations `20261029181545_arcade_platform` and `20261029181706_arcade_deployment_hardening` were applied and `arcade-api` version 1 became active. Do not reapply these migrations. Remaining steps below concern Auth/email/CAPTCHA, hosted integration tests, monitoring and eventual website publication.

1. Use only free services; the owner explicitly prohibits purchases, paid upgrades, and add-ons. Use a separate free staging project for Auth/deployment/destructive/concurrency tests when available. Local PGlite tests are safe to repeat.
2. Review the complete migration and Edge handler. Apply the versioned migration to staging first using the Supabase CLI or MCP migration tool. Keep the remote migration history and local filename aligned. Do not repeatedly run the migration or paste pieces into production.
3. Configure Email Auth with confirmation enabled, anonymous signup disabled, minimum password length 12, suitable authentication rate limits, and exact redirect URLs. `supabase/config.toml` is a LOCAL configuration; it does not change hosted Auth settings.
4. Set the production Site URL to `https://tannersteeber.dev/arcade.html`. Allow these exact redirects: `https://tannersteeber.dev/arcade.html`, `https://tannersteeber.dev/arcade.html?recovery=1`. If www is actually served, add those two www paths. For development, add the same paths on `http://127.0.0.1:8766` and `http://localhost:8766`. Do not allow wildcard production redirects.
5. Configure custom SMTP or an approved Auth email hook, sender identity, and provider DNS records. Supabase's default email service is restricted and is unsuitable for public registration. The owner must supply the email provider/account. Test verification/resend/recovery in real email inboxes, including expired links and opening a PKCE link in another browser; if the verifier is unavailable, restart the flow in the original browser.
6. Enable CAPTCHA for public registration/recovery before launch. The Cloudflare Turnstile widget's public `turnstileSiteKey` and matching hosted secret are now configured, and enforcement is verified. Tokens are passed to sign-in, signup, recovery and resend calls. Do not silently disable an enforced Auth CAPTCHA to make tests pass. Confirm successful live flows before launch; see release review for current evidence.
7. Deploy `supabase/functions/arcade-api`. `verify_jwt=false` is deliberate: the handler validates the bearer token with Supabase Auth and checks the active Auth session itself. The function uses platform-provided SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY only on the server. Never copy the secret into HTML, a public environment variable, this repo, or chat. Verify those platform secrets exist on the target deployment. Browser origin allowlist lives in the handler; add staging origins explicitly.
8. `js/arcade-platform/config.js` contains only browser-safe values: target project URL, publishable client key, and public Turnstile site key. For staging, use staging values and rebuild/test there. The published site must use the intended production project values.
9. Run database security/performance advisors after deployment. Test anonymous requests, two users, forbidden direct writes, stale/expired/deleted sessions, duplicate keys, two concurrent exchanges, competing sessions, corrupted inputs and response-loss retry using staging accounts. Test ledger sums against balances. Test a real server-backed golf shot and measure Edge CPU and response latency on multiple devices.
10. After approval, schedule `public.arcade_maintenance()` daily with hosted pg_cron (or another managed scheduler). It freezes closed periods, removes rate buckets older than two days and removes expired sessions/events after 30 days. It retains summaries, wallets, ledgers and current saves until account deletion. No schedule is created automatically.
11. Review backups/exports and retention/privacy disclosures before collecting public users. Enable leaked-password protection if available on the chosen plan; review SMTP/IP abuse controls. Project cost, backups and provider setup are owner decisions.
12. Get final production approval, then apply the reviewed migration, deploy the function, configure hosted Auth, run hosted smoke tests and publish the static files to GitHub Pages. Do not push automatically. Do not publish the frontend gate ahead of a working backend/email setup.

Supabase CLI commands change over time; run `npx supabase --help` and the relevant subcommand's `--help` before use. Migration files are created by the pinned CLI. Do not use `db reset --linked` against production for testing. No repository connection in the Supabase dashboard is required for this architecture.

## Economy activation

Both exchange and reward rules start disabled. No rate or payout is presumed approved. After the owner approves a rule, add a NEW migration updating private configuration. A reward rule names a server-derived statistic, units per reward, integer points, a per-event cap, and a daily cap. Never use the raw golf run-score as currency automatically. Exchange configuration defines points/chips per unit and maximum exchange size. Verify conversions, repeated keys, overflow, insufficient funds, and concurrent requests on staging before enabling.

The exchange UI stores a pending key and amount locally and retries the same request. If a request was rejected definitively, the pending key can be removed through a reviewed recovery tool after confirming the transaction status. Do not issue a second key merely because a response was lost. Backend operations remain authoritative across devices.

Ranking activation is independent of rewards: approve game fairness/validation, set desired `ranked` definitions and the game's `competitive_enabled` switch in a reviewed migration. Global `arcade.points_earned` ranks verified lifetime earnings, never balance. No driving-game rankings should be enabled with the current browser simulation.

## Monitoring and limits

Read the current [Supabase pricing](https://supabase.com/pricing), [usage guide](https://supabase.com/docs/guides/platform/billing-on-supabase), and [Edge limits](https://supabase.com/docs/guides/functions/limits) before launch. Free-tier quotas and plan options can change. The plan inspected during assessment included 500 MB database, limited egress and Edge invocations, and inactivity pausing. There is no unlimited/free guarantee or automatic backup promise.

The site has no per-frame database writes or Realtime subscriptions. Saves are change-detected at 15-second intervals, with visibility-triggered best-effort saving. Golf sends a request for each discrete decision/shot. Leaderboards use indexed aggregates and 25-row pages; recent ledger fetches are limited to 25. Errors stop gameplay and expose explicit retry/reload recovery. A closed tab can lose unsynced presentation preferences; authoritative golf progress remains on the server.

Monitor database/ledger/event growth, Auth failures, SMTP delivery, 401/409/429 responses, Edge CPU/latency, rejected replay keys and unusual session rates. Per-account limits do not replace edge/IP protection against volumetric abuse or mass account creation. Rollback of a rejected transaction also rolls back its rate counter, so Auth/edge ingress controls are still needed. No expensive simulation runs before a separate persisted rate reservation. Repeated identical completed requests return cached results.

## Moderation and reconciliation

Suspend ranking participation through the administrative `ranking_suspended` column. Changing it is not available through the profile RPC. Invalidated historical results need an audited correction migration/job that rebuilds affected aggregates and reverses any linked wallet credits with explicit ledger adjustments. This release provides exclusion and immutable event history, not an automated moderation dashboard or a generic browser adjustment endpoint. Do not edit wallet balances directly. Retain an exported incident record and test corrections in staging.

For a lost exchange response, locate the owner/request key in arcade_operations; reconcile arcade_ledger totals by currency with arcade_wallets. For golf 409 conflicts, reload the authoritative run rather than overwriting another device. For a pending request, replay the same key/body. For an account backend schema error, verify migration history and grants. For login failures, inspect Auth logs, redirect allowlist, verification, SMTP, session revocation and CAPTCHA configuration; do not weaken RLS or expose a service key.

## References

- [Email Auth](https://supabase.com/docs/guides/auth/passwords)
- [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha)
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Edge authorization](https://supabase.com/docs/guides/functions/auth)
- [Supabase acceptable use](https://supabase.com/aup)

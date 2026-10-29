# tannersteeber.dev

Personal Portfolio Website - Tanner Steeber

## Versioning

The site is ever-growing, so it never reaches v1.0. It stays on `v0.9.x`, and the last number counts each release (v0.9.1, v0.9.2, ...).

Every entry in a project's update notes starts with one of three labels:

- **Feature** - New functionality, pages, or projects.
- **Update** - Design changes and improvements.
- **Patch** - Bug fixes and small corrections.

The `tannersteeber.dev` project card and homepage featured version track **website-only** releases. Keep navigation, page layouts, project cards, themes and the Arcade library interface there. Put gameplay, game controls, physics, in-game cameras, HUD, game visuals, saves and game-specific fixes in the relevant `games/library.js` entry instead. A shared game change belongs in each affected game's changelog, not the website history. Game changelogs use their own dated sections; do not assign website version numbers to games.

Site v0.9.6 and v0.9.7 retain brief website and library UI summaries in the project history. Their gameplay details are maintained separately in each game's update history.

Builds before the new scheme are kept in the update history as alpha (0.6 - 0.8) and early access (0.9 - 0.9.3).

## Arcade

Cruise and Cutup are original browser driving games built with a shared vanilla JavaScript/Three.js engine. RipaGolf adds procedural golf, gesture swings and virtual-point predictions. No build is required. See [game setup, controls and testing](games/README.md).

## Fonts

Retro uses locally hosted Pixelify Sans by the Pixelify Sans Project Authors, under the [SIL Open Font License](assets/fonts/PixelifySans-LICENSE.txt). The font is bundled in `assets/fonts/`; no external font service is required.

Digital Rain uses locally hosted Cascadia Code by Microsoft, under the [SIL Open Font License](assets/fonts/CascadiaCode-LICENSE.txt).

## Arcade account platform

The account-based Arcade implementation and its deployment checklist are documented in
[the platform architecture](docs/arcade-platform/architecture.md) and
[the release review](docs/arcade-platform/release-review.md).
Run `npm ci` and `npm run check` for local build/logic/security checks.
The approved Supabase schema and Edge Function are deployed, and SMTP and CAPTCHA
are configured. Remaining hosted integration checks and website publication are
tracked in the release review.

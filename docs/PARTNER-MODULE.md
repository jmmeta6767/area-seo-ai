# Partner and project module

Base: area-seo-ai main f61112c. Keep the public website and its data separate.

## Delivered
- P0: repository review; existing admin authentication and same-origin mutation gate.
- P1: partner registry, relationship, active state, publication consent and evidence note.
- P2: multiple projects per partner, actual equipment and location, original image URL/alt, project permission and sponsorship disclosure.
- P3: private noindex profile/project previews, deterministic Thai draft, JSON export and direct transfer into Article Workspace. Permission evidence is excluded from workspace data. Human metadata review and existing SEO audit remain required.
- P4 foundation: approval records retain project ID and SHA-256 source reference. Queue creation, human approval and publisher preflight reject withdrawn or changed sources. Source-read completion rechecks before package generation. Existing three-file public article package includes an escaped contractor/contact section with HTTPS links and sponsored rel/disclosure when applicable.
- Serialized database-first writes to the existing PostgreSQL state table, atomic local file fallback, corrupt-file failure and separate authenticated partner backup download.

## Remaining release phases
- P4: publish dedicated public profiles, maintain project/profile cross-links and add withdrawal/removal PR workflow for already-published content.
- P5: backlink inventory and bounded HTTPS link health checks, contact click measurement. Reciprocal links remain optional; no ranking guarantees.
- P6: staging browser/iPhone QA, live PostgreSQL verification, backup and production release gate before merge/deploy.

## Validation
`npm test` covers persistence, consent, HTTPS enforcement, sponsor links, concurrency, DB failure, corrupt-file preservation, HTTP authentication/CSRF, workspace and preview routes, approval withdrawal rejection, source changes, private evidence omission, escaped HTML and publisher rendering.

Optional browser workflow: `node tests/partners-browser.js` requires Playwright and CHROMIUM_PATH (default /usr/bin/chromium), runs the create/edit/draft/profile/workspace workflow at 390px and 1440px. Local execution was blocked by Chromium process-singleton socket permissions. No browser, Safari, live database or staging pass is claimed.

## Current limits
Single process, maximum 2,000 records per collection. Image references only; no upload. Partner backup is separate from full schema-v3 backup/restore and has no restore endpoint yet. Permission withdrawal blocks new drafts/approval/publisher package creation but cannot retract exported copies, already-open PRs or published pages. Review existing PRs and published content separately after withdrawal. External URLs are not fetched automatically. Dedicated profiles remain private admin previews; publishing runs through existing human-reviewed article PRs only. No production deployment has been performed.

## P4/P5 implementation — 25 November 2026

- Profile publishing produces an atomic five-file PR: partner UUID page, partners.html directory, portfolio discovery link, sitemap.xml and sitemap.template.xml. Consent is checked before branch/PR creation; private permission evidence is never included in public HTML. Existing manually-owned files are rejected. Profiles are limited to 50 consented projects.
- Profile withdrawal creates a separate reviewable PR deleting only the generated profile and removing its directory/sitemap entries. It refuses to overwrite a profile whose content hash changed after the last recorded publication. This does not retract independent article mentions, externally shared copies or already-open update PRs; those require review/cancellation separately.
- Backlink inventory records explicit public HTTPS source pages and AREA destination pages. On-demand checks use public DNS/IP guards, port 443 only, a 2 MB response cap, 12-second request timeout, at most three redirects on the same origin and at most three checks concurrently. Results distinguish found/no_link/http_error/fetch_failed; they do not assert link quality, indexing or rankings. JavaScript-generated links are not inspected. Backlinks remain optional.
- /api/seo/formwork-performance?days=7|28 compares equal adjacent windows, excludes the latest three days, and reads the exact keyword ไม้แบบให้เช่าแม่สาย for /formwork.html. Metrics come from live configured Google reporting only. No-impression position/CTR are null. No synthetic production ranking data, confirmed rental inference or causal uplift claim is made.
- Profile AREA phone/LINE links use the existing consent-aware public app click tracking. These are interest events, not confirmed rental bookings. The new report does not yet aggregate partner-specific contact events.
- PUBLIC_SITE_URL source defaults now use https://areamaibab.com. Deployed environment values still require verification; this commit does not change live secrets or promise a live connection.

### Validation and release boundary
Local npm test passes the existing suites and new profile/withdrawal/path guards, stale consent, link IP guards, persistence and reporting cases. A QA-only profile plus directory inserted into a copy of the public site passes the 57-page site validator, search, fragment, AEO and performance budget gates. No QA contractor/profile was published to the real repository. CI now runs the partner create/edit/link inventory/workspace workflow at mobile and desktop sizes on Chromium and WebKit; live CI results must be recorded before release.

Public-site PR #221 remains a separate release. Merge attempts via the GitHub connector returned internal errors; direct browser access requires GitHub sign-in. No direct main push or replacement deployment is used as a substitute for Merge/Release Gate. Live database verification, partner backup/restore and production rollout remain required. Google reports need the configured account and data from the actual publication dates before outcome evaluation.

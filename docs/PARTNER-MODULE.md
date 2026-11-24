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

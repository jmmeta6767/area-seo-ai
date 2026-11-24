# Partner and project module — delivery plan

Base: area-seo-ai main f61112c. Keep the public website and its data separate.

## Delivered in this PR
- P0: repository review; reuse admin authentication and same-origin mutation gate.
- P1: partner registry, relationship, active state, publication consent and evidence note.
- P2: multiple projects per partner, equipment, location, original image URL/alt, project permission and sponsorship disclosure.
- P3 foundation: admin mobile-responsive page, editing, deterministic Thai draft, JSON export and HTTPS link metadata. No fabricated contractors or projects.
- Database-first serialized writes using the existing PostgreSQL state table; atomic local file fallback; fail on corrupt local state. Dedicated authenticated backup download. This component is intentionally independent of schema-v3 full backup/restore; do not use the existing restore UI to restore partner data.

## Remaining release phases
- P3: public profile/project templates and reference IDs carried through the existing article approval pipeline. Current draft JSON is for manual review, not directly importable into the publisher.
- P4: dedicated partner publishing preflight and reviewable public-site PR packages, consent recheck on publication, profile withdrawal workflow; no direct automatic publish.
- P5: contact click measurements with consent, backlink inventory and bounded HTTPS link health checks. Reciprocal links remain optional; paid placements use sponsored. No ranking guarantees.
- P6: staging browser/iPhone QA and live PostgreSQL verification, backup and production release gate before merge/deploy.

## Validation
`npm test` includes partner persistence, consent gate, HTTPS enforcement, sponsor link policy, concurrent writes, DB failure and corrupt file preservation; authenticated HTTP save/export and CSRF rejection. Browser rendering, live database and production deployment require separate checks.

## Current limits
Single process, at most 2,000 records per collection. Image references only; no upload. No data restore endpoint yet. Permission withdrawal blocks new drafts but cannot retract previously exported copies or externally published pages. No external URL fetching or backlinks exchanged automatically. Current registry is private behind existing authentication. Full backup schema remains unchanged.

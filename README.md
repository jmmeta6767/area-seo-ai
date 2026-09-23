# AREA SEO AI

ระบบหลังบ้าน SEO/AEO สำหรับ AREA Maibab แยกจากเว็บไซต์สาธารณะโดยสมบูรณ์

Pipeline: Research → Intent → Write → Image → Audit → Approve → Publish

Safety defaults: Mae Sai primary market, approval before publish, server-side secrets only.


## Website Intelligence (v1.4)

The **คะแนนเว็บไซต์** panel collects HTML audit snapshots from the configured
`PUBLIC_SITE_URL`, with page scores, comparable URL deltas, automatically detected
resolved/new issues, a prioritized improvement list, history selection and JSON export.
No Gemini key is needed for this collector. The scan button starts a scan; it is not
an automatic recurring job.

- Same-origin HTTPS crawl, public-address DNS checks, maximum 30 pages and three
  concurrent requests, 2 MB/request, 12-second request deadline and bounded redirects.
- Reads the top-level `/sitemap.xml`. Sitemap indexes are explicitly reported as
  partial; nested sitemaps and browser-rendered content are not crawled yet.
- Atomic history writes retain the latest 60 snapshots. Failed fetches have no score
  and are excluded from averages and resolved-issue counts. Deltas compare the last
  successful snapshot for the same URL, site and scoring version.
- The 100-point rubric is an internal HTML readiness heuristic, not Google's score,
  rank, traffic, indexing status, or Core Web Vitals. It does not infer word-count or
  character-count ranking thresholds. Duplicate metadata and malformed JSON-LD are
  additional recommendations, not ranking predictions.
- Google guidance: https://developers.google.com/search/docs/fundamentals/seo-starter-guide

### History storage before production deployment

Set `DATA_DIR` to a directory backed by persistent storage and make it writable by
the server. Both approval data and `site-history.json` use this directory. Setting
an environment variable alone does not create persistent storage. The existing free
Render Blueprint has no disk: history on that ephemeral filesystem may disappear
on replacement/redeploy. The UI reports this limitation. Do not claim durable
production history until a disk or database has actually been provisioned and tested.
No paid infrastructure has been created by this change.

Back up `site-history.json` regularly; snapshots can also be downloaded from the UI.
A corrupt history file is reported as an error and is never silently overwritten.
This file store is for one server process/instance only. Multiple instances require
transactional shared storage. Existing admin authentication must be addressed before
exposing administration endpoints broadly; this change does not add authentication.

### Verification

`npm test` checks real server startup and HTTP routes, approval regression, browser
script Auto Fix wiring, audit fixtures, score comparisons, restart persistence,
retention, corrupt-file preservation, failed pages, crawl limits, duplicate metadata,
concurrent scan rejection and URL/address guards. Remote transport is mocked in
collector tests; live Search Console, Gemini and Render are separate deployment checks.

## Content Quality Auditor (v1.5)

In Article Workspace, enter the primary keyword and use **AI รีเช็คคุณภาพ 5 หมวด**.
`POST /api/seo/quality-review` accepts string fields `title`, `meta`, `content`,
`cta`, `primaryKeyword`, and `service`. Content is required, maximum 50,000
characters; the other fields allow 2,000 characters each. Requires the configured
Gemini key. It makes no publishing or approval changes.

The JSON response has `schema_version`, `article_hash`, `reviewed_at`,
`overall_score`, `verdict`, `summary`, five `categories`, `priority_fixes`,
`measurements`, and `limitations`. Categories are `on_page_seo`, `local_seo`,
`conversion_cta`, `accuracy_value`, and `readability_structure`, each scored 0–20.
Findings contain `field`, `severity`, `issue`, exact quoted `evidence` (or empty for
missing information), and `fix`. The server validates the structure and evidence,
computes the total itself, and rejects malformed model output with HTTP 502.
Any high-severity finding results in `needs_revision` regardless of total score.

Measurements include heading order, bullet/table presence, local place mentions,
verified phone presence (064-989-3124 or +66 64 989 3124), and literal keyword
phrase occurrences per 100 approximate Thai word segments. No ideal keyword
percentage is asserted. Mae Chan is context, not verified delivery coverage.
Accuracy assessment is based on the supplied content, not external fact checking.

The UI displays/downloads JSON, clears old reports after input edits, and refuses
a response when the article changed during the request. Reports are not persisted
as website scan history; export JSON to retain an individual content review.


## Admin Security & Deployment Backup (v1.6)

v1.6 adds a server-side HTTP Basic authentication gate for the private admin app.
Set `REQUIRE_ADMIN_AUTH=true`, `ADMIN_USER`, and a strong `ADMIN_PASSWORD`.
When authentication is required but credentials are missing, the application fails
closed with HTTP 503. Invalid or missing credentials receive HTTP 401. The public
`/api/health` endpoint exposes only boolean readiness flags and never returns secrets.

All admin HTML, scripts, approval routes, Website Intelligence, Gemini actions and
publisher-preflight routes are behind the same gate when enabled. Credential
comparison uses fixed-length SHA-256 digests with timing-safe comparison. Secrets
remain server-side and must be stored in Render environment variables, not GitHub.

`GET /api/admin/backup` exports approval-queue data plus Website Intelligence
history as JSON before a redeploy or migration. This is an export only: v1.6 does
not add an overwrite/restore endpoint, avoiding accidental destructive imports.

The Render blueprint intentionally declares `ADMIN_PASSWORD` with `sync: false`.
Do not merge/deploy v1.6 until that secret is set for the target service. The free
Render filesystem remains ephemeral; the backup endpoint reduces migration risk but
does not make storage durable. Live Publisher remains locked.


## Safe Publisher Package (v1.7)

v1.7 prepares approved content for the real AREA Maibab public-site structure without
writing to the public repository. It renders a public article with the existing
`seoArticle` classes, canonical/OG metadata, BlogPosting and Breadcrumb JSON-LD,
verified Mae Sai contact CTA, and removes the Markdown H1 from the body so the final
page has exactly one H1.

The builder also updates the existing `articles.html` ItemList JSON-LD and appends
a `seoArticleCard`, then updates `sitemap.xml` with an idempotent weekly article
entry. Duplicate article/listing slugs are rejected.

For an approved draft, `GET /api/approval/:id/publisher-package` runs the existing
preflight, reads the currently deployed `articles.html` and `sitemap.xml`, and
returns a package containing exactly three candidate files: the new article,
`articles.html`, and `sitemap.xml`. The endpoint is behind v1.6 admin auth.

This endpoint is package-only. It does not write GitHub, merge `main`, or unlock
the live publisher. The next publisher stage should create a dedicated branch and
pull request in `jmmeta6767/area-maibab-public-site`, then require review before
merge.

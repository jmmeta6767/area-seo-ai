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

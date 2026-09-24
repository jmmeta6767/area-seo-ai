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

- Same-origin HTTPS crawl, public-address DNS checks, maximum 100 pages and three
  concurrent requests, 2 MB/request, 12-second request deadline and bounded redirects.
- Reads `/sitemap.xml` and follows same-origin sitemap indexes, up to 10 sitemap
  files and 5,000 discovered URLs. Unsupported/failed maps and limits are reported
  as partial. Browser-rendered content is not crawled.
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
a response when the article changed during the request. Reports are retained separately as article quality history in v3.2; they are not
website scan snapshots. Export JSON to keep a separate copy.


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


## Branch + Pull Request Publisher (v1.8)

v1.8 can turn an approved publisher package into a reviewable GitHub pull request.
Set `GITHUB_PUBLISH_TOKEN` server-side with the minimum repository permissions:
Contents write and Pull requests write for `jmmeta6767/area-maibab-public-site`.

`POST /api/approval/:id/publish-pr` requires the existing admin authentication,
human-approved status, passing SEO audit, unique slug preflight and the v1.7 package
guards. It creates only an `area-seo/article-<slug>` branch, writes only the new
article, `articles.html`, and `sitemap.xml`, then opens a PR against `main`.
It never merges the PR and never pushes directly to `main`.

The approval snapshot records the PR number, URL, branch and written commit SHAs and
moves to `publishing` so the operation is auditable. Keep the token out of GitHub
source and configure it only as a Render secret.


## Production Readiness (v2.0)

v2.0 hardens the approval/publishing lifecycle before live use. Approval data is now
written with temp-file + atomic rename semantics instead of direct overwrite. A corrupt
approval file fails closed and is preserved for recovery rather than silently becoming
an empty queue.

Approval creation, human approve/reject, PR creation and publish-state changes append
structured events to `approval-audit.jsonl`. The admin backup schema is v2 and includes
this audit history. `GET /api/admin/audit-log?limit=100` exposes the latest audit events
behind admin authentication.

Publisher PR creation is idempotent after a PR has been recorded: a repeated request
returns the existing publishing record instead of creating another PR. Approval and
rejection are valid only from `ready_for_review`; invalid lifecycle transitions return
HTTP 409. PR status refresh records transitions to `published` or `needs_changes`.

This improves crash/retry safety on one process, but does **not** make Render's free
ephemeral filesystem durable. Production durability still requires a persistent disk or
transactional database and a verified backup/restore procedure. No paid infrastructure
or automatic PR merge is introduced by v2.0.


## Persistent Storage (v2.1)

v2.1 adds an optional PostgreSQL durability layer. When `DATABASE_URL` is present,
startup creates only the `area_seo_state` and `area_seo_audit` tables, hydrates the
approval queue from PostgreSQL when available, and mirrors later approval writes and
audit events to the database. The existing local files remain a recovery/cache copy.

`GET /api/admin/storage-health` reports whether storage is file-only or PostgreSQL,
and `/api/health` exposes only boolean persistence readiness without credentials.
Admin audit-log reads from PostgreSQL once persistence is ready.

If `DATABASE_URL` is absent the app deliberately stays compatible with file storage;
that mode is not durable on Render Free. If a configured database cannot initialize,
the production process does not start rather than silently pretending persistence is
healthy. Database credentials must be Render secrets and never committed to GitHub.

v2.1 does not automatically provision paid infrastructure and does not change the
safe PR-only publisher policy.


## Recovery & Migration (v2.2)

v2.2 introduced the guarded backup restore path. The current endpoint remains
admin-authenticated and dry-run by default. It accepts legacy schema-v2 approval-only
backups and the complete schema-v3 backup emitted by `GET /api/admin/backup`.
A restore happens only when the same request also contains `"confirm": true`.

Dry-run validates every included component and returns per-component counts and
SHA-256 checksums plus one bundle checksum without changing state. Schema v3 requires
approval queue, approval audit, `site_history_full`, and `quality_history`.
Malformed collections, duplicate approval IDs, invalid score history, invalid quality
reports, and bad audit timestamps are rejected before writes begin.

Use a dry run, compare counts/checksum, export a fresh pre-restore backup, then confirm.
This endpoint does not expose database credentials and remains behind admin auth.


## Production Readiness Gate (v2.3)

`GET /api/admin/readiness` is an authenticated, non-destructive readiness gate. It
checks that admin authentication is enforced, the PR-only GitHub publisher is configured,
durable PostgreSQL is connected, and Gemini is configured. The response lists explicit
blockers instead of treating a successful web deploy as production-ready.

The publisher policy remains pull-request-only. A file-only deployment is intentionally
reported as blocked by `persistent_storage`.


## Database Link Verification (v2.4)

v2.4 makes the final Render database-link test observable without exposing credentials.
The authenticated `/api/admin/storage-health` endpoint reports PostgreSQL database
name, role, server version, latency, state-row count, audit-row count and readiness.
File mode reports `durable:false` and `ready:false`.

After `DATABASE_URL` is linked in Render, use this endpoint before and after a redeploy
to prove that the same durable state is readable. Connection strings and passwords are
never returned.


## Publisher Source of Truth (v2.5)

Publisher package generation now reads `articles.html`, `sitemap.xml`, the article
slug and the base commit directly from the public-site GitHub `main` branch. It no
longer treats the currently deployed Render HTML as the source of truth.

Immediately before branch creation the publisher resolves `main` again. If the SHA
changed since package generation, publishing stops with HTTP 409 so the package can be
rebuilt instead of overwriting newer work. An article file already present on main also
blocks publication. GitHub content paths are encoded by path segment.

This closes the stale-deploy race while preserving the PR-only/no-auto-merge policy.


## Durable Website Scores (v2.6)

Website Intelligence now uses the existing PostgreSQL adapter when DATABASE_URL is
configured. Startup loads the complete `site_history` state and refreshes the local
recovery copy. If the database has no history yet, an existing valid local history is
migrated once. Invalid data fails closed and is not overwritten.

Each scan awaits the database write before reporting success. Failed writes return
HTTP 503, leave the previous history intact, and mark score-storage readiness false.
A local-cache write failure after a successful database write is reported separately;
it does not incorrectly mark the durable write as failed. Without DATABASE_URL,
file mode and its explicit Render Free durability warning remain unchanged.

Admin backup adds `site_history_full` containing complete snapshots and page findings;
the existing `site_history` summaries remain for compatibility. The existing approval
restore route does not restore this new field yet. Readiness now includes a separate
`score_history_storage` check, so durable approval storage alone cannot hide missing
score durability. Deployment remains single-instance; multi-writer synchronization
is not provided by the in-memory history cache.

Tests cover migration, restart with an empty local filesystem, database-write failure,
corrupt data preservation and recovery-copy failure using an isolated database adapter.
A live PostgreSQL verification still requires a configured DATABASE_URL.


## Publisher Safety (v2.7)

v2.7 rejects browser cross-site mutation requests using Fetch Metadata and validates
Origin/Referer when those headers are present. Set `ADMIN_ORIGIN` to the admin site's
origin when it differs from `PUBLIC_SITE_URL`.

An authenticated `POST /api/approval/:id/publish-cancel` closes an unmerged publisher
pull request and returns the draft to `needs_changes`. Cancellation is audited and
does not delete branches. Merged PRs cannot be cancelled through this endpoint.


## Publisher Recovery (v2.8)

A published draft can create a recovery pull request with
`POST /api/approval/:id/publish-revert`. The source publisher PR must already be
merged. Recovery never writes directly to `main` and never auto-merges.

The recovery branch is based on the current public-site `main`. Recovery is targeted:
it reverts only the article file, `articles.html`, and `sitemap.xml` changes made by
the recorded publisher PR. If any of those files changed again after that PR, recovery
fails closed with HTTP 409 rather than overwriting newer edits. Unrelated newer site
files are preserved. Repeated requests for the same draft return the recorded revert
PR instead of creating another one. Every recovery PR creation is audited.


## Performance Intelligence (v2.9)

The content pipeline now exposes `GET /api/content/performance` for Approval/Published
views. It links each publishable article to its page path, primary keyword and latest
performance snapshot without making live Google API calls per table row.

`lib/performance-comparison.js` implements the alert rule: an article must be older
than 30 days and either lose more than 3 ranking positions or lose more than 20 percent
of Google clicks. Re-optimization tasks enter `research`, require approval, and honor
an article cooldown instead of modifying the live article directly.

Until GA4/Search Console credentials and collectors are configured, the endpoint reports
`analyticsConfigured:false` and each article reports `analyticsStatus:"pending"`;
it never invents ranking or visitor numbers.


## Missing performance data (v3.1.1)

Unknown click and visitor counts are returned as null, with pending SEO health.
Missing comparison observations never count as zero or trigger a false traffic-drop
alert; measured zero clicks still count as a real decline. Approval drafts retain
the primary keyword supplied by the article workspace. Analytics clears the previous
article's results when loading or failing, and ignores responses from older requests.
These changes do not configure external credentials or enable admin login.


## Article Quality History (v3.2)

Successful five-category reviews retain their full validated JSON report, title and
primary keyword. The last 100 reports are available in the Article Workspace history
selector and through `GET /api/seo/quality-history` (summaries) and
`GET /api/seo/quality-history/:id` (detail). Opening a historical report does not
replace the current article or imply it has been reviewed. Export remains available.

Storage uses `quality-history.json` with atomic local writes, or the PostgreSQL
`quality_history` state key when DATABASE_URL is configured. Startup migrates valid
local history only if the database has no saved quality history. Writes are serialized
within the single server process and committed to the database before success. Invalid
stored data is preserved and initialization fails closed. This is not a multi-writer
store. The UI reports file-only storage explicitly; Render without persistent storage
can lose that history during deploys.

A completed AI review remains available to download if saving history fails: the
response contains `history.saved:false` and a warning rather than claiming it was saved.
Gemini or report-validation failures create no history entry. Admin backup includes
`quality_history`; the existing approval restore endpoint does not restore this field.
Readiness includes `quality_history_storage`. No provider credentials, authentication
settings, approval status or publishing behavior are changed by this feature.

Tests cover real review/list/detail/backup routes with mocked Gemini transport,
concurrent saves, restart/migration, retention, database failure, cache failure and
corrupt-data preservation. Live Gemini and PostgreSQL still need configured credentials.


## Broader Website Scans (v3.3)

Website Intelligence now audits up to 100 pages with the existing three-request
concurrency limit. It follows nested sitemap indexes on the configured HTTPS origin,
deduplicates sitemap and page URLs, and supports CDATA locations. Sitemap discovery
is bounded to 10 files and 5,000 unique page URLs; every existing fetch still has the
12-second/2 MB/redirect/public-address guards. External sitemap URLs are not fetched.

Snapshots record sitemap count and whether discovery was capped. The UI reports a
lower-bound URL count when capped. Failed child maps preserve discovered pages and
mark the result partial. Existing score history and onpage-1 comparisons remain valid;
this extends discovery without changing scoring weights or claiming Google ranking.


## Technical Indexability Diagnostics (v3.4)

Website Intelligence now records site-level technical crawl diagnostics alongside the
existing page score without changing the `onpage-1` scoring weights. Each scan reads
`/robots.txt` through the same same-origin HTTPS, public-address, response-size,
redirect and timeout guards used by the crawler.

The snapshot records robots HTTP status, whether the file was readable, whether the
wildcard user-agent contains an exact `Disallow: /`, same-origin sitemap directives,
external/invalid sitemap directives, and whether the configured root sitemap is
declared. These findings appear as separate Technical SEO tasks; they do not pretend
to prove Google indexing status.

Page analysis also records whether an absolute HTTPS canonical stays on the same
origin and whether it matches the URL that was scanned. Off-origin canonicals and
non-self canonicals are reported as explicit issues without changing the historical
100-point score, so existing score comparisons remain comparable.

This feature still does not execute target-site JavaScript, inspect Google index
coverage, or verify every internal-link destination. Those remain separate checks.


## Complete Backup & Recovery (v3.5)

The authenticated admin backup is now schema v3 and contains the complete restorable
state bundle: approval queue, approval audit, full Website Intelligence snapshots and
five-category article quality history. Schema v2 remains accepted for legacy
approval-only restores and never clears newer history fields that were absent from the
old format.

Confirmed schema-v3 recovery validates the entire bundle before any mutation. In file
mode, all local stores keep atomic per-file writes and the recovery coordinator captures
the previous state so it can restore the prior queue, audit, site history and quality
history if a later write fails.

When PostgreSQL is connected, schema-v3 recovery writes approval queue, site history,
quality history and audit history inside one database transaction. Local recovery
copies are then refreshed. If a local refresh fails after the database commit, the
coordinator attempts a compensating database transaction plus local rollback instead of
reporting a partial success.

Every successful restore appends a fresh `backup_restored` audit event after the
restored audit history. The endpoint never returns database credentials. A dry run
should still be performed first and its component counts/checksums reviewed before
sending `"confirm": true`.


## Backup & Recovery Console (v3.6)

The private admin UI now includes a **Backup & Recovery Center** for the schema-v3
state bundle. It shows the current storage mode/readiness, downloads the authenticated
`/api/admin/backup` response as JSON, accepts schema-v2/v3 backup files, and always
runs a dry-run before the restore action can be enabled.

A successful dry-run returns component counts plus a bundle checksum. The operator must
type `RESTORE` before confirmation. The browser sends the dry-run checksum back as
`expectedChecksum`; the server compares it to the validated backup before any write.
If the file changes between validation and confirmation, restore stops with HTTP 409
and requires another dry-run.

The recovery endpoint allows up to 16 MB request bodies while normal JSON endpoints
retain the existing 1 MB limit. The browser applies the same 16 MB file guard before
upload. This larger limit is scoped only to authenticated recovery because complete
Website Intelligence history can be significantly larger than ordinary admin requests.

The UI never displays database URLs, passwords, Google credentials, or GitHub tokens.
File-only Render deployments are clearly labeled as non-durable; PostgreSQL is shown
as durable only when the storage-health endpoint reports both `durable:true` and
`ready:true`.


## HTTP Failure Scoring (v3.6.1)

Non-2xx pages now have a null score and an explicit HTTP task. Their error-page
markup cannot inflate the average, introduce duplicate metadata findings, or mark
previous article issues as resolved. Failed pages are included in failed-page counts
and make the scan partial. Successful-page weights remain unchanged (onpage-1).
Comparisons skip legacy non-2xx scores and use the last successful same-URL snapshot;
old snapshots remain untouched.


## Durable Storage Verification (v3.7)

Storage readiness now verifies the actual durable state keys instead of treating a
database connection alone as sufficient. PostgreSQL is considered fully durable only
when `approval_queue`, `site_history`, and `quality_history` are all present in
`area_seo_state`, the database connection is healthy, and no persistence error is
active.

`GET /api/admin/storage-health` returns the required/present/missing state keys plus
state/audit row counts. The Recovery Center shows these missing keys directly so a
partially initialized database cannot be mistaken for a complete migration.

Schema-v3 backups now export the complete approval audit history. File mode uses the
uncapped local audit stream; PostgreSQL mode reads the full durable audit table in
chronological order. The ordinary audit-log viewer remains capped for UI safety.

This release still does not connect DATABASE_URL by itself. Render must inject the
database connection through its environment/Blueprint configuration. Until that
happens, the service intentionally remains in file mode and reports
`durable_state_complete` as a readiness blocker.

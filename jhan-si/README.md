# ฌานเอสไอ / Jhan SI — Independent Affiliate Studio

Independent app inside the isolated jhan-si/ directory. It imports no AREA Maibab code, API, publishing repositories, or data.

Repository caveat: source is currently a feature branch of an existing repo until a separate GitHub repository can be created. Runtime and data are independent, source control hosting not yet independent.

## Features
- Public /shop and server-rendered /p/:uuid product pages with JSON-LD.
- Tracked /go/:uuid validated Shopee/Lazada affiliate redirects.
- Protected /admin for product imports, store settings, drafts, queued post drafts, clicks, backup JSON.
- Gemini text drafting is optional and server-side. Human review is mandatory before publication.
- No fabricated marketplace scores, stock, commissions or sales.

## Run
Node 20+. In jhan-si: npm install; npm test; npm start.
Set environment variables in the runtime: NODE_ENV, ADMIN_USER, ADMIN_PASSWORD, DATABASE_URL, GEMINI_API_KEY if available.

## Production requirements
Use a dedicated PostgreSQL database that has NO connection to AREA Maibab. Start command: cd jhan-si && npm start. Build command: cd jhan-si && npm install. Public /shop, protected /admin.
When NODE_ENV=production with no DATABASE_URL, admin mutations fail closed with HTTP 503. Development uses a local JSON file, not a production durable store.
Backup via authenticated GET /api/admin/backup; schedule offsite backups separately.

## Not yet connected
- Marketplace catalog sync, commissions or completed orders
- Facebook Page publishing and queue worker; saved posts are DRAFTS, never published
- Custom-domain provisioning
- Production Gemini API until a server-side secret is configured

URL host allowlist prevents open redirects. Admin is Basic-auth protected. Secrets remain server side. Product price information is entered by the operator and needs source verification. Shipping, product warranties and reviews are never invented.

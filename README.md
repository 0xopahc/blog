# 5tv blog

raw html + Cloudflare Worker. **no HTML build / no framework.**

```
.
├── index.html, posts/, 404.html   # edit these
├── mdblog/                        # raw markdown notes (public at /mdblog/)
├── cf/worker.js                   # edge router + logger
├── cf/logger.js                   # browser beacon
├── public/                        # synced assets (auto; do not hand-edit)
├── scripts/sync-public.mjs
├── wrangler.toml
└── package.json
```

## commands

```bash
npm install

npm start          # sync → wrangler dev  (http://127.0.0.1:8787)
npm run deploy     # sync → wrangler deploy -e production
npm run tail       # live logs (production worker)
npm run check      # dry-run (no account)
```

`prestart` / `predeploy` run `sync` first so `public/` matches your sources.

**Why `-e production`?** Top-level `routes` for `canipay.io` make local `wrangler dev` rewrite every request Host to `canipay.io`, so the apex stub would shadow the blog. Routes only apply on production deploy; `perssy` stays a dashboard custom domain.

## if “build” fails on Cloudflare

This is **not** a Pages static-site generator.

| wrong | right |
|---|---|
| Framework preset / `npm run build` | **none** — empty build command |
| Build output directory `dist` | use **Workers** + this repo’s `wrangler.toml` |
| Assets = whole repo (incl. `node_modules`) | assets = `./public` only |

```bash
npx wrangler login   # once
npm run deploy
```

## flow

1. Browser → DNS (orange-cloud) → Cloudflare edge → **your Worker**
2. Worker branches on `Host` (apex stub vs blog)
3. Blog paths: Worker logs + serves files from `public/` via `ASSETS`
4. Browser pages → `/cf/logger.js` beacons `POST /cf/log`

### mdblog (raw notes)

| URL | what |
|---|---|
| `https://perssy.canipay.io/mdblog/` | directory index (generated at sync) |
| `…/mdblog/2026/` | year listing |
| `…/mdblog/2026/8.3.26.md` | raw markdown text |
| `…/mdblog/2026/8.2.26` | extensionless notes → forced `text/markdown` |

Edit files only under `mdblog/`. `npm start` / `npm run deploy` runs `sync`, which copies into `public/mdblog/` and writes `index.html` / `index.txt` per folder (Workers Assets has **no** auto dir listing).

## multi-host (same worker)

| host | response |
|---|---|
| `perssy.canipay.io` | blog (`public/`) including `/mdblog/` |
| `canipay.io` / `www.canipay.io` | bare html: *youcantpayyetsorry* |
| `*.workers.dev` / localhost | blog (dev) |

Routing is by `Host` header in `cf/worker.js` (`APEX_HOSTS`).

### attach domains (dashboard)

1. Zone `canipay.io` on Cloudflare DNS  
2. Workers → **5tv-blog** → **Settings → Domains & Routes**  
3. Add:
   - `perssy.canipay.io`
   - `canipay.io`
   - `www.canipay.io` (optional)

DNS: for each hostname, either let Workers auto-add the route, or point a CNAME/AAAA to the worker as the UI instructs. Same worker = same deploy.

### local test by host

```bash
npm start
# blog + mdblog (default local host)
curl http://127.0.0.1:8787/
curl -sL http://127.0.0.1:8787/mdblog/
curl http://127.0.0.1:8787/mdblog/2026/8.3.26.md
# apex stub
curl -H 'Host: canipay.io' http://127.0.0.1:8787/
# production host name (blog path — Host is not rewritten without top-level routes)
curl -H 'Host: perssy.canipay.io' http://127.0.0.1:8787/mdblog/
```

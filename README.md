# 5tv blog

raw html + Cloudflare Worker. **no HTML build / no framework.**

```
.
├── index.html, posts/, 404.html   # edit these
├── cf/worker.js                   # edge logger
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
npm run deploy     # sync → wrangler deploy
npm run tail       # live logs
npm run check      # dry-run (no account)
```

`prestart` / `predeploy` run `sync` first so `public/` matches your HTML.

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

1. Browser loads page → `/cf/logger.js` beacons `POST /cf/log`
2. Worker logs beacon + every request (`wrangler tail`)
3. Worker serves HTML/CSS/JS from `public/` via `ASSETS`

## multi-host (same worker)

| host | response |
|---|---|
| `perssy.canipay.io` | blog (`public/`) |
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
# blog
curl -H 'Host: perssy.canipay.io' http://127.0.0.1:8787/
# apex stub
curl -H 'Host: canipay.io' http://127.0.0.1:8787/
```

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

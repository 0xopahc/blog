# 5tv blog

raw html. no build. no framework. Cloudflare Worker for traffic logs.

```
.
├── index.html
├── posts/
│   ├── homelab.html
│   └── canipay.html
├── cf/
│   ├── logger.js    # browser beacon → POST /cf/log
│   └── worker.js    # edge logger + static assets
└── wrangler.toml
```

## run locally (static only)

```bash
python3 -m http.server 8080
# open http://localhost:8080
# note: /cf/log will 404 without the worker
```

## deploy worker

```bash
npx wrangler deploy
npx wrangler tail     # live JSON request + beacon logs
```

Every request is `console.log`'d (Workers Logs). Client pageviews hit `POST /cf/log`.

Optional Analytics Engine: uncomment the binding in `wrangler.toml`.

## add a post

1. copy `posts/homelab.html` → `posts/your-slug.html`
2. edit title + body
3. append to `POSTS` in `index.html`

```js
{ title: "your-slug", href: "posts/your-slug.html", date: "2026-08" },
```

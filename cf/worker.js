/**
 * 5tv Worker
 *
 * - POST /cf/log  → client pageview beacon (cf/logger.js)
 * - everything else → static HTML via ASSETS binding
 * - every request → JSON line in Workers Logs (`wrangler tail`)
 *
 * Run:   npm start
 * Ship:  npm run deploy
 */

const LOG_PATH = "/cf/log";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const t0 = Date.now();

    // CORS preflight for beacon
    if (url.pathname === LOG_PATH && request.method === "OPTIONS") {
      return cors(url.origin, 204);
    }

    // Client logger sink
    if (url.pathname === LOG_PATH && request.method === "POST") {
      ctx.waitUntil(handleBeacon(request, env));
      return cors(url.origin, 204);
    }

    // Static HTML / assets
    if (!env.ASSETS) {
      return new Response("ASSETS binding missing — check wrangler.toml [assets]", {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    let response;
    try {
      response = await env.ASSETS.fetch(request);
    } catch (err) {
      console.error(JSON.stringify({ kind: "assets_error", err: String(err) }));
      return new Response("asset fetch failed", { status: 502 });
    }

    ctx.waitUntil(
      logLine(request, env, {
        kind: "request",
        status: response.status,
        ms: Date.now() - t0,
      })
    );

    return response;
  },
};

function cors(origin, status) {
  return new Response(null, {
    status,
    headers: {
      "cache-control": "no-store",
      "access-control-allow-origin": origin || "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400",
    },
  });
}

async function handleBeacon(request, env) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const cf = request.cf || {};
  await logLine(request, env, {
    kind: "beacon",
    status: 204,
    ms: 0,
    path: body.path || "",
    hash: body.hash || "",
    ref: clip(body.ref, 200),
    title: clip(body.title, 120),
    lang: body.lang || "",
    tz: body.tz || "",
    sw: body.sw || 0,
    sh: body.sh || 0,
    ttfb: body.ttfb ?? null,
    dcl: body.dcl ?? null,
    v: body.v ?? null,
    country: cf.country || request.headers.get("cf-ipcountry") || "",
    colo: cf.colo || "",
  });
}

async function logLine(request, env, extra) {
  const url = new URL(request.url);
  const cf = request.cf || {};

  const row = {
    kind: extra.kind || "request",
    ts: new Date().toISOString(),
    method: request.method,
    path: extra.path || url.pathname + url.search,
    status: extra.status ?? null,
    ms: extra.ms ?? null,
    ip: request.headers.get("cf-connecting-ip") || "",
    country: extra.country || cf.country || request.headers.get("cf-ipcountry") || "",
    colo: extra.colo || cf.colo || "",
    ray: request.headers.get("cf-ray") || "",
    ua: clip(request.headers.get("user-agent"), 180),
    ref: extra.ref || clip(request.headers.get("referer"), 200),
    title: extra.title || "",
    lang: extra.lang || "",
    tz: extra.tz || "",
    sw: extra.sw || 0,
    sh: extra.sh || 0,
    ttfb: extra.ttfb ?? null,
    dcl: extra.dcl ?? null,
    v: extra.v ?? null,
    proto: cf.httpProtocol || "",
    tls: cf.tlsVersion || "",
  };

  // Workers Logs / wrangler tail
  console.log(JSON.stringify(row));

  // Optional Analytics Engine
  if (env.ANALYTICS && typeof env.ANALYTICS.writeDataPoint === "function") {
    try {
      env.ANALYTICS.writeDataPoint({
        blobs: [row.kind, row.path, row.country, row.method, row.ref],
        doubles: [Number(row.status) || 0, Number(row.ms) || 0],
        indexes: [row.path || "/"],
      });
    } catch (err) {
      console.error(JSON.stringify({ kind: "analytics_fail", err: String(err) }));
    }
  }
}

function clip(s, n) {
  return String(s || "").slice(0, n);
}

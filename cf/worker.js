/**
 * 5tv — Cloudflare Worker
 *
 * - Logs every request (Workers Logs / `wrangler tail`)
 * - Accepts client beacons at POST /cf/log
 * - Serves static assets via the ASSETS binding (Workers Static Assets)
 *
 * wrangler.toml sketch:
 *
 *   name = "5tv-blog"
 *   main = "cf/worker.js"
 *   compatibility_date = "2024-11-01"
 *
 *   [assets]
 *   directory = "."
 *   binding = "ASSETS"
 *   not_found_handling = "404-page"
 *
 * Optional:
 *   [[analytics_engine_datasets]]
 *   binding = "ANALYTICS"
 *   dataset = "blog_traffic"
 */

const LOG_PATH = "/cf/log";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const started = Date.now();

    // --- client beacon sink ---
    if (url.pathname === LOG_PATH && request.method === "POST") {
      ctx.waitUntil(handleBeacon(request, env));
      return new Response(null, {
        status: 204,
        headers: {
          "cache-control": "no-store",
          "access-control-allow-origin": url.origin,
        },
      });
    }

    if (url.pathname === LOG_PATH && request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": url.origin,
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "content-type",
          "access-control-max-age": "86400",
        },
      });
    }

    // --- serve static site ---
    let response;
    try {
      response = env.ASSETS
        ? await env.ASSETS.fetch(request)
        : new Response("ASSETS binding missing", { status: 500 });
    } catch (err) {
      console.error("assets_error", String(err));
      response = new Response("upstream error", { status: 502 });
    }

    // log after we know status, without delaying the body
    ctx.waitUntil(
      logRequest(request, {
        status: response.status,
        ms: Date.now() - started,
        kind: "request",
      }, env)
    );

    return response;
  },
};

/** Edge / request log line (shows up in Workers Logs). */
async function logRequest(request, extra, env) {
  const url = new URL(request.url);
  const cf = request.cf || {};

  const row = {
    kind: extra.kind || "request",
    ts: new Date().toISOString(),
    method: request.method,
    path: url.pathname + url.search,
    status: extra.status ?? null,
    ms: extra.ms ?? null,
    ip: request.headers.get("cf-connecting-ip") || "",
    country: cf.country || request.headers.get("cf-ipcountry") || "",
    colo: cf.colo || "",
    ray: request.headers.get("cf-ray") || "",
    ua: (request.headers.get("user-agent") || "").slice(0, 180),
    ref: (request.headers.get("referer") || "").slice(0, 200),
    proto: cf.httpProtocol || "",
    tls: cf.tlsVersion || "",
    bot: cf.botManagement?.score ?? null,
  };

  // structured log → wrangler tail / dashboard logs
  console.log(JSON.stringify(row));

  // optional Analytics Engine
  writeAnalytics(env, row);
}

/** Client pageview beacon body. */
async function handleBeacon(request, env) {
  let body = {};
  try {
    body = await request.json();
  } catch (_) {
    body = { parse: "fail" };
  }

  const cf = request.cf || {};
  const row = {
    kind: "beacon",
    ts: new Date().toISOString(),
    ip: request.headers.get("cf-connecting-ip") || "",
    country: cf.country || request.headers.get("cf-ipcountry") || "",
    colo: cf.colo || "",
    ray: request.headers.get("cf-ray") || "",
    ua: (request.headers.get("user-agent") || "").slice(0, 180),
    // client fields
    path: body.path || "",
    hash: body.hash || "",
    ref: (body.ref || "").slice(0, 200),
    title: (body.title || "").slice(0, 120),
    lang: body.lang || "",
    tz: body.tz || "",
    sw: body.sw || 0,
    sh: body.sh || 0,
    ttfb: body.ttfb,
    dcl: body.dcl,
    v: body.v,
  };

  console.log(JSON.stringify(row));
  writeAnalytics(env, row);
}

function writeAnalytics(env, row) {
  if (!env || !env.ANALYTICS || typeof env.ANALYTICS.writeDataPoint !== "function") {
    return;
  }
  try {
    env.ANALYTICS.writeDataPoint({
      // searchable strings
      blobs: [
        row.kind || "",
        row.path || "",
        row.country || "",
        row.method || "GET",
        row.ref || "",
      ],
      // numeric
      doubles: [
        Number(row.status) || 0,
        Number(row.ms) || 0,
        Number(row.sw) || 0,
        Number(row.sh) || 0,
      ],
      indexes: [row.path || "/"],
    });
  } catch (err) {
    console.error("analytics_write_fail", String(err));
  }
}

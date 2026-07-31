(function () {
  "use strict";

  var ENDPOINT = "/cf/log";
  var VERSION = 1;

  function hit() {
    try {
      var nav = performance && performance.getEntriesByType
        ? performance.getEntriesByType("navigation")[0]
        : null;

      var payload = {
        v: VERSION,
        t: "pageview",
        ts: Date.now(),
        path: location.pathname + location.search,
        hash: location.hash || "",
        ref: document.referrer || "",
        title: document.title || "",
        lang: (navigator.language || "").slice(0, 16),
        tz: (function () {
          try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
          } catch (_) {
            return "";
          }
        })(),
        sw: screen && screen.width ? screen.width : 0,
        sh: screen && screen.height ? screen.height : 0,
        ttfb: nav && nav.responseStart ? Math.round(nav.responseStart) : null,
        dcl: nav && nav.domContentLoadedEventEnd
          ? Math.round(nav.domContentLoadedEventEnd)
          : null,
      };

      var body = JSON.stringify(payload);

      if (navigator.sendBeacon) {
        var ok = navigator.sendBeacon(
          ENDPOINT,
          new Blob([body], { type: "application/json" })
        );
        if (ok) return;
      }

      fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body,
        keepalive: true,
        mode: "same-origin",
        credentials: "omit",
        cache: "no-store",
      }).catch(function () {});
    } catch (_) {}
  }

  if (document.readyState === "complete") {
    hit();
  } else {
    window.addEventListener("load", hit, { once: true });
  }
})();

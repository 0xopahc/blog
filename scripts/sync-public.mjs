/**
 * Mirror source files → public/ (wrangler assets dir).
 * No compile — pure copy + tiny index files for mdblog dirs.
 *
 * Why indexes? Cloudflare Workers Assets is not Apache/nginx:
 * there is no auto directory listing. Without an index file,
 * GET /mdblog/ returns 404 even if files exist underneath.
 */
import {
  cpSync,
  mkdirSync,
  rmSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");

rmSync(pub, { recursive: true, force: true });
mkdirSync(join(pub, "posts"), { recursive: true });
mkdirSync(join(pub, "cf"), { recursive: true });
mkdirSync(join(pub, "css"), { recursive: true });

for (const f of ["index.html", "404.html"]) {
  cpSync(join(root, f), join(pub, f));
}
cpSync(join(root, "posts"), join(pub, "posts"), { recursive: true });
cpSync(join(root, "css"), join(pub, "css"), { recursive: true });
cpSync(join(root, "cf", "logger.js"), join(pub, "cf", "logger.js"));

// --- mdblog: copy tree + write directory indexes ---
const mdSrc = join(root, "mdblog");
const mdDst = join(pub, "mdblog");
cpSync(mdSrc, mdDst, { recursive: true });
writeMdblogIndexes(mdDst, "/mdblog");

console.log(
  "synced → public/ (html, posts/*, css/*, cf/logger.js, mdblog/* + indexes)"
);

/**
 * Walk mdblog under public/ and write a plain-text index for each dir.
 * Served as text/plain so the browser shows a simple file list.
 */
function writeMdblogIndexes(dirAbs, urlPath) {
  const entries = readdirSync(dirAbs, { withFileTypes: true })
    .filter((e) => e.name !== "index.txt" && !e.name.startsWith("."))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const lines = [
    `# ${urlPath}/`,
    `# generated at sync — not hand-edited`,
    "",
  ];

  for (const e of entries) {
    const slash = e.isDirectory() ? "/" : "";
    lines.push(`${e.name}${slash}`);
    if (e.isDirectory()) {
      writeMdblogIndexes(join(dirAbs, e.name), `${urlPath}/${e.name}`);
    }
  }

  // bare text listing — browser renders as plain text
  writeFileSync(join(dirAbs, "index.txt"), lines.join("\n") + "\n", "utf8");

  // also index.html so ASSETS default-document behavior works on /mdblog/
  const htmlLinks = entries
    .map((e) => {
      const href = e.isDirectory() ? `${e.name}/` : e.name;
      return `  <li><a href="${href}">${e.name}${e.isDirectory() ? "/" : ""}</a></li>`;
    })
    .join("\n");

  writeFileSync(
    join(dirAbs, "index.html"),
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${urlPath}/</title>
  <style>
    body { font: 16px/1.5 ui-monospace, monospace; margin: 2rem; }
    a { color: #06c; }
    .muted { color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <p class="muted">${escapeHtml(urlPath)}/</p>
  <ul>
${htmlLinks}
  </ul>
  <p class="muted"><a href="${parentHref(urlPath)}">..</a></p>
</body>
</html>
`,
    "utf8"
  );
}

function parentHref(urlPath) {
  if (urlPath === "/mdblog") return "/";
  const i = urlPath.lastIndexOf("/");
  return i <= 0 ? "/" : urlPath.slice(0, i) + "/";
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

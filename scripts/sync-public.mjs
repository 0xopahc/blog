/**
 * Copy source HTML → public/ (the assets dir wrangler deploys).
 * No compile. Just mirrors files.
 */
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");

rmSync(pub, { recursive: true, force: true });
mkdirSync(join(pub, "posts"), { recursive: true });
mkdirSync(join(pub, "cf"), { recursive: true });

for (const f of ["index.html", "404.html"]) {
  cpSync(join(root, f), join(pub, f));
}
cpSync(join(root, "posts"), join(pub, "posts"), { recursive: true });
cpSync(join(root, "cf", "logger.js"), join(pub, "cf", "logger.js"));

console.log("synced → public/ (index, 404, posts/*, cf/logger.js)");

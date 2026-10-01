// Replaces packages that the remote package cache sometimes installs with
// missing files by the complete copies saved under vendor/.
const f = require("fs");
const nested = "node_modules/@lovable.dev/vite-tanstack-config/node_modules/nitro";
if (!f.existsSync(nested + "/package.json")) f.rmSync(nested, { recursive: true, force: true });
const map = { seroval: "seroval", "seroval-plugins": "seroval-plugins", unplugin: "unplugin", "@tanstack/router-core": "@tanstack_router-core" };
for (const [name, dir] of Object.entries(map)) {
  const src = "vendor/" + dir;
  if (!f.existsSync(src)) continue;
  const dest = "node_modules/" + name;
  try { if (f.realpathSync(dest) === f.realpathSync(src)) continue; } catch {}
  f.rmSync(dest, { recursive: true, force: true });
  f.cpSync(src, dest, { recursive: true });
}

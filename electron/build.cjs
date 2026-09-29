// Masaüstü için üretim derlemesi: bilgisayarda çalışan yerel sunucu (.output).
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const r = spawnSync("npx", ["vite", "build"], {
  cwd: path.join(__dirname, ".."),
  stdio: "inherit",
  shell: true,
  env: { ...process.env, ELECTRON_BUILD: "1" },
});
process.exit(r.status ?? 1);

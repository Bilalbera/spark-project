// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { fileURLToPath } from "node:url";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Resolve query-core straight from the verified vendor copy so an incomplete
// node_modules install in the publish environment cannot break the build.
const queryCore = fileURLToPath(
  new URL("./vendor/query-core/build/modern/index.js", import.meta.url),
);

// Windows desktop build (npm run pc:build) runs a local Node server instead of the edge target.
const electronBuild = process.env['ELECTRON_BUILD'] === "1";
// Vercel sets VERCEL=1 during its builds; emit Vercel's output format so every
// page (e.g. /giris) is served by the app server instead of returning 404.
const vercelBuild = !electronBuild && !!process.env['VERCEL'];

export default defineConfig({
  ...(electronBuild ? { nitro: { preset: "node-server" } } : {}),
  ...(vercelBuild ? { nitro: { preset: "vercel" } } : {}),
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: [{ find: /^@tanstack\/query-core$/, replacement: queryCore }],
    },
  },
});

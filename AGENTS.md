<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Kurucu yönetimi `/kurucu` altındaki korumalı sayfalarda tutulur; böylece rol denetimi ve yönetim arayüzü tek bir yerde uygulanır.
- Nitro ile doğrudan yükleme bağımlılıkları `ohash` ve `@tanstack/query-core`, `vendor/` altındaki doğrulanmış açılmış paketlerden kurulur; uzak paket önbelleğindeki eksik dosyalar derlemeyi bozmasın.
- `@tanstack/query-core` is aliased in vite.config.ts to `vendor/query-core`; publish installs left its node_modules copy incomplete.
- Google girişi doğrudan `supabase.auth.signInWithOAuth` ile yapılır (Lovable OAuth aracı kullanılmaz); Vercel'de `/~oauth/initiate` adresi olmadığı için.
- `seroval`, `seroval-plugins`, `unplugin`, `@tanstack/router-core` are restored from `vendor/` by `scripts/restore-vendor.cjs` after install; remote installs left them missing files.
- Vercel builds (VERCEL=1) use the nitro `vercel` preset in vite.config.ts; the default edge output made Vercel 404 every page.
- Keep YouTube lifecycle and custom controls in VideoPlayer, with progress persistence supplied by the watch route; this isolates UI changes from existing history and completion rules.
- Allow dropdown portals to target the player container so settings remain accessible in browser fullscreen.
- Uploaded MP4 sources reuse episodes.youtube_url and the existing media bucket; a native playback adapter shares controls and progress callbacks without requiring a database migration.

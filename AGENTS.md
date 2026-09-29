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

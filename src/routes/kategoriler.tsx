import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/site-client";
import { ContentRow, EmptyState, SeriesCard, type Series } from "@/components/app/cards";

export const Route = createFileRoute("/kategoriler")({
  head: () => ({
    meta: [
      { title: "Kategoriler — Bilal Efendi" },
      { name: "description", content: "Serileri kategorilere göre keşfet." },
      { property: "og:title", content: "Kategoriler — Bilal Efendi" },
      { property: "og:description", content: "Serileri kategorilere göre keşfet." },
    ],
  }),
  component: Categories,
});

function Categories() {
  const { data, isLoading } = useQuery({
    queryKey: ["categories-with-series"],
    queryFn: async () => (await supabase.from("categories").select("*, series_categories(series(*))").order("sort_order")).data ?? [],
  });
  return (
    <main className="space-y-8 pb-20 pt-24">
      <h1 className="px-4 font-display text-5xl tracking-wide sm:px-8">Kategoriler</h1>
      {isLoading && <div className="mx-8 h-40 animate-pulse rounded-lg bg-card" />}
      {!isLoading && !data?.length && <EmptyState title="Kategori yok" text="Kategoriler eklendiğinde burada görünecek." />}
      {data?.map((c) => {
        const items = c.series_categories.map((x) => x.series).filter(Boolean) as Series[];
        return (
          <div key={c.id} id={c.slug}>
            <ContentRow title={`${c.emoji ?? ""} ${c.name}`.trim()}>
              {items.length ? items.map((s) => <SeriesCard key={s.id} s={s} />) : <p className="text-sm text-muted-foreground">Bu kategoride henüz seri yok.</p>}
            </ContentRow>
          </div>
        );
      })}
    </main>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/site-client";
import { EmptyState, SeriesCard } from "@/components/app/cards";

export const Route = createFileRoute("/seriler")({
  head: () => ({
    meta: [
      { title: "Tüm Seriler — Bilal Efendi" },
      { name: "description", content: "Bilal Efendi'nin yayındaki tüm serileri." },
      { property: "og:title", content: "Tüm Seriler — Bilal Efendi" },
      { property: "og:description", content: "Bilal Efendi'nin yayındaki tüm serileri." },
    ],
  }),
  component: SeriesList,
});

function SeriesList() {
  const { data, isLoading } = useQuery({
    queryKey: ["series-all"],
    queryFn: async () => (await supabase.from("series").select("*").order("sort_order").order("created_at", { ascending: false })).data ?? [],
  });
  return (
    <main className="px-4 pb-20 pt-24 sm:px-8">
      <h1 className="mb-6 font-display text-5xl tracking-wide">Seriler</h1>
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">{Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-card" />)}</div>
      ) : data?.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">{data.map((s) => <SeriesCard key={s.id} s={s} className="w-full sm:w-full" />)}</div>
      ) : (
        <EmptyState title="Henüz seri yok" text="Yeni seriler eklendiğinde burada görünecek." />
      )}
    </main>
  );
}

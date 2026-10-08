import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Play, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/site-client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ContentRow, EmptyState, EpisodeCard, RowSkeleton, SeriesCard, type Series } from "@/components/app/cards";
import { useToggle } from "@/hooks/useToggles";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bilal Efendi — Serileri İzle" },
      { name: "description", content: "Bilal Efendi'nin tüm serileri tek yerde. İzle, kaldığın yerden devam et, arkadaşlarınla paylaş." },
      { property: "og:title", content: "Bilal Efendi — Serileri İzle" },
      { property: "og:description", content: "Bilal Efendi'nin tüm serileri tek yerde." },
    ],
  }),
  component: Home,
});

function Home() {
  const { user } = useAuth();
  const series = useQuery({
    queryKey: ["series-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("series").select("*").order("sort_order").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const popular = useQuery({
    queryKey: ["episodes-popular"],
    queryFn: async () => (await supabase.from("episodes").select("*, series(title)").order("view_count", { ascending: false }).limit(15)).data ?? [],
  });
  const latest = useQuery({
    queryKey: ["episodes-latest"],
    queryFn: async () => (await supabase.from("episodes").select("*, series(title)").order("created_at", { ascending: false }).limit(15)).data ?? [],
  });
  const cont = useQuery({
    queryKey: ["continue", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("watch_progress").select("*, episodes(*, series(title))").eq("user_id", user!.id).eq("completed", false).order("updated_at", { ascending: false }).limit(15)).data ?? [],
  });
  const sections = useQuery({
    queryKey: ["home-sections"],
    queryFn: async () =>
      (await supabase.from("homepage_sections").select("*, section_items(sort_order, series(*)), categories(id, series_categories(series(*)))").eq("visible", true).order("sort_order")).data ?? [],
  });

  const all = series.data ?? [];
  const hero = all.find((s) => s.show_in_hero) ?? all.find((s) => s.featured) ?? all[0];

  return (
    <main className="pb-20">
      {series.isLoading ? (
        <div className="h-[70vh] animate-pulse bg-card" />
      ) : hero ? (
        <Hero s={hero} />
      ) : (
        <div className="px-4 pt-32">
          <EmptyState title="Yakında burada" text="İlk seriler çok yakında yayında olacak. Takipte kal!" />
        </div>
      )}
      <div className="relative z-10 -mt-16 space-y-8">
        {cont.data && cont.data.length > 0 && (
          <ContentRow title="İzlemeye Devam Et">
            {cont.data.filter((p) => p.episodes).map((p) => (
              <EpisodeCard key={p.episode_id} e={p.episodes!} subtitle={p.episodes!.series?.title} progress={p.duration_seconds ? p.position_seconds / p.duration_seconds : 0} />
            ))}
          </ContentRow>
        )}
        {series.isLoading && <RowSkeleton />}
        {all.length > 0 && (
          <ContentRow title="Tüm Seriler">{all.map((s) => <SeriesCard key={s.id} s={s} />)}</ContentRow>
        )}
        {popular.isLoading ? <RowSkeleton wide /> : popular.data && popular.data.length > 0 && (
          <ContentRow title="Popüler">{popular.data.map((e) => <EpisodeCard key={e.id} e={e} subtitle={e.series?.title} />)}</ContentRow>
        )}
        {latest.data && latest.data.length > 0 && (
          <ContentRow title="Yeni Bölümler">{latest.data.map((e) => <EpisodeCard key={e.id} e={e} subtitle={e.series?.title} />)}</ContentRow>
        )}
        {(sections.data ?? []).map((sec) => {
          let items: Series[] = [];
          if (sec.kind === "category" && sec.categories) items = sec.categories.series_categories.map((x) => x.series).filter(Boolean) as Series[];
          else items = [...sec.section_items].sort((a, b) => a.sort_order - b.sort_order).map((x) => x.series).filter(Boolean) as Series[];
          if (!items.length) return null;
          return <ContentRow key={sec.id} title={sec.title}>{items.map((s) => <SeriesCard key={s.id} s={s} />)}</ContentRow>;
        })}
      </div>
    </main>
  );
}

function Hero({ s }: { s: Series }) {
  const { user } = useAuth();
  const wl = useToggle("watchlist", s.id);
  const first = useQuery({
    queryKey: ["first-ep", s.id],
    queryFn: async () => (await supabase.from("episodes").select("id, seasons(number)").eq("series_id", s.id).order("number").limit(20)).data ?? [],
  });
  const firstId = [...(first.data ?? [])].sort((a, b) => (a.seasons?.number ?? 0) - (b.seasons?.number ?? 0))[0]?.id;
  const bg = s.hero_url || s.cover_url;
  return (
    <section className="relative flex h-[75vh] min-h-[480px] items-end overflow-hidden">
      {bg && <img src={bg} alt={s.title} className="absolute inset-0 h-full w-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/30 to-transparent" />
      <div className="relative max-w-2xl space-y-4 px-4 pb-28 sm:px-8">
        {s.genre && <p className="text-sm font-semibold uppercase tracking-widest text-primary">{s.genre}</p>}
        <h1 className="font-display text-6xl leading-none tracking-wide sm:text-8xl">{s.title}</h1>
        {s.description && <p className="line-clamp-3 text-muted-foreground sm:text-lg">{s.description}</p>}
        <div className="flex flex-wrap gap-3">
          {firstId ? (
            <Button asChild size="lg" className="rounded-full"><Link to="/izle/$id" params={{ id: firstId }}><Play className="fill-current" /> İzle</Link></Button>
          ) : (
            <Button asChild size="lg" className="rounded-full"><Link to="/seri/$slug" params={{ slug: s.slug }}>Detaylar</Link></Button>
          )}
          <Button size="lg" variant="secondary" className="rounded-full" onClick={() => (user ? wl.toggle() : toast("Listene eklemek için giriş yap"))}>
            {wl.active ? <Check /> : <Plus />} Listeme Ekle
          </Button>
        </div>
      </div>
    </section>
  );
}

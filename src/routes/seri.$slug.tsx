import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Play, Plus, Check, Heart } from "lucide-react";
import { supabase } from "@/lib/site-client";
import { useAuth } from "@/hooks/useAuth";
import { useToggle } from "@/hooks/useToggles";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/cards";
import { formatDuration, youtubeThumb, formatDate } from "@/lib/format";

export const Route = createFileRoute("/seri/$slug")({
  head: () => ({
    meta: [
      { title: "Seri — Bilal Efendi" },
      { name: "description", content: "Seri detayları, sezonlar ve bölümler." },
      { property: "og:title", content: "Seri — Bilal Efendi" },
      { property: "og:description", content: "Seri detayları, sezonlar ve bölümler." },
    ],
  }),
  component: SeriesDetail,
});

function SeriesDetail() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["series", slug],
    queryFn: async () => {
      const { data } = await supabase.from("series").select("*, seasons(*), episodes(*)").eq("slug", slug).maybeSingle();
      return data;
    },
  });
  const s = q.data;
  const fav = useToggle("favorites", s?.id ?? "");
  const wl = useToggle("watchlist", s?.id ?? "");
  const progress = useQuery({
    queryKey: ["progress-series", s?.id, user?.id],
    enabled: !!s && !!user,
    queryFn: async () => (await supabase.from("watch_progress").select("*").eq("user_id", user!.id).in("episode_id", s!.episodes.map((e) => e.id))).data ?? [],
  });
  const seasons = [...(s?.seasons ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.number - b.number);
  const [active, setActive] = useState<string | null>(null);
  const seasonId = active ?? seasons[0]?.id;
  const eps = (s?.episodes ?? []).filter((e) => e.season_id === seasonId).sort((a, b) => a.sort_order - b.sort_order || a.number - b.number);

  if (q.isLoading) return <div className="h-[60vh] animate-pulse bg-card" />;
  if (!s) return <div className="pt-32"><EmptyState title="Seri bulunamadı" action={<Link to="/seriler" className="text-primary">Tüm seriler</Link>} /></div>;
  type Progress = { episode_id: string; completed: boolean | null; duration_seconds: number | null; position_seconds: number };
  const pm = new Map<string, Progress>((progress.data ?? []).map((p: Progress) => [p.episode_id, p] as const));
  const first = eps[0];

  return (
    <main className="pb-20">
      <section className="relative flex h-[60vh] min-h-[420px] items-end">
        {(s.hero_url || s.cover_url) && <img src={s.hero_url || s.cover_url!} alt={s.title} className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="relative max-w-3xl space-y-4 px-4 pb-10 sm:px-8">
          <p className="text-sm text-primary">{[s.genre, s.release_date && formatDate(s.release_date), `${seasons.length} sezon`].filter(Boolean).join(" • ")}</p>
          <h1 className="font-display text-6xl tracking-wide sm:text-7xl">{s.title}</h1>
          {s.description && <p className="text-muted-foreground">{s.description}</p>}
          <div className="flex flex-wrap gap-3">
            {first && <Button asChild size="lg" className="rounded-full"><Link to="/izle/$id" params={{ id: first.id }}><Play className="fill-current" /> İzle</Link></Button>}
            <Button size="lg" variant="secondary" className="rounded-full" onClick={wl.toggle}>{wl.active ? <Check /> : <Plus />} Listem</Button>
            <Button size="lg" variant="secondary" className="rounded-full" onClick={fav.toggle}><Heart className={fav.active ? "fill-primary text-primary" : ""} /> Favori</Button>
          </div>
        </div>
      </section>
      <section className="px-4 sm:px-8">
        <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto border-b border-border">
          {seasons.map((se) => (
            <button key={se.id} onClick={() => setActive(se.id)} className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold ${se.id === seasonId ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
              {se.title || `Sezon ${se.number}`}
            </button>
          ))}
        </div>
        {eps.length === 0 ? <EmptyState title="Bölüm yok" text="Bu sezona henüz bölüm eklenmedi." /> : (
          <div className="space-y-3">
            {eps.map((e) => {
              const p = pm.get(e.id);
              const pct = p?.completed ? 1 : p?.duration_seconds ? p.position_seconds / p.duration_seconds : 0;
              return (
                <Link key={e.id} to="/izle/$id" params={{ id: e.id }} className="flex gap-4 rounded-lg p-2 transition-colors hover:bg-card">
                  <div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-md bg-elevated sm:w-56">
                    {(e.thumbnail_url || youtubeThumb(e.youtube_url)) && <img src={e.thumbnail_url || youtubeThumb(e.youtube_url)!} alt="" className="h-full w-full object-cover" loading="lazy" />}
                    {pct > 0 && <div className="absolute inset-x-0 bottom-0 h-1 bg-muted"><div className="h-full bg-primary" style={{ width: `${pct * 100}%` }} /></div>}
                  </div>
                  <div className="min-w-0 py-1">
                    <p className="font-semibold">{e.number > 0 && `${e.number}. `}{e.title} {e.is_new && <span className="ml-2 rounded bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">YENİ</span>}</p>
                    <p className="text-xs text-muted-foreground">{formatDuration(e.duration_seconds)}</p>
                    {e.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.description}</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

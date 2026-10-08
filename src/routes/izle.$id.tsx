import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, Heart, Plus, Check, ThumbsUp, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuth";
import { useToggle } from "@/hooks/useToggles";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/cards";
import { VideoPlayer } from "@/components/app/VideoPlayer";
import { isDirectVideo } from "@/lib/native-video-player";
import { formatCount, youtubeId } from "@/lib/format";

export const Route = createFileRoute("/izle/$id")({
  head: () => ({
    meta: [
      { title: "İzle — Bilal Efendi" },
      { name: "description", content: "Bölümü izle ve kaldığın yerden devam et." },
      { property: "og:title", content: "İzle — Bilal Efendi" },
      { property: "og:description", content: "Bölümü izle ve kaldığın yerden devam et." },
      { property: "og:type", content: "video.episode" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Watch,
});

function Watch() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const q = useQuery({
    queryKey: ["episode", id],
    queryFn: async () => (await supabase.from("episodes").select("*, series(*), seasons(*)").eq("id", id).maybeSingle()).data,
  });
  const siblings = useQuery({
    queryKey: ["episode-siblings", q.data?.series_id],
    enabled: !!q.data,
    queryFn: async () => {
      if (!q.data) return [];
      return (await supabase.from("episodes").select("id, number, sort_order, seasons(number)").eq("series_id", q.data.series_id)).data ?? [];
    },
  });
  const ep = q.data;
  const like = useToggle("episode_likes", id);
  const fav = useToggle("favorites", ep?.series_id ?? "");
  const wl = useToggle("watchlist", ep?.series_id ?? "");

  useEffect(() => { supabase.rpc("register_episode_view", { _episode_id: id }); }, [id]);

  const getStart = useCallback(async () => {
    if (!user) return 0;
    const { data } = await supabase.from("watch_progress").select("position_seconds, completed").eq("user_id", user.id).eq("episode_id", id).maybeSingle();
    return data && !data.completed ? data.position_seconds : 0;
  }, [id, user?.id]);
  const saveProgress = useCallback((pos: number, dur: number) => {
    if (!user || pos < 3) return;
    void (async () => {
      await supabase.from("watch_progress").upsert({ user_id: user.id, episode_id: id, position_seconds: pos, duration_seconds: dur || null, completed: dur > 0 && pos / dur > 0.92, updated_at: new Date().toISOString() });
    })();
  }, [id, user?.id]);

  if (q.isLoading) return <div className="mx-auto mt-24 aspect-video max-w-5xl animate-pulse rounded-xl bg-card" />;
  if (!ep) return <div className="pt-32"><EmptyState title="Bölüm bulunamadı" /></div>;

  const ordered = [...(siblings.data ?? [])].sort((a, b) => (a.seasons?.number ?? 0) - (b.seasons?.number ?? 0) || a.sort_order - b.sort_order || a.number - b.number);
  const idx = ordered.findIndex((e) => e.id === id);
  const prev = idx > 0 ? ordered[idx - 1] : null;
  const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-20 pt-20">
      {isDirectVideo(ep.youtube_url) ? <VideoPlayer key={id} videoId="" videoUrl={ep.youtube_url ?? ""} title={ep.title} getStart={getStart} onProgress={saveProgress} /> : youtubeId(ep.youtube_url) ? <VideoPlayer key={id} videoId={youtubeId(ep.youtube_url) ?? ""} title={ep.title} getStart={getStart} onProgress={saveProgress} /> : <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-card text-muted-foreground">Video henüz eklenmedi.</div>}
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          {ep.series && <Link to="/seri/$slug" params={{ slug: ep.series.slug }} className="text-sm font-semibold text-primary">{ep.series.title} • Sezon {ep.seasons?.number}</Link>}
          <h1 className="mt-1 text-2xl font-bold">{ep.number > 0 && `${ep.number}. `}{ep.title}</h1>
          <p className="text-sm text-muted-foreground">{formatCount(ep.view_count)} görüntülenme</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="rounded-full" onClick={like.toggle}><ThumbsUp className={like.active ? "fill-primary text-primary" : ""} /> Beğen</Button>
          <Button variant="secondary" className="rounded-full" onClick={fav.toggle}><Heart className={fav.active ? "fill-primary text-primary" : ""} /> Favori</Button>
          <Button variant="secondary" className="rounded-full" onClick={wl.toggle}>{wl.active ? <Check /> : <Plus />} Listem</Button>
          <Button variant="secondary" className="rounded-full" onClick={async () => { await navigator.clipboard.writeText(window.location.href); toast.success("Bağlantı kopyalandı"); }}><Share2 /> Paylaş</Button>
        </div>
      </div>
      {ep.description && <p className="mt-4 whitespace-pre-line text-muted-foreground">{ep.description}</p>}
      <div className="mt-8 flex justify-between gap-3">
        {prev ? <Button asChild variant="outline" className="rounded-full"><Link to="/izle/$id" params={{ id: prev.id }}><ChevronLeft /> Önceki bölüm</Link></Button> : <span />}
        {next && <Button asChild className="rounded-full"><Link to="/izle/$id" params={{ id: next.id }}>Sonraki bölüm <ChevronRight /></Link></Button>}
      </div>
    </main>
  );
}

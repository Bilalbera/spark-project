import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Heart, Plus, Check, ThumbsUp, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuth";
import { useToggle } from "@/hooks/useToggles";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/cards";
import { formatCount, youtubeId } from "@/lib/format";

export const Route = createFileRoute("/izle/$id")({
  head: () => ({
    meta: [
      { title: "İzle — Bilal Efendi" },
      { name: "description", content: "Bölümü izle ve kaldığın yerden devam et." },
      { property: "og:title", content: "İzle — Bilal Efendi" },
      { property: "og:description", content: "Bölümü izle ve kaldığın yerden devam et." },
    ],
  }),
  component: Watch,
});

declare global {
  interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void }
}

function loadYT(): Promise<any> {
  return new Promise((res) => {
    if (window.YT?.Player) return res(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); res(window.YT); };
    if (!document.getElementById("yt-api")) {
      const s = document.createElement("script");
      s.id = "yt-api"; s.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(s);
    }
  });
}

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
    queryFn: async () => (await supabase.from("episodes").select("id, number, sort_order, seasons(number)").eq("series_id", q.data!.series_id)).data ?? [],
  });
  const ep = q.data;
  const like = useToggle("episode_likes", id);
  const fav = useToggle("favorites", ep?.series_id ?? "");
  const wl = useToggle("watchlist", ep?.series_id ?? "");
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => { supabase.rpc("register_episode_view", { _episode_id: id }); }, [id]);

  useEffect(() => {
    const vid = youtubeId(ep?.youtube_url);
    if (!vid || !holder.current) return;
    let player: any; let timer: ReturnType<typeof setInterval>; let cancelled = false;
    (async () => {
      let start = 0;
      if (user) {
        const { data } = await supabase.from("watch_progress").select("position_seconds, completed").eq("user_id", user.id).eq("episode_id", id).maybeSingle();
        if (data && !data.completed) start = data.position_seconds;
      }
      const YT = await loadYT();
      if (cancelled || !holder.current) return;
      const el = document.createElement("div");
      holder.current.innerHTML = ""; holder.current.appendChild(el);
      player = new YT.Player(el, { videoId: vid, width: "100%", height: "100%", playerVars: { start: Math.floor(start), rel: 0, modestbranding: 1 } });
      const save = async () => {
        if (!user || !player?.getCurrentTime) return;
        const pos = Math.floor(player.getCurrentTime()); const dur = Math.floor(player.getDuration() || 0);
        if (pos < 3) return;
        await supabase.from("watch_progress").upsert({ user_id: user.id, episode_id: id, position_seconds: pos, duration_seconds: dur || null, completed: dur > 0 && pos / dur > 0.92, updated_at: new Date().toISOString() });
      };
      timer = setInterval(save, 10_000);
    })();
    return () => { cancelled = true; clearInterval(timer); try { player?.destroy(); } catch { /* noop */ } };
  }, [ep?.youtube_url, id, user]);

  if (q.isLoading) return <div className="mx-auto mt-24 aspect-video max-w-5xl animate-pulse rounded-xl bg-card" />;
  if (!ep) return <div className="pt-32"><EmptyState title="Bölüm bulunamadı" /></div>;

  const ordered = [...(siblings.data ?? [])].sort((a, b) => (a.seasons?.number ?? 0) - (b.seasons?.number ?? 0) || a.sort_order - b.sort_order || a.number - b.number);
  const idx = ordered.findIndex((e) => e.id === id);
  const prev = idx > 0 ? ordered[idx - 1] : null;
  const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-20 pt-20">
      <div ref={holder} className="aspect-video w-full overflow-hidden rounded-xl bg-card [&_iframe]:h-full [&_iframe]:w-full">
        {!youtubeId(ep.youtube_url) && <div className="flex h-full items-center justify-center text-muted-foreground">Video henüz eklenmedi.</div>}
      </div>
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

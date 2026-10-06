import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Plus,
  Check,
  ThumbsUp,
  Share2,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Loader2,
} from "lucide-react";
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
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function loadYT(): Promise<any> {
  return new Promise((res) => {
    if (window.YT?.Player) return res(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      res(window.YT);
    };
    if (!document.getElementById("yt-api")) {
      const s = document.createElement("script");
      s.id = "yt-api";
      s.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(s);
    }
  });
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function CustomPlayer({
  videoId,
  userId,
  episodeId,
}: {
  videoId: string;
  userId?: string;
  episodeId: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeHolderRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadedFraction, setLoadedFraction] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    if (isPlaying) {
      hideControlsTimer.current = setTimeout(() => {
        setShowControls(false);
        setIsSettingsOpen(false);
      }, 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    let cancelled = false;

    (async () => {
      let start = 0;
      if (userId) {
        const { data } = await supabase
          .from("watch_progress")
          .select("position_seconds, completed")
          .eq("user_id", userId)
          .eq("episode_id", episodeId)
          .maybeSingle();
        if (data && !data.completed) start = data.position_seconds;
      }

      const YT = await loadYT();
      if (cancelled || !iframeHolderRef.current) return;

      const el = document.createElement("div");
      iframeHolderRef.current.innerHTML = "";
      iframeHolderRef.current.appendChild(el);

      playerRef.current = new YT.Player(el, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          start: Math.floor(start),
          controls: 0, // YouTube varsayılan kontrol çubuğunu kapatır
          disablekb: 1, // Kendi klavye kontrollerimizle çakışmaması için YouTube kısayollarını kapatır
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          fs: 0, // Tam ekranı container seviyesinde yöneteceğimiz için kapatıldı
          enablejsapi: 1,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            const dur = event.target.getDuration() || 0;
            setDuration(dur);
            setIsBuffering(false);
            setVolume(event.target.getVolume() || 100);
            setIsMuted(event.target.isMuted() || false);
          },
          onStateChange: (event: any) => {
            // YT.PlayerState: 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING, 0 = ENDED
            if (event.data === 1) {
              setIsPlaying(true);
              setIsBuffering(false);
            } else if (event.data === 2) {
              setIsPlaying(false);
              setIsBuffering(false);
              setShowControls(true);
            } else if (event.data === 3) {
              setIsBuffering(true);
            } else if (event.data === 0) {
              setIsPlaying(false);
              setShowControls(true);
            }
          },
        },
      });

      // İlerleme ve tamponlama güncellemesi (Her 250ms)
      const updateInterval = setInterval(() => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
          try {
            const curr = playerRef.current.getCurrentTime() || 0;
            const dur = playerRef.current.getDuration() || 0;
            const frac = playerRef.current.getVideoLoadedFraction?.() || 0;
            setCurrentTime(curr);
            if (dur > 0) setDuration(dur);
            setLoadedFraction(frac);
          } catch {
            // Player henüz hazır değilse hata vermesin
          }
        }
      }, 250);

      // Veritabanına izleme durumunu kaydetme (Her 10 saniyede bir)
      timer = setInterval(async () => {
        if (!userId || !playerRef.current?.getCurrentTime) return;
        try {
          const pos = Math.floor(playerRef.current.getCurrentTime());
          const dur = Math.floor(playerRef.current.getDuration() || 0);
          if (pos < 3) return;
          await supabase.from("watch_progress").upsert({
            user_id: userId,
            episode_id: episodeId,
            position_seconds: pos,
            duration_seconds: dur || null,
            completed: dur > 0 && pos / dur > 0.92,
            updated_at: new Date().toISOString(),
          });
        } catch {
          // Bağlantı hatası durumunda sessiz kal
        }
      }, 10_000);

      return () => {
        clearInterval(updateInterval);
        clearInterval(timer);
      };
    })();

    return () => {
      cancelled = true;
      clearInterval(timer);
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* noop */
      }
    };
  }, [videoId, episodeId, userId]);

  // Tam ekran değişimi takibi
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const togglePlay = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
    resetHideTimer();
  };

  const seek = (timeInSeconds: number) => {
    if (!playerRef.current) return;
    const clamped = Math.max(0, Math.min(duration, timeInSeconds));
    playerRef.current.seekTo(clamped, true);
    setCurrentTime(clamped);
    resetHideTimer();
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    seek(percentage * duration);
  };

  const handleProgressBarHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const hoverX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const percentage = hoverX / rect.width;
    setHoverTime(percentage * duration);
    setHoverPosition(hoverX);
  };

  const toggleMute = () => {
    if (!playerRef.current) return;
    if (isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
      if (volume === 0) {
        playerRef.current.setVolume(50);
        setVolume(50);
      }
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
    resetHideTimer();
  };

  const handleVolumeChange = (newVol: number) => {
    if (!playerRef.current) return;
    playerRef.current.setVolume(newVol);
    setVolume(newVol);
    if (newVol === 0) {
      playerRef.current.mute();
      setIsMuted(true);
    } else if (isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
    }
    resetHideTimer();
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen();
      } catch (err) {
        console.error("Tam ekran başlatılamadı:", err);
      }
    } else {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.error("Tam ekrandan çıkılamadı:", err);
      }
    }
  };

  const changeRate = (rate: number) => {
    if (!playerRef.current) return;
    playerRef.current.setPlaybackRate(rate);
    setPlaybackRate(rate);
    setIsSettingsOpen(false);
    resetHideTimer();
  };

  // Klavye kısayolları (Space, Ok Tuşları, M, F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        seek(currentTime - 10);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        seek(currentTime + 10);
      } else if (e.code === "KeyM") {
        e.preventDefault();
        toggleMute();
      } else if (e.code === "KeyF") {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, currentTime, duration, isMuted]);

  return (
    <div
      ref={containerRef}
      onMouseMove={resetHideTimer}
      onClick={resetHideTimer}
      className="group relative aspect-video w-full select-none overflow-hidden rounded-xl bg-black shadow-2xl"
    >
      {/* YouTube IFrame Konteynırı */}
      <div
        ref={iframeHolderRef}
        className="pointer-events-none absolute inset-0 h-full w-full [&_iframe]:h-full [&_iframe]:w-full"
      />

      {/* Şeffaf Tıklama Katmanı (Video üzerine tıklayarak oynat/duraklat) */}
      <div
        className="absolute inset-0 z-10 cursor-pointer"
        onClick={togglePlay}
      />

      {/* Yükleniyor / Buffering İkonu */}
      {isBuffering && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      )}

      {/* Ortadaki Büyük Play/Pause Butonu */}
      {(!isPlaying || showControls) && (
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? "Durdur" : "Oynat"}
          className={`absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background/70 p-4 text-primary backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-background/90 ${
            !isPlaying ? "opacity-100 scale-100" : "opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100"
          }`}
        >
          {isPlaying ? <Pause className="h-8 w-8 fill-current" /> : <Play className="h-8 w-8 fill-current translate-x-0.5" />}
        </button>
      )}

      {/* Özel Kontrol Çubuğu Overlay */}
      <div
        className={`absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-3 pt-8 transition-opacity duration-300 ${
          showControls ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* İlerleme Çubuğu (Progress Bar) */}
        <div
          className="group/bar relative mb-3 flex h-3 cursor-pointer items-center"
          onClick={handleProgressBarClick}
          onMouseMove={handleProgressBarHover}
          onMouseLeave={() => setHoverTime(null)}
        >
          {/* Hover Zaman Etiketi */}
          {hoverTime !== null && (
            <div
              className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded bg-background/90 px-1.5 py-0.5 text-[11px] font-semibold text-foreground shadow-md backdrop-blur-sm"
              style={{ left: `${hoverPosition}px` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}

          {/* Çubuk Arka Planı */}
          <div className="relative h-1 w-full rounded-full bg-white/20 transition-all group-hover/bar:h-2">
            {/* Tamponlanan Kısım (Buffer) */}
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-white/30"
              style={{ width: `${Math.min(100, loadedFraction * 100)}%` }}
            />
            {/* Oynatılan Kısım */}
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-primary"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
            {/* Scrubber Noktası */}
            <div
              className="absolute top-1/2 -translate-y-1/2 rounded-full bg-primary opacity-0 transition-opacity group-hover/bar:opacity-100"
              style={{
                left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                width: "12px",
                height: "12px",
                marginLeft: "-6px",
              }}
            />
          </div>
        </div>

        {/* Butonlar & Kontroller */}
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Oynat / Durdur */}
            <button
              onClick={togglePlay}
              aria-label={isPlaying ? "Durdur" : "Oynat"}
              className="rounded-full p-1.5 text-white/90 transition-transform hover:scale-110 hover:text-white"
            >
              {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
            </button>

            {/* 10 Saniye Geri */}
            <button
              onClick={() => seek(currentTime - 10)}
              aria-label="10 saniye geri sar"
              className="rounded-full p-1.5 text-white/80 transition-transform hover:scale-110 hover:text-white"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            {/* 10 Saniye İleri */}
            <button
              onClick={() => seek(currentTime + 10)}
              aria-label="10 saniye ileri sar"
              className="rounded-full p-1.5 text-white/80 transition-transform hover:scale-110 hover:text-white"
            >
              <RotateCw className="h-4 w-4" />
            </button>

            {/* Ses Seviyesi & Mute */}
            <div className="group/vol flex items-center">
              <button
                onClick={toggleMute}
                aria-label={isMuted ? "Sesi aç" : "Sesi kapat"}
                className="rounded-full p-1.5 text-white/80 transition-transform hover:scale-110 hover:text-white"
              >
                {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                aria-label="Ses seviyesi"
                className="ml-1 h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/30 accent-primary transition-all duration-200 group-hover/vol:w-16 sm:group-hover/vol:w-20"
              />
            </div>

            {/* Zaman Göstergesi */}
            <div className="ml-1 text-xs font-medium text-white/80">
              <span>{formatTime(currentTime)}</span>
              <span className="mx-1 text-white/40">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="relative flex items-center gap-2">
            {/* Ayarlar Menüsü (Hız & Kalite Bilgisi) */}
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              aria-label="Ayarlar"
              className="rounded-full p-1.5 text-white/80 transition-transform hover:scale-110 hover:text-white"
            >
              <Settings className="h-5 w-5" />
            </button>

            {isSettingsOpen && (
              <div className="absolute bottom-10 right-8 z-40 w-52 rounded-lg border border-border/40 bg-background/95 p-2 text-xs text-foreground shadow-2xl backdrop-blur-md">
                <p className="mb-2 font-semibold text-primary">Oynatma Hızı</p>
                <div className="grid grid-cols-3 gap-1">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => changeRate(rate)}
                      className={`rounded px-1.5 py-1 text-center font-medium transition-colors ${
                        playbackRate === rate ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>

                {/* 
                  YouTube IFrame API Kalite Notu:
                  YouTube HTML5 Player API, getAvailableQualityLevels ve setPlaybackQuality metodlarını 
                  resmi olarak sınırlandırmıştır ve video çözünürlüğünü bağlantı hızına ve ekran boyutuna 
                  göre dinamik olarak (Otomatik / Adaptive Bitrate) kendisi belirler. 
                  Bu yüzden kullanıcıyı yanıltacak sahte butonlar yerine gerçek durum şeffafça gösterilir.
                */}
                <div className="mt-3 border-t border-border/40 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-muted-foreground">Kalite</span>
                    <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                      Otomatik (HD)
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    YouTube IFrame bağlantı hızınıza göre en yüksek kaliteyi otomatik uygular.
                  </p>
                </div>
              </div>
            )}

            {/* Tam Ekran Butonu */}
            <button
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Tam ekrandan çık" : "Tam ekran"}
              className="rounded-full p-1.5 text-white/80 transition-transform hover:scale-110 hover:text-white"
            >
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Watch() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const q = useQuery({
    queryKey: ["episode", id],
    queryFn: async () =>
      (await supabase.from("episodes").select("*, series(*), seasons(*)").eq("id", id).maybeSingle()).data,
  });
  const siblings = useQuery({
    queryKey: ["episode-siblings", q.data?.series_id],
    enabled: !!q.data,
    queryFn: async () =>
      (
        await supabase
          .from("episodes")
          .select("id, number, sort_order, seasons(number)")
          .eq("series_id", q.data!.series_id)
      ).data ?? [],
  });

  const ep = q.data;
  const like = useToggle("episode_likes", id);
  const fav = useToggle("favorites", ep?.series_id ?? "");
  const wl = useToggle("watchlist", ep?.series_id ?? "");

  useEffect(() => {
    supabase.rpc("register_episode_view", { _episode_id: id });
  }, [id]);

  if (q.isLoading) return <div className="mx-auto mt-24 aspect-video max-w-5xl animate-pulse rounded-xl bg-card" />;
  if (!ep) return <div className="pt-32"><EmptyState title="Bölüm bulunamadı" /></div>;

  const vid = youtubeId(ep.youtube_url);
  const ordered = [...(siblings.data ?? [])].sort(
    (a, b) => (a.seasons?.number ?? 0) - (b.seasons?.number ?? 0) || a.sort_order - b.sort_order || a.number - b.number
  );
  const idx = ordered.findIndex((e) => e.id === id);
  const prev = idx > 0 ? ordered[idx - 1] : null;
  const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-20 pt-20">
      {/* Özel Video Oynatıcı */}
      {vid ? (
        <CustomPlayer videoId={vid} userId={user?.id} episodeId={id} />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-card text-muted-foreground">
          Video henüz eklenmedi.
        </div>
      )}

      {/* Video Altı Başlık ve Aksiyonlar */}
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          {ep.series && (
            <Link to="/seri/$slug" params={{ slug: ep.series.slug }} className="text-sm font-semibold text-primary">
              {ep.series.title} • Sezon {ep.seasons?.number}
            </Link>
          )}
          {/* Bölüm numarası 0 ise "0." yazmaz, sadece bölüm adını gösterir */}
          <h1 className="mt-1 text-2xl font-bold">
            {ep.number > 0 ? `${ep.number}. ` : ""}{ep.title}
          </h1>
          <p className="text-sm text-muted-foreground">{formatCount(ep.view_count)} görüntülenme</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="rounded-full" onClick={like.toggle}>
            <ThumbsUp className={like.active ? "fill-primary text-primary" : ""} /> Beğen
          </Button>
          <Button variant="secondary" className="rounded-full" onClick={fav.toggle}>
            <Heart className={fav.active ? "fill-primary text-primary" : ""} /> Favori
          </Button>
          <Button variant="secondary" className="rounded-full" onClick={wl.toggle}>
            {wl.active ? <Check /> : <Plus />} Listem
          </Button>
          <Button
            variant="secondary"
            className="rounded-full"
            onClick={async () => {
              await navigator.clipboard.writeText(window.location.href);
              toast.success("Bağlantı kopyalandı");
            }}
          >
            <Share2 /> Paylaş
          </Button>
        </div>
      </div>
      {ep.description && <p className="mt-4 whitespace-pre-line text-muted-foreground">{ep.description}</p>}
      <div className="mt-8 flex justify-between gap-3">
        {prev ? (
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/izle/$id" params={{ id: prev.id }}>
              <ChevronLeft /> Önceki bölüm
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {next && (
          <Button asChild className="rounded-full">
            <Link to="/izle/$id" params={{ id: next.id }}>
              Sonraki bölüm <ChevronRight />
            </Link>
          </Button>
        )}
      </div>
    </main>
  );
}

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Gauge, Loader2, Maximize, Minimize, Pause, Play, RotateCcw, RotateCw, Settings, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { loadYouTubeAPI, playerTime, videoError, type YouTubePlayer } from "@/lib/youtube-player";

interface VideoPlayerProps {
  videoId: string;
  title: string;
  getStart: () => Promise<number>;
  onProgress: (position: number, duration: number) => void;
}

function Control({ label, children, ...props }: React.ComponentProps<typeof Button> & { label: string; children: ReactNode }) {
  return <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label={label} className="video-control size-11 shrink-0" {...props}>{children}</Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}

export function VideoPlayer({ videoId, title, getStart, onProgress }: VideoPlayerProps) {
  const container = useRef<HTMLDivElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const player = useRef<YouTubePlayer | null>(null);
  const progressCallback = useRef(onProgress);
  progressCallback.current = onProgress;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const playingRef = useRef(false);
  const menuRef = useRef(false);
  const seeking = useRef(false);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState(-1);
  const [visible, setVisible] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [rates, setRates] = useState<number[]>([1]);
  const [rate, setRate] = useState(1);
  const [preview, setPreview] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const playing = state === 1;

  const reveal = useCallback(() => {
    setVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      const focused = document.activeElement;
      const keyboardFocus = focused instanceof HTMLElement && focused.matches(":focus-visible") && container.current?.contains(focused);
      if (playingRef.current && !menuRef.current && !seeking.current && !keyboardFocus) setVisible(false);
    }, 3000);
  }, []);

  const toggle = useCallback(() => {
    const p = player.current;
    if (!p) return;
    if (p.getPlayerState() === 1) p.pauseVideo(); else p.playVideo();
    reveal();
  }, [reveal]);
  const seek = useCallback((time: number) => {
    const p = player.current;
    if (!p) return;
    const target = Math.max(0, Math.min(time, p.getDuration() || 0));
    p.seekTo(target, true);
    setPosition(target);
    reveal();
  }, [reveal]);
  const skip = useCallback((seconds: number) => { if (player.current) seek(player.current.getCurrentTime() + seconds); }, [seek]);
  const toggleMute = useCallback(() => {
    const p = player.current;
    if (!p) return;
    const nextMuted = !p.isMuted();
    if (!nextMuted) { p.unMute(); if (p.getVolume() === 0) p.setVolume(50); } else p.mute();
    setMuted(nextMuted); setVolume(p.getVolume()); reveal();
  }, [reveal]);
  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (container.current?.requestFullscreen) await container.current.requestFullscreen();
      else setNotice("Bu tarayıcı özel oynatıcıda tam ekranı desteklemiyor.");
    } catch { setNotice("Tam ekran açılamadı. Tarayıcınızın tam ekran iznini kontrol edin."); }
    reveal();
  }, [reveal]);

  useEffect(() => {
    let cancelled = false;
    let local: YouTubePlayer | null = null;
    let readyTimer: ReturnType<typeof setTimeout> | undefined;
    let ticker: ReturnType<typeof setInterval> | undefined;
    let lastSave = Date.now();
    let initialized = false;
    const save = () => {
      if (!initialized || !local) return;
      progressCallback.current(Math.floor(local.getCurrentTime()), Math.floor(local.getDuration() || 0));
    };
    const stopTicker = () => { clearInterval(ticker); ticker = undefined; };
    const sample = () => {
      if (cancelled || !initialized || !local) return;
      if (!seeking.current) setPosition(local.getCurrentTime());
      setDuration(local.getDuration() || 0);
      setBuffered(local.getVideoLoadedFraction() || 0);
      setVolume(local.getVolume()); setMuted(local.isMuted());
      if (local.getPlayerState() === 1 && Date.now() - lastSave >= 10_000) { lastSave = Date.now(); save(); }
    };
    setError(""); setReady(false); setState(-1); setVisible(true);
    void (async () => {
      try {
        const [YT, start] = await Promise.all([loadYouTubeAPI(), getStart().catch(() => 0)]);
        if (cancelled || !holder.current) return;
        const element = document.createElement("div");
        holder.current.replaceChildren(element);
        readyTimer = setTimeout(() => { if (!cancelled) setError("Video bağlantısı zaman aşımına uğradı. Tekrar deneyin."); }, 20_000);
        local = new YT.Player(element, {
          videoId, width: "100%", height: "100%",
          playerVars: { controls: 0, enablejsapi: 1, origin: window.location.origin, playsinline: 1, rel: 0, start: Math.floor(start), iv_load_policy: 3 },
          events: {
            onReady: ({ target }) => {
              if (cancelled) return;
              clearTimeout(readyTimer); initialized = true; player.current = target;
              target.getIframe().title = title;
              setReady(true); setError("");
              setRates(target.getAvailablePlaybackRates()); setRate(target.getPlaybackRate());
              sample();
            },
            onStateChange: ({ data }) => {
              if (cancelled) return;
              setState(data); playingRef.current = data === 1; reveal(); sample();
              stopTicker();
              if (data === 1 || data === 3) ticker = setInterval(sample, 500);
              if (data === 2 || data === 0) save();
            },
            onError: ({ data }) => { if (!cancelled) { clearTimeout(readyTimer); stopTicker(); playingRef.current = false; setError(videoError(data)); } },
            onPlaybackRateChange: ({ data }) => { if (!cancelled) setRate(data); },
            onAutoplayBlocked: () => { if (!cancelled) { setState(2); playingRef.current = false; reveal(); } },
          },
        });
      } catch (reason) { if (!cancelled) setError(reason instanceof Error ? reason.message : "Video yüklenemedi. Tekrar deneyin."); }
    })();
    const onVisibility = () => { if (document.hidden) { save(); stopTicker(); } else { sample(); if (playingRef.current && !ticker) ticker = setInterval(sample, 500); } };
    const onPageHide = () => save();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      save(); cancelled = true; stopTicker(); clearTimeout(readyTimer); clearTimeout(hideTimer.current);
      document.removeEventListener("visibilitychange", onVisibility); window.removeEventListener("pagehide", onPageHide);
      player.current = null; playingRef.current = false;
      try { local?.destroy(); } catch { /* Already removed by navigation. */ }
    };
  }, [videoId, title, getStart, attempt, reveal]);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(document.fullscreenElement === container.current);
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.altKey || event.ctrlKey || event.metaKey || target instanceof HTMLElement && (target.closest("input, textarea, select, [contenteditable], [role='slider'], [role^='menu']") || target.closest("button, a"))) return;
      if (!ready || error) return;
      const key = event.key.toLowerCase();
      if (![" ", "arrowleft", "arrowright", "m", "f"].includes(key)) return;
      event.preventDefault();
      if (key === " ") toggle();
      if (key === "arrowleft") skip(-10);
      if (key === "arrowright") skip(10);
      if (key === "m") toggleMute();
      if (key === "f") void toggleFullscreen();
    };
    document.addEventListener("fullscreenchange", onFullscreen); window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("fullscreenchange", onFullscreen); window.removeEventListener("keydown", onKey); };
  }, [ready, error, toggle, skip, toggleMute, toggleFullscreen]);

  const menuChange = (open: boolean) => { menuRef.current = open; reveal(); };
  // YouTube removed reliable resolution discovery/selection from its public IFrame API.
  // Do not call getAvailableQualityLevels/setPlaybackQuality or invent resolution options.
  // The current schema contains only youtube_url, not direct MP4/HLS/DASH renditions.
  // Likewise no documented caption-track discovery exists: do not show a fake CC toggle.
  // rel=0 limits recommendations to the same channel; it does NOT remove YouTube branding/end screens.
  return (
    <TooltipProvider delayDuration={350}>
      <div ref={container} className="video-player relative aspect-video w-full overflow-hidden rounded-lg text-player-foreground" role="region" aria-label={`${title} video oynatıcı`} onPointerEnter={reveal} onPointerMove={reveal} onPointerDown={reveal} onFocusCapture={reveal}>
        <div ref={holder} className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full" />
        {ready && !error && <Button variant="ghost" aria-label={playing ? "Video alanı: duraklat" : "Video alanı: oynat"} className="absolute inset-0 h-full w-full rounded-none hover:bg-transparent focus-visible:ring-inset" onClick={toggle} />}
        {error ? <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-player-surface px-6 text-center" role="alert"><AlertCircle className="size-8 text-destructive" /><p className="max-w-md text-sm">{error}</p><Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}><RotateCcw />Tekrar dene</Button></div> : <>
          {!ready && <div className="pointer-events-none absolute inset-0 flex items-center justify-center" role="status" aria-label="Video yükleniyor"><Loader2 className="size-8 animate-spin text-primary" /></div>}
          {ready && state !== 1 && state !== 3 && <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><Button variant="default" size="icon" aria-label={state === 2 ? "Oynat" : "Videoyu oynat"} className="pointer-events-auto size-14 rounded-lg [&_svg]:size-7" onClick={toggle}><Play className="fill-current" /></Button></div>}
          {state === 3 && <div className="pointer-events-none absolute inset-0 flex items-center justify-center" role="status" aria-label="Video tamponlanıyor"><Loader2 className="size-8 animate-spin text-primary" /></div>}
          <div className="video-controls absolute inset-x-0 bottom-0 px-2 pb-1 pt-8 sm:px-4 sm:pb-2" data-visible={visible || !playing} onPointerEnter={() => { clearTimeout(hideTimer.current); setVisible(true); }} onPointerLeave={reveal} onBlurCapture={reveal}>
            <div className="relative flex h-6 items-center" onPointerMove={(event) => { const box = event.currentTarget.getBoundingClientRect(); setPreview(Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)) * duration); }} onPointerLeave={() => setPreview(null)}>
              <progress className="video-buffer pointer-events-none absolute h-1.5 w-full" value={buffered} max={1} aria-label="Tamponlanan video" />
              {preview !== null && duration > 0 && <span className="pointer-events-none absolute bottom-7 left-1/2 -translate-x-1/2 rounded bg-player-surface px-2 py-1 text-xs tabular-nums">{playerTime(preview)}</span>}
              <Slider aria-label="Video ilerlemesi" aria-valuetext={`${playerTime(position)} / ${playerTime(duration)}`} disabled={!ready || !duration} min={0} max={duration || 1} step={1} value={[Math.min(position, duration || 1)]} onValueChange={([value = 0]) => { seeking.current = true; setPosition(value); reveal(); }} onValueCommit={([value = 0]) => { seek(value); seeking.current = false; }} className="video-seek h-6" />
            </div>
            <div className="flex min-w-0 items-center gap-0 sm:gap-1">
              <Control label={playing ? "Duraklat" : "Oynat"} disabled={!ready} onClick={toggle}>{playing ? <Pause /> : <Play />}</Control>
              <Control label="10 saniye geri" disabled={!ready} onClick={() => skip(-10)}><RotateCcw /></Control>
              <Control label="10 saniye ileri" disabled={!ready} onClick={() => skip(10)}><RotateCw /></Control>
              <span className="min-w-0 whitespace-nowrap px-1 text-[10px] tabular-nums sm:px-2 sm:text-xs">{playerTime(position)} / {playerTime(duration)}</span>
              <div className="flex-1" />
              <div className="hidden items-center sm:flex"><Control label={muted || volume === 0 ? "Sesi aç" : "Sessize al"} disabled={!ready} onClick={toggleMute}>{muted || volume === 0 ? <VolumeX /> : <Volume2 />}</Control><Slider aria-label="Ses seviyesi" min={0} max={100} step={1} value={[muted ? 0 : volume]} disabled={!ready} className="mr-2 w-16" onValueChange={([value = 0]) => { player.current?.setVolume(value); player.current?.unMute(); setVolume(value); setMuted(false); reveal(); }} /></div>
              <DropdownMenu onOpenChange={menuChange}><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="video-control hidden size-11 sm:inline-flex" aria-label="Kalite" disabled={!ready}><Gauge /></Button></DropdownMenuTrigger><DropdownMenuContent container={container.current} side="top" align="end" className="w-60"><DropdownMenuLabel>Kalite</DropdownMenuLabel><DropdownMenuItem disabled>Otomatik · YouTube</DropdownMenuItem><p className="px-2 pb-2 text-xs text-muted-foreground">Çözünürlük bağlantınıza göre YouTube tarafından otomatik ayarlanır.</p></DropdownMenuContent></DropdownMenu>
              <DropdownMenu onOpenChange={menuChange}><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="video-control size-11" aria-label="Ayarlar" disabled={!ready}><Settings /></Button></DropdownMenuTrigger><DropdownMenuContent container={container.current} side="top" align="end" className="w-60"><DropdownMenuLabel>Ayarlar</DropdownMenuLabel><DropdownMenuItem onSelect={toggleMute}>{muted || volume === 0 ? <VolumeX /> : <Volume2 />}{muted || volume === 0 ? "Sesi aç" : "Sessize al"}</DropdownMenuItem><div className="px-3 py-3"><Slider aria-label="Ses seviyesi (ayarlar)" min={0} max={100} value={[muted ? 0 : volume]} onValueChange={([value = 0]) => { player.current?.setVolume(value); player.current?.unMute(); setVolume(value); setMuted(false); }} /></div><DropdownMenuSeparator /><DropdownMenuLabel>Kalite · Otomatik</DropdownMenuLabel><p className="px-2 pb-2 text-xs text-muted-foreground">YouTube tarafından ayarlanır.</p>{rates.length > 1 && <><DropdownMenuSeparator /><DropdownMenuLabel>Oynatma hızı</DropdownMenuLabel><DropdownMenuRadioGroup value={String(rate)} onValueChange={(value) => player.current?.setPlaybackRate(Number(value))}>{rates.map((r) => <DropdownMenuRadioItem key={r} value={String(r)}>{r === 1 ? "Normal" : `${r}×`}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></>}</DropdownMenuContent></DropdownMenu>
              <Control label={fullscreen ? "Tam ekrandan çık" : "Tam ekran"} disabled={!ready} onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize /> : <Maximize />}</Control>
            </div>
          </div>
          {notice && <div className="absolute left-2 right-2 top-2 rounded bg-player-surface px-3 py-2 text-xs" role="status">{notice}<Button variant="ghost" size="sm" aria-label="Uyarıyı kapat" onClick={() => setNotice("")}>×</Button></div>}
        </>}
      </div>
    </TooltipProvider>
  );
}
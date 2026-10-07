export interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  getVideoLoadedFraction(): number;
  getVolume(): number;
  setVolume(volume: number): void;
  isMuted(): boolean;
  mute(): void;
  unMute(): void;
  getAvailablePlaybackRates(): number[];
  getPlaybackRate(): number;
  setPlaybackRate(rate: number): void;
  getIframe(): HTMLIFrameElement;
  destroy(): void;
}

interface YouTubeAPI {
  Player: new (element: HTMLElement, options: {
    videoId: string;
    width: string;
    height: string;
    playerVars: Record<string, number | string>;
    events: {
      onReady(event: { target: YouTubePlayer }): void;
      onStateChange(event: { data: number }): void;
      onError(event: { data: number }): void;
      onPlaybackRateChange(event: { data: number }): void;
      onAutoplayBlocked(): void;
    };
  }) => YouTubePlayer;
}

type YouTubeWindow = Window & { YT?: YouTubeAPI; onYouTubeIframeAPIReady?: (() => void) | undefined };

let pending: Promise<YouTubeAPI> | undefined;

// One script for all episodes; no polling or repeated global callback chains.
export function loadYouTubeAPI(): Promise<YouTubeAPI> {
  const youtubeWindow = window as YouTubeWindow;
  if (youtubeWindow.YT?.Player) return Promise.resolve(youtubeWindow.YT);
  if (pending) return pending;
  pending = new Promise<YouTubeAPI>((resolve, reject) => {
    const previous = youtubeWindow.onYouTubeIframeAPIReady;
    const existing = document.getElementById("yt-api");
    const script = existing instanceof HTMLScriptElement ? existing : document.createElement("script");
    const cleanup = () => {
      clearTimeout(timeout);
      script.removeEventListener("error", fail);
      if (youtubeWindow.onYouTubeIframeAPIReady === ready) youtubeWindow.onYouTubeIframeAPIReady = previous;
    };
    const fail = () => {
      cleanup();
      pending = undefined;
      script.remove();
      reject(new Error("YouTube bağlantısı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin."));
    };
    const ready = () => {
      cleanup();
      previous?.();
      if (youtubeWindow.YT?.Player) resolve(youtubeWindow.YT);
      else fail();
    };
    const timeout = setTimeout(fail, 15_000);
    youtubeWindow.onYouTubeIframeAPIReady = ready;
    script.addEventListener("error", fail, { once: true });
    if (!existing) {
      script.id = "yt-api";
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
  });
  return pending;
}

export function videoError(code: number): string {
  if (code === 101 || code === 150) return "Bu videonun sahibi başka sitelerde oynatılmasına izin vermiyor.";
  if (code === 100) return "Video kaldırılmış, gizli veya şu anda kullanılamıyor.";
  if (code === 153) return "YouTube bu sitenin oynatıcı bağlantısını doğrulayamadı. Sayfayı yeniden açmayı deneyin.";
  if (code === 2) return "Video bağlantısı geçersiz.";
  return "Video oynatılamadı. Lütfen tekrar deneyin.";
}

export function playerTime(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = String(total % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${secs}` : `${minutes}:${secs}`;
}
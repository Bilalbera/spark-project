import type { YouTubePlayer } from "@/lib/youtube-player";

export type PlaybackControls = Omit<YouTubePlayer, "getIframe">;

/** A single uploaded MP4 has one source resolution, not selectable renditions. */
export function nativePlayback(video: HTMLVideoElement): PlaybackControls {
  return {
    playVideo: () => { void video.play().catch(() => { /* The player reports blocked playback separately. */ }); },
    pauseVideo: () => video.pause(),
    seekTo: (seconds) => { video.currentTime = seconds; },
    getCurrentTime: () => video.currentTime,
    getDuration: () => Number.isFinite(video.duration) ? video.duration : 0,
    getPlayerState: () => video.ended ? 0 : video.paused ? 2 : video.readyState < 3 ? 3 : 1,
    getVideoLoadedFraction: () => video.buffered.length && Number.isFinite(video.duration) && video.duration > 0 ? video.buffered.end(video.buffered.length - 1) / video.duration : 0,
    getVolume: () => video.volume * 100,
    setVolume: (value) => { video.volume = Math.max(0, Math.min(1, value / 100)); },
    isMuted: () => video.muted,
    mute: () => { video.muted = true; },
    unMute: () => { video.muted = false; },
    getAvailablePlaybackRates: () => [0.5, 0.75, 1, 1.25, 1.5, 2],
    getPlaybackRate: () => video.playbackRate,
    setPlaybackRate: (value) => { video.playbackRate = value; },
    destroy: () => { video.pause(); video.removeAttribute("src"); video.load(); video.remove(); },
  };
}

export function isDirectVideo(url?: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol) && parsed.pathname.toLowerCase().endsWith(".mp4");
  } catch { return false; }
}
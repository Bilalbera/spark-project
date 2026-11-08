export function formatDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatCount(n?: number | null) {
  const value = n ?? 0;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}B`;
  return String(value);
}

export function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatTime(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

/** Accept a raw image URL or a Markdown link/image and return a browser-ready URL. */
export function normalizeImageUrl(value?: string | null) {
  if (!value) return null;
  let candidate = value.trim();
  const markdown = /^!?\[[^\]]*\]\(\s*(?:<([^>]+)>|(https?:\/\/[^)\s]+))(?:\s+["'][^)]*["'])?\s*\)$/.exec(candidate);
  if (markdown) candidate = (markdown[1] ?? markdown[2] ?? "").trim();
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : null;
  }
}

export function relativeTime(value?: string | null) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "şimdi";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gün önce`;
  return formatDate(value);
}

export function youtubeId(url?: string | null) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]{6,})/,
    /(?:youtu\.be\/)([\w-]{6,})/,
    /(?:youtube\.com\/embed\/)([\w-]{6,})/,
    /(?:youtube\.com\/shorts\/)([\w-]{6,})/,
    /(?:youtube\.com\/live\/)([\w-]{6,})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  if (/^[\w-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

export function youtubeThumb(url?: string | null) {
  const id = youtubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

export function slugify(input: string) {
  const map: Record<string, string> = {
    ç: "c",
    ğ: "g",
    ı: "i",
    İ: "i",
    ö: "o",
    ş: "s",
    ü: "u",
  };
  return input
    .toLowerCase()
    .replace(/[çğıİöşü]/g, (c) => map[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function isOnline(lastSeen?: string | null) {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 2 * 60 * 1000;
}

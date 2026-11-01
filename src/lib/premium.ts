/** Premium membership helpers. Membership is active only while premium_until is in the future. */
export const PREMIUM_TRIAL_DAYS = 30;

export function isPremium(premiumUntil: string | null | undefined, now: Date = new Date()) {
  if (!premiumUntil) return false;
  const t = new Date(premiumUntil).getTime();
  return Number.isFinite(t) && t > now.getTime();
}

export function premiumDaysLeft(premiumUntil: string | null | undefined, now: Date = new Date()) {
  if (!isPremium(premiumUntil, now)) return 0;
  return Math.ceil((new Date(premiumUntil!).getTime() - now.getTime()) / 86_400_000);
}

/** Premium users first, keeping the original order otherwise. */
export function premiumFirst<T extends { premium_until?: string | null }>(rows: T[], now: Date = new Date()) {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => Number(isPremium(b.r.premium_until, now)) - Number(isPremium(a.r.premium_until, now)) || a.i - b.i)
    .map((x) => x.r);
}

export const PREMIUM_TITLES = ["Efsanevi Avcı", "Bilal Efendi Takipçisi", "Gece Bekçisi", "Köy Muhafızı", "Elmas Madencisi", "Nether Gezgini"];

export const PROFILE_THEMES = [
  { id: "standard", label: "Standart" },
  { id: "gold", label: "Premium Gold" },
  { id: "dark", label: "Premium Dark" },
  { id: "neon", label: "Premium Neon" },
  { id: "obsidian", label: "Obsidian" },
  { id: "nether", label: "Nether" },
];

export const ACCENT_COLORS = [
  { id: "default", label: "Varsayılan" },
  { id: "gold", label: "Altın" },
  { id: "purple", label: "Mor" },
  { id: "blue", label: "Mavi" },
  { id: "emerald", label: "Zümrüt Yeşili" },
  { id: "crimson", label: "Kan Kırmızısı" },
];

export const AVATAR_FRAMES = [
  { id: "gold", label: "👑 Gold" },
  { id: "diamond", label: "💎 Diamond" },
  { id: "glow", label: "✨ Glow" },
  { id: "fire", label: "🔥 Fire" },
  { id: "nether", label: "⚡ Nether Yıldızı" },
];

export const CHAT_THEMES = [
  { id: "standard", label: "Standart" },
  { id: "dark", label: "Premium Dark" },
  { id: "gold", label: "Premium Gold" },
  { id: "midnight", label: "Midnight" },
  { id: "nether", label: "Nether Glow" },
];

export const PROFILE_MUSIC = [
  { id: "", label: "Müzik yok" },
  { id: "koy", label: "Köy Gecesi" },
  { id: "nether", label: "Nether Yolculuğu" },
  { id: "efsane", label: "Efsanevi Macera" },
];

export const BASIC_REACTIONS = ["👍", "❤️", "😂"];
export const PREMIUM_REACTIONS = ["👑", "✨", "🔥", "💎", "⚔️", "🛡️"];

export const STICKERS: Record<string, { emoji: string; label: string }> = {
  creeper: { emoji: "🟩", label: "Creeper" },
  kazma: { emoji: "⛏️", label: "Kazma" },
  elmas: { emoji: "💎", label: "Elmas" },
  kilic: { emoji: "🗡️", label: "Kılıç" },
  tnt: { emoji: "🧨", label: "TNT" },
  ender: { emoji: "🟣", label: "Ender İncisi" },
};

export function stickerContent(id: string) {
  return `[sticker:${id}]`;
}

export function parseSticker(content: string) {
  const m = /^\[sticker:([a-z]+)\]$/.exec(content);
  return m ? STICKERS[m[1]!] ?? null : null;
}

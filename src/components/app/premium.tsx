import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Crown, Music, Pause } from "lucide-react";
import { supabase } from "@/lib/site-client";
import { isPremium, PROFILE_MUSIC } from "@/lib/premium";
import { cn } from "@/lib/utils";

type NameProfile = { display_name?: string | null; username?: string | null; premium_until?: string | null } | null | undefined;

export function PremiumBadge({ className }: { className?: string }) {
  return (
    <span className={cn("premium-badge inline-flex shrink-0 items-center rounded px-1.5 py-px align-middle text-[10px] font-extrabold uppercase tracking-wider", className)}>
      Premium
    </span>
  );
}

/** Display name with the premium shimmer and [PREMIUM] badge while membership is active. */
export function PremiumName({ p, className, fallback = "Kullanıcı" }: { p: NameProfile; className?: string; fallback?: string }) {
  const name = p?.display_name || p?.username || fallback;
  const premium = isPremium(p?.premium_until);
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <span className={cn("truncate", premium && "premium-name")}>{name}</span>
      {premium && <PremiumBadge />}
    </span>
  );
}

export function PremiumSeal({ title }: { title?: string | null }) {
  return (
    <span className="premium-seal inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold">
      <Crown className="h-3.5 w-3.5" /> Premium Üye{title ? ` • ⚔️ ${title}` : ""}
    </span>
  );
}

export function ProfileShowcase({ episodeId, seriesId }: { episodeId?: string | null; seriesId?: string | null }) {
  const q = useQuery({
    queryKey: ["showcase", episodeId, seriesId],
    enabled: !!(episodeId || seriesId),
    queryFn: async () => {
      const [e, s] = await Promise.all([
        episodeId ? supabase.from("episodes").select("id, title, number, series(title)").eq("id", episodeId).maybeSingle() : Promise.resolve({ data: null }),
        seriesId ? supabase.from("series").select("slug, title").eq("id", seriesId).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      return { episode: e.data, series: s.data };
    },
  });
  if (!q.data?.episode && !q.data?.series) return null;
  return (
    <div className="premium-glow-row w-full max-w-md rounded-xl bg-background/40 p-4 text-left">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">⭐ Vitrin</p>
      {q.data.episode && (
        <Link to="/izle/$id" params={{ id: q.data.episode.id }} className="block hover:text-primary">
          <span className="text-xs text-muted-foreground">Favori Bölümüm · </span>
          {q.data.episode.series?.title} — {q.data.episode.number > 0 && `${q.data.episode.number}. `}{q.data.episode.title}
        </Link>
      )}
      {q.data.series && (
        <Link to="/seri/$slug" params={{ slug: q.data.series.slug }} className="mt-1 block hover:text-primary">
          <span className="text-xs text-muted-foreground">Favori Serim · </span>{q.data.series.title}
        </Link>
      )}
    </div>
  );
}

const TRACKS: Record<string, { notes: number[]; wave: OscillatorType; tempo: number }> = {
  koy: { notes: [261.6, 329.6, 392, 329.6, 293.7, 349.2, 440, 349.2], wave: "triangle", tempo: 0.7 },
  nether: { notes: [110, 130.8, 116.5, 98, 110, 146.8, 130.8, 103.8], wave: "sawtooth", tempo: 0.9 },
  efsane: { notes: [196, 246.9, 293.7, 392, 349.2, 293.7, 329.6, 246.9], wave: "square", tempo: 0.55 },
};

/** Short synthesized cinematic loop. Browsers block autoplay, so visitors start it with a button. */
export function ProfileMusic({ track }: { track?: string | null }) {
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const timer = useRef<number | null>(null);
  const meta = PROFILE_MUSIC.find((m) => m.id === track);

  function stop() {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    ctxRef.current?.close();
    ctxRef.current = null;
    setPlaying(false);
  }
  useEffect(() => stop, []);
  if (!track || !meta || !TRACKS[track]) return null;
  const t = TRACKS[track]!;

  function start() {
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    let i = 0;
    const playNote = () => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = t.wave;
      osc.frequency.value = t.notes[i % t.notes.length]!;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.06, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t.tempo * 1.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + t.tempo * 1.7);
      i += 1;
    };
    playNote();
    timer.current = window.setInterval(playNote, t.tempo * 1000);
    setPlaying(true);
  }

  return (
    <button onClick={playing ? stop : start} className="premium-seal inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" aria-label={playing ? "Profil müziğini durdur" : "Profil müziğini çal"}>
      {playing ? <Pause className="h-3.5 w-3.5" /> : <Music className="h-3.5 w-3.5" />} {meta.label}
    </button>
  );
}

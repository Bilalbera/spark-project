import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
import type { ReactNode } from "react";
import type { Tables } from "@/lib/site-database.types";
import { formatDuration, youtubeThumb } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Series = Tables<"series">;
export type Episode = Tables<"episodes">;

export function SeriesCard({ s, className }: { s: Series; className?: string }) {
  return (
    <Link
      to="/seri/$slug"
      params={{ slug: s.slug }}
      className={cn(
        "group relative block w-36 shrink-0 overflow-hidden rounded-lg bg-card sm:w-44 transition-transform duration-300 hover:scale-105 hover:z-10",
        className,
      )}
    >
      <div className="aspect-[2/3] w-full bg-elevated">
        {s.cover_url ? (
          <img src={s.cover_url} alt={s.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center p-3 text-center font-display text-2xl text-muted-foreground">
            {s.title}
          </div>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background to-transparent p-3 pt-10">
        <p className="line-clamp-2 text-sm font-semibold">{s.title}</p>
        {s.genre && <p className="text-xs text-muted-foreground">{s.genre}</p>}
      </div>
    </Link>
  );
}

export function EpisodeCard({
  e,
  progress,
  subtitle,
  className,
}: {
  e: Episode;
  progress?: number;
  subtitle?: string;
  className?: string;
}) {
  const thumb = e.thumbnail_url || youtubeThumb(e.youtube_url);
  return (
    <Link
      to="/izle/$id"
      params={{ id: e.id }}
      className={cn("group block w-64 shrink-0 sm:w-72", className)}
    >
      <div className="relative aspect-video overflow-hidden rounded-lg bg-elevated">
        {thumb && (
          <img src={thumb} alt={e.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-background/40 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="rounded-full bg-primary p-3 text-primary-foreground"><Play className="h-5 w-5 fill-current" /></span>
        </div>
        {e.is_new && (
          <span className="absolute left-2 top-2 rounded bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">Yeni</span>
        )}
        {e.duration_seconds ? (
          <span className="absolute bottom-2 right-2 rounded bg-background/80 px-1.5 text-xs">{formatDuration(e.duration_seconds)}</span>
        ) : null}
        {progress !== undefined && progress > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-muted">
            <div className="h-full bg-primary" style={{ width: `${Math.min(100, progress * 100)}%` }} />
          </div>
        )}
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-semibold">
        {e.number > 0 && `${e.number}. `}{e.title}
      </p>
      {subtitle && <p className="line-clamp-1 text-xs text-muted-foreground">{subtitle}</p>}
    </Link>
  );
}

export function ContentRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="px-4 font-display text-2xl tracking-wide sm:px-8 md:text-3xl">{title}</h2>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-4 pt-1 sm:px-8">{children}</div>
    </section>
  );
}

export function RowSkeleton({ wide }: { wide?: boolean }) {
  return (
    <div className="space-y-3 px-4 sm:px-8">
      <div className="h-7 w-48 animate-pulse rounded bg-card" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={cn("shrink-0 animate-pulse rounded-lg bg-card", wide ? "aspect-video w-72" : "aspect-[2/3] w-44")} />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-14 text-center">
      <p className="font-display text-3xl tracking-wide">{title}</p>
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
      {action}
    </div>
  );
}

export function UserAvatar({
  p,
  size = 40,
  online,
}: {
  p?: { avatar_url?: string | null; display_name?: string | null; username?: string | null } | null;
  size?: number;
  online?: boolean;
}) {
  const name = p?.display_name || p?.username || "?";
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {p?.avatar_url ? (
        <img src={p.avatar_url} alt={name} className="h-full w-full rounded-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-accent font-semibold text-accent-foreground" style={{ fontSize: size * 0.4 }}>
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      {online !== undefined && (
        <span className={cn("absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background", online ? "bg-success" : "bg-muted-foreground")} />
      )}
    </span>
  );
}

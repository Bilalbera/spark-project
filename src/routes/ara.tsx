import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/lib/site-client";
import { useSession } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { EpisodeCard, SeriesCard, UserAvatar } from "@/components/app/cards";

export const Route = createFileRoute("/ara")({
  head: () => ({
    meta: [
      { title: "Ara — Bilal Efendi" },
      { name: "description", content: "Seri, bölüm, kategori ve kullanıcı ara." },
      { property: "og:title", content: "Ara — Bilal Efendi" },
      { property: "og:description", content: "Seri, bölüm, kategori ve kullanıcı ara." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { user } = useSession();
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => { const t = setTimeout(() => setTerm(text.trim()), 300); return () => clearTimeout(t); }, [text]);
  const like = `%${term.replace(/[%_,()]/g, "")}%`;
  const q = useQuery({
    queryKey: ["search", term, !!user],
    enabled: term.length >= 2,
    queryFn: async () => {
      const [s, e, c, u] = await Promise.all([
        supabase.from("series").select("*").ilike("title", like).limit(12),
        supabase.from("episodes").select("*, series(title)").ilike("title", like).limit(12),
        supabase.from("categories").select("*").ilike("name", like).limit(12),
        user ? supabase.from("profiles").select("id, username, display_name, avatar_url").or(`username.ilike.${like},display_name.ilike.${like}`).limit(12) : Promise.resolve({ data: [] as any[] }),
      ]);
      return { series: s.data ?? [], episodes: e.data ?? [], categories: c.data ?? [], users: u.data ?? [] };
    },
  });
  const r = q.data;
  const none = r && !r.series.length && !r.episodes.length && !r.categories.length && !r.users.length;
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 pb-20 pt-24">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Seri, bölüm, kategori veya kullanıcı ara..." className="h-14 rounded-full pl-12 text-lg" />
      </div>
      {term.length < 2 && <p className="text-center text-muted-foreground">Aramak için en az 2 harf yaz.</p>}
      {q.isLoading && <div className="h-40 animate-pulse rounded-xl bg-card" />}
      {none && <p className="text-center text-muted-foreground">"{term}" için sonuç bulunamadı.</p>}
      {r?.series.length ? <Group title="Seriler"><div className="flex flex-wrap gap-3">{r.series.map((s) => <SeriesCard key={s.id} s={s} />)}</div></Group> : null}
      {r?.episodes.length ? <Group title="Bölümler"><div className="flex flex-wrap gap-4">{r.episodes.map((e) => <EpisodeCard key={e.id} e={e} subtitle={e.series?.title} />)}</div></Group> : null}
      {r?.categories.length ? <Group title="Kategoriler"><div className="flex flex-wrap gap-2">{r.categories.map((c) => <Link key={c.id} to="/kategoriler" hash={c.slug} className="rounded-full bg-card px-4 py-2 text-sm hover:bg-elevated">{c.emoji} {c.name}</Link>)}</div></Group> : null}
      {r?.users.length ? <Group title="Kullanıcılar"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{r.users.map((p: any) => (
        <Link key={p.id} to="/u/$username" params={{ username: p.username ?? p.id }} className="flex items-center gap-3 rounded-lg bg-card p-3 hover:bg-elevated">
          <UserAvatar p={p} /><div><p className="font-semibold">{p.display_name}</p><p className="text-xs text-muted-foreground">@{p.username}</p></div>
        </Link>))}</div></Group> : null}
    </main>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="mb-3 font-display text-3xl tracking-wide">{title}</h2>{children}</section>;
}

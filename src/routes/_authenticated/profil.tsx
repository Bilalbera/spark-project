import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/site-client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmptyState, EpisodeCard, SeriesCard, UserAvatar, type Series } from "@/components/app/cards";
import { fetchFriends } from "@/lib/social";
import { formatDate, isOnline, relativeTime } from "@/lib/format";
import { ProfileForm } from "./kurulum";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({ meta: [{ title: "Profilim — Bilal Efendi" }, { name: "description", content: "Favorilerin, listen, izleme geçmişin ve arkadaşların." }] }),
  component: MyProfile,
});

function MyProfile() {
  const { user, profile } = useAuth();
  const uid = user?.id;
  const favs = useQuery({ queryKey: ["my-favorites", uid], enabled: !!uid, queryFn: async () => (await supabase.from("favorites").select("series(*)").eq("user_id", uid!).order("created_at", { ascending: false })).data ?? [] });
  const list = useQuery({ queryKey: ["my-watchlist", uid], enabled: !!uid, queryFn: async () => (await supabase.from("watchlist").select("series(*)").eq("user_id", uid!).order("created_at", { ascending: false })).data ?? [] });
  const cont = useQuery({ queryKey: ["continue", uid], enabled: !!uid, queryFn: async () => (await supabase.from("watch_progress").select("*, episodes(*, series(title))").eq("user_id", uid!).eq("completed", false).order("updated_at", { ascending: false }).limit(30)).data ?? [] });
  const hist = useQuery({ queryKey: ["history", uid], enabled: !!uid, queryFn: async () => (await supabase.from("watch_history").select("id, watched_at, episodes(*, series(title))").eq("user_id", uid!).order("watched_at", { ascending: false }).limit(50)).data ?? [] });
  const friends = useQuery({ queryKey: ["friends", uid], enabled: !!uid, queryFn: () => fetchFriends(uid!) });

  const seriesGrid = (rows: { series: Series | null }[] | undefined, empty: string) =>
    rows?.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">{rows.map((r) => r.series && <SeriesCard key={r.series.id} s={r.series} className="w-full sm:w-full" />)}</div> : <EmptyState title={empty} />;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-24">
      <div className="mb-8 flex flex-wrap items-center gap-5">
        <UserAvatar p={profile} size={88} />
        <div>
          <h1 className="text-3xl font-bold">{profile?.display_name}</h1>
          <p className="text-muted-foreground">@{profile?.username} • {formatDate(profile?.created_at)} tarihinden beri üye</p>
          {profile?.bio && <p className="mt-1 text-sm">{profile.bio}</p>}
        </div>
      </div>
      <Tabs defaultValue="devam">
        <TabsList className="no-scrollbar h-auto w-full justify-start overflow-x-auto">
          <TabsTrigger value="devam">Devam Et</TabsTrigger>
          <TabsTrigger value="liste">Listem</TabsTrigger>
          <TabsTrigger value="fav">Favoriler</TabsTrigger>
          <TabsTrigger value="gecmis">İzleme Geçmişi</TabsTrigger>
          <TabsTrigger value="arkadas">Arkadaşlar</TabsTrigger>
          <TabsTrigger value="ayar">Hesap Ayarları</TabsTrigger>
        </TabsList>
        <TabsContent value="devam" className="pt-4">
          {cont.data?.length ? <div className="flex flex-wrap gap-4">{cont.data.map((p) => p.episodes && <EpisodeCard key={p.episode_id} e={p.episodes} subtitle={p.episodes.series?.title} progress={p.duration_seconds ? p.position_seconds / p.duration_seconds : 0} />)}</div> : <EmptyState title="Yarım kalan bölüm yok" />}
        </TabsContent>
        <TabsContent value="liste" className="pt-4">{seriesGrid(list.data, "Listen boş")}</TabsContent>
        <TabsContent value="fav" className="pt-4">{seriesGrid(favs.data, "Henüz favorin yok")}</TabsContent>
        <TabsContent value="gecmis" className="pt-4">
          {hist.data?.length ? <div className="divide-y divide-border rounded-lg bg-card">{hist.data.map((h) => h.episodes && (
            <Link key={h.id} to="/izle/$id" params={{ id: h.episodes.id }} className="flex justify-between gap-3 px-4 py-3 hover:bg-elevated">
              <span className="truncate">{h.episodes.series?.title} — {h.episodes.number}. {h.episodes.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(h.watched_at)}</span>
            </Link>))}</div> : <EmptyState title="Geçmiş boş" />}
        </TabsContent>
        <TabsContent value="arkadas" className="pt-4">
          {friends.data?.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{friends.data.map((f) => (
            <Link key={f.id} to="/u/$username" params={{ username: f.username ?? f.id }} className="flex items-center gap-3 rounded-lg bg-card p-3 hover:bg-elevated">
              <UserAvatar p={f} online={isOnline(f.last_seen)} /><div><p className="font-semibold">{f.display_name}</p><p className="text-xs text-muted-foreground">@{f.username}</p></div>
            </Link>))}</div> : <EmptyState title="Henüz arkadaşın yok" action={<Button asChild className="rounded-full"><Link to="/arkadaslar">Arkadaş bul</Link></Button>} />}
        </TabsContent>
        <TabsContent value="ayar" className="max-w-md pt-4"><ProfileForm submitLabel="Kaydet" onDone={() => {}} /></TabsContent>
      </Tabs>
    </main>
  );
}

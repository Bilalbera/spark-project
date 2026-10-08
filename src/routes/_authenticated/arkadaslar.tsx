import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Check, X } from "lucide-react";
import { supabase } from "@/lib/site-client";
import { useSession } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, UserAvatar } from "@/components/app/cards";
import { fetchFriends, fetchProfiles, openConversation, type MiniProfile } from "@/lib/social";
import { isOnline, relativeTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/arkadaslar")({
  head: () => ({ meta: [{ title: "Arkadaşlar — Bilal Efendi" }, { name: "description", content: "Arkadaşların, istekler ve kullanıcı arama." }] }),
  component: Friends,
});

function Friends() {
  const { user } = useSession();
  const me = user?.id ?? "";
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const friends = useQuery({ queryKey: ["friends", me], enabled: !!me, queryFn: () => fetchFriends(me) });
  const reqs = useQuery({
    queryKey: ["friend-requests", me],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase.from("friend_requests").select("*").eq("status", "pending").or(`sender_id.eq.${me},receiver_id.eq.${me}`).order("created_at", { ascending: false });
      const map = await fetchProfiles((data ?? []).map((r) => (r.sender_id === me ? r.receiver_id : r.sender_id)));
      return (data ?? []).map((r) => ({ ...r, other: map.get(r.sender_id === me ? r.receiver_id : r.sender_id) }));
    },
  });
  const found = useQuery({
    queryKey: ["user-search", search],
    enabled: !!me && search.trim().length >= 2,
    queryFn: async () => {
      const t = `%${search.trim().replace(/[%_,()]/g, "")}%`;
      return (await supabase.from("profiles").select("id, username, display_name, avatar_url, last_seen").neq("id", me).or(`username.ilike.${t},display_name.ilike.${t}`).limit(20)).data ?? [];
    },
  });
  useEffect(() => {
    if (!me) return;
    const ch = supabase.channel(`fr-${me}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests" }, () => { qc.invalidateQueries({ queryKey: ["friend-requests", me] }); qc.invalidateQueries({ queryKey: ["friends", me] }); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me, qc]);

  const incoming = (reqs.data ?? []).filter((r) => r.receiver_id === me);
  const outgoing = (reqs.data ?? []).filter((r) => r.sender_id === me);
  const list = (friends.data ?? []).filter((f) => `${f.display_name} ${f.username}`.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => Number(isOnline(b.last_seen)) - Number(isOnline(a.last_seen)));

  const refresh = () => { qc.invalidateQueries({ queryKey: ["friend-requests", me] }); qc.invalidateQueries({ queryKey: ["friends", me] }); };
  async function accept(id: string) { const { error } = await supabase.rpc("accept_friend_request", { _request_id: id }); if (error) toast.error("Hata"); else toast.success("Artık arkadaşsınız"); refresh(); }
  async function reject(id: string) { await supabase.from("friend_requests").update({ status: "rejected" }).eq("id", id); refresh(); }
  async function cancel(id: string) { await supabase.from("friend_requests").delete().eq("id", id); refresh(); }
  async function msg(id: string) { const c = await openConversation(id); navigate({ to: "/mesajlar", search: { c } }); }

  const Row = ({ p, children }: { p?: MiniProfile | undefined; children?: React.ReactNode }) => p ? (
    <div className="flex items-center gap-3 rounded-lg bg-card p-3">
      <Link to="/u/$username" params={{ username: p.username ?? p.id }} className="flex min-w-0 flex-1 items-center gap-3">
        <UserAvatar p={p} online={isOnline(p.last_seen)} />
        <div className="min-w-0"><p className="truncate font-semibold">{p.display_name}</p><p className="truncate text-xs text-muted-foreground">@{p.username} • {isOnline(p.last_seen) ? "Çevrimiçi" : relativeTime(p.last_seen)}</p></div>
      </Link>
      {children}
    </div>
  ) : null;

  if (!user) {
    return <main className="mx-auto max-w-3xl px-4 pb-20 pt-24"><div className="h-24 animate-pulse rounded-lg bg-card" /></main>;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-24">
      <h1 className="mb-6 font-display text-5xl tracking-wide">Arkadaşlar</h1>
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Arkadaşlarım ({friends.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="req">İstekler {incoming.length > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{incoming.length}</span>}</TabsTrigger>
          <TabsTrigger value="find">Kişi Bul</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="space-y-2 pt-4">
          <Input placeholder="Arkadaşlarında ara..." value={filter} onChange={(e) => setFilter(e.target.value)} />
          {friends.isLoading && <div className="h-20 animate-pulse rounded-lg bg-card" />}
          {!friends.isLoading && !list.length && <EmptyState title="Arkadaş yok" text="Kişi Bul sekmesinden yeni arkadaşlar ekle." />}
          {list.map((f) => <Row key={f.id} p={f}><Button size="icon" variant="secondary" onClick={() => msg(f.id)} aria-label="Mesaj"><MessageCircle /></Button></Row>)}
        </TabsContent>
        <TabsContent value="req" className="space-y-6 pt-4">
          <div className="space-y-2"><h2 className="font-semibold">Gelen istekler</h2>
            {!incoming.length && <p className="text-sm text-muted-foreground">Bekleyen istek yok.</p>}
            {incoming.map((r) => <Row key={r.id} p={r.other}><Button size="icon" onClick={() => accept(r.id)} aria-label="Kabul"><Check /></Button><Button size="icon" variant="secondary" onClick={() => reject(r.id)} aria-label="Reddet"><X /></Button></Row>)}
          </div>
          <div className="space-y-2"><h2 className="font-semibold">Gönderilen istekler</h2>
            {!outgoing.length && <p className="text-sm text-muted-foreground">Gönderilmiş istek yok.</p>}
            {outgoing.map((r) => <Row key={r.id} p={r.other}><Button size="sm" variant="secondary" onClick={() => cancel(r.id)}>İptal</Button></Row>)}
          </div>
        </TabsContent>
        <TabsContent value="find" className="space-y-2 pt-4">
          <Input placeholder="Kullanıcı adı veya isim..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {found.data?.map((p) => <Row key={p.id} p={p}><Button size="sm" asChild variant="secondary"><Link to="/u/$username" params={{ username: p.username ?? p.id }}>Profil</Link></Button></Row>)}
          {found.data && !found.data.length && <p className="text-sm text-muted-foreground">Kimse bulunamadı.</p>}
        </TabsContent>
      </Tabs>
    </main>
  );
}

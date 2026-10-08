import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, MessageCircle, UserCheck, UserMinus, Clock } from "lucide-react";
import { supabase } from "@/lib/site-client";
import { useSession } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { EmptyState, UserAvatar } from "@/components/app/cards";
import { openConversation } from "@/lib/social";
import { formatDate, isOnline, relativeTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/u/$username")({
  head: () => ({ meta: [{ title: "Kullanıcı Profili — Bilal Efendi" }, { name: "description", content: "Kullanıcı profili." }] }),
  component: UserProfile,
});

function UserProfile() {
  const { username } = Route.useParams();
  const { user } = useSession();
  const me = user?.id ?? "";
  const qc = useQueryClient();
  const navigate = useNavigate();
  const p = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => (await supabase.from("profiles").select("*").or(`username.eq.${username},id.eq.${/^[0-9a-f-]{36}$/.test(username) ? username : "00000000-0000-0000-0000-000000000000"}`).maybeSingle()).data,
  });
  const other = p.data?.id;
  const rel = useQuery({
    queryKey: ["relation", me, other],
    enabled: !!me && !!other,
    queryFn: async () => {
      const [f, r] = await Promise.all([
        supabase.from("friendships").select("user_id").eq("user_id", me).eq("friend_id", other!).maybeSingle(),
        supabase.from("friend_requests").select("*").eq("status", "pending").or(`and(sender_id.eq.${me},receiver_id.eq.${other}),and(sender_id.eq.${other},receiver_id.eq.${me})`).maybeSingle(),
      ]);
      return { friend: !!f.data, request: r.data };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["relation", me, other] });

  if (!user || p.isLoading) return <div className="mx-auto mt-28 h-40 max-w-3xl animate-pulse rounded-xl bg-card" />;
  if (!p.data) return <div className="pt-32"><EmptyState title="Kullanıcı bulunamadı" /></div>;
  if (other === me) return <div className="pt-32"><EmptyState title="Bu senin profilin" action={<Link to="/profil" className="text-primary">Profilime git</Link>} /></div>;
  const r = rel.data;

  async function add() {
    await supabase.from("friend_requests").delete().eq("sender_id", me).eq("receiver_id", other!).neq("status", "pending");
    const { error } = await supabase.from("friend_requests").insert({ sender_id: me, receiver_id: other! });
    if (error) toast.error("İstek gönderilemedi"); else toast.success("Arkadaşlık isteği gönderildi");
    refresh();
  }
  async function accept() { const { error } = await supabase.rpc("accept_friend_request", { _request_id: r!.request!.id }); if (error) toast.error("Hata"); refresh(); }
  async function cancel() { await supabase.from("friend_requests").delete().eq("id", r!.request!.id); refresh(); }
  async function remove() { await supabase.rpc("remove_friend", { _friend_id: other! }); toast("Arkadaşlıktan çıkarıldı"); refresh(); }
  async function message() { try { const c = await openConversation(other!); navigate({ to: "/mesajlar", search: { c } }); } catch { toast.error("Sohbet açılamadı"); } }

  const online = isOnline(p.data.last_seen);
  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-28">
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-card p-8 text-center">
        <UserAvatar p={p.data} size={112} online={online} />
        <div>
          <h1 className="text-3xl font-bold">{p.data.display_name}</h1>
          <p className="text-muted-foreground">@{p.data.username}</p>
          <p className="mt-1 text-xs text-muted-foreground">{online ? "Çevrimiçi" : `Son görülme ${relativeTime(p.data.last_seen)}`} • Üyelik {formatDate(p.data.created_at)}</p>
        </div>
        {p.data.bio && <p className="max-w-md">{p.data.bio}</p>}
        <div className="flex flex-wrap justify-center gap-2">
          {r?.friend ? (
            <>
              <Button onClick={message} className="rounded-full"><MessageCircle /> Mesaj Gönder</Button>
              <Button variant="secondary" onClick={remove} className="rounded-full"><UserMinus /> Arkadaşlıktan Çıkar</Button>
            </>
          ) : r?.request ? (
            r.request.receiver_id === me ? (
              <Button onClick={accept} className="rounded-full"><UserCheck /> İsteği Kabul Et</Button>
            ) : (
              <Button variant="secondary" onClick={cancel} className="rounded-full"><Clock /> İstek Gönderildi (iptal)</Button>
            )
          ) : (
            <Button onClick={add} className="rounded-full"><UserPlus /> Arkadaş Ekle</Button>
          )}
          {!r?.friend && <Button variant="outline" onClick={message} className="rounded-full"><MessageCircle /> Mesaj</Button>}
        </div>
      </div>
    </main>
  );
}

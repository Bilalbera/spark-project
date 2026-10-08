import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Send, Trash2, CheckCheck, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/site-client";
import { useSession } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, UserAvatar } from "@/components/app/cards";
import { fetchProfiles } from "@/lib/social";
import { formatTime, isOnline, relativeTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/mesajlar")({
  validateSearch: z.object({ c: z.string().optional() }),
  head: () => ({ meta: [{ title: "Mesajlar — Bilal Efendi" }, { name: "description", content: "Arkadaşlarınla gerçek zamanlı sohbet." }] }),
  component: Messages,
});

function Messages() {
  const { user } = useSession();
  const me = user?.id ?? "";
  const { c } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const convs = useQuery({
    queryKey: ["conversations", me],
    enabled: !!me,
    queryFn: async () => {
      const { data: mine } = await supabase.from("conversation_members").select("conversation_id, last_read_at, conversations(last_message_at)").eq("user_id", me);
      const ids = (mine ?? []).map((m) => m.conversation_id);
      if (!ids.length) return [];
      const { data: others } = await supabase.from("conversation_members").select("conversation_id, user_id").in("conversation_id", ids).neq("user_id", me);
      const profiles = await fetchProfiles([...new Set((others ?? []).map((o) => o.user_id))]);
      const rows = await Promise.all((mine ?? []).map(async (m) => {
        const [{ data: last }, { count }] = await Promise.all([
          supabase.from("messages").select("content, sender_id, deleted, created_at").eq("conversation_id", m.conversation_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", m.conversation_id).neq("sender_id", me).gt("created_at", m.last_read_at),
        ]);
        const o = others?.find((x) => x.conversation_id === m.conversation_id);
        return { id: m.conversation_id, other: o ? profiles.get(o.user_id) : undefined, last, unread: count ?? 0, at: m.conversations?.last_message_at ?? "" };
      }));
      return rows.sort((a, b) => b.at.localeCompare(a.at));
    },
  });
  useEffect(() => {
    if (!me) return;
    const ch = supabase.channel(`inbox-${me}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => qc.invalidateQueries({ queryKey: ["conversations", me] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me, qc]);

  const active = convs.data?.find((x) => x.id === c);

  if (!user) {
    return <main className="mx-auto h-[100dvh] max-w-6xl px-4 pt-20"><div className="h-24 animate-pulse rounded-lg bg-card" /></main>;
  }

  return (
    <main className="mx-auto flex h-[100dvh] max-w-6xl gap-0 px-0 pb-0 pt-16 sm:px-4 sm:pb-4">
      <aside className={`w-full shrink-0 border-border sm:w-80 sm:border-r ${c ? "hidden sm:block" : ""}`}>
        <h1 className="px-4 py-4 font-display text-3xl tracking-wide">Mesajlar</h1>
        <div className="h-[calc(100%-4.5rem)] overflow-y-auto">
          {convs.isLoading && <div className="mx-4 h-16 animate-pulse rounded-lg bg-card" />}
          {convs.data?.length === 0 && <p className="px-4 text-sm text-muted-foreground">Henüz sohbet yok. Bir arkadaşının profilinden mesaj gönder.</p>}
          {convs.data?.map((cv) => (
            <button key={cv.id} onClick={() => navigate({ to: "/mesajlar", search: { c: cv.id } })} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-card ${cv.id === c ? "bg-card" : ""}`}>
              <UserAvatar p={cv.other ?? null} online={isOnline(cv.other?.last_seen)} />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2"><p className="truncate font-semibold">{cv.other?.display_name ?? "Kullanıcı"}</p><span className="shrink-0 text-[10px] text-muted-foreground">{relativeTime(cv.last?.created_at)}</span></div>
                <div className="flex justify-between gap-2">
                  <p className="truncate text-xs text-muted-foreground">{cv.last ? (cv.last.deleted ? "Mesaj silindi" : `${cv.last.sender_id === me ? "Sen: " : ""}${cv.last.content}`) : "Sohbet başlat"}</p>
                  {cv.unread > 0 && <span className="shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{cv.unread}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>
      <section className={`min-w-0 flex-1 ${c ? "flex" : "hidden sm:flex"} flex-col`}>
        {c ? <ChatWindow key={c} conversationId={c} me={me} other={active?.other ?? null} /> : <div className="m-auto"><EmptyState title="Bir sohbet seç" text="Soldan bir sohbet seçerek mesajlaşmaya başla." /></div>}
      </section>
    </main>
  );
}

function ChatWindow({ conversationId, me, other }: { conversationId: string; me: string; other: { id: string; username: string | null; display_name: string | null; avatar_url: string | null; last_seen: string } | null }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const key = ["messages", conversationId];
  const msgs = useQuery({
    queryKey: key,
    queryFn: async () => ((await supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(200)).data ?? []).reverse(),
  });
  const markRead = async () => {
    await supabase.from("conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", conversationId).eq("user_id", me);
    await supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("conversation_id", conversationId).neq("sender_id", me).is("read_at", null);
    qc.invalidateQueries({ queryKey: ["conversations", me] });
  };
  useEffect(() => {
    markRead();
    const ch = supabase.channel(`chat-${conversationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        qc.invalidateQueries({ queryKey: key });
        if (payload.eventType === "INSERT" && (payload.new as { sender_id: string }).sender_id !== me) markRead();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.data?.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setText("");
    const { error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: me, content: content.slice(0, 4000) });
    if (error) { toast.error("Mesaj gönderilemedi"); setText(content); }
    qc.invalidateQueries({ queryKey: key });
  }
  async function del(id: string) {
    await supabase.from("messages").update({ deleted: true, content: "" }).eq("id", id);
    qc.invalidateQueries({ queryKey: key });
  }
  async function leave() {
    if (!confirm("Bu sohbet listenden silinsin mi?")) return;
    await supabase.from("conversation_members").delete().eq("conversation_id", conversationId).eq("user_id", me);
    qc.invalidateQueries({ queryKey: ["conversations", me] });
    window.history.back();
  }

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Link to="/mesajlar" search={{}} className="sm:hidden"><ArrowLeft /></Link>
        {other && <Link to="/u/$username" params={{ username: other.username ?? other.id }} className="flex items-center gap-3">
          <UserAvatar p={other} size={36} online={isOnline(other.last_seen)} />
          <div><p className="font-semibold">{other.display_name}</p><p className="text-xs text-muted-foreground">{isOnline(other.last_seen) ? "Çevrimiçi" : `Son görülme ${relativeTime(other.last_seen)}`}</p></div>
        </Link>}
        <Button variant="ghost" size="icon" className="ml-auto" onClick={leave} aria-label="Sohbeti sil"><Trash2 /></Button>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {msgs.data?.length === 0 && <p className="mt-10 text-center text-sm text-muted-foreground">İlk mesajı sen gönder 👋</p>}
        {msgs.data?.map((m) => {
          const mine = m.sender_id === me;
          return (
            <div key={m.id} className={`group flex ${mine ? "justify-end" : "justify-start"}`}>
              {mine && !m.deleted && <button onClick={() => del(m.id)} className="mr-2 self-center opacity-0 transition-opacity group-hover:opacity-100" aria-label="Sil"><Trash2 className="h-4 w-4 text-muted-foreground" /></button>}
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-card"}`}>
                <p className={`whitespace-pre-wrap break-words text-sm ${m.deleted ? "italic opacity-60" : ""}`}>{m.deleted ? "Bu mesaj silindi" : m.content}</p>
                <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] opacity-70">{formatTime(m.created_at)}{mine && (m.read_at ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Mesaj yaz..." className="rounded-full" />
        <Button type="submit" size="icon" className="shrink-0 rounded-full" aria-label="Gönder"><Send /></Button>
      </form>
    </>
  );
}

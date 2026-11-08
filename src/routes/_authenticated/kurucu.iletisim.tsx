import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Mail } from "lucide-react";
import { supabase } from "@/lib/site-client";
import { fetchProfiles } from "@/lib/social";
import { relativeTime } from "@/lib/format";
import { AdminHeading } from "@/components/app/AdminShell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/cards";

export const Route = createFileRoute("/_authenticated/kurucu/iletisim")({
  head: () => ({ meta: [{ title: "Kullanıcı İletileri — Kurucu Paneli" }] }),
  component: ContactInbox,
});

function ContactInbox() {
  const qc = useQueryClient();
  const inbox = useQuery({
    queryKey: ["founder-contact-messages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      const profiles = await fetchProfiles([...new Set((data ?? []).map((message) => message.sender_id))]);
      return { messages: data ?? [], profiles };
    },
  });

  useEffect(() => {
    const channel = supabase.channel("founder-contact-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "contact_messages" }, () => {
        void qc.invalidateQueries({ queryKey: ["founder-contact-messages"] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [qc]);

  async function markRead(id: string) {
    const { error } = await supabase.from("contact_messages").update({ read_at: new Date().toISOString() }).eq("id", id);
    if (error) return;
    await qc.invalidateQueries({ queryKey: ["founder-contact-messages"] });
  }

  return (
    <>
      <AdminHeading title="Kullanıcı İletileri" description="Bize ulaşın formundan gönderilen mesajlar." />
      {inbox.isLoading && <div className="h-24 animate-pulse rounded-lg bg-card" />}
      {inbox.error && <p className="rounded-lg border border-destructive/40 bg-card p-4 text-sm text-destructive">İletiler yüklenemedi: {inbox.error.message}</p>}
      {!inbox.isLoading && !inbox.error && inbox.data?.messages.length === 0 && <EmptyState title="Henüz ileti yok" text="Kullanıcıların gönderdiği mesajlar burada görünür." />}
      <div className="space-y-3">
        {inbox.data?.messages.map((message) => {
          const sender = inbox.data?.profiles.get(message.sender_id);
          return (
            <article key={message.id} className={`rounded-xl border bg-card p-4 ${message.read_at ? "border-border" : "border-primary/50"}`}>
              <div className="flex flex-wrap items-start gap-3">
                <Mail className="mt-1 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="font-semibold">{sender?.display_name || sender?.username || "Kullanıcı"}</p>
                    {sender?.username && <span className="text-xs text-muted-foreground">@{sender.username}</span>}
                    {message.sender_email && <a className="text-xs text-primary underline" href={`mailto:${message.sender_email}`}>{message.sender_email}</a>}
                    <span className="text-xs text-muted-foreground">· {relativeTime(message.created_at)}</span>
                    {!message.read_at && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Yeni</span>}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm">{message.body}</p>
                </div>
                {!message.read_at && <Button variant="secondary" size="sm" onClick={() => void markRead(message.id)}><Check /> Okundu</Button>}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

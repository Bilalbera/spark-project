import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Eye, Film, MessageCircle, PlaySquare, Users } from "lucide-react";
import { supabase } from "@/lib/site-client";
import { AdminHeading, MetricCard } from "@/components/app/AdminShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/kurucu/")({
  head: () => ({ meta: [
    { title: "Genel Bakış — Bilal Efendi Kurucu Paneli" },
    { name: "description", content: "Platformun güncel içerik ve kullanım özeti." },
    { property: "og:title", content: "Genel Bakış — Bilal Efendi" },
    { property: "og:description", content: "Platformun güncel içerik ve kullanım özeti." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Dashboard,
});

function Dashboard() {
  const stats = useQuery({
    queryKey: ["founder-dashboard"],
    queryFn: async () => {
      const [users, series, episodes, views, messages] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("series").select("id", { count: "exact", head: true }),
        supabase.from("episodes").select("id", { count: "exact", head: true }),
        supabase.from("episode_views").select("id", { count: "exact", head: true }),
        supabase.from("messages").select("id", { count: "exact", head: true }),
      ]);
      return { users: users.count ?? 0, series: series.count ?? 0, episodes: episodes.count ?? 0, views: views.count ?? 0, messages: messages.count ?? 0 };
    },
  });
  const recent = useQuery({ queryKey: ["founder-recent-series"], queryFn: async () => (await supabase.from("series").select("id,title,status,created_at,cover_url").order("created_at", { ascending: false }).limit(5)).data ?? [] });
  const s = stats.data ?? { users: 0, series: 0, episodes: 0, views: 0, messages: 0 };
  return <>
    <AdminHeading title="Genel Bakış" description="Platformun güncel durumu ve hızlı yönetim araçları." action={<Button asChild><Link to="/kurucu/seriler">İçerik yönet</Link></Button>} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard label="Kullanıcı" value={s.users} icon={Users} /><MetricCard label="Seri" value={s.series} icon={Film} /><MetricCard label="Bölüm" value={s.episodes} icon={PlaySquare} /><MetricCard label="İzlenme" value={s.views} icon={Eye} /><MetricCard label="Mesaj" value={s.messages} icon={MessageCircle} />
    </div>
    <section className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <div><h2 className="mb-3 text-lg font-semibold">Son eklenen seriler</h2><div className="divide-y divide-border rounded-lg border border-border bg-card">
        {recent.isLoading && <div className="h-24 animate-pulse" />}
        {recent.data?.length === 0 && <p className="p-6 text-sm text-muted-foreground">Henüz seri eklenmedi.</p>}
        {recent.data?.map((item) => <div key={item.id} className="flex items-center gap-3 p-3">{item.cover_url ? <img src={item.cover_url} alt="" className="h-14 w-10 rounded object-cover" /> : <div className="h-14 w-10 rounded bg-muted" />}<div className="min-w-0 flex-1"><p className="truncate font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.status === "published" ? "Yayında" : "Taslak"}</p></div></div>)}
      </div></div>
      <div><h2 className="mb-3 text-lg font-semibold">Hızlı işlemler</h2><div className="space-y-2 rounded-lg border border-border bg-card p-3"><Button asChild variant="secondary" className="w-full justify-start"><Link to="/kurucu/seriler"><Film /> Yeni seri ekle</Link></Button><Button asChild variant="secondary" className="w-full justify-start"><Link to="/kurucu/bolumler"><PlaySquare /> Bölüm ekle</Link></Button><Button asChild variant="secondary" className="w-full justify-start"><Link to="/kurucu/istatistikler"><BarChart3 /> Raporları gör</Link></Button></div></div>
    </section>
  </>;
}
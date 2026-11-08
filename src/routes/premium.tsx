import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Crown, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/site-client";
import { isPremium, premiumDaysLeft } from "@/lib/premium";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/premium")({
  head: () => ({ meta: [{ title: "Premium — Bilal Efendi" }, { name: "description", content: "30 günlük ücretsiz Bilal Efendi Premium denemesi." }] }),
  component: Premium,
});

function Premium() {
  const { user, profile, loading } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const active = isPremium(profile?.premium_until);
  const trialUsed = Boolean(profile?.premium_until);

  async function activate() {
    if (!user || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc("activate_free_premium");
    setBusy(false);
    if (error) {
      if (error.message.includes("zaten")) {
        toast.error("Ücretsiz Premium denemen zaten kullanılmış.");
      } else if (error.code === "PGRST202" || /activate_free_premium|schema cache/i.test(error.message)) {
        toast.error("Premium kurulumu tamamlanmamış. Supabase SQL Editor'da activate_free_premium.sql dosyasını çalıştır.");
      } else {
        toast.error("Premium başlatılamadı. Biraz sonra tekrar dene.");
      }
      return;
    }
    await qc.invalidateQueries({ queryKey: ["my-profile", user.id] });
    toast.success("30 günlük Premium üyeliğin başladı!");
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-20 pt-24">
      <section className="premium-glow-row overflow-hidden rounded-3xl border border-primary/20 bg-card p-8 text-center sm:p-12">
        <Crown className="mx-auto h-12 w-12 text-primary" />
        <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.35em] text-primary">Bilal Efendi</p>
        <h1 className="mt-2 font-display text-5xl tracking-widest sm:text-7xl">PREMİUM</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Tüm Premium özelliklerini ücretsiz kullan. Deneme, başlattığın andan itibaren 30 gün sürer ve yalnızca bir kez alınabilir.</p>
        <div className="mt-7">
          {loading ? <Button disabled><Loader2 className="animate-spin" />Yükleniyor…</Button> : !user ? <Button asChild><a href="/giris">Giriş yap ve ücretsiz dene</a></Button> : active ? <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-5 py-3 font-semibold text-primary"><Check className="h-5 w-5" />Premium aktif · {premiumDaysLeft(profile?.premium_until)} gün kaldı</p> : trialUsed ? <p className="rounded-xl bg-muted px-5 py-3 text-sm text-muted-foreground">30 günlük ücretsiz Premium denemen kullanıldı. Süresi dolduğu için Premium özellikleri artık etkin değil.</p> : <Button onClick={activate} disabled={busy || !profile} size="lg" className="rounded-full px-7">{busy ? <><Loader2 className="animate-spin" />Başlatılıyor…</> : <><Sparkles />30 Gün Ücretsiz Başlat</>}</Button>}
        </div>
        {user && !trialUsed && <p className="mt-3 text-xs text-muted-foreground">Ödeme bilgisi gerekmez · Süre sonunda otomatik yenilenmez</p>}
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Feature title="Premium profil" items={["İsim yanında Premium rozeti ve parıltı", "Elmas çerçeve ve profil mührü", "Özel profil arka planı ve vurgu rengi", "Özel ünvan, vitrin ve profil müziği"]} />
        <Feature title="Sohbet ayrıcalıkları" items={["Mesajlarda Premium rozeti", "Altı özel Premium tepkisi", "Özel sohbet temaları", "Premium mesaj balonları ve çıkartmalar"]} />
        <Feature title="Premium topluluk" items={["Premium filtresi ve listelerde öncelik", "Çevrimiçi Premium göstergesi", "Altın mühürlü arkadaşlık daveti", "Rozet adının geçtiği listelerde görünür"]} />
      </section>
    </main>
  );
}

function Feature({ title, items }: { title: string; items: string[] }) {
  return <article className="rounded-2xl border border-border bg-card p-5"><h2 className="font-semibold">👑 {title}</h2><ul className="mt-4 space-y-2 text-sm text-muted-foreground">{items.map((item) => <li key={item} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{item}</li>)}</ul></article>;
}

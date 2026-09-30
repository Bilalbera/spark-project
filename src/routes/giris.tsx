import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/giris")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Giriş Yap — Bilal Efendi" },
      { name: "description", content: "Google hesabınla Bilal Efendi'ye giriş yap." },
      { property: "og:title", content: "Giriş Yap — Bilal Efendi" },
      { property: "og:description", content: "Google hesabınla Bilal Efendi'ye giriş yap." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (user) navigate({ to: "/" }); }, [user, navigate]);

  async function google() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/giris` },
    });
    if (error) { toast.error("Giriş yapılamadı, tekrar dene."); setBusy(false); }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--accent),transparent_60%)] opacity-70" />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card/80 p-8 text-center backdrop-blur">
        <p className="font-display text-5xl tracking-widest text-primary">BİLAL EFENDİ</p>
        <h1 className="mt-6 text-xl font-bold">Bilal Efendi'ye Hoş Geldin</h1>
        <p className="mt-2 text-sm text-muted-foreground">Serileri izle, kaldığın yerden devam et, arkadaşlarınla sohbet et.</p>
        <Button onClick={google} disabled={busy} size="lg" className="mt-8 w-full rounded-full">
          {busy ? "Yönlendiriliyor..." : "Google ile devam et"}
        </Button>
      </div>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/site-client";
import { useAuth } from "@/hooks/useAuth";
import { uploadImage } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/app/cards";

export const Route = createFileRoute("/_authenticated/kurulum")({
  head: () => ({ meta: [{ title: "Profilini Kur — Bilal Efendi" }, { name: "description", content: "Kullanıcı adını ve avatarını belirle." }] }),
  component: Onboarding,
});

export function ProfileForm({ onDone, submitLabel }: { onDone: () => void; submitLabel: string }) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username ?? "");
      setDisplayName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setAvatar(profile.avatar_url);
    }
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const u = username.trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,20}$/.test(u)) { toast.error("Kullanıcı adı 3-20 karakter; harf, rakam, _ ve . içerebilir."); return; }
    if (!displayName.trim()) { toast.error("Görünen ad gerekli."); return; }
    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({ id: user!.id, email: user!.email ?? null, username: u, display_name: displayName.trim(), bio: bio.trim() || null, avatar_url: avatar, onboarded: true }, { onConflict: "id" });
    setBusy(false);
    if (error) { console.error("Profil kaydı hatası:", error.message, error); toast.error(error.code === "23505" ? "Bu kullanıcı adı alınmış." : "Kaydedilemedi."); return; }
    await qc.invalidateQueries({ queryKey: ["my-profile"] });
    toast.success("Profil kaydedildi");
    onDone();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="flex items-center gap-4">
        <UserAvatar p={{ avatar_url: avatar, display_name: displayName }} size={72} />
        <label className="cursor-pointer text-sm text-primary">
          Avatar değiştir
          <input type="file" accept=".jpg,.jpeg,image/jpeg,image/png,image/webp" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            try { setAvatar(await uploadImage(f, user!.id)); } catch { toast.error("Yüklenemedi"); }
          }} />
        </label>
      </div>
      <div className="space-y-1.5"><Label>Kullanıcı adı</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="bilal_hayrani" /></div>
      <div className="space-y-1.5"><Label>Görünen ad</Label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
      <div className="space-y-1.5"><Label>Hakkında</Label><Input value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Kısa bir not (isteğe bağlı)" /></div>
      <Button type="submit" disabled={busy} className="w-full rounded-full">{busy ? "Kaydediliyor..." : submitLabel}</Button>
    </form>
  );
}

function Onboarding() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8">
        <p className="font-display text-3xl tracking-widest text-primary">BİLAL EFENDİ</p>
        <h1 className="mt-2 text-xl font-bold">Profilini oluştur</h1>
        <p className="mb-6 text-sm text-muted-foreground">Arkadaşların seni bu bilgilerle bulacak.</p>
        <ProfileForm submitLabel="Başla" onDone={() => navigate({ to: "/" })} />
      </div>
    </div>
  );
}

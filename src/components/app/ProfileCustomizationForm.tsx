import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/site-client";
import { useAuth } from "@/hooks/useAuth";
import { ACCENT_COLORS, AVATAR_FRAMES, CHAT_THEMES, isPremium, PREMIUM_TITLES, PROFILE_MUSIC, PROFILE_THEMES } from "@/lib/premium";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Customization = {
  profile_theme: string;
  accent_color: string;
  avatar_frame: string;
  chat_theme: string;
  premium_title: string;
  profile_music: string;
  showcase_episode_id: string;
  showcase_series_id: string;
};

const defaults: Customization = {
  profile_theme: "standard",
  accent_color: "default",
  avatar_frame: "diamond",
  chat_theme: "standard",
  premium_title: "none",
  profile_music: "none",
  showcase_episode_id: "none",
  showcase_series_id: "none",
};

export function ProfileCustomizationForm() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [values, setValues] = useState(defaults);
  const [busy, setBusy] = useState(false);
  const active = isPremium(profile?.premium_until);

  useEffect(() => {
    if (!profile) return;
    setValues({
      profile_theme: profile.profile_theme || defaults.profile_theme,
      accent_color: profile.accent_color || defaults.accent_color,
      avatar_frame: profile.avatar_frame || defaults.avatar_frame,
      chat_theme: profile.chat_theme || defaults.chat_theme,
      premium_title: profile.premium_title || "none",
      profile_music: profile.profile_music || "none",
      showcase_episode_id: profile.showcase_episode_id || "none",
      showcase_series_id: profile.showcase_series_id || "none",
    });
  }, [profile]);

  const episodes = useQuery({
    queryKey: ["profile-customization-episodes"],
    enabled: active,
    queryFn: async () => {
      const { data, error } = await supabase.from("episodes").select("id,title,number,series(title)").eq("status", "published").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });
  const series = useQuery({
    queryKey: ["profile-customization-series"],
    enabled: active,
    queryFn: async () => {
      const { data, error } = await supabase.from("series").select("id,title").eq("status", "published").order("title");
      if (error) throw error;
      return data;
    },
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !active || busy) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      profile_theme: values.profile_theme,
      accent_color: values.accent_color,
      avatar_frame: values.avatar_frame,
      chat_theme: values.chat_theme,
      premium_title: values.premium_title === "none" ? null : values.premium_title,
      profile_music: values.profile_music === "none" ? null : values.profile_music,
      showcase_episode_id: values.showcase_episode_id === "none" ? null : values.showcase_episode_id,
      showcase_series_id: values.showcase_series_id === "none" ? null : values.showcase_series_id,
    }).eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error(`Kişiselleştirme kaydedilemedi: ${error.message}`);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["my-profile", user.id] });
    toast.success("Profil kişiselleştirmesi kaydedildi.");
  }

  if (!active) {
    return (
      <section className="max-w-xl rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Profilini kişiselleştir</h2>
        <p className="mt-2 text-sm text-muted-foreground">Temalar, çerçeveler, sohbet görünümü ve profil vitrini Premium üyeliğe dahildir.</p>
        <Button asChild className="mt-4 rounded-full"><Link to="/premium">Premium’u ücretsiz dene</Link></Button>
      </section>
    );
  }

  return (
    <form onSubmit={save} className="grid max-w-3xl gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
      <Choice label="Profil teması" value={values.profile_theme} options={PROFILE_THEMES} onChange={(value) => setValues((v) => ({ ...v, profile_theme: value }))} />
      <Choice label="Vurgu rengi" value={values.accent_color} options={ACCENT_COLORS} onChange={(value) => setValues((v) => ({ ...v, accent_color: value }))} />
      <Choice label="Avatar çerçevesi" value={values.avatar_frame} options={AVATAR_FRAMES} onChange={(value) => setValues((v) => ({ ...v, avatar_frame: value }))} />
      <Choice label="Sohbet teması" value={values.chat_theme} options={CHAT_THEMES} onChange={(value) => setValues((v) => ({ ...v, chat_theme: value }))} />
      <Choice label="Ünvan" value={values.premium_title} options={[{ id: "none", label: "Ünvan yok" }, ...PREMIUM_TITLES.map((label) => ({ id: label, label }))]} onChange={(value) => setValues((v) => ({ ...v, premium_title: value }))} />
      <Choice label="Profil müziği" value={values.profile_music} options={PROFILE_MUSIC.map((item) => ({ ...item, id: item.id || "none" }))} onChange={(value) => setValues((v) => ({ ...v, profile_music: value }))} />
      <Choice label="Vitrin bölümü" value={values.showcase_episode_id} options={[{ id: "none", label: "Bölüm seçme" }, ...(episodes.data ?? []).map((ep) => ({ id: ep.id, label: `${ep.series?.title ? `${ep.series.title} · ` : ""}${ep.number > 0 ? `${ep.number}. ` : ""}${ep.title}` }))]} onChange={(value) => setValues((v) => ({ ...v, showcase_episode_id: value }))} />
      <Choice label="Vitrin serisi" value={values.showcase_series_id} options={[{ id: "none", label: "Seri seçme" }, ...(series.data ?? []).map((item) => ({ id: item.id, label: item.title }))]} onChange={(value) => setValues((v) => ({ ...v, showcase_series_id: value }))} />
      <Button type="submit" disabled={busy} className="rounded-full sm:col-span-2">{busy ? "Kaydediliyor…" : "Kişiselleştirmeyi kaydet"}</Button>
    </form>
  );
}

function Choice({ label, value, options, onChange }: { label: string; value: string; options: { id: string; label: string }[]; onChange: (value: string) => void }) {
  const safeValue = options.some((option) => option.id === value) ? value : options[0]?.id ?? "";
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={safeValue} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

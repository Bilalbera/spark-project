import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/site-client";
import { uploadImage } from "@/lib/upload";
import { AdminHeading } from "@/components/app/AdminShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type SeriesForm = { id?: string; title: string; slug: string; description: string; genre: string; cover_url: string; hero_url: string; status: "draft" | "published" | "hidden" | "scheduled"; featured: boolean; show_in_hero: boolean; sort_order: number };
const blank: SeriesForm = { title: "", slug: "", description: "", genre: "", cover_url: "", hero_url: "", status: "draft", featured: false, show_in_hero: false, sort_order: 0 };
const slugify = (value: string) => value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const Route = createFileRoute("/_authenticated/kurucu/seriler")({
  head: () => ({ meta: [{ title: "Seri Yönetimi — Bilal Efendi" }, { name: "description", content: "Serileri oluşturun ve yayın durumlarını yönetin." }, { property: "og:title", content: "Seri Yönetimi — Bilal Efendi" }, { property: "og:description", content: "Serileri oluşturun ve yayın durumlarını yönetin." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: SeriesAdmin,
});

function SeriesAdmin() {
  const qc = useQueryClient(); const [open, setOpen] = useState(false); const [form, setForm] = useState<SeriesForm>(blank); const [saving, setSaving] = useState(false);
  const query = useQuery({ queryKey: ["founder-series"], queryFn: async () => { const { data, error } = await supabase.from("series").select("*").order("sort_order").order("created_at", { ascending: false }); if (error) throw error; return data; } });
  const edit = (row: NonNullable<typeof query.data>[number]) => { setForm({ id: row.id, title: row.title, slug: row.slug, description: row.description ?? "", genre: row.genre ?? "", cover_url: row.cover_url ?? "", hero_url: row.hero_url ?? "", status: row.status, featured: row.featured, show_in_hero: row.show_in_hero, sort_order: row.sort_order }); setOpen(true); };
  async function upload(file: File, key: "cover_url" | "hero_url") { try { const url = await uploadImage(file, `series/${key}`); setForm((v) => ({ ...v, [key]: url })); } catch { toast.error("Görsel yüklenemedi"); } }
  async function save(e: React.FormEvent) { e.preventDefault(); if (!form.title.trim()) return; setSaving(true); const payload = { title: form.title.trim(), slug: form.slug || slugify(form.title), description: form.description || null, genre: form.genre || null, cover_url: form.cover_url || null, hero_url: form.hero_url || null, status: form.status, featured: form.featured, show_in_hero: form.show_in_hero, sort_order: form.sort_order }; if (payload.show_in_hero) await supabase.from("series").update({ show_in_hero: false }).neq("id", form.id ?? "00000000-0000-0000-0000-000000000000"); const result = form.id ? await supabase.from("series").update(payload).eq("id", form.id) : await supabase.from("series").insert(payload); setSaving(false); if (result.error) { toast.error(result.error.message); return; } toast.success(form.id ? "Seri güncellendi" : "Seri oluşturuldu"); setOpen(false); qc.invalidateQueries({ queryKey: ["founder-series"] }); }
  async function remove(id: string) { if (!confirm("Bu seri, sezonları ve bölümleri kalıcı olarak silinsin mi?")) return; const { error } = await supabase.from("series").delete().eq("id", id); if (error) toast.error(error.message); else { toast.success("Seri silindi"); qc.invalidateQueries({ queryKey: ["founder-series"] }); } }
  return <>
    <AdminHeading title="Seriler" description="Kapakları, yayın durumunu ve ana sayfa görünümünü yönetin." action={<Button onClick={() => { setForm(blank); setOpen(true); }}><Plus /> Yeni seri</Button>} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{query.data?.map((row) => <article key={row.id} className="overflow-hidden rounded-lg border border-border bg-card"><div className="aspect-video bg-muted">{row.hero_url || row.cover_url ? <img src={row.hero_url || row.cover_url || ""} alt={row.title} className="h-full w-full object-cover" /> : null}</div><div className="p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{row.title}</h2><p className="text-xs text-muted-foreground">{row.status === "published" ? "Yayında" : row.status === "draft" ? "Taslak" : "Gizli"} · {row.genre || "Tür belirtilmedi"}</p></div><span className="rounded-full bg-muted px-2 py-1 text-[10px]">#{row.sort_order}</span></div><div className="mt-4 flex gap-2"><Button size="sm" variant="secondary" onClick={() => edit(row)}><Pencil /> Düzenle</Button><Button size="icon" variant="ghost" onClick={() => remove(row.id)} aria-label="Seriyi sil"><Trash2 className="text-destructive" /></Button></div></div></article>)}</div>
    {!query.isLoading && query.data?.length === 0 && <p className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">Henüz seri yok. İlk seriyi ekleyerek başlayın.</p>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{form.id ? "Seriyi düzenle" : "Yeni seri"}</DialogTitle></DialogHeader><form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <Field label="Seri adı"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: form.id ? form.slug : slugify(e.target.value) })} required /></Field><Field label="Adres adı"><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} required /></Field>
      <Field label="Tür"><Input value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} /></Field><Field label="Sıralama"><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></Field>
      <Field label="Yayın durumu"><Select value={form.status} onValueChange={(v: SeriesForm["status"]) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Taslak</SelectItem><SelectItem value="published">Yayında</SelectItem><SelectItem value="hidden">Gizli</SelectItem><SelectItem value="scheduled">Planlandı</SelectItem></SelectContent></Select></Field><div className="flex items-end gap-5 pb-2"><Toggle label="Öne çıkar" checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} /><Toggle label="Hero'da göster" checked={form.show_in_hero} onCheckedChange={(v) => setForm({ ...form, show_in_hero: v })} /></div>
      <Field label="Açıklama" className="sm:col-span-2"><Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      <ImageField label="Kapak görseli" value={form.cover_url} onChange={(v) => setForm({ ...form, cover_url: v })} onFile={(f) => upload(f, "cover_url")} /><ImageField label="Geniş banner" value={form.hero_url} onChange={(v) => setForm({ ...form, hero_url: v })} onFile={(f) => upload(f, "hero_url")} />
      <Button type="submit" disabled={saving} className="sm:col-span-2">{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
    </form></DialogContent></Dialog>
  </>;
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) { return <div className={className}><Label className="mb-1.5 block">{label}</Label>{children}</div>; }
function Toggle({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (v: boolean) => void }) { return <label className="flex items-center gap-2 text-xs"><Switch checked={checked} onCheckedChange={onCheckedChange} />{label}</label>; }
function ImageField({ label, value, onChange, onFile }: { label: string; value: string; onChange: (v: string) => void; onFile: (f: File) => void }) { return <Field label={label}><div className="flex gap-2"><Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Görsel adresi" /><Button type="button" variant="secondary" size="icon" asChild aria-label="Görsel yükle"><label><ImagePlus /><input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} /></label></Button></div></Field>; }
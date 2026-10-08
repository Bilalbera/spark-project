import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/site-client";
import { AdminHeading } from "@/components/app/AdminShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Form = { id?: string; name: string; slug: string; emoji: string; image_url: string; sort_order: number };
const blank: Form = { name: "", slug: "", emoji: "", image_url: "", sort_order: 0 };
const slugify = (v: string) => v.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const Route = createFileRoute("/_authenticated/kurucu/kategoriler")({
  head: () => ({ meta: [{ title: "Kategori Yönetimi — Bilal Efendi" }, { name: "description", content: "İçerik kategorilerini yönetin." }, { property: "og:title", content: "Kategori Yönetimi — Bilal Efendi" }, { property: "og:description", content: "İçerik kategorilerini yönetin." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: CategoriesAdmin,
});
function CategoriesAdmin() {
  const qc = useQueryClient(); const [open, setOpen] = useState(false); const [form, setForm] = useState<Form>(blank);
  const query = useQuery({ queryKey: ["founder-categories"], queryFn: async () => (await supabase.from("categories").select("*").order("sort_order")).data ?? [] });
  async function save(e: React.FormEvent) { e.preventDefault(); const payload = { name: form.name.trim(), slug: form.slug || slugify(form.name), emoji: form.emoji || null, image_url: form.image_url || null, sort_order: form.sort_order }; const res = form.id ? await supabase.from("categories").update(payload).eq("id", form.id) : await supabase.from("categories").insert(payload); if (res.error) { toast.error(res.error.message); return; } toast.success("Kategori kaydedildi"); setOpen(false); qc.invalidateQueries({ queryKey: ["founder-categories"] }); }
  async function remove(id: string) { if (!confirm("Kategori silinsin mi?")) return; const { error } = await supabase.from("categories").delete().eq("id", id); if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["founder-categories"] }); }
  return <><AdminHeading title="Kategoriler" description="Serileri düzenli ve keşfedilebilir tutan kategoriler." action={<Button onClick={() => { setForm(blank); setOpen(true); }}><Plus /> Yeni kategori</Button>} />
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{query.data?.map((c) => <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4"><span className="flex h-11 w-11 items-center justify-center rounded-md bg-muted text-xl">{c.emoji || "#"}</span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{c.name}</p><p className="text-xs text-muted-foreground">/{c.slug}</p></div><Button variant="ghost" size="icon" onClick={() => { setForm({ id: c.id, name: c.name, slug: c.slug, emoji: c.emoji ?? "", image_url: c.image_url ?? "", sort_order: c.sort_order }); setOpen(true); }} aria-label="Düzenle"><Pencil /></Button><Button variant="ghost" size="icon" onClick={() => remove(c.id)} aria-label="Sil"><Trash2 className="text-destructive" /></Button></div>)}</div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{form.id ? "Kategoriyi düzenle" : "Yeni kategori"}</DialogTitle></DialogHeader><form onSubmit={save} className="space-y-4"><Field label="Kategori adı"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.id ? form.slug : slugify(e.target.value) })} /></Field><Field label="Adres adı"><Input required value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} /></Field><div className="grid grid-cols-[1fr_2fr] gap-3"><Field label="Simge"><Input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} placeholder="🎬" /></Field><Field label="Sıralama"><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></Field></div><Field label="Görsel adresi"><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></Field><Button className="w-full" type="submit">Kaydet</Button></form></DialogContent></Dialog>
  </>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label className="mb-1.5 block">{label}</Label>{children}</div>; }
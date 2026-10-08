import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bell, Menu, Search, LogOut, User, Users, MessageCircle, Crown } from "lucide-react";
import { supabase } from "@/lib/site-client";
import { useAuth } from "@/hooks/useAuth";
import { relativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "./cards";

const links = [
  { to: "/", label: "Ana Sayfa" },
  { to: "/seriler", label: "Seriler" },
  { to: "/kategoriler", label: "Kategoriler" },
  { to: "/premium", label: "Premium" },
] as const;

export function Navbar() {
  const { user, profile, isFounder } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 20);
    on();
    window.addEventListener("scroll", on);
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("touch_last_seen");
    const t = setInterval(() => supabase.rpc("touch_last_seen"), 60_000);
    return () => clearInterval(t);
  }, [user]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/giris", replace: true });
  }

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-colors ${scrolled ? "bg-background/95 backdrop-blur border-b border-border" : "bg-gradient-to-b from-background/90 to-transparent"}`}>
      <div className="flex h-16 items-center gap-4 px-4 sm:px-8">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menü"><Menu /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64">
            <nav className="mt-8 flex flex-col gap-1">
              {links.map((l) => (
                <Link key={l.to} to={l.to} className="rounded-md px-3 py-2 hover:bg-muted" activeProps={{ className: "text-primary" }} activeOptions={{ exact: true }}>{l.label}</Link>
              ))}
              {user && <>
                <Link to="/profil" className="rounded-md px-3 py-2 hover:bg-muted">Profilim</Link>
                <Link to="/arkadaslar" className="rounded-md px-3 py-2 hover:bg-muted">Arkadaşlar</Link>
                <Link to="/mesajlar" className="rounded-md px-3 py-2 hover:bg-muted">Mesajlar</Link>
              </>}
              {isFounder && <Link to="/kurucu" className="rounded-md px-3 py-2 text-primary hover:bg-muted">Kurucu Paneli</Link>}
            </nav>
          </SheetContent>
        </Sheet>
        <Link to="/" className="font-display text-2xl tracking-widest text-primary sm:text-3xl">BİLAL EFENDİ</Link>
        <nav className="ml-4 hidden gap-5 md:flex">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="text-sm text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "!text-foreground font-semibold" }} activeOptions={{ exact: true }}>{l.label}</Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" asChild aria-label="Ara"><Link to="/ara"><Search /></Link></Button>
          {user ? (
            <>
              <Button variant="ghost" size="icon" asChild aria-label="Mesajlar" className="hidden sm:inline-flex"><Link to="/mesajlar"><MessageCircle /></Link></Button>
              <NotificationBell userId={user.id} />
              <DropdownMenu>
                <DropdownMenuTrigger className="ml-1 rounded-full outline-none ring-primary focus-visible:ring-2">
                  <UserAvatar p={profile} size={34} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-2 py-1.5 text-sm"><p className="font-semibold">{profile?.display_name}</p><p className="text-xs text-muted-foreground">@{profile?.username}</p></div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link to="/profil"><User /> Profilim</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/arkadaslar"><Users /> Arkadaşlar</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/mesajlar"><MessageCircle /> Mesajlar</Link></DropdownMenuItem>
                  {isFounder && <DropdownMenuItem asChild><Link to="/kurucu"><Crown /> Kurucu Paneli</Link></DropdownMenuItem>}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}><LogOut /> Çıkış Yap</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button asChild size="sm" className="ml-2 rounded-full"><Link to="/giris">Giriş Yap</Link></Button>
          )}
        </div>
      </div>
    </header>
  );
}

function NotificationBell({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data = [] } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    const ch = supabase
      .channel(`notif-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () =>
        qc.invalidateQueries({ queryKey: ["notifications", userId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, qc]);
  const unread = data.filter((n) => !n.read).length;

  async function markAll() {
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
    qc.invalidateQueries({ queryKey: ["notifications", userId] });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Bildirimler">
          <Bell />
          {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-semibold">Bildirimler</p>
          {unread > 0 && <button onClick={markAll} className="text-xs text-primary">Tümünü okundu yap</button>}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {data.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Henüz bildirimin yok.</p>}
          {data.map((n) => (
            <button
              key={n.id}
              onClick={async () => {
                await supabase.from("notifications").update({ read: true }).eq("id", n.id);
                qc.invalidateQueries({ queryKey: ["notifications", userId] });
                if (n.link) navigate({ to: n.link });
              }}
              className={`block w-full border-b border-border px-4 py-3 text-left hover:bg-muted ${n.read ? "opacity-60" : ""}`}
            >
              <p className="text-sm font-semibold">{n.title}</p>
              {n.body && <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
              <p className="mt-1 text-[10px] text-muted-foreground">{relativeTime(n.created_at)}</p>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

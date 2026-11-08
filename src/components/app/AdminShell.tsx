import { Link, Outlet } from "@tanstack/react-router";
import {
  BarChart3,
  Clapperboard,
  Film,
  FolderOpen,
  Home,
  LayoutDashboard,
  LogOut,
  Mail,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const items = [
  { to: "/kurucu", label: "Genel Bakış", icon: LayoutDashboard, exact: true },
  { to: "/kurucu/seriler", label: "Seriler", icon: Film },
  { to: "/kurucu/bolumler", label: "Sezon ve Bölümler", icon: Clapperboard },
  { to: "/kurucu/kategoriler", label: "Kategoriler", icon: FolderOpen },
  { to: "/kurucu/kullanicilar", label: "Kullanıcılar", icon: Users },
  { to: "/kurucu/istatistikler", label: "İstatistikler", icon: BarChart3 },
  { to: "/kurucu/iletisim", label: "Kullanıcı İletileri", icon: Mail },
] as const;

export function AdminShell() {
  return (
    <div className="min-h-screen bg-background text-foreground md:grid md:grid-cols-[260px_1fr]">
      <aside className="border-b border-border bg-sidebar md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r">
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
          <Link to="/kurucu" className="font-display text-2xl text-primary">BİLAL EFENDİ</Link>
          <Button asChild variant="ghost" size="icon" className="md:hidden" aria-label="Siteye dön">
            <Link to="/"><Home /></Link>
          </Button>
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto p-3 md:block md:space-y-1 md:overflow-visible">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: "exact" in item && item.exact }}
                activeProps={{ className: "!bg-sidebar-accent !text-sidebar-primary" }}
                className="flex shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden border-t border-sidebar-border p-3 md:absolute md:inset-x-0 md:bottom-0 md:block">
          <Button asChild variant="ghost" className="w-full justify-start">
            <Link to="/"><LogOut /> Siteye dön</Link>
          </Button>
        </div>
      </aside>
      <main className="min-w-0 p-4 sm:p-6 lg:p-8"><Outlet /></main>
    </div>
  );
}

export function AdminHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-4xl sm:text-5xl">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function MetricCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between text-muted-foreground"><span className="text-sm">{label}</span><Icon className="h-5 w-5 text-primary" /></div>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </div>
  );
}

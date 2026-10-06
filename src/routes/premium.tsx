import { createFileRoute } from "@tanstack/react-router";
import { Crown } from "lucide-react";

export const Route = createFileRoute("/premium")({
  head: () => ({
    meta: [
      { title: "Bilal Efendi Premium — Yakında" },
      { name: "description", content: "Bilal Efendi Premium çok yakında sizlerle." },
      { property: "og:title", content: "Bilal Efendi Premium — Yakında" },
      { property: "og:description", content: "Bilal Efendi Premium çok yakında sizlerle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Premium,
});

function Premium() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 pt-20 text-center">
      <Crown className="h-16 w-16 text-primary" />
      <h1 className="mt-6 font-display text-5xl tracking-widest text-primary sm:text-7xl">
        BİLAL EFENDİ <span className="text-foreground">PREMİUM</span>
      </h1>
      <p className="mt-4 text-xl font-semibold tracking-[0.3em] text-muted-foreground">YAKINDA</p>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Premium üyelik üzerinde çalışıyoruz. Hazır olduğunda buradan duyurulacak.
      </p>
    </main>
  );
}

import Link from "next/link";
import { CircleDot } from "lucide-react";
import { footerGroups } from "@/lib/navigation";

export function SiteFooter() {
  return (
    <footer className="border-t bg-[#070707] text-white">
      <div className="container py-12">
        <div className="mb-12 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent font-black">
              W
            </span>
            <div>
              <p className="text-xl font-extrabold">Watchlist</p>
              <p className="text-sm text-white/55">Фільми, серіали й друзі в одному каталозі.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
          {footerGroups.map((group) => {
            const Icon = group.icon;
            return (
              <section key={group.title} className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-md border border-primary/50 bg-primary/10 text-primary">
                    <Icon data-icon="inline-start" />
                  </span>
                  <h3 className="text-lg font-bold">{group.title}</h3>
                </div>
                <nav className="flex flex-col gap-3">
                  {group.links.map((link) => (
                    <Link key={link.href} href={link.href} className="text-sm text-white/60 hover:text-white">
                      {link.label}
                    </Link>
                  ))}
                </nav>
              </section>
            );
          })}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-8 text-sm text-white/60 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <CircleDot data-icon="inline-start" />
            <span>Українська (UA)</span>
          </div>
          <p>© 2026 Watchlist. Усі права захищено.</p>
        </div>
      </div>
    </footer>
  );
}

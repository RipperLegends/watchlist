"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ClipboardList, Database, FileWarning, Gauge, Shield, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { href: "/admin", label: "Огляд", icon: Gauge, exact: true },
  { href: "/admin/catalog", label: "Каталог", icon: ClipboardList },
  { href: "/admin/users", label: "Користувачі", icon: Users },
  { href: "/admin/reports", label: "Звернення", icon: FileWarning },
  { href: "/admin/moderation", label: "Модерація", icon: Shield },
  { href: "/admin/audit", label: "Аудит", icon: Activity },
  { href: "/admin/maintenance", label: "Maintenance", icon: Database }
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="page-shell grid gap-6 xl:grid-cols-[260px_1fr]">
      <aside className="h-fit rounded-lg border bg-card p-4 shadow-soft xl:sticky xl:top-24">
        <div className="mb-4 border-b pb-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Watchlist CRM</p>
          <p className="mt-1 text-sm text-muted-foreground">Керування сайтом</p>
        </div>
        <nav className="flex flex-col gap-1">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const exact = "exact" in item && item.exact;
            const active = exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground",
                  active && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

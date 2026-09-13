"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Film, ListVideo, MessageSquare, Users, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/catalog", label: "Каталог", icon: Film },
  { href: "/watchlist-plus", label: "Мій список", icon: ListVideo },
  { href: "/messages", label: "Чати", icon: MessageSquare },
  { href: "/friends", label: "Друзі", icon: Users },
  { href: "/profile", label: "Профіль", icon: User },
];

export function MobileNav() {
  const pathname = usePathname();

  // Hide on login / register / onboarding pages if needed
  if (pathname === "/login" || pathname === "/register") {
    return null;
  }

  return (
    <nav aria-label="Мобільна навігація" className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 md:hidden">
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-colors",
                isActive
                  ? "text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <Icon className={cn("size-5 transition-transform", isActive && "scale-110")} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
                )}
              </div>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

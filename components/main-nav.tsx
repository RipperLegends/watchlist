"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface MainNavProps {
  items: {
    href: string;
    label: string;
  }[];
}

export function MainNav({ items }: MainNavProps) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) => {
        // Simple active check. If pathname starts with item.href (and it's not just "/"), mark it active
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted hover:text-foreground",
              isActive ? "bg-accent text-foreground" : "text-muted-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

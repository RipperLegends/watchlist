import { requireUser } from "@/lib/auth";
import { getCatalogEntries } from "@/lib/data";
import { getWatchlistPlusAccessForUser } from "@/lib/watchlist-plus";
import { CatalogClient } from "@/components/catalog/catalog-client";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const user = await requireUser();
  const [entries, plusAccess] = await Promise.all([
    getCatalogEntries(user?.id),
    getWatchlistPlusAccessForUser(user?.id)
  ]);
  const canManageCatalog = user?.role === "admin";

  return (
    <div className="page-shell flex flex-col gap-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-3">
          <h1 className="section-title">Каталог</h1>
          <p className="section-lead">
            Фільми й серіали додає адміністратор. Користувачі можуть ставити лайк або дизлайк окремо від адмінської оцінки.
          </p>
        </div>
        {canManageCatalog ? (
          <Button asChild>
            <Link href="/catalog/new">Додати фільм</Link>
          </Button>
        ) : null}
      </header>
      <CatalogClient
        entries={entries}
        canManage={canManageCatalog}
        canReact={Boolean(user)}
        canUsePersonalList={Boolean(user && plusAccess.active)}
      />
    </div>
  );
}

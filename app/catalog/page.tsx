import { auth } from "@/lib/auth";
import { getEntriesForUser } from "@/lib/data";
import { CatalogClient } from "@/components/catalog/catalog-client";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const session = await auth();
  const entries = await getEntriesForUser(session?.user?.id);

  return (
    <div className="page-shell flex flex-col gap-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-3">
          <h1 className="section-title">Каталог</h1>
          <p className="section-lead">
            Ваші фільми, серіали і особисті нотатки. Коментар відкривається по кліку, щоб текст не розтягував всю сторінку.
          </p>
        </div>
        <Button asChild>
          <Link href={session?.user ? "/catalog/new" : "/login"}>Додати запис</Link>
        </Button>
      </header>
      <CatalogClient entries={entries} />
    </div>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="page-shell flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-5xl font-black">404</h1>
      <p className="text-muted-foreground">Такої сторінки в Watchlist немає.</p>
      <Button asChild>
        <Link href="/">На головну</Link>
      </Button>
    </div>
  );
}

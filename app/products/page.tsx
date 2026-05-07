import Link from "next/link";
import { productCards } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProductsPage() {
  return (
    <div className="page-shell flex flex-col gap-8">
      <header>
        <h1 className="section-title">Продукти</h1>
        <p className="section-lead">Основні частини Watchlist, які тепер живуть як Next.js сторінки.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {productCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.href}>
              <CardHeader>
                <Icon data-icon="inline-start" />
                <CardTitle>{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href={card.href}>Відкрити</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

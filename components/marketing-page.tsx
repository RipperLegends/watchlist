import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type MarketingPageProps = {
  title: string;
  description: string;
  sections: Array<[string, string]>;
};

export function MarketingPage({ title, description, sections }: MarketingPageProps) {
  return (
    <div className="page-shell flex flex-col gap-8">
      <header className="flex max-w-3xl flex-col gap-4">
        <h1 className="section-title">{title}</h1>
        <p className="section-lead">{description}</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map(([sectionTitle, body]) => (
          <Card key={sectionTitle}>
            <CardHeader>
              <CardTitle>{sectionTitle}</CardTitle>
              <CardDescription>{body}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

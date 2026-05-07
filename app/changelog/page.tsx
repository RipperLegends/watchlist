import { MarketingPage } from "@/components/marketing-page";
import { marketingPages } from "@/lib/marketing-content";

export default function ChangelogPage() {
  return <MarketingPage {...marketingPages.changelog} />;
}

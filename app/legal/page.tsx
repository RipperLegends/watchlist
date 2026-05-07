import { MarketingPage } from "@/components/marketing-page";
import { marketingPages } from "@/lib/marketing-content";

export default function LegalPage() {
  return <MarketingPage {...marketingPages.legal} />;
}

import { MarketingPage } from "@/components/marketing-page";
import { marketingPages } from "@/lib/marketing-content";

export default function SecurityPage() {
  return <MarketingPage {...marketingPages.security} />;
}

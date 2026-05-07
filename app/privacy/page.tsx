import { MarketingPage } from "@/components/marketing-page";
import { marketingPages } from "@/lib/marketing-content";

export default function PrivacyPage() {
  return <MarketingPage {...marketingPages.privacy} />;
}

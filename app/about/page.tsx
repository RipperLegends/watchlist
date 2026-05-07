import { MarketingPage } from "@/components/marketing-page";
import { marketingPages } from "@/lib/marketing-content";

export default function AboutPage() {
  return <MarketingPage {...marketingPages.about} />;
}

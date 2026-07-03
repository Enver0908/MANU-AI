import type { Metadata } from "next";
import { SiriusaiMarketingPage } from "@/components/siriusai-marketing-page";
import { PUBLIC_MARKETING_COPY } from "@/lib/phase-84b-public-website";

export const metadata: Metadata = {
  title: `${PUBLIC_MARKETING_COPY.brand} | ${PUBLIC_MARKETING_COPY.tagline}`,
  description: PUBLIC_MARKETING_COPY.heroSubtitle,
};

export default function Home() {
  return <SiriusaiMarketingPage />;
}

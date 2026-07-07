import type { Metadata } from "next";
import { ContactSection } from "@/components/public/ContactSection";
import { HeroSection } from "@/components/public/HeroSection";
import { HowItWorksSection } from "@/components/public/HowItWorksSection";
import { MobileSection } from "@/components/public/MobileSection";
import { PublicShell } from "@/components/public/PublicShell";
import { SecuritySection } from "@/components/public/SecuritySection";
import { WorkspacePreviewSection } from "@/components/public/WorkspacePreviewSection";
import { PUBLIC_MARKETING_COPY } from "@/lib/phase-84b-public-website";

export const metadata: Metadata = {
  title: `${PUBLIC_MARKETING_COPY.brand} | ${PUBLIC_MARKETING_COPY.tagline}`,
  description: PUBLIC_MARKETING_COPY.heroSubtitle,
};

export default function Home() {
  return (
    <PublicShell>
      <HeroSection />
      <WorkspacePreviewSection />
      <HowItWorksSection />
      <SecuritySection />
      <MobileSection />
      <ContactSection />
    </PublicShell>
  );
}

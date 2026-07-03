import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { buttonClasses, Card, CardBody, CardHeader } from "@/components/ui";
import { PUBLIC_MARKETING_COPY, isPublicDemoLoginEnabled } from "@/lib/phase-84b-public-website";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Demo | ${PUBLIC_MARKETING_COPY.brand}`,
  description: PUBLIC_MARKETING_COPY.demoPageBody,
  robots: { index: false, follow: false },
};

export default function DemoEntryPage() {
  if (!isPublicDemoLoginEnabled()) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-surface-muted px-safe py-10 text-ink">
      <div className="mx-auto max-w-lg">
        <Link href="/" className={`${buttonClasses("ghost", "sm")} mb-6 inline-flex`}>
          <ArrowLeft size={16} />
          Ana sayfa
        </Link>
        <Card>
          <CardHeader title={PUBLIC_MARKETING_COPY.demoPageTitle} />
          <CardBody className="space-y-4">
            <p className="text-sm leading-6 text-ink-muted">{PUBLIC_MARKETING_COPY.demoPageBody}</p>
            <form action="/api/demo-login" method="post">
              <button type="submit" className={buttonClasses("secondary", "lg")}>
                <LockKeyhole size={17} />
                {PUBLIC_MARKETING_COPY.demoButton}
              </button>
            </form>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import {
  CreditCard,
  LogOut,
  Mail,
  ShieldAlert,
  ShieldX,
  ShoppingCart,
  UserRoundX,
} from "lucide-react";
import { buttonClasses, Card, CardBody, type IconType, type Tone } from "@/components/ui";
import { PURCHASE_CONTACT_EMAIL } from "@/lib/phase-83e2-purchase-ux";
import type { DashboardAccessGate } from "@/lib/phase-83e3-app-shell";

/**
 * Phase 83E-3 authenticated shell gated states. Each state is a full-screen,
 * fail-closed block that never renders dashboard data. A safe sign-out is always
 * available; commercial states additionally offer a purchase/contact path.
 */
function GatedStateScreen({
  icon: Icon,
  tone,
  title,
  description,
  children,
  actions,
}: {
  icon: IconType;
  tone: Tone;
  title: string;
  description: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const iconToneClasses: Record<Tone, string> = {
    plum: "bg-surface-muted text-primary",
    sage: "bg-sage/10 text-sage",
    warm: "bg-warm/10 text-warm",
    emerald: "bg-sage/10 text-sage",
    amber: "bg-warm/10 text-warm",
    red: "bg-red-100 text-red-900",
    stone: "bg-surface-muted text-ink-muted",
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-muted px-safe py-8 text-ink">
      <div className="w-full max-w-md">
        <Card>
          <CardBody className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <span className={`rounded-control p-2 ${iconToneClasses[tone]}`}>
                <Icon size={22} />
              </span>
              <div>
                <h1 className="text-lg font-semibold text-ink">{title}</h1>
                <p className="mt-1 text-sm text-ink-muted">{description}</p>
              </div>
            </div>
            {children ? <div className="text-sm leading-6 text-ink-muted">{children}</div> : null}
            <div className="flex flex-col gap-2">
              {actions}
              <form action="/api/demo-logout" method="post">
                <button type="submit" className={`${buttonClasses("secondary", "md")} w-full`}>
                  <LogOut size={17} />
                  Oturumu kapat
                </button>
              </form>
            </div>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}

function ContactLink() {
  return (
    <a
      href={`mailto:${PURCHASE_CONTACT_EMAIL}`}
      className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-primary underline"
    >
      <Mail size={15} />
      {PURCHASE_CONTACT_EMAIL}
    </a>
  );
}

export function NoMembershipState() {
  return (
    <GatedStateScreen
      icon={ShieldAlert}
      tone="amber"
      title="Çalışma alanı erişimi yok"
      description="Hesabınız herhangi bir MANU-AI çalışma alanına bağlı değil."
      actions={<ContactLink />}
    >
      Panele erişebilmeniz için bir çalışma alanı yöneticisinin hesabınızı bir kiracıya eklemesi
      gerekir. Klinik yöneticinizle iletişime geçin.
    </GatedStateScreen>
  );
}

export function NoDietitianProfileState() {
  return (
    <GatedStateScreen
      icon={UserRoundX}
      tone="amber"
      title="Diyetisyen profili eksik"
      description="Hesabınızın çalışma alanı erişimi var ancak diyetisyen profili yok."
      actions={<ContactLink />}
    >
      Paneli kullanabilmeniz için hesabınıza bir diyetisyen profili tanımlanmalıdır. Kurulumu
      tamamlamak için çalışma alanı yöneticinizle iletişime geçin.
    </GatedStateScreen>
  );
}

export function NoInviteState() {
  return (
    <GatedStateScreen
      icon={ShoppingCart}
      tone="stone"
      title="Erişim davetiniz yok"
      description="Bu hesap için etkin bir ticari erişim bulunamadı."
      actions={
        <>
          <Link href="/purchase" className={`${buttonClasses("primary", "md")} w-full`}>
            <ShoppingCart size={17} />
            Satın al
          </Link>
          <ContactLink />
        </>
      }
    >
      MANU-AI davetle erişilir. Onaylı e-posta ve davet kodunuzla satın alma akışını başlatabilir
      veya erişim için ekiple iletişime geçebilirsiniz.
    </GatedStateScreen>
  );
}

export function CheckoutIncompleteState() {
  return (
    <GatedStateScreen
      icon={CreditCard}
      tone="amber"
      title="Ödeme tamamlanmadı"
      description="Aboneliğiniz henüz etkin değil çünkü ödeme tamamlanmadı."
      actions={
        <Link href="/purchase" className={`${buttonClasses("primary", "md")} w-full`}>
          <CreditCard size={17} />
          Ödemeye devam et
        </Link>
      }
    >
      Panele erişmek için güvenli ödeme akışını tamamlayın. Ödemeniz doğrulandıktan sonra erişiminiz
      otomatik olarak açılır.
    </GatedStateScreen>
  );
}

export function InactiveSubscriptionState() {
  return (
    <GatedStateScreen
      icon={ShieldAlert}
      tone="red"
      title="Abonelik aktif değil"
      description="Aboneliğiniz gecikmiş ya da iptal edilmiş durumda."
      actions={
        <>
          <Link href="/purchase" className={`${buttonClasses("primary", "md")} w-full`}>
            <CreditCard size={17} />
            Aboneliği yenile
          </Link>
          <ContactLink />
        </>
      }
    >
      Panele ve mobil kuruluma erişim, abonelik yeniden etkinleşene kadar kapalıdır. Ödeme
      durumunuzu güncelleyin veya ekiple iletişime geçin.
    </GatedStateScreen>
  );
}

export function RevokedAccessState() {
  return (
    <GatedStateScreen
      icon={ShieldX}
      tone="red"
      title="Erişim iptal edildi"
      description="Bu hesabın MANU-AI erişimi iptal edilmiş."
      actions={<ContactLink />}
    >
      Korumalı ekranlara ve verilere erişim kapatıldı. Bunun bir hata olduğunu düşünüyorsanız
      çalışma alanı yöneticinizle veya ekiple iletişime geçin.
    </GatedStateScreen>
  );
}

/** Render the correct gated-state screen for a blocked dashboard access gate. */
export function DashboardGatedState({ gate }: { gate: Exclude<DashboardAccessGate, "ok"> }) {
  switch (gate) {
    case "no_membership":
      return <NoMembershipState />;
    case "no_dietitian_profile":
      return <NoDietitianProfileState />;
    case "no_invite":
      return <NoInviteState />;
    case "checkout_incomplete":
      return <CheckoutIncompleteState />;
    case "inactive_subscription":
      return <InactiveSubscriptionState />;
    case "revoked_access":
      return <RevokedAccessState />;
    default:
      return <RevokedAccessState />;
  }
}

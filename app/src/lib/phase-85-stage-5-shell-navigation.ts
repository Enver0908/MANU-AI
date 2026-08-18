import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  ClipboardList,
  Ellipsis,
  MessageSquareText,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  UsersRound,
} from "lucide-react";
import type { AppCapability } from "./app-capability-contracts";
import { hasCapability } from "./app-capability-contracts";
import type { SupportedLanguageCode } from "./languages";
import {
  AI_CHAT_ROOT_PATH,
  MORE_ROOT_PATH,
  SETTINGS_ROOT_PATH,
  buildShellHref,
  type DashboardNavKey,
} from "./phase-85-stage-4b-dashboard-routing";
import {
  SHELL_COMPACT_BOTTOM_NAV_IDS,
  type ShellDestinationId,
  type ShellNavigationItemDto,
} from "./phase-85-stage-5-shell-contracts";
import type { TenantRole } from "./types";

export const PHASE_85_STAGE_5_SHELL_NAVIGATION_VERSION = "p85-stage-5-shell-navigation-v1";

export const SHELL_COMPACT_MAX_PX = 767;
export const SHELL_MEDIUM_MIN_PX = 768;
export const SHELL_MEDIUM_MAX_PX = 1199;
export const SHELL_WIDE_MIN_PX = 1200;
export const SHELL_WIDE_SIDEBAR_PX = 288;
export const SHELL_MEDIUM_RAIL_PX = 80;
export const SHELL_COMPACT_HEADER_PX = 64;
export const SHELL_WIDE_HEADER_PX = 56;
export const SHELL_COMPACT_BOTTOM_NAV_PX = 64;

export type ShellNavVisualItem = {
  destinationId: ShellDestinationId;
  navKey: DashboardNavKey;
  label: string;
  shortLabel: string;
  href: string;
  icon: LucideIcon;
  badgeCount: number;
  enabled: boolean;
  disabledReason?: string;
};

export type MoreMenuSectionId = "ai_tools" | "client_tools" | "account" | "admin";

export type MoreMenuItem = {
  id: string;
  destinationId: ShellDestinationId | "operational_foundation";
  label: string;
  href: string;
  enabled: boolean;
  disabledReason?: string;
};

export type MoreMenuSection = {
  id: MoreMenuSectionId;
  title: string;
  items: MoreMenuItem[];
};

type DestinationMeta = {
  navKey: DashboardNavKey;
  labelKey: ShellNavigationMessageKey;
  shortLabelKey: ShellNavigationMessageKey;
  fallbackLabel: string;
  fallbackShortLabel: string;
  icon: LucideIcon;
};

type ShellNavigationMessageKey =
  | "shellNavHome"
  | "shellNavClients"
  | "shellNavMessages"
  | "shellNavAlerts"
  | "shellNavNotifications"
  | "shellNavSimulator"
  | "shellNavVoice"
  | "shellNavForms"
  | "shellNavAiChat"
  | "shellNavSettings"
  | "shellNavMore"
  | "shellNavShortHome"
  | "shellNavShortClients"
  | "shellNavShortMessages"
  | "shellNavShortAlerts"
  | "shellNavShortNotifications"
  | "shellNavShortSimulator"
  | "shellNavShortVoice"
  | "shellNavShortForms"
  | "shellNavShortAiChat"
  | "shellNavShortSettings"
  | "shellNavShortMore"
  | "shellMoreSectionAiTools"
  | "shellMoreSectionClientTools"
  | "shellMoreSectionAccount"
  | "shellMoreSectionAdmin"
  | "shellMoreOperationalFoundation";

const SHELL_NAVIGATION_MESSAGES: Record<SupportedLanguageCode, Record<ShellNavigationMessageKey, string>> = {
  tr: {
    shellNavHome: "Ana Sayfa",
    shellNavClients: "Danisanlar",
    shellNavMessages: "Mesajlar",
    shellNavAlerts: "Uyarilar",
    shellNavNotifications: "Bildirimler",
    shellNavSimulator: "Simulator",
    shellNavVoice: "Ses",
    shellNavForms: "Formlar",
    shellNavAiChat: "AI Chat",
    shellNavSettings: "Ayarlar",
    shellNavMore: "Diger",
    shellNavShortHome: "Ana",
    shellNavShortClients: "Danisan",
    shellNavShortMessages: "Mesaj",
    shellNavShortAlerts: "Uyari",
    shellNavShortNotifications: "Bildirim",
    shellNavShortSimulator: "Sim",
    shellNavShortVoice: "Ses",
    shellNavShortForms: "Form",
    shellNavShortAiChat: "AI",
    shellNavShortSettings: "Ayar",
    shellNavShortMore: "Diger",
    shellMoreSectionAiTools: "AI ve is araclari",
    shellMoreSectionClientTools: "Danisan araclari",
    shellMoreSectionAccount: "Hesap ve uygulama",
    shellMoreSectionAdmin: "Owner / admin yonetimi",
    shellMoreOperationalFoundation: "Operasyon temeli",
  },
  en: {
    shellNavHome: "Home",
    shellNavClients: "Clients",
    shellNavMessages: "Messaging",
    shellNavAlerts: "Alerts",
    shellNavNotifications: "Notifications",
    shellNavSimulator: "Simulator",
    shellNavVoice: "Voice",
    shellNavForms: "Forms",
    shellNavAiChat: "AI Chat",
    shellNavSettings: "Settings",
    shellNavMore: "More",
    shellNavShortHome: "Home",
    shellNavShortClients: "Client",
    shellNavShortMessages: "Msg",
    shellNavShortAlerts: "Alert",
    shellNavShortNotifications: "Notif",
    shellNavShortSimulator: "Sim",
    shellNavShortVoice: "Voice",
    shellNavShortForms: "Form",
    shellNavShortAiChat: "AI",
    shellNavShortSettings: "Set",
    shellNavShortMore: "More",
    shellMoreSectionAiTools: "AI and work tools",
    shellMoreSectionClientTools: "Client tools",
    shellMoreSectionAccount: "Account and app",
    shellMoreSectionAdmin: "Owner / admin management",
    shellMoreOperationalFoundation: "Operational foundation",
  },
  de: {
    shellNavHome: "Startseite",
    shellNavClients: "Klienten",
    shellNavMessages: "Nachrichten",
    shellNavAlerts: "Warnungen",
    shellNavNotifications: "Benachrichtigungen",
    shellNavSimulator: "Simulator",
    shellNavVoice: "Stimme",
    shellNavForms: "Formulare",
    shellNavAiChat: "AI Chat",
    shellNavSettings: "Einstellungen",
    shellNavMore: "Mehr",
    shellNavShortHome: "Start",
    shellNavShortClients: "Klient",
    shellNavShortMessages: "Msg",
    shellNavShortAlerts: "Warn",
    shellNavShortNotifications: "Hinw",
    shellNavShortSimulator: "Sim",
    shellNavShortVoice: "Stim",
    shellNavShortForms: "Form",
    shellNavShortAiChat: "AI",
    shellNavShortSettings: "Einst",
    shellNavShortMore: "Mehr",
    shellMoreSectionAiTools: "AI- und Arbeitswerkzeuge",
    shellMoreSectionClientTools: "Klientenwerkzeuge",
    shellMoreSectionAccount: "Konto und App",
    shellMoreSectionAdmin: "Owner-/Admin-Verwaltung",
    shellMoreOperationalFoundation: "Operative Grundlage",
  },
  fr: {
    shellNavHome: "Accueil",
    shellNavClients: "Clients",
    shellNavMessages: "Messagerie",
    shellNavAlerts: "Alertes",
    shellNavNotifications: "Notifications",
    shellNavSimulator: "Simulateur",
    shellNavVoice: "Voix",
    shellNavForms: "Formulaires",
    shellNavAiChat: "AI Chat",
    shellNavSettings: "Parametres",
    shellNavMore: "Plus",
    shellNavShortHome: "Accueil",
    shellNavShortClients: "Client",
    shellNavShortMessages: "Msg",
    shellNavShortAlerts: "Alerte",
    shellNavShortNotifications: "Notif",
    shellNavShortSimulator: "Sim",
    shellNavShortVoice: "Voix",
    shellNavShortForms: "Form",
    shellNavShortAiChat: "AI",
    shellNavShortSettings: "Regl",
    shellNavShortMore: "Plus",
    shellMoreSectionAiTools: "Outils AI et travail",
    shellMoreSectionClientTools: "Outils client",
    shellMoreSectionAccount: "Compte et application",
    shellMoreSectionAdmin: "Gestion owner / admin",
    shellMoreOperationalFoundation: "Fondation operationnelle",
  },
  es: {
    shellNavHome: "Inicio",
    shellNavClients: "Clientes",
    shellNavMessages: "Mensajeria",
    shellNavAlerts: "Alertas",
    shellNavNotifications: "Notificaciones",
    shellNavSimulator: "Simulador",
    shellNavVoice: "Voz",
    shellNavForms: "Formularios",
    shellNavAiChat: "AI Chat",
    shellNavSettings: "Ajustes",
    shellNavMore: "Mas",
    shellNavShortHome: "Inicio",
    shellNavShortClients: "Cliente",
    shellNavShortMessages: "Msg",
    shellNavShortAlerts: "Alerta",
    shellNavShortNotifications: "Notif",
    shellNavShortSimulator: "Sim",
    shellNavShortVoice: "Voz",
    shellNavShortForms: "Form",
    shellNavShortAiChat: "AI",
    shellNavShortSettings: "Ajus",
    shellNavShortMore: "Mas",
    shellMoreSectionAiTools: "Herramientas AI y trabajo",
    shellMoreSectionClientTools: "Herramientas de cliente",
    shellMoreSectionAccount: "Cuenta y app",
    shellMoreSectionAdmin: "Gestion owner / admin",
    shellMoreOperationalFoundation: "Base operativa",
  },
  pt: {
    shellNavHome: "Inicio",
    shellNavClients: "Clientes",
    shellNavMessages: "Mensagens",
    shellNavAlerts: "Alertas",
    shellNavNotifications: "Notificacoes",
    shellNavSimulator: "Simulador",
    shellNavVoice: "Voz",
    shellNavForms: "Formularios",
    shellNavAiChat: "AI Chat",
    shellNavSettings: "Definicoes",
    shellNavMore: "Mais",
    shellNavShortHome: "Inicio",
    shellNavShortClients: "Cliente",
    shellNavShortMessages: "Msg",
    shellNavShortAlerts: "Alerta",
    shellNavShortNotifications: "Notif",
    shellNavShortSimulator: "Sim",
    shellNavShortVoice: "Voz",
    shellNavShortForms: "Form",
    shellNavShortAiChat: "AI",
    shellNavShortSettings: "Def",
    shellNavShortMore: "Mais",
    shellMoreSectionAiTools: "Ferramentas AI e trabalho",
    shellMoreSectionClientTools: "Ferramentas de cliente",
    shellMoreSectionAccount: "Conta e app",
    shellMoreSectionAdmin: "Gestao owner / admin",
    shellMoreOperationalFoundation: "Fundacao operacional",
  },
  cs: {
    shellNavHome: "Domu",
    shellNavClients: "Klienti",
    shellNavMessages: "Zpravy",
    shellNavAlerts: "Alerty",
    shellNavNotifications: "Oznameni",
    shellNavSimulator: "Simulator",
    shellNavVoice: "Hlas",
    shellNavForms: "Formulare",
    shellNavAiChat: "AI Chat",
    shellNavSettings: "Nastaveni",
    shellNavMore: "Vice",
    shellNavShortHome: "Domu",
    shellNavShortClients: "Klient",
    shellNavShortMessages: "Zpr",
    shellNavShortAlerts: "Alert",
    shellNavShortNotifications: "Ozn",
    shellNavShortSimulator: "Sim",
    shellNavShortVoice: "Hlas",
    shellNavShortForms: "Form",
    shellNavShortAiChat: "AI",
    shellNavShortSettings: "Nast",
    shellNavShortMore: "Vice",
    shellMoreSectionAiTools: "AI a pracovni nastroje",
    shellMoreSectionClientTools: "Klientske nastroje",
    shellMoreSectionAccount: "Ucet a aplikace",
    shellMoreSectionAdmin: "Sprava owner / admin",
    shellMoreOperationalFoundation: "Operacni zaklad",
  },
};

function navMessage(language: SupportedLanguageCode, key: ShellNavigationMessageKey) {
  return SHELL_NAVIGATION_MESSAGES[language]?.[key] ?? SHELL_NAVIGATION_MESSAGES.tr[key];
}

const DESTINATION_META: Record<ShellDestinationId, DestinationMeta> = {
  home: {
    navKey: "overview",
    labelKey: "shellNavHome",
    shortLabelKey: "shellNavShortHome",
    fallbackLabel: "Ana Sayfa",
    fallbackShortLabel: "Ana",
    icon: Activity,
  },
  clients: {
    navKey: "clients",
    labelKey: "shellNavClients",
    shortLabelKey: "shellNavShortClients",
    fallbackLabel: "Danisanlar",
    fallbackShortLabel: "Danisan",
    icon: UsersRound,
  },
  messages: {
    navKey: "messages",
    labelKey: "shellNavMessages",
    shortLabelKey: "shellNavShortMessages",
    fallbackLabel: "Mesajlar",
    fallbackShortLabel: "Mesaj",
    icon: MessageSquareText,
  },
  alerts: {
    navKey: "alerts",
    labelKey: "shellNavAlerts",
    shortLabelKey: "shellNavShortAlerts",
    fallbackLabel: "Uyarilar",
    fallbackShortLabel: "Uyari",
    icon: AlertTriangle,
  },
  notifications: {
    navKey: "notifications",
    labelKey: "shellNavNotifications",
    shortLabelKey: "shellNavShortNotifications",
    fallbackLabel: "Bildirimler",
    fallbackShortLabel: "Bildirim",
    icon: Bell,
  },
  simulator: {
    navKey: "simulator",
    labelKey: "shellNavSimulator",
    shortLabelKey: "shellNavShortSimulator",
    fallbackLabel: "Simulator",
    fallbackShortLabel: "Sim",
    icon: Bot,
  },
  voice: {
    navKey: "voice",
    labelKey: "shellNavVoice",
    shortLabelKey: "shellNavShortVoice",
    fallbackLabel: "Ses",
    fallbackShortLabel: "Ses",
    icon: ClipboardList,
  },
  forms: {
    navKey: "forms",
    labelKey: "shellNavForms",
    shortLabelKey: "shellNavShortForms",
    fallbackLabel: "Formlar",
    fallbackShortLabel: "Form",
    icon: SlidersHorizontal,
  },
  ai_chat: {
    navKey: "ai_chat",
    labelKey: "shellNavAiChat",
    shortLabelKey: "shellNavShortAiChat",
    fallbackLabel: "AI Chat",
    fallbackShortLabel: "AI",
    icon: Sparkles,
  },
  settings: {
    navKey: "settings",
    labelKey: "shellNavSettings",
    shortLabelKey: "shellNavShortSettings",
    fallbackLabel: "Ayarlar",
    fallbackShortLabel: "Ayar",
    icon: Settings,
  },
  more: {
    navKey: "more",
    labelKey: "shellNavMore",
    shortLabelKey: "shellNavShortMore",
    fallbackLabel: "Diger",
    fallbackShortLabel: "Diger",
    icon: Ellipsis,
  },
};

const WIDE_SIDEBAR_ORDER: ShellDestinationId[] = [
  "home",
  "clients",
  "messages",
  "alerts",
  "notifications",
  "simulator",
  "voice",
  "forms",
  "ai_chat",
  "more",
  "settings",
];

function hrefForDestination(destinationId: ShellDestinationId) {
  if (destinationId === "more") return MORE_ROOT_PATH;
  if (destinationId === "settings") return SETTINGS_ROOT_PATH;
  if (destinationId === "ai_chat") return AI_CHAT_ROOT_PATH;
  return buildShellHref(destinationId);
}

function navigationEnabledMap(navigation: readonly ShellNavigationItemDto[] | null | undefined) {
  const map = new Map<ShellDestinationId, ShellNavigationItemDto>();
  for (const item of navigation ?? []) {
    map.set(item.id, item);
  }
  return map;
}

function isPermanentlyDenied(item: ShellNavVisualItem | MoreMenuItem) {
  return (
    item.disabledReason?.startsWith("rbac_") ||
    item.disabledReason === "read_only_role" ||
    item.disabledReason === "conversation_read_forbidden"
  );
}

function toVisualItem(
  destinationId: ShellDestinationId,
  navigation: ReadonlyMap<ShellDestinationId, ShellNavigationItemDto>,
  badges: { alerts: number; messages: number; notifications: number },
  uiLanguage: SupportedLanguageCode,
): ShellNavVisualItem {
  const meta = DESTINATION_META[destinationId];
  const projected = navigation.get(destinationId);
  const enabled = projected?.enabled !== false;
  let badgeCount = 0;
  if (destinationId === "alerts") badgeCount = badges.alerts;
  if (destinationId === "messages") badgeCount = badges.messages;
  if (destinationId === "notifications") badgeCount = badges.notifications;

  return {
    destinationId,
    navKey: meta.navKey,
    label: navMessage(uiLanguage, meta.labelKey) || meta.fallbackLabel,
    shortLabel: navMessage(uiLanguage, meta.shortLabelKey) || meta.fallbackShortLabel,
    href: hrefForDestination(destinationId),
    icon: meta.icon,
    badgeCount: enabled ? Math.max(0, badgeCount) : 0,
    enabled,
    disabledReason: projected?.disabledReason,
  };
}

export function resolveCompactBottomNavItems(input: {
  navigation?: readonly ShellNavigationItemDto[] | null;
  badges?: { alerts: number; messages: number; notifications: number };
  role?: TenantRole;
  uiLanguage?: SupportedLanguageCode;
}): ShellNavVisualItem[] {
  const navigation = navigationEnabledMap(input.navigation);
  const badges = input.badges ?? { alerts: 0, messages: 0, notifications: 0 };
  const uiLanguage = input.uiLanguage ?? "tr";
  return SHELL_COMPACT_BOTTOM_NAV_IDS
    .map((id) => toVisualItem(id, navigation, badges, uiLanguage))
    .filter((item) => {
      if (!input.role || input.role === "owner" || input.role === "admin" || input.role === "dietitian") {
        return true;
      }
      if (item.destinationId === "more") return true;
      return !isPermanentlyDenied(item);
    });
}

export function resolveMediumRailNavItems(input: {
  navigation?: readonly ShellNavigationItemDto[] | null;
  badges?: { alerts: number; messages: number; notifications: number };
  role: TenantRole;
  uiLanguage?: SupportedLanguageCode;
}): ShellNavVisualItem[] {
  const navigation = navigationEnabledMap(input.navigation);
  const badges = input.badges ?? { alerts: 0, messages: 0, notifications: 0 };
  const order: ShellDestinationId[] = ["home", "clients", "messages", "alerts", "more", "settings"];
  if (input.role === "owner" || input.role === "admin" || input.role === "dietitian") {
    order.splice(5, 0, "notifications");
  }
  return order
    .map((id) => toVisualItem(id, navigation, badges, input.uiLanguage ?? "tr"))
    .filter((item) => {
      if (item.destinationId === "more" || item.destinationId === "settings") return true;
      return item.enabled || !isPermanentlyDenied(item);
    });
}

export function resolveWideSidebarNavItems(input: {
  navigation?: readonly ShellNavigationItemDto[] | null;
  badges?: { alerts: number; messages: number; notifications: number };
  role: TenantRole;
  uiLanguage?: SupportedLanguageCode;
}): ShellNavVisualItem[] {
  const navigation = navigationEnabledMap(input.navigation);
  const badges = input.badges ?? { alerts: 0, messages: 0, notifications: 0 };
  return WIDE_SIDEBAR_ORDER.map((id) => toVisualItem(id, navigation, badges, input.uiLanguage ?? "tr")).filter((item) => {
    if (item.destinationId === "more" || item.destinationId === "settings") return true;
    if (input.role === "assistant" || input.role === "auditor") {
      return item.enabled && hasCapability(input.role, "read_app_state");
    }
    return item.enabled || !isPermanentlyDenied(item);
  });
}

function pushMoreItem(items: MoreMenuItem[], item: MoreMenuItem) {
  if (!item.enabled && isPermanentlyDenied(item)) return;
  items.push(item);
}

export function resolveMoreMenuSections(input: {
  role: TenantRole;
  navigation?: readonly ShellNavigationItemDto[] | null;
  aiChatEnabled: boolean;
  capabilities?: readonly AppCapability[];
  uiLanguage?: SupportedLanguageCode;
}): MoreMenuSection[] {
  const navigation = navigationEnabledMap(input.navigation);
  const uiLanguage = input.uiLanguage ?? "tr";
  const canReadOps =
    hasCapability(input.role, "read_operational_foundation") ||
    (input.capabilities?.includes("read_operational_foundation") ?? false);

  const aiItems: MoreMenuItem[] = [];
  const aiChat = navigation.get("ai_chat");
  pushMoreItem(aiItems, {
    id: "ai_chat",
    destinationId: "ai_chat",
    label: navMessage(uiLanguage, "shellNavAiChat"),
    href: AI_CHAT_ROOT_PATH,
    enabled: Boolean(input.aiChatEnabled && aiChat?.enabled !== false),
    disabledReason: !input.aiChatEnabled ? "feature_disabled" : aiChat?.disabledReason,
  });
  for (const id of ["simulator", "voice"] as const) {
    const projected = navigation.get(id);
    pushMoreItem(aiItems, {
      id,
      destinationId: id,
      label: navMessage(uiLanguage, DESTINATION_META[id].labelKey),
      href: hrefForDestination(id),
      enabled: projected?.enabled !== false,
      disabledReason: projected?.disabledReason,
    });
  }

  const clientItems: MoreMenuItem[] = [];
  for (const id of ["forms", "notifications"] as const) {
    const projected = navigation.get(id);
    pushMoreItem(clientItems, {
      id,
      destinationId: id,
      label: navMessage(uiLanguage, DESTINATION_META[id].labelKey),
      href: hrefForDestination(id),
      enabled: projected?.enabled !== false,
      disabledReason: projected?.disabledReason,
    });
  }

  const accountItems: MoreMenuItem[] = [];
  pushMoreItem(accountItems, {
    id: "settings",
    destinationId: "settings",
    label: navMessage(uiLanguage, "shellNavSettings"),
    href: SETTINGS_ROOT_PATH,
    enabled: navigation.get("settings")?.enabled !== false,
    disabledReason: navigation.get("settings")?.disabledReason,
  });

  const sections: MoreMenuSection[] = [
    { id: "ai_tools", title: navMessage(uiLanguage, "shellMoreSectionAiTools"), items: aiItems },
    { id: "client_tools", title: navMessage(uiLanguage, "shellMoreSectionClientTools"), items: clientItems },
    { id: "account", title: navMessage(uiLanguage, "shellMoreSectionAccount"), items: accountItems },
  ];

  if ((input.role === "owner" || input.role === "admin") && canReadOps) {
    sections.push({
      id: "admin",
      title: navMessage(uiLanguage, "shellMoreSectionAdmin"),
      items: [
        {
          id: "operational_foundation",
          destinationId: "operational_foundation",
          label: navMessage(uiLanguage, "shellMoreOperationalFoundation"),
          href: "/dashboard?section=overview&inspection=operational",
          enabled: true,
        },
      ],
    });
  }

  return sections.filter((section) => section.items.length > 0);
}

export function shellDestinationIcon(destinationId: ShellDestinationId): LucideIcon {
  return DESTINATION_META[destinationId].icon;
}

export const SHELL_ADMIN_SECTION_ICON = Shield;

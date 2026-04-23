import {
  Bot,
  Calendar,
  Clock3,
  CreditCard,
  KeyRound,
  Layers3,
  MessageCircle,
  ShieldCheck,
  Users2,
} from "lucide-react";
import type { ComponentType } from "react";

type Feature = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
};

const features: Feature[] = [
  {
    icon: Layers3,
    title: "Multi-platform publishing",
    description:
      "Schedule posts for Facebook, Instagram, LinkedIn, YouTube, TikTok, and WhatsApp from one composer.",
  },
  {
    icon: Users2,
    title: "Access request onboarding",
    description: "Public signups require super-admin approval before users can enter workspaces.",
  },
  {
    icon: CreditCard,
    title: "Trial + Stripe billing",
    description: "7-day trial with Stripe checkout and self-serve billing portal for upgrades.",
  },
  {
    icon: KeyRound,
    title: "BYOK AI policy",
    description: "Use your own OpenRouter API key. You control model usage, privacy, and costs.",
  },
  {
    icon: ShieldCheck,
    title: "RBAC governance",
    description: "Granular roles: super_admin, client, owner, and moderator for operational control.",
  },
  {
    icon: MessageCircle,
    title: "Messaging channels",
    description: "Link Telegram and WhatsApp users per company with admin-side active/inactive controls.",
  },
  {
    icon: Calendar,
    title: "Central post schedule",
    description: "Review upcoming content across channels in one unified schedule view.",
  },
  {
    icon: Bot,
    title: "AI-assisted content",
    description: "Generate captions and hashtag variants with BYOK AI integrations.",
  },
  {
    icon: Clock3,
    title: "Smart scheduling",
    description: "Pick posting times by channel and timezone to run campaigns consistently.",
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="scroll-mt-20">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          Everything you need to{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-sky-600 bg-clip-text text-transparent">
            scale social media
          </span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-slate-600">
          Powerful capabilities for publishing, approvals, billing, and team governance.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-100 to-sky-100 text-indigo-600 transition-colors group-hover:from-indigo-600 group-hover:to-sky-600 group-hover:text-white">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-slate-900">{title}</h3>
            <p className="text-sm leading-relaxed text-slate-600">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

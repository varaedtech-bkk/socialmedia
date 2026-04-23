import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2 } from "lucide-react";

type PricingCardProps = {
  name: string;
  price: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  ctaLabel: string;
};

function PricingCard({ name, price, description, features, highlighted = false, ctaLabel }: PricingCardProps) {
  return (
    <div
      className={`rounded-xl border p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 ${
        highlighted
          ? "border-indigo-300 bg-gradient-to-br from-indigo-50 to-white shadow-indigo-100"
          : "border-slate-200 bg-white"
      }`}
    >
      {highlighted && (
        <div className="mb-3 inline-block rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">
          Popular
        </div>
      )}
      <h3 className="text-xl font-bold text-slate-900">{name}</h3>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-slate-900">{price}</span>
      </div>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      <Separator className="my-4" />
      <ul className="mb-6 space-y-2">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Link href="/auth">
        <Button
          className={`w-full rounded-full ${
            highlighted
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-500"
              : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          {ctaLabel}
        </Button>
      </Link>
    </div>
  );
}

export function LandingPricing() {
  return (
    <section id="pricing" className="my-20 scroll-mt-20">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          Simple,{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-sky-600 bg-clip-text text-transparent">
            transparent pricing
          </span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-slate-600">Start with a 7-day trial, then scale with Stripe billing.</p>
      </div>
      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
        <PricingCard
          name="Trial"
          price="$0"
          description="Explore the platform with full feature access for 7 days."
          features={["7-day full access", "Core publishing and scheduling", "Access request flow", "Community support"]}
          ctaLabel="Start free trial"
        />
        <PricingCard
          name="Premium"
          price="Contact us"
          description="For teams that need scale, controls, and priority support."
          features={["Advanced analytics", "Expanded team workflows", "Priority support", "Stripe-managed billing"]}
          highlighted
          ctaLabel="Contact sales"
        />
      </div>
      <p className="mt-6 text-center text-xs text-slate-500">
        All plans include RBAC, BYOK AI policy, and approval-based onboarding.
      </p>
    </section>
  );
}

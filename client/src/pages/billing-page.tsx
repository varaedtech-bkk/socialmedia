import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowRight,
  Check,
  CreditCard,
  ExternalLink,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Shield,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { canAccessAdminPanel } from "@/lib/admin-access";
import { appCard, appCardElevated, appPageLead, appPageTitle, appSectionStack } from "@/lib/app-surface";
import { AppLayout } from "@/components/app-layout";

type BillingConfig = {
  advanceCheckoutAvailable: boolean;
  trialDays?: number;
  stripe?: {
    missingKeys?: string[];
    webhookPath?: string;
  };
};

type SubscriptionPayload = {
  plan?: string;
  status?: string;
  current_period_end?: number;
  posts_used?: number;
  posts_limit?: number | typeof Infinity;
  featureDisabled?: boolean;
  packageTier?: string;
  advanceCheckoutAvailable?: boolean;
  trialEligible?: boolean;
  trialEndsAt?: string | null;
  trialExpired?: boolean;
  paymentRequired?: boolean;
  trialDays?: number;
};

type OpenRouterStatus = {
  hasUserKey: boolean;
  maskedKey: string | null;
};

function maskCustomerId(id: string | null | undefined): string | null {
  if (!id || id.length < 10) return null;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export default function BillingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canceled = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("canceled") : null;

  useEffect(() => {
    if (canceled === "1") {
      toast({
        title: "Checkout canceled",
        description: "No changes were made to your plan.",
      });
      window.history.replaceState({}, "", "/billing");
    }
  }, [canceled, toast]);

  const { data: config, isLoading: configLoading } = useQuery<BillingConfig>({
    queryKey: ["/api/billing/config", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/billing/config");
      return res.json();
    },
    enabled: !!user?.id,
  });

  const { data: subscription, isLoading: subLoading } = useQuery<SubscriptionPayload>({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/subscription");
      return res.json();
    },
    enabled: !!user?.id,
  });

  const { data: openRouter, isLoading: orLoading } = useQuery<OpenRouterStatus>({
    queryKey: ["/api/integrations/openrouter"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/openrouter", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!user?.id,
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/checkout-advance", {});
      const j = (await res.json()) as { url?: string };
      if (!j.url) throw new Error("No checkout URL returned");
      return j.url;
    },
    onSuccess: (url) => {
      window.location.href = url;
    },
    onError: (e: Error) => {
      toast({ title: "Could not start checkout", description: e.message, variant: "destructive" });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/portal-session", {});
      const j = (await res.json()) as { url?: string };
      if (!j.url) throw new Error("No portal URL returned");
      return j.url;
    },
    onSuccess: (url) => {
      window.location.href = url;
    },
    onError: (e: Error) => {
      toast({ title: "Could not open billing portal", description: e.message, variant: "destructive" });
    },
  });

  const dbTier = subscription?.packageTier ?? user?.packageTier ?? "basic";
  const effectiveTier = user?.capabilities?.packageTier ?? dbTier;
  const isAdvance = effectiveTier === "advance";
  const aiReady = user?.capabilities?.aiGeneration === true;
  const canPay = config?.advanceCheckoutAvailable === true;
  const showAdmin = canAccessAdminPanel(user?.role, (user as any)?.companyMembership?.role);
  const companyRole = (user as any)?.companyMembership?.role as string | undefined;
  const inCompanyWorkspace = Boolean((user as any)?.companyMembership);
  const isCompanyBillingManager = companyRole === "owner";
  const canManageBilling = user?.role === "super_admin" || !inCompanyWorkspace || isCompanyBillingManager;
  const stripeCustomerMasked = maskCustomerId(user?.stripeCustomerId ?? undefined);

  const postsLimitLabel =
    subscription?.posts_limit === Infinity ? "∞" : String(subscription?.posts_limit ?? "—");
  const renewalTs = subscription?.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;
  const trialEndsAt = subscription?.trialEndsAt ? new Date(subscription.trialEndsAt) : null;
  const renewalLabel =
    renewalTs && subscription?.status === "active" ? renewalTs.toLocaleDateString() : "No active paid subscription";
  const trialDays = subscription?.trialDays ?? config?.trialDays ?? 7;
  const stripeMissing = config?.stripe?.missingKeys ?? [];
  const roleSummary = user?.role === "super_admin"
    ? "Super admin"
    : inCompanyWorkspace
      ? `Company member (${companyRole || "member"})`
      : "Individual workspace user";

  return (
    <AppLayout shellWidth="narrow" topBarTitle="Billing" topBarIcon={CreditCard}>
      <div className={cn(appSectionStack, "sm:space-y-10")}>
        {/* Title */}
        <div className="max-w-3xl space-y-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
              <CreditCard className="h-5 w-5" />
            </div>
            <h1 className={appPageTitle}>Plan & billing</h1>
          </div>
          <p className={appPageLead}>
            Your <strong className="font-medium text-zinc-900">workspace package</strong> controls AI (Advance) vs
            posting-only (Basic). Payments for Advance use Stripe; OpenRouter usage may be billed separately.
          </p>
        </div>

        {!canPay && !configLoading && (
          <Alert className="rounded-xl border border-amber-200/80 bg-amber-50/90">
            <AlertTitle className="text-sm">Self-serve checkout unavailable</AlertTitle>
            <AlertDescription className="text-sm leading-relaxed mt-1.5">
              Stripe checkout is currently disabled for this deployment.
              {stripeMissing.length > 0 && (
                <>
                  {" "}Missing config:{" "}
                  {stripeMissing.map((k) => (
                    <code key={k} className="rounded bg-muted px-1 py-0.5 text-[11px] mr-1">{k}</code>
                  ))}
                  {config?.stripe?.webhookPath && (
                    <>
                      {" "}Webhook endpoint:{" "}
                      <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{config.stripe.webhookPath}</code>
                    </>
                  )}
                </>
              )}
            </AlertDescription>
          </Alert>
        )}
        {subscription?.paymentRequired && (
          <Alert className="rounded-xl border border-rose-200/80 bg-rose-50/90">
            <AlertTitle className="text-sm">Trial ended — payment required</AlertTitle>
            <AlertDescription className="text-sm leading-relaxed mt-1.5">
              Your {trialDays}-day trial is finished. Upgrade with Stripe below to continue using Advance features.
            </AlertDescription>
          </Alert>
        )}
        {!canManageBilling && (
          <Alert className="rounded-xl border border-blue-200/80 bg-blue-50/90">
            <AlertTitle className="text-sm">Billing managed by your company owner</AlertTitle>
            <AlertDescription className="text-sm leading-relaxed mt-1.5">
              Your role is <strong>{companyRole || "member"}</strong>. Checkout, renewal, and cancellation are managed
              by your company owner.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:gap-8 lg:grid-cols-12 items-start">
          {/* Current plan — left column */}
          <div className="lg:col-span-5 space-y-6">
            <Card className={cn(appCard, "overflow-hidden")}>
              <CardHeader className="space-y-1 border-b border-zinc-200/80 bg-zinc-50/80 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
                <CardTitle className="text-lg font-semibold text-zinc-900">Your workspace</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Signed in as <span className="font-medium text-foreground">{user?.username}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="px-5 sm:px-6 py-5 sm:py-6 space-y-5">
                {(configLoading || subLoading) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    Loading plan…
                  </div>
                )}

                {!configLoading && !subLoading && (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Package</span>
                      <Badge variant={isAdvance ? "default" : "secondary"} className="capitalize text-xs px-2.5 py-0.5">
                        {effectiveTier}
                      </Badge>
                      {isAdvance && (
                        <Badge variant={aiReady ? "default" : "outline"} className="gap-1 text-xs">
                          <Sparkles className="h-3 w-3" />
                          {aiReady ? "AI ready" : "Add OpenRouter key"}
                        </Badge>
                      )}
                    </div>

                    <Separator />

                    <div className="space-y-2 text-sm">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Posting quota</p>
                      {subscription?.featureDisabled ? (
                        <p className="text-muted-foreground">Unlimited posts (subscription quota feature off).</p>
                      ) : (
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground tabular-nums">{subscription?.posts_used ?? 0}</span>
                          {" / "}
                          <span className="font-medium text-foreground tabular-nums">{postsLimitLabel}</span>
                          <span className="text-xs ml-1 capitalize">({subscription?.plan ?? "—"} tier)</span>
                        </p>
                      )}
                      {renewalTs && subscription?.status === "active" && !subscription?.featureDisabled && (
                        <p className="text-xs text-muted-foreground">
                          Current period ends{" "}
                          <span className="font-medium text-foreground">{renewalTs.toLocaleDateString()}</span>
                        </p>
                      )}
                    </div>
                    <Separator />
                    <div className="space-y-2 text-sm">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Billing cycle
                      </p>
                      <p className="text-muted-foreground">
                        Renewal/expiry: <span className="font-medium text-foreground">{renewalLabel}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Billing owner: {roleSummary}
                      </p>
                    </div>
                    {subscription?.trialEligible && trialEndsAt && (
                      <>
                        <Separator />
                        <p className="text-xs text-muted-foreground">
                          Trial ends on{" "}
                          <span className="font-medium text-foreground">{trialEndsAt.toLocaleDateString()}</span>
                        </p>
                      </>
                    )}

                    {stripeCustomerMasked && (
                      <>
                        <Separator />
                        <p className="text-xs text-muted-foreground">
                          Stripe customer:{" "}
                          <code className="text-[11px] rounded bg-muted px-1.5 py-0.5">{stripeCustomerMasked}</code>
                        </p>
                      </>
                    )}
                  </>
                )}
              </CardContent>
              <CardFooter className="flex flex-col gap-2 border-t border-zinc-200/80 bg-zinc-50/80 px-5 py-4 sm:flex-row sm:flex-wrap sm:px-6">
                <Button variant="outline" size="sm" className="w-full sm:w-auto justify-center gap-2" asChild>
                  <Link href="/integrations">
                    <KeyRound className="h-4 w-4" />
                    Integrations
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="w-full sm:w-auto justify-center gap-2" asChild>
                  <Link href="/app">
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                </Button>
                {showAdmin && (
                  <Button variant="outline" size="sm" className="w-full sm:w-auto justify-center gap-2" asChild>
                    <Link href="/admin">
                      <Shield className="h-4 w-4" />
                      Admin
                    </Link>
                  </Button>
                )}
              </CardFooter>
            </Card>

            {/* OpenRouter snapshot */}
            <Card className={appCard}>
              <CardHeader className="px-5 pb-2 pt-5 sm:px-6 sm:pt-6">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                  <KeyRound className="h-4 w-4 text-primary" />
                  OpenRouter
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Advance AI requires your own OpenRouter key.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-5 sm:px-6 pb-5 sm:pb-6">
                {orLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </div>
                ) : openRouter?.hasUserKey ? (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Saved key:</span>{" "}
                    <code className="text-xs rounded bg-muted px-1.5 py-0.5 break-all">{openRouter.maskedKey}</code>
                  </p>
                ) : (
                  <p className="text-sm text-amber-800 dark:text-amber-200/90">No key configured yet.</p>
                )}
                <Button variant="link" className="h-auto p-0 mt-3 text-sm gap-1" asChild>
                  <Link href="/integrations">
                    Manage key
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Upgrade / Advance — right column */}
          <div className="lg:col-span-7 space-y-6">
            <Card className={cn(appCardElevated, "overflow-hidden border-primary/20 shadow-[0_14px_30px_-20px_rgba(0,0,0,0.35)]")}>
              <CardHeader className="space-y-2 border-b border-zinc-200/80 bg-gradient-to-br from-primary/[0.07] via-white to-white px-5 pb-6 pt-6 sm:px-6 sm:pt-8">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/20">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <CardTitle className="text-xl font-semibold leading-tight text-zinc-900 sm:text-2xl">
                      Advance package
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed text-zinc-600 sm:text-base">
                      Stripe subscription — unlocks dashboard AI and Telegram{" "}
                      <code className="text-[11px] rounded bg-background/80 px-1">/ai</code> when a key is available.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-5 sm:px-6 py-6 sm:py-8 space-y-6">
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {[
                    "AI-assisted drafts in Create Post",
                    "Telegram /ai with your own OpenRouter key",
                    "Everything in Basic (scheduling, multi-network posting, bot)",
                  ].map((line) => (
                    <li key={line} className="flex gap-3">
                      <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="leading-snug">{line}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="w-full sm:w-auto justify-center" asChild>
                    <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">
                      OpenRouter keys
                      <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" className="w-full sm:w-auto justify-center" asChild>
                    <a href="https://stripe.com/docs" target="_blank" rel="noreferrer">
                      About Stripe billing
                      <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                    </a>
                  </Button>
                </div>

                <Separator />

                {isAdvance ? (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-muted-foreground">
                    <p className="font-medium text-emerald-900 dark:text-emerald-100 mb-1">You&apos;re on Advance</p>
                    <p>
                      You can manage invoices, payment methods, and cancellation from the Stripe billing portal.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => portalMutation.mutate()}
                      disabled={!canPay || portalMutation.isPending || !canManageBilling}
                    >
                      {portalMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Opening portal…
                        </>
                      ) : (
                        "Manage subscription"
                      )}
                    </Button>
                    {!canManageBilling && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Ask your company owner to manage renewal or cancellation.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <Button
                      size="lg"
                      className="w-full sm:w-auto min-w-[200px] shrink-0"
                      onClick={() => checkoutMutation.mutate()}
                      disabled={!canPay || checkoutMutation.isPending || !canManageBilling}
                    >
                      {checkoutMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Opening Stripe…
                        </>
                      ) : (
                        <>
                          Upgrade with Stripe
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground leading-relaxed flex-1 min-w-0">
                      You&apos;ll complete payment on Stripe&apos;s site. Your plan updates when checkout finishes (and
                      via webhook).
                    </p>
                    {!canManageBilling && (
                      <p className="text-xs text-muted-foreground leading-relaxed flex-1 min-w-0">
                        Billing actions are restricted for your company role.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Compare */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className={cn(appCard, !isAdvance && "ring-1 ring-zinc-200/90")}>
                <CardHeader className="px-5 pb-3 pt-5 sm:px-6">
                  <CardTitle className="text-base font-semibold text-zinc-900">Basic</CardTitle>
                  <CardDescription className="text-xs">Posting, scheduling, Telegram (no AI)</CardDescription>
                </CardHeader>
                <CardContent className="px-5 sm:px-6 pb-5 space-y-2 text-sm text-muted-foreground">
                  <p className="flex gap-2">
                    <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    Multi-network compose & calendar
                  </p>
                  <p className="flex gap-2">
                    <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    You can still save an OpenRouter key for after upgrade
                  </p>
                </CardContent>
              </Card>
              <Card
                className={cn(
                  appCard,
                  isAdvance && "border-primary/25 bg-primary/[0.04] ring-2 ring-primary/25",
                )}
              >
                <CardHeader className="px-5 pb-3 pt-5 sm:px-6">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base font-semibold text-zinc-900">Advance</CardTitle>
                    {isAdvance && (
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                        Current
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs">AI drafts + /ai + everything in Basic</CardDescription>
                </CardHeader>
                <CardContent className="px-5 sm:px-6 pb-5 space-y-2 text-sm text-muted-foreground">
                  <p className="flex gap-2">
                    <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    Dashboard AI & Telegram /ai
                  </p>
                  <p className="flex gap-2">
                    <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    Billed on Stripe for this upgrade path
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <p className="text-center sm:text-left text-[11px] sm:text-xs text-muted-foreground max-w-3xl px-0">
          Trial policy: {trialDays} days. Questions about invoices or refunds are handled by your workspace owner and
          Stripe — this app stores your package tier and optional Stripe customer id for renewals.
        </p>
      </div>
    </AppLayout>
  );
}

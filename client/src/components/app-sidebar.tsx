import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { BarChart2, CreditCard, Home, KeyRound, Settings } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Separator } from "@/components/ui/separator";
import { AppUserMenu } from "@/components/app-user-menu";
import Clock from "@/components/ui/clock";
import { apiRequest } from "@/lib/queryClient";
import { canAccessAdminPanel } from "@/lib/admin-access";
import { cn } from "@/lib/utils";
import { sidebarNavLinkClass, sidebarSectionTitleClass } from "@/lib/app-nav";

type SidebarSubscription = {
  packageTier?: string;
};

export function AppSidebar({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const [appMatch] = useRoute("/app");
  const [integrationsMatch] = useRoute("/integrations");
  const [analyticsMatch] = useRoute("/analytics");
  const [billingMatch] = useRoute("/billing");
  const [adminMatch] = useRoute("/admin");

  const { data: subscription } = useQuery<SidebarSubscription>({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/subscription");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!user?.id,
  });

  const workspaceTier = (
    user?.capabilities?.packageTier ??
    subscription?.packageTier ??
    user?.packageTier ??
    "basic"
  ).toLowerCase();
  const isAdvanceTier = workspaceTier === "advance";

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-zinc-900 text-zinc-300", className)}>
      <div className="shrink-0 border-b border-zinc-800/90 px-4 py-5 sm:px-5 sm:py-6">
        <h1 className="text-base font-semibold leading-tight tracking-tight text-white sm:text-lg">
          Multi<span className="text-primary">Social</span> Studio
        </h1>
        <Clock className="mt-2 text-sm font-medium tabular-nums tracking-tight text-zinc-500" />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 sm:px-3 sm:py-4">
        <p className={sidebarSectionTitleClass()}>Workspace</p>
        <div className="space-y-0.5">
          <Link href="/app" className={sidebarNavLinkClass(!!appMatch)}>
            <Home className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
            <span className="truncate">Dashboard</span>
          </Link>
          <Link href="/integrations" className={sidebarNavLinkClass(!!integrationsMatch)}>
            <KeyRound className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
            <span className="truncate">Integrations</span>
          </Link>
          <Link href="/analytics" className={sidebarNavLinkClass(!!analyticsMatch)}>
            <BarChart2 className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
            <span className="truncate">Analytics</span>
          </Link>
          <Link href="/billing" className={cn(sidebarNavLinkClass(!!billingMatch), "gap-2 pr-2")}>
            <CreditCard className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
            <span className="min-w-0 flex-1 truncate">Billing</span>
            <span
              className={cn(
                "shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                isAdvanceTier
                  ? "border-primary/40 bg-primary text-primary-foreground"
                  : "border-zinc-600 bg-zinc-800 text-zinc-200",
              )}
              title="Workspace package (Basic vs Advance). Legacy post plans are separate."
            >
              {workspaceTier}
            </span>
          </Link>
        </div>

        <p className={sidebarSectionTitleClass()}>Account</p>
        <div className="space-y-0.5">
          {canAccessAdminPanel(user?.role, (user as any)?.companyMembership?.role) && (
            <Link href="/admin" className={sidebarNavLinkClass(!!adminMatch)}>
              <Settings className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
              <span className="truncate">Admin</span>
            </Link>
          )}
        </div>
      </nav>

      <Separator className="shrink-0 bg-zinc-800" />
      <div className="shrink-0 border-t border-zinc-800/90 bg-zinc-950/70 p-2.5 sm:p-3">
        <AppUserMenu variant="sidebar" />
      </div>
    </div>
  );
}

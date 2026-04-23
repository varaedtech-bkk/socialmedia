// src/components/SubscriptionStatus.tsx
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type SubscriptionResponse = {
  plan: string;
  status: string;
  current_period_end: number;
  posts_used: number;
  posts_limit: number | typeof Infinity;
  featureDisabled?: boolean;
  packageTier?: string;
  advanceCheckoutAvailable?: boolean;
  trialEligible?: boolean;
  trialEndsAt?: string | null;
  paymentRequired?: boolean;
};

export const SubscriptionStatus = () => {
  const { user } = useAuth();

  const { data: subscription, isLoading, error } = useQuery<SubscriptionResponse>({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/subscription");
      return response.json();
    },
    enabled: !!user?.id,
  });

  if (isLoading) return <Skeleton className="h-6 w-32" />;
  if (error) return <div className="text-red-500 text-sm">Error loading subscription</div>;

  const expiryDate = subscription?.current_period_end
    ? new Date(subscription.current_period_end * 1000).toLocaleDateString()
    : null;

  const postsLimit = subscription?.posts_limit === Infinity 
    ? '∞' 
    : subscription?.posts_limit || '∞';

  const workspaceTier = subscription?.packageTier || "basic";
  const trialEnd = subscription?.trialEndsAt ? new Date(subscription.trialEndsAt).toLocaleDateString() : null;

  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium">Workspace:</span>
        <span
          className={cn(
            "px-2 py-1 rounded-full text-xs capitalize",
            workspaceTier === "advance" ? "bg-primary/10 text-primary" : "bg-muted",
          )}
        >
          {workspaceTier}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-medium">Posts plan:</span>
        <span className={cn(
          "px-2 py-1 rounded-full text-xs",
          subscription?.plan === 'pro' ? 'bg-primary/10 text-primary' :
          subscription?.plan === 'enterprise' ? 'bg-purple-500/10 text-purple-500' :
          'bg-muted'
        )}>
          {subscription?.plan || 'Free'}
        </span>
        {subscription?.featureDisabled && (
          <span className="text-xs text-muted-foreground">(Unlimited)</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="font-medium">Usage:</span>
        <span>
          {subscription?.posts_used || 0}/{postsLimit} posts
        </span>
      </div>
      {expiryDate && subscription?.status === 'active' && !subscription?.featureDisabled && (
        <div className="flex items-center gap-2">
          <span className="font-medium">Renews:</span>
          <span>{expiryDate}</span>
        </div>
      )}
      {subscription?.trialEligible && trialEnd && (
        <div className="flex items-center gap-2">
          <span className="font-medium">Trial ends:</span>
          <span>{trialEnd}</span>
        </div>
      )}
      {subscription?.paymentRequired && (
        <div className="text-xs text-rose-600">Payment required for Advance features</div>
      )}
    </div>
  );
};
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
};

export const SubscriptionStatus = () => {
  const { user } = useAuth();

  const { data: subscription, isLoading, error } = useQuery<SubscriptionResponse>({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/subscription");
      if (!response.ok) throw new Error("Failed to fetch subscription");
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

  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium">Plan:</span>
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
    </div>
  );
};
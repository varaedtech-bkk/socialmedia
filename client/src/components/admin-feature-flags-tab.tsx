import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CreditCard, FileText, Globe, Loader2, Shield, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { appCard } from "@/lib/app-surface";

type FeatureFlag = {
  key: string;
  value: boolean;
  description: string | null;
  updatedAt: string;
};

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  subscriptions_enabled: <CreditCard className="h-5 w-5" />,
  post_quota_enabled: <FileText className="h-5 w-5" />,
  stripe_payments_enabled: <Shield className="h-5 w-5" />,
  public_registration_enabled: <Globe className="h-5 w-5" />,
};

const FEATURE_HINTS: Partial<Record<string, string>> = {
  subscriptions_enabled:
    "Legacy post-plan tiers in the database. When off, the app treats posting as unlimited for quota checks.",
  post_quota_enabled: "When on, monthly post limits apply per subscription tier (separate from Basic/Advance AI).",
  stripe_payments_enabled:
    "Required for self-serve Advance upgrades (Stripe Checkout) and webhooks. Off blocks new checkouts.",
  public_registration_enabled: "When off, only admins create accounts; Request access flow still works.",
};

export function AdminFeatureFlagsTab({ viewerId }: { viewerId: number | undefined }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ features: FeatureFlag[] }>({
    queryKey: ["admin", "features", viewerId],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/features");
      return res.json();
    },
    enabled: Boolean(viewerId),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      const res = await apiRequest("POST", `/api/admin/features/${key}`, { value });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "features"] });
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      toast({
        title: "Feature updated",
        description: `${variables.key.replace(/_/g, " ")} is now ${variables.value ? "on" : "off"}.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-44 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground max-w-3xl">
        These flags control platform behaviour. <strong>Basic / Advance</strong> workspace packages are set per user
        (admin Users tab, access approvals, or Stripe checkout)—not by the legacy &quot;subscriptions&quot; flag alone.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {data?.features.map((feature) => {
          const isUpdating = updateMutation.isPending && updateMutation.variables?.key === feature.key;
          const featureName = feature.key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
          const hint = FEATURE_HINTS[feature.key] || feature.description || "";

          return (
            <Card key={feature.key} className={appCard}>
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                    {FEATURE_ICONS[feature.key] || <Zap className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base font-semibold text-zinc-900">{featureName}</CardTitle>
                    <CardDescription className="mt-1 text-xs leading-relaxed">{hint}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {isUpdating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    <Switch
                      checked={feature.value}
                      onCheckedChange={(checked) => updateMutation.mutate({ key: feature.key, value: checked })}
                      disabled={isUpdating}
                    />
                    <Label className="text-sm font-medium">
                      {feature.value ? (
                        <span className="text-emerald-600 dark:text-emerald-400">On</span>
                      ) : (
                        <span className="text-muted-foreground">Off</span>
                      )}
                    </Label>
                  </div>
                  <Badge variant={feature.value ? "default" : "secondary"}>{feature.value ? "Active" : "Inactive"}</Badge>
                </div>
                {feature.updatedAt && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Last updated {new Date(feature.updatedAt).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SocialAccount } from "@shared/schema";

export default function ConnectedAccounts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery<SocialAccount[]>({
    queryKey: ["social-accounts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/social-accounts");
      return res.json();
    },
  });

  const setDefault = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/social-accounts/${id}/default`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Default updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/social-accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Account removed" });
    },
    onError: (e: Error) => {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!accounts.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connected pages &amp; accounts</CardTitle>
          <CardDescription>
            Connect Facebook Page (or other platforms) below. Each connection is stored here so you can
            manage multiple pages and choose a default for posting.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Connected pages &amp; accounts</CardTitle>
        <CardDescription>
          Default accounts are used when you post from the dashboard or Telegram. Use Telegram{" "}
          <code className="text-xs bg-muted px-1 rounded">/accounts</code> and{" "}
          <code className="text-xs bg-muted px-1 rounded">/defaultfb &lt;id&gt;</code> to switch from chat.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {accounts.map((a) => (
          <div
            key={a.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
          >
            <div>
              <div className="font-medium flex items-center gap-2 flex-wrap">
                {a.displayName || a.externalId}
                {a.isDefault && (
                  <Badge variant="secondary" className="text-xs">
                    default
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                #{a.id} · {a.platform} · {a.externalId}
              </div>
            </div>
            <div className="flex gap-2">
              {!a.isDefault && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={setDefault.isPending}
                  onClick={() => setDefault.mutate(a.id)}
                >
                  <Star className="h-4 w-4 mr-1" />
                  Set default
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={remove.isPending}
                onClick={() => remove.mutate(a.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

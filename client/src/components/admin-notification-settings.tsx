import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { appCard } from "@/lib/app-surface";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Server } from "lucide-react";

type NotificationSettings = {
  superAdminEmail: string;
  effectiveRecipient: string | null;
  smtpConfigured: boolean;
  envSuperAdminConfigured: boolean;
};

export function AdminNotificationSettingsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");

  const { data: config } = useQuery<{ userPermissions: string[] }>({
    queryKey: ["admin", "config"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/config");
      return res.json();
    },
  });
  const canEdit = config?.userPermissions?.includes("settings.edit") ?? false;

  const { data, isLoading } = useQuery<NotificationSettings>({
    queryKey: ["admin", "notification-settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/notification-settings");
      return res.json();
    },
  });

  useEffect(() => {
    if (data) setEmail(data.superAdminEmail ?? "");
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (superAdminEmail: string) => {
      const res = await apiRequest("PUT", "/api/admin/notification-settings", { superAdminEmail });
      return res.json() as Promise<NotificationSettings & { ok?: boolean }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "notification-settings"] });
      toast({ title: "Saved", description: "Notification recipient updated." });
    },
    onError: (e: Error) => {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Card className={cn(appCard, "max-w-xl")}>
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
          <Mail className="h-5 w-5 text-primary" />
          Notifications
        </CardTitle>
        <CardDescription className="text-sm leading-snug">
          Access requests and alerts send to this address. SMTP credentials stay in server environment only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="flex flex-wrap gap-2">
          <Badge variant={data?.smtpConfigured ? "default" : "secondary"} className="text-xs font-normal">
            <Server className="h-3 w-3 mr-1" />
            SMTP {data?.smtpConfigured ? "ready" : "not configured"}
          </Badge>
          {data?.effectiveRecipient ? (
            <Badge variant="outline" className="text-xs font-normal truncate max-w-[240px]">
              Delivers to: {data.effectiveRecipient}
            </Badge>
          ) : null}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="super-admin-email" className="text-xs uppercase tracking-wide text-muted-foreground">
              Super admin email
            </Label>
            <Input
              id="super-admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              disabled={!canEdit}
              className="h-9"
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use <code className="text-[11px]">SUPER_ADMIN_EMAIL</code> from env
              {data?.envSuperAdminConfigured ? " (currently set)" : " (not set)"}.
            </p>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button
            size="sm"
            disabled={!canEdit || saveMutation.isPending || isLoading}
            onClick={() => saveMutation.mutate(email.trim())}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>

        {!canEdit && (
          <p className="text-xs text-muted-foreground border-t pt-3">
            Only super admins can change this setting.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

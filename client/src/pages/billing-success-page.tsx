import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useEffect } from "react";

export default function BillingSuccessPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const sessionId =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("session_id")
      : null;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["/api/billing/session-status", sessionId],
    queryFn: async () => {
      if (!sessionId) throw new Error("Missing session_id");
      const res = await fetch(
        `/api/billing/session-status?session_id=${encodeURIComponent(sessionId)}`,
        { credentials: "include" }
      );
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; payment_status?: string };
      if (!res.ok) throw new Error(j.error || res.statusText);
      return j as { ok: boolean; packageTier?: string; payment_status?: string };
    },
    enabled: !!user?.id && !!sessionId,
    retry: 2,
  });

  useEffect(() => {
    if (data?.ok) {
      void queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      void queryClient.invalidateQueries({ queryKey: ["subscription"] });
    }
  }, [data?.ok, queryClient]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Payment complete</h1>

        {!sessionId && (
          <Alert variant="destructive">
            <AlertTitle>Missing session</AlertTitle>
            <AlertDescription>Open this page from the link Stripe shows after checkout.</AlertDescription>
          </Alert>
        )}

        {sessionId && isLoading && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Confirming your subscription…
          </div>
        )}

        {sessionId && isError && (
          <Alert variant="destructive">
            <AlertTitle>Could not confirm</AlertTitle>
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        )}

        {sessionId && data?.ok && (
          <p className="text-muted-foreground">
            Your account is on <strong className="text-foreground">Advance</strong>. You can use AI features after
            adding your OpenRouter key under Integrations.
          </p>
        )}

        {sessionId && data && !data.ok && !isLoading && (
          <p className="text-sm text-muted-foreground">
            Payment status: {data.payment_status ?? "unknown"}. If you were charged, your plan may still update in a
            few seconds via webhook—refresh the dashboard.
          </p>
        )}

        <Button asChild variant="default">
          <Link href="/app">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}

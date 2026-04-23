import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { appCard } from "@/lib/app-surface";
import { AppLayout } from "@/components/app-layout";

type OpenRouterStatus = {
  hasUserKey: boolean;
  maskedKey: string | null;
  requiresUserKey?: boolean;
};

function FeatureRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
      )}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

export default function IntegrationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [apiKeyInput, setApiKeyInput] = useState("");

  const tier = user?.capabilities?.packageTier ?? "basic";
  const isAdvance = tier === "advance";
  const aiReady = user?.capabilities?.aiGeneration === true;

  const { data: status, isLoading } = useQuery<OpenRouterStatus>({
    queryKey: ["/api/integrations/openrouter"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/openrouter", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load integration status");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      const res = await fetch("/api/integrations/openrouter", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ apiKey }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
    },
    onSuccess: () => {
      setApiKeyInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/openrouter"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Key saved", description: "AI will use your OpenRouter account." });
    },
    onError: (e: Error) => {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/integrations/openrouter", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clear: true }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/openrouter"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Key removed" });
    },
    onError: (e: Error) => {
      toast({ title: "Could not remove", description: e.message, variant: "destructive" });
    },
  });

  const keyConfigured = Boolean(status?.hasUserKey);
  const dashboardAiEnabled = isAdvance && keyConfigured;
  const telegramAiEnabled = isAdvance && keyConfigured;

  return (
    <AppLayout shellWidth="narrow" topBarTitle="Integrations" topBarIcon={KeyRound}>
      <div className="space-y-8">
        <div className="mb-8 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">Integrations</h1>
              <p className="text-sm leading-relaxed text-zinc-600 md:text-base">
                Connect external services your workspace uses.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
          {/* Status column */}
          <div className="space-y-4 lg:col-span-4">
            <Card className={appCard}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-zinc-900">Your workspace</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Live view of how AI is wired for your account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={isAdvance ? "default" : "secondary"} className="capitalize">
                    {tier} plan
                  </Badge>
                  {isAdvance ? (
                    <Badge variant={aiReady ? "default" : "outline"} className="gap-1">
                      <Sparkles className="h-3 w-3" />
                      {aiReady ? "AI ready" : "AI blocked"}
                    </Badge>
                  ) : null}
                </div>
                <Separator />
                <div className="space-y-2.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Features</p>
                  <FeatureRow ok={true} label="Multi-platform posting & scheduling" />
                  <FeatureRow ok={true} label="Telegram bot (connect, /fb, /post, …)" />
                  <FeatureRow ok={dashboardAiEnabled} label="Dashboard AI drafts (Create Post)" />
                  <FeatureRow ok={telegramAiEnabled} label="Telegram /ai command" />
                </div>
                {!isAdvance && (
                  <Alert className="rounded-xl border border-amber-200/80 bg-amber-50/90 text-amber-950">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-sm">Advance plan</AlertTitle>
                    <AlertDescription className="text-xs leading-relaxed">
                      AI tools require an <strong>Advance</strong> subscription. You can still save an OpenRouter key in
                      the panel on the right so AI works immediately after an administrator upgrades your package.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card className={appCard}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-zinc-900">OpenRouter</CardTitle>
                <CardDescription className="text-xs">Bring your own key — you pay usage at OpenRouter.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 pt-0">
                <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                  <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">
                    API keys
                    <ExternalLink className="ml-1.5 h-3 w-3" />
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                  <a href="https://openrouter.ai/docs" target="_blank" rel="noreferrer">
                    Docs
                    <ExternalLink className="ml-1.5 h-3 w-3" />
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                  <a href="https://openrouter.ai/activity" target="_blank" rel="noreferrer">
                    Activity
                    <ExternalLink className="ml-1.5 h-3 w-3" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Main OpenRouter panel */}
          <div className="lg:col-span-8">
            <Card className="border-border/80 shadow-md overflow-hidden">
              <CardHeader className="border-b bg-muted/30 pb-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background border">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <CardTitle className="text-lg">OpenRouter API key</CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      Used for <strong>dashboard AI</strong> and <strong>Telegram /ai</strong> when your plan includes
                      AI. Keys are stored on the server; this page never shows the full secret after save.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                {isLoading || !status ? (
                  <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading status…
                  </div>
                ) : (
                  <>
                    {status.hasUserKey ? (
                      <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/80 px-4 py-3">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Saved key
                            </p>
                            <p className="font-mono text-sm break-all">{status.maskedKey}</p>
                          </div>
                          <Badge variant="secondary" className="w-fit shrink-0">
                            Yours
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <Alert variant="destructive">
                        <AlertTitle>No OpenRouter key</AlertTitle>
                        <AlertDescription className="text-sm">
                          On an <strong>Advance</strong> plan, add your own key below.
                          Without a key, AI in the app and <code className="rounded bg-background px-1 text-xs">/ai</code>{" "}
                          will not run.
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="openrouter-key" className="text-sm">
                        {status.hasUserKey ? "Replace API key" : "API key"}
                      </Label>
                      <Input
                        id="openrouter-key"
                        type="password"
                        autoComplete="off"
                        placeholder="sk-or-v1-…"
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        className="h-10 font-mono text-sm"
                      />
                      {!isAdvance && (
                        <p className="text-xs text-muted-foreground">
                          On Basic, saving a key stores it for later; AI stays off until your plan is Advance.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        onClick={() => saveMutation.mutate(apiKeyInput)}
                        disabled={saveMutation.isPending || apiKeyInput.trim().length < 16}
                      >
                        {saveMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving…
                          </>
                        ) : (
                          "Save key"
                        )}
                      </Button>
                      {status.hasUserKey && (
                        <Button
                          variant="outline"
                          onClick={() => clearMutation.mutate()}
                          disabled={clearMutation.isPending}
                        >
                          {clearMutation.isPending ? "Removing…" : "Remove my key"}
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
              <CardFooter className="flex flex-col items-start gap-2 border-t border-zinc-200/80 bg-zinc-50/80 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground flex items-start gap-2 max-w-prose">
                  <BookOpen className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  Referer headers for OpenRouter use your site URL from server config (<code className="text-[11px]">CLIENT_URL</code> /{" "}
                  <code className="text-[11px]">BASE_URL</code>).
                </p>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { appPageCanvas } from "@/lib/app-surface";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

// Create a simpler schema for login (only username and password)
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});
import { CheckCircle2, Loader2, ShieldCheck, Sparkles } from "lucide-react";


const TELEGRAM_BIND_STORAGE = "telegram_bind_token_pending";
const WHATSAPP_BIND_STORAGE = "whatsapp_bind_token_pending";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: publicConfig } = useQuery({
    queryKey: ["public-config"],
    queryFn: async () => {
      const res = await fetch("/api/public-config");
      if (!res.ok) return { publicRegistrationEnabled: false };
      return (await res.json()) as { publicRegistrationEnabled: boolean };
    },
    staleTime: 60_000,
  });
  const allowRegister = publicConfig?.publicRegistrationEnabled === true;

  // Safely get auth context - useAuth now handles missing provider gracefully
  const auth = useAuth();
  const { user, loginMutation, registerMutation } = auth;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("telegram_bind");
    if (t) {
      sessionStorage.setItem(TELEGRAM_BIND_STORAGE, t);
      params.delete("telegram_bind");
    }
    const w = params.get("whatsapp_bind");
    if (w) {
      sessionStorage.setItem(WHATSAPP_BIND_STORAGE, w);
      params.delete("whatsapp_bind");
    }
    const next = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
  }, []);

  // After login/register: attach Telegram if pending, then go to dashboard
  useEffect(() => {
    if (!user) return;
    const telegramToken = typeof window !== "undefined" ? sessionStorage.getItem(TELEGRAM_BIND_STORAGE) : null;
    const whatsAppToken = typeof window !== "undefined" ? sessionStorage.getItem(WHATSAPP_BIND_STORAGE) : null;
    if (telegramToken || whatsAppToken) {
      (async () => {
        try {
          if (telegramToken) {
            await apiRequest("POST", "/api/telegram/attach", { token: telegramToken });
            sessionStorage.removeItem(TELEGRAM_BIND_STORAGE);
          }
          if (whatsAppToken) {
            await apiRequest("POST", "/api/whatsapp/attach", { token: whatsAppToken });
            sessionStorage.removeItem(WHATSAPP_BIND_STORAGE);
          }
          await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
          toast({
            title: "Chat linked",
            description: "Your Telegram/WhatsApp identity is now linked.",
          });
        } catch (e) {
          toast({
            title: "Chat link failed",
            description: e instanceof Error ? e.message : "Unknown error",
            variant: "destructive",
          });
        } finally {
          setLocation("/app");
        }
      })();
      return;
    }
    setLocation("/app");
  }, [user, setLocation, toast]);

  // Show loading state if auth is still initializing
  if (auth.isLoading) {
    return (
      <div className={cn(appPageCanvas, "flex min-h-screen items-center justify-center")}>
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Don't render if already logged in (redirect is handled by useEffect)
  if (user) {
    return null;
  }

  return (
    <div className={cn(appPageCanvas, "min-h-screen bg-gradient-to-b from-sky-50 via-white to-indigo-50")}>
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 to-sky-500 text-sm font-bold text-white shadow-md">
              SM
            </div>
            <span className="font-semibold tracking-tight text-slate-800">
              Social{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-sky-600 bg-clip-text text-transparent">
                Media Manager
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Home
            </Link>
            <Link href="/request-access" className="text-sm text-slate-600 hover:text-indigo-600">
              Request access
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto grid min-h-screen w-full max-w-7xl items-center gap-8 px-4 py-8 md:px-6 lg:grid-cols-2">
        <div className="hidden rounded-2xl border border-indigo-100 bg-white/90 p-8 shadow-xl shadow-indigo-100/60 lg:block">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700">
            <Sparkles className="h-3.5 w-3.5" />
            Secure team access
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
            Social <span className="text-indigo-600">Media Manager</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Sign in to manage publishing workflows, team permissions, billing, and AI integrations from one place.
          </p>
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Approval-first onboarding for managed teams
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Stripe-backed billing and trial management
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <ShieldCheck className="h-4 w-4 text-indigo-600" />
              BYOK AI policy with role-based controls
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <Card className="w-full max-w-md border-zinc-200/90 shadow-lg shadow-zinc-200/70">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl font-bold tracking-tight text-zinc-900">
                Welcome back
              </CardTitle>
              <p className="text-sm text-zinc-600">
                Sign in to continue to your workspace.
              </p>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login" className="space-y-4">
                <TabsList className={`grid w-full ${allowRegister ? "grid-cols-2" : "grid-cols-1"}`}>
                  <TabsTrigger value="login">Login</TabsTrigger>
                  {allowRegister ? <TabsTrigger value="register">Register</TabsTrigger> : null}
                </TabsList>

                <TabsContent value="login" className="space-y-3">
                  <LoginForm />
                  {!allowRegister && (
                    <p className="text-sm text-muted-foreground">
                      Accounts are created after purchase or admin approval.{" "}
                      <Link href="/request-access" className="text-primary underline-offset-4 hover:underline">
                        Request access
                      </Link>
                      .
                    </p>
                  )}
                </TabsContent>

                {allowRegister ? (
                  <TabsContent value="register" className="space-y-3">
                    <RegisterForm />
                  </TabsContent>
                ) : null}
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const { loginMutation } = useAuth();
  const [, setLocation] = useLocation();
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const handleSubmit = async (data: z.infer<typeof loginSchema>) => {
    try {
      await loginMutation.mutateAsync(data);
      // Redirect to dashboard on successful login
      setLocation("/app");
    } catch (error) {
      // Error is already handled by the mutation's onError
      console.error("Login error:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="mt-1 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input 
          id="username" 
          {...form.register("username")} 
          autoComplete="username"
          disabled={loginMutation.isPending}
        />
        {form.formState.errors.username && (
          <p className="text-sm text-destructive">{form.formState.errors.username.message}</p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input 
          type="password" 
          id="password" 
          {...form.register("password")} 
          autoComplete="current-password"
          disabled={loginMutation.isPending}
        />
        {form.formState.errors.password && (
          <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
        {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {loginMutation.isPending ? "Logging in..." : "Log in"}
      </Button>
    </form>
  );
}

function RegisterForm() {
  const { registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  const form = useForm<z.infer<typeof insertUserSchema>>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
      email: ""
    }
  });

  const handleSubmit = async (data: z.infer<typeof insertUserSchema>) => {
    try {
      await registerMutation.mutateAsync(data);
      // Redirect to dashboard on successful registration
      setLocation("/app");
    } catch (error) {
      // Error is already handled by the mutation's onError
      console.error("Registration error:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="mt-1 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reg-username">Username</Label>
        <Input 
          id="reg-username" 
          {...form.register("username")} 
          autoComplete="username"
          disabled={registerMutation.isPending}
        />
        {form.formState.errors.username && (
          <p className="text-sm text-destructive">{form.formState.errors.username.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reg-email">Email</Label>
        <Input 
          id="reg-email" 
          type="email"
          {...form.register("email")} 
          autoComplete="email"
          disabled={registerMutation.isPending}
        />
        {form.formState.errors.email && (
          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="reg-password">Password</Label>
        <Input 
          type="password" 
          id="reg-password" 
          {...form.register("password")} 
          autoComplete="new-password"
          disabled={registerMutation.isPending}
        />
        {form.formState.errors.password && (
          <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
        {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {registerMutation.isPending ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}

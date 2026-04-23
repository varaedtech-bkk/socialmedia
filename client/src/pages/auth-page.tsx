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

// Create a simpler schema for login (only username and password)
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});
import { Loader2 } from "lucide-react";
import AnalogClock from "@/components/ui/analog-clock";


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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Don't render if already logged in (redirect is handled by useEffect)
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center p-8">
      
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              <span>MultiSocial Studio</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className={`grid w-full ${allowRegister ? "grid-cols-2" : "grid-cols-1"}`}>
                <TabsTrigger value="login">Login</TabsTrigger>
                {allowRegister ? <TabsTrigger value="register">Register</TabsTrigger> : null}
              </TabsList>

              <TabsContent value="login">
                <LoginForm />
                {!allowRegister && (
                  <p className="text-sm text-muted-foreground mt-4">
                    Accounts are created by your organization after purchase or approval.{" "}
                    <Link href="/request-access" className="text-primary underline-offset-4 hover:underline">
                      Request access
                    </Link>
                    .
                  </p>
                )}
              </TabsContent>

              {allowRegister ? (
                <TabsContent value="register">
                  <RegisterForm />
                </TabsContent>
              ) : null}
            </Tabs>
          </CardContent>
        </Card>
      </div>
     
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary/10 to-purple-600/10 items-center justify-center p-8">
     
        <div className="max-w-md space-y-4 text-center">
        <div> <span><AnalogClock/></span></div>
          <h1 className="text-4xl font-bold">Manage Your Social Media Presence</h1>
          <p className="text-muted-foreground">
            Schedule posts, track engagement, and grow your audience across multiple platforms.
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const { loginMutation } = useAuth();
  const [, setLocation] = useLocation();
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const handleSubmit = async (data: { username: string; password: string }) => {
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
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-4">
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
        {loginMutation.isPending ? "Logging in..." : "Login"}
      </Button>
    </form>
  );
}

function RegisterForm() {
  const { registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  const form = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
      email: ""
    }
  });

  const handleSubmit = async (data: { username: string; password: string; email: string }) => {
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
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-4">
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
        {registerMutation.isPending ? "Registering..." : "Register"}
      </Button>
    </form>
  );
}

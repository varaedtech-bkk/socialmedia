import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
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


export default function AuthPage() {
  const [, setLocation] = useLocation();
  
  // Safely get auth context - useAuth now handles missing provider gracefully
  const auth = useAuth();
  const { user, loginMutation, registerMutation } = auth;

  // Redirect if already logged in → dashboard, not landing
  useEffect(() => {
    if (user) {
      setLocation("/app");
    }
  }, [user, setLocation]);

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
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <LoginForm />
              </TabsContent>

              <TabsContent value="register">
                <RegisterForm />
              </TabsContent>
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
      username: "superuser",
      password: "superpass123"
    }
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

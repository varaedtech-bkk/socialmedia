import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
};

type LoginData = Pick<InsertUser, "username" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      const userData = await res.json();
      // Remove password from user data
      const { password: _, ...userWithoutPassword } = userData;
      return userWithoutPassword as SelectUser;
    },
    onSuccess: (user: SelectUser) => {
      // Update query cache and invalidate to refetch
      queryClient.setQueryData(["/api/user"], user);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      const userData = await res.json();
      // Remove password from user data
      const { password: _, ...userWithoutPassword } = userData;
      return userWithoutPassword as SelectUser;
    },
    onSuccess: (user: SelectUser) => {
      // Update query cache and invalidate to refetch
      queryClient.setQueryData(["/api/user"], user);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    // During hot reload or initial render, AuthProvider might not be ready yet
    // Return a safe fallback that won't crash the app
    const safeFallback: AuthContextType = {
      user: null,
      isLoading: true,
      error: null,
      loginMutation: {
        mutate: () => {},
        mutateAsync: async () => {
          throw new Error("AuthProvider not ready");
        },
        isPending: false,
        isError: false,
        isSuccess: false,
        error: null,
        data: undefined,
        reset: () => {},
      } as any,
      logoutMutation: {
        mutate: () => {},
        mutateAsync: async () => {},
        isPending: false,
        isError: false,
        isSuccess: false,
        error: null,
        data: undefined,
        reset: () => {},
      } as any,
      registerMutation: {
        mutate: () => {},
        mutateAsync: async () => {
          throw new Error("AuthProvider not ready");
        },
        isPending: false,
        isError: false,
        isSuccess: false,
        error: null,
        data: undefined,
        reset: () => {},
      } as any,
    };
    
    // Only warn in development, and only once per session
    if (typeof window !== "undefined" && !(window as any).__authWarningShown) {
      console.warn("useAuth called outside AuthProvider - using fallback (this may happen during hot reload)");
      (window as any).__authWarningShown = true;
    }
    
    return safeFallback;
  }
  return context;
}

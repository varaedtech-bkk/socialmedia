import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Settings,
  Shield,
  Loader2,
  Users,
  BarChart3,
  UserCheck,
  Mail,
  Zap,
  Building2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { AdminAccessRequestsTab } from "@/components/admin-access-requests-tab";
import { AdminNotificationSettingsTab } from "@/components/admin-notification-settings";
import { AdminFeatureFlagsTab } from "@/components/admin-feature-flags-tab";
import { AdminStatisticsTab } from "@/components/admin-statistics-tab";
import { AdminUserManagementTab } from "@/components/admin-user-management-tab";
import { AdminCompanyMembersTab } from "@/components/admin-company-members-tab";
import { AdminSuperCompanyDirectoryTab } from "@/components/admin-super-company-directory-tab";
import {
  canAccessAdminPanel,
  formatRoleLabel,
  normalizeAdminRole,
  adminPermissionsInclude,
  type AdminRole,
} from "@/lib/admin-access";
import { Badge } from "@/components/ui/badge";
import { appCard, appPageCanvas, appPageEyebrow, appPageLead, appPageTitle, appSectionStack } from "@/lib/app-surface";
import { AppLayout } from "@/components/app-layout";
import { cn } from "@/lib/utils";

type AdminConfig = {
  roles: Record<string, unknown>;
  availableFeatures: Array<{ id: string; label: string; description: string; path: string }>;
  userPermissions: string[];
  userRole: string;
  assignableRoles?: AdminRole[];
};

function ForbiddenAdmin() {
  return (
    <div className={cn(appPageCanvas, "flex items-center justify-center p-6")}>
      <Card className={cn(appCard, "w-full max-w-md shadow-lg")}>
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <Shield className="h-5 w-5" />
            <CardTitle className="text-lg font-semibold text-zinc-900">Admin area</CardTitle>
          </div>
          <CardDescription className="text-zinc-600">
            This workspace is restricted to <strong>super admins or company owners</strong>. Your account is a
            standard member login.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            If you need access to user management or billing controls, ask your company owner or a super admin.
          </p>
          <Button asChild className="w-full">
            <Link href="/app">Return to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState("statistics");

  const sessionRole = normalizeAdminRole(user?.role);
  const companyRole = (user as any)?.companyMembership?.role as string | undefined;
  const isPlatformSuperAdmin = sessionRole === "super_admin";
  const isCompanyAdmin = companyRole === "owner";

  const {
    data: config,
    isLoading: configLoading,
    isError: configError,
    error: configErr,
  } = useQuery<AdminConfig>({
    queryKey: ["admin", "config", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/config");
      return res.json();
    },
    enabled: Boolean(user?.id) && isPlatformSuperAdmin,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (configError && user?.id) {
      toast({
        title: "Could not load admin configuration",
        description: (configErr as Error).message,
        variant: "destructive",
      });
    }
  }, [configError, configErr, toast, user?.id]);

  const perms = config?.userPermissions ?? [];
  const assignableRoles: AdminRole[] = useMemo(() => {
    const raw = config?.assignableRoles;
    if (Array.isArray(raw) && raw.length) {
      return raw.map((r) => normalizeAdminRole(String(r)));
    }
    return sessionRole === "super_admin"
      ? ["client", "super_admin"]
      : ["client"];
  }, [config?.assignableRoles, sessionRole]);

  const visibleTabs = useMemo(() => {
    if (isCompanyAdmin && !isPlatformSuperAdmin) return ["company"];
    const t: string[] = [];
    if (adminPermissionsInclude(perms, "analytics.view")) t.push("statistics");
    if (adminPermissionsInclude(perms, "users.view")) {
      t.push("users");
      t.push("company");
      t.push("access");
    }
    if (adminPermissionsInclude(perms, "settings.view")) t.push("settings");
    if (adminPermissionsInclude(perms, "features.manage")) t.push("features");
    return t;
  }, [isCompanyAdmin, isPlatformSuperAdmin, perms]);

  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.includes(tab)) {
      setTab(visibleTabs[0]);
    }
  }, [visibleTabs, tab]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canAccessAdminPanel(user.role, companyRole)) {
    return <ForbiddenAdmin />;
  }

  const canCreateUsers = adminPermissionsInclude(perms, "users.create");
  const storedPackageTier = user.packageTier || "basic";
  const effectivePackageTier = user.capabilities?.packageTier ?? storedPackageTier;
  const packageTierNote =
    storedPackageTier !== effectivePackageTier
      ? `Database record is ${storedPackageTier}; your role uses ${effectivePackageTier} product access.`
      : null;

  const showStats = visibleTabs.includes("statistics");
  const showUsers = visibleTabs.includes("users");
  const showAccess = visibleTabs.includes("access");
  const showCompany = visibleTabs.includes("company");
  const showSettings = visibleTabs.includes("settings");
  const showFeatures = visibleTabs.includes("features");

  return (
    <AppLayout shellWidth="admin" topBarTitle="Administration" topBarIcon={Settings}>
      <div className={appSectionStack}>
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 max-w-2xl">
              <p className={appPageEyebrow}>Workspace controls</p>
              <h1 className={cn("mt-1.5", appPageTitle, "text-xl sm:text-2xl")}>
                {isPlatformSuperAdmin ? "Platform administration" : "Company administration"}
              </h1>
              <p className={cn("mt-2", appPageLead)}>
                {isPlatformSuperAdmin
                  ? "Users, access, notifications, and platform flags - aligned with Basic / Advance and Stripe billing."
                  : "Manage your company members, AI controls, and platform restrictions for your workspace."}
              </p>
            </div>
            <Card className={cn(appCard, "w-full shrink-0 border-zinc-200/90 lg:w-auto lg:min-w-[19rem] lg:max-w-sm")}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your session</span>
                  <Badge variant="secondary">{formatRoleLabel(sessionRole)}</Badge>
                </div>
                <p className="text-sm font-medium truncate" title={user.username}>
                  {user.username}
                </p>
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Effective workspace</span>
                    <Badge variant={effectivePackageTier === "advance" ? "default" : "secondary"} className="capitalize">
                      {effectivePackageTier}
                    </Badge>
                    {user.capabilities?.aiGeneration && (
                      <Badge variant="outline" className="text-[10px]">
                        AI on
                      </Badge>
                    )}
                  </div>
                  {packageTierNote && (
                    <p className="text-[11px] leading-snug text-muted-foreground">{packageTierNote}</p>
                  )}
                </div>
                {configLoading && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading permissions…
                  </p>
                )}
                {config && !configLoading && (
                  <p className="text-xs text-muted-foreground">
                    {perms.length} {perms.length === 1 ? "capability" : "capabilities"} loaded for this panel.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

      <div>
        {visibleTabs.length === 0 && !configLoading && (
          <Alert className="mb-6">
            <AlertTitle>No admin sections available</AlertTitle>
            <AlertDescription>
              Your role does not include any of the admin permissions. Contact a super admin.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList
            className={cn(
              "grid h-auto w-full gap-1 rounded-xl border border-zinc-200/80 bg-zinc-100/70 p-1.5",
              [showStats, showUsers, showCompany, showAccess, showSettings, showFeatures].filter(Boolean).length <= 2
                ? "grid-cols-2 sm:max-w-lg"
                : [showStats, showUsers, showCompany, showAccess, showSettings, showFeatures].filter(Boolean).length === 3
                  ? "grid-cols-3 sm:max-w-2xl"
                  : "grid-cols-2 sm:grid-cols-3 lg:max-w-5xl lg:grid-cols-6",
            )}
          >
            {showStats && (
              <TabsTrigger
                value="statistics"
                className="gap-1.5 rounded-lg py-2.5 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:font-medium data-[state=active]:text-zinc-900 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-zinc-200/80"
              >
                <BarChart3 className="h-4 w-4 shrink-0" />
                <span>Overview</span>
              </TabsTrigger>
            )}
            {showUsers && (
              <TabsTrigger
                value="users"
                className="gap-1.5 rounded-lg py-2.5 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:font-medium data-[state=active]:text-zinc-900 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-zinc-200/80"
              >
                <Users className="h-4 w-4 shrink-0" />
                Users
              </TabsTrigger>
            )}
            {showCompany && (
              <TabsTrigger
                value="company"
                className="gap-1.5 rounded-lg py-2.5 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:font-medium data-[state=active]:text-zinc-900 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-zinc-200/80"
              >
                <Building2 className="h-4 w-4 shrink-0" />
                Company
              </TabsTrigger>
            )}
            {showAccess && (
              <TabsTrigger
                value="access"
                className="gap-1.5 rounded-lg py-2.5 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:font-medium data-[state=active]:text-zinc-900 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-zinc-200/80"
              >
                <UserCheck className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Access</span>
                <span className="sm:hidden">Access</span>
              </TabsTrigger>
            )}
            {showSettings && (
              <TabsTrigger
                value="settings"
                className="gap-1.5 rounded-lg py-2.5 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:font-medium data-[state=active]:text-zinc-900 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-zinc-200/80"
              >
                <Mail className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Email</span>
                <span className="sm:hidden">Mail</span>
              </TabsTrigger>
            )}
            {showFeatures && (
              <TabsTrigger
                value="features"
                className="gap-1.5 rounded-lg py-2.5 text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:font-medium data-[state=active]:text-zinc-900 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-zinc-200/80"
              >
                <Zap className="h-4 w-4 shrink-0" />
                Flags
              </TabsTrigger>
            )}
          </TabsList>

          {showStats && (
            <TabsContent value="statistics" className="mt-2 focus-visible:outline-none">
              <AdminStatisticsTab viewerId={user.id} />
            </TabsContent>
          )}

          {showUsers && (
            <TabsContent value="users" className="mt-2 focus-visible:outline-none">
              <AdminUserManagementTab
                viewerId={user.id}
                assignableRoles={assignableRoles}
                canCreateUsers={canCreateUsers}
              />
            </TabsContent>
          )}

          {showCompany && (
            <TabsContent value="company" className="mt-2 focus-visible:outline-none">
              {isPlatformSuperAdmin ? <AdminSuperCompanyDirectoryTab /> : <AdminCompanyMembersTab />}
            </TabsContent>
          )}

          {showAccess && (
            <TabsContent value="access" className="mt-2 focus-visible:outline-none">
              <AdminAccessRequestsTab canApprove={canCreateUsers} />
            </TabsContent>
          )}

          {showSettings && (
            <TabsContent value="settings" className="mt-2 focus-visible:outline-none">
              <AdminNotificationSettingsTab />
            </TabsContent>
          )}

          {showFeatures && (
            <TabsContent value="features" className="mt-2 focus-visible:outline-none">
              <AdminFeatureFlagsTab viewerId={user.id} />
            </TabsContent>
          )}
        </Tabs>
      </div>
      </div>
    </AppLayout>
  );
}

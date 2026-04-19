import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { Calendar, CreditCard, FileText, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { normalizeAdminRole, formatRoleLabel } from "@/lib/admin-access";
import { appCard } from "@/lib/app-surface";
import { cn } from "@/lib/utils";

type Statistics = {
  users: {
    total: number;
    active: number;
    roles: Array<{ role: string; count: number }>;
    packageTiers?: Array<{ packageTier: string; count: number }>;
  };
  posts: {
    total: number;
    published: number;
    scheduled: number;
  };
  subscriptions: {
    total: number;
    active: number;
  };
};

const ROLE_COLORS: Record<string, string> = {
  user: "#3b82f6",
  admin: "#8b5cf6",
  super_admin: "#ef4444",
};

const TIER_COLORS: Record<string, string> = {
  basic: "#64748b",
  advance: "#0d9488",
};

export function AdminStatisticsTab({ viewerId }: { viewerId: number | undefined }) {
  const { data, isLoading, error } = useQuery<Statistics>({
    queryKey: ["admin", "statistics", viewerId],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/statistics");
      return res.json();
    },
    enabled: Boolean(viewerId),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className={cn(appCard, "border-destructive/40")}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-zinc-900">Could not load statistics</CardTitle>
          <CardDescription>{(error as Error).message}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const roleChartData =
    data?.users.roles.map((row) => {
      const key = normalizeAdminRole(row.role);
      return {
        name: formatRoleLabel(key),
        value: row.count,
        fill: ROLE_COLORS[key] || "#94a3b8",
      };
    }) || [];

  const tierChartData =
    data?.users.packageTiers?.map((row) => ({
      name: (row.packageTier || "basic").replace(/\b\w/g, (c) => c.toUpperCase()),
      value: row.count,
      fill: TIER_COLORS[row.packageTier] || "#94a3b8",
    })) || [];

  const postsData = [
    { name: "Published", value: data?.posts.published || 0, fill: "#10b981" },
    { name: "Scheduled", value: data?.posts.scheduled || 0, fill: "#3b82f6" },
    {
      name: "Other",
      value: Math.max(
        0,
        (data?.posts.total || 0) - (data?.posts.published || 0) - (data?.posts.scheduled || 0),
      ),
      fill: "#94a3b8",
    },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/80 shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{data?.users.total ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">{data?.users.active ?? 0}</span>{" "}
              active
            </p>
          </CardContent>
        </Card>

        <Card className={cn(appCard, "border-l-4 border-l-emerald-500")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Posts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{data?.posts.total ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {data?.posts.published ?? 0}
              </span>{" "}
              published
            </p>
          </CardContent>
        </Card>

        <Card className={cn(appCard, "border-l-4 border-l-violet-500")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Legacy subscriptions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{data?.subscriptions.total ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {data?.subscriptions.active ?? 0}
              </span>{" "}
              active rows
            </p>
          </CardContent>
        </Card>

        <Card className={cn(appCard, "border-l-4 border-l-amber-500")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{data?.posts.scheduled ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting publish</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={appCard}>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-zinc-900">Access roles</CardTitle>
            <CardDescription>Admin vs member accounts (platform access)</CardDescription>
          </CardHeader>
          <CardContent>
            {roleChartData.length > 0 ? (
              <ChartContainer config={{}} className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={roleChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={88}
                      dataKey="value"
                    >
                      {roleChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                No users yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={appCard}>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-zinc-900">Workspace packages</CardTitle>
            <CardDescription>Basic vs Advance (AI entitlement tier)</CardDescription>
          </CardHeader>
          <CardContent>
            {tierChartData.length > 0 ? (
              <ChartContainer config={{}} className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tierChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={88}
                      dataKey="value"
                    >
                      {tierChartData.map((entry, index) => (
                        <Cell key={`tier-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                No package data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={appCard}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-zinc-900">Post pipeline</CardTitle>
          <CardDescription>Published vs scheduled vs other</CardDescription>
        </CardHeader>
        <CardContent>
          {postsData.length > 0 ? (
            <ChartContainer
              config={{
                published: { label: "Published", color: "#10b981" },
                scheduled: { label: "Scheduled", color: "#3b82f6" },
              }}
              className="h-[260px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={postsData}>
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {postsData.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
              No posts yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

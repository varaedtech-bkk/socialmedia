import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Post } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Bar,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { BarChart2, Calendar, Heart, LayoutList, MessageCircle } from "lucide-react";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { appCard } from "@/lib/app-surface";
import { AppLayout } from "@/components/app-layout";

const CHART_COLORS = {
  likes: "hsl(var(--primary))",
  comments: "hsl(262 83% 58%)",
  shares: "hsl(199 89% 48%)",
};

const STATUS_COLORS: Record<string, string> = {
  published: "#10b981",
  scheduled: "#3b82f6",
  draft: "#94a3b8",
  failed: "#f43f5e",
};

function analyticsTotals(posts: Post[]) {
  let likes = 0;
  let comments = 0;
  let shares = 0;
  for (const p of posts) {
    if (p.status !== "published") continue;
    const a = p.analytics as Record<string, number> | null | undefined;
    likes += a?.likes ?? 0;
    comments += a?.comments ?? 0;
    shares += a?.shares ?? 0;
  }
  return { likes, comments, shares, total: likes + comments + shares };
}

export default function Analytics() {
  const { data: posts = [], isLoading, isError, error } = useQuery<Post[]>({
    queryKey: ["posts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/posts");
      return res.json();
    },
  });

  const publishedPosts = useMemo(() => posts.filter((p) => p.status === "published"), [posts]);
  const scheduledCount = useMemo(() => posts.filter((p) => p.status === "scheduled").length, [posts]);
  const draftCount = useMemo(() => posts.filter((p) => p.status === "draft").length, [posts]);
  const failedCount = useMemo(() => posts.filter((p) => p.status === "failed").length, [posts]);

  const engagementRows = useMemo(() => {
    return publishedPosts.slice(0, 12).map((post, i) => {
      const a = (post.analytics || {}) as Record<string, number>;
      return {
        id: post.id,
        label: `Post ${i + 1}`,
        likes: a.likes ?? 0,
        comments: a.comments ?? 0,
        shares: a.shares ?? 0,
      };
    });
  }, [publishedPosts]);

  const statusPie = useMemo(
    () =>
      [
        { name: "Published", value: publishedPosts.length, fill: STATUS_COLORS.published },
        { name: "Scheduled", value: scheduledCount, fill: STATUS_COLORS.scheduled },
        { name: "Draft", value: draftCount, fill: STATUS_COLORS.draft },
        { name: "Failed", value: failedCount, fill: STATUS_COLORS.failed },
      ].filter((d) => d.value > 0),
    [publishedPosts.length, scheduledCount, draftCount, failedCount],
  );

  const totals = useMemo(() => analyticsTotals(posts), [posts]);

  return (
    <AppLayout shellWidth="wide" topBarTitle="Analytics" topBarIcon={BarChart2}>
      <div className="space-y-8">
        <div className="max-w-3xl space-y-2 pt-2 md:pt-0">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BarChart2 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Analytics</h1>
                <p className="mt-0.5 text-sm leading-relaxed text-zinc-600">
                  Published post counts and engagement signals stored with each post.
                </p>
              </div>
            </div>
        </div>

        {isError && (
            <Card className={cn(appCard, "border-destructive/40")}>
              <CardHeader>
                <CardTitle className="text-base">Could not load posts</CardTitle>
                <CardDescription>{(error as Error).message}</CardDescription>
              </CardHeader>
            </Card>
          )}

          {!isError && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className={appCard}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Published</CardTitle>
                    <LayoutList className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <Skeleton className="h-9 w-16 rounded-md" />
                    ) : (
                      <p className="text-3xl font-bold tabular-nums">{publishedPosts.length}</p>
                    )}
                  </CardContent>
                </Card>
                <Card className={appCard}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Scheduled</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <Skeleton className="h-9 w-16 rounded-md" />
                    ) : (
                      <p className="text-3xl font-bold tabular-nums">{scheduledCount}</p>
                    )}
                  </CardContent>
                </Card>
                <Card className={cn(appCard, "sm:col-span-2 lg:col-span-2")}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Engagement total</CardTitle>
                    <Heart className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {isLoading ? (
                      <Skeleton className="h-9 w-24 rounded-md" />
                    ) : (
                      <>
                        <p className="text-3xl font-bold tabular-nums">{totals.total}</p>
                        <p className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                          <span className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-primary" />
                            Likes {totals.likes}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-[hsl(262_83%_58%)]" />
                            Comments {totals.comments}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-[hsl(199_89%_48%)]" />
                            Shares {totals.shares}
                          </span>
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-12 items-start">
                <Card className={cn(appCard, "lg:col-span-5")}>
                  <CardHeader>
                    <CardTitle className="text-lg">Post pipeline</CardTitle>
                    <CardDescription>How many posts are in each stage</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <Skeleton className="h-[240px] w-full rounded-lg" />
                    ) : statusPie.length === 0 ? (
                      <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                        No posts yet
                      </div>
                    ) : (
                      <ChartContainer config={{}} className="h-[260px] w-full mx-auto max-w-sm">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={statusPie}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={52}
                              outerRadius={88}
                              paddingAngle={2}
                            >
                              {statusPie.map((entry, i) => (
                                <Cell key={i} fill={entry.fill} />
                              ))}
                            </Pie>
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Legend verticalAlign="bottom" height={28} />
                          </PieChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    )}
                  </CardContent>
                </Card>

                <Card className={cn(appCard, "lg:col-span-7")}>
                  <CardHeader>
                    <CardTitle className="text-lg">Engagement by post</CardTitle>
                    <CardDescription>
                      Stacked likes, comments, and shares for up to 12 recent published posts (when analytics exist).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-2 sm:px-6">
                    {isLoading ? (
                      <Skeleton className="h-[320px] w-full rounded-lg" />
                    ) : engagementRows.length === 0 ? (
                      <EmptyState
                        title="No published posts"
                        description="Publish a post to see engagement breakdown here."
                        icon={BarChart2}
                      />
                    ) : (
                      <ChartContainer
                        config={{
                          likes: { label: "Likes", color: CHART_COLORS.likes },
                          comments: { label: "Comments", color: CHART_COLORS.comments },
                          shares: { label: "Shares", color: CHART_COLORS.shares },
                        }}
                        className="h-[min(360px,55vh)] w-full"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={engagementRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} tickLine={false} axisLine={false} />
                            <YAxis width={36} tick={{ fontSize: 11 }} allowDecimals={false} tickLine={false} axisLine={false} />
                            <Tooltip
                              contentStyle={{
                                borderRadius: "8px",
                                border: "1px solid hsl(var(--border))",
                                background: "hsl(var(--card))",
                              }}
                            />
                            <Bar dataKey="likes" stackId="e" fill={CHART_COLORS.likes} name="Likes" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="comments" stackId="e" fill={CHART_COLORS.comments} name="Comments" />
                            <Bar
                              dataKey="shares"
                              stackId="e"
                              fill={CHART_COLORS.shares}
                              name="Shares"
                              radius={[6, 6, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className={cn(appCard, "rounded-xl border-indigo-100/80 bg-indigo-50/50")}>
                <CardContent className="py-4 px-5 sm:px-6 flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-muted-foreground">
                  <MessageCircle className="h-4 w-4 shrink-0 text-primary hidden sm:block" />
                  <p className="leading-relaxed">
                    Numbers come from <strong className="text-foreground">post analytics</strong> saved when platforms
                    report metrics. Connect accounts under Dashboard if totals look empty.
                  </p>
                </CardContent>
              </Card>
            </>
          )}
      </div>
    </AppLayout>
  );
}

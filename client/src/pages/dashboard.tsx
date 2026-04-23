import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Post } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import PostEditor from "@/components/post-editor";
import ScheduleCalendar from "@/components/schedule-calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, BarChart2, Trash } from "lucide-react";
import { Link } from "wouter";
import SocialConnect from "@/components/social-connect";
import ConnectedAccounts from "@/components/connected-accounts";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { SubscriptionStatus } from "@/components/subscription-status";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { appCard } from "@/lib/app-surface";
import { AppLayout } from "@/components/app-layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Subscription = {
  plan: string;
  status: 'active' | 'canceled' | 'past_due';
  current_period_end: number;
  posts_used: number;
  posts_limit: number | typeof Infinity;
  featureDisabled?: boolean;
  /** Stored workspace package (Basic vs Advance); aligns with AI entitlements after Stripe upgrade. */
  packageTier?: string;
  advanceCheckoutAvailable?: boolean;
  trialEligible?: boolean;
  trialEndsAt?: string | null;
  trialExpired?: boolean;
  paymentRequired?: boolean;
};

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch subscription for upgrade button visibility
  const { data: subscription } = useQuery<Subscription>({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/subscription");
      return res.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    enabled: !!user?.id, // Only fetch if user is logged in
  });

  // Posts query: no background polling; refetch when window refocuses (if stale) or after mutations
  const {
    data: posts = [],
    isLoading,
    isError,
    error,
    isRefetching,
  } = useQuery<Post[], Error>({
    queryKey: ["posts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/posts");
      if (!res.ok) throw new Error("Failed to fetch posts");
      return res.json();
    },
    staleTime: 1000 * 60 * 2, // 2 minutes – no refetch unless stale or invalidated
    refetchOnWindowFocus: true, // refetch when user returns to tab (only if stale)
    retry: 2,
  });

  // Delete post mutation with optimistic updates
  const deletePost = useMutation({
    mutationFn: async (postId: number) => {
      const res = await apiRequest("DELETE", `/api/posts/${postId}`);
      return res.json();
    },
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ["posts"] });
      const previousPosts = queryClient.getQueryData<Post[]>(["posts"]);
      
      queryClient.setQueryData<Post[]>(["posts"], (old) =>
        old?.filter((post) => post.id !== postId) ?? []
      );
      
      return { previousPosts };
    },
    onError: (error, postId, context) => {
      toast({
        title: "Failed to delete post",
        description: error.message,
        variant: "destructive",
      });
      queryClient.setQueryData(["posts"], context?.previousPosts);
    },
    onSuccess: () => {
      toast({
        title: "Post deleted",
        description: "Your post has been successfully deleted",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  // Filter posts once for better performance
  const scheduledPosts = posts.filter((p) => p.status === "scheduled");
  const publishedPosts = posts.filter((p) => p.status === "published");

  if (isError) {
    return (
      <AppLayout shellWidth="full" showBackLink={false}>
        <EmptyState
          title="Failed to load posts"
          description={error.message}
          action={
            <Button onClick={() => queryClient.refetchQueries({ queryKey: ["posts"] })}>Retry</Button>
          }
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout shellWidth="full" showBackLink={false}>
      <div>
          {subscription?.paymentRequired && (
            <Alert className="mb-6 border-rose-200/80 bg-rose-50/90">
              <AlertTitle>Trial ended — payment required</AlertTitle>
              <AlertDescription>
                Your 7-day trial has ended. Continue using Advance AI features by completing payment in{" "}
                <Link href="/billing" className="underline font-medium text-primary">
                  Billing
                </Link>
                .
              </AlertDescription>
            </Alert>
          )}
          <div className="mb-8">
            <div className="flex flex-col gap-6 rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm ring-1 ring-zinc-100/80 md:flex-row md:items-start md:justify-between md:p-8">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">
                  Welcome back, {user?.username}!
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600 md:text-base">
                  Manage your social media presence across platforms.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <SubscriptionStatus />
                {user?.packageTier === "basic" ? (
                  <Button
                    variant={subscription?.advanceCheckoutAvailable ? "default" : "outline"}
                    size="sm"
                    asChild
                    className="w-full sm:w-auto shrink-0"
                  >
                    <Link href="/billing">
                      {subscription?.advanceCheckoutAvailable
                        ? "Upgrade to Advance"
                        : "Plans & billing"}
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" asChild className="w-full sm:w-auto shrink-0">
                    <Link href="/billing">Billing</Link>
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            {/* Compose Section */}
            <section>
              <Card className={appCard}>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-zinc-900">Create Post</CardTitle>
                </CardHeader>
                <CardContent>
                  <PostEditor 
                    onSuccess={() => {
                      queryClient.invalidateQueries({ queryKey: ["posts"] });
                    }}
                  />
                </CardContent>
              </Card>
            </section>

            {/* Posts Grid */}
            <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
              <section>
                <Card className={appCard}>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold text-zinc-900">Recent Posts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="scheduled">
                      <TabsList className="mb-4 h-auto gap-1 rounded-lg border border-zinc-200/80 bg-zinc-100/80 p-1">
                        <TabsTrigger
                          value="scheduled"
                          className="rounded-md data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-zinc-200/80"
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          Scheduled
                        </TabsTrigger>
                        <TabsTrigger
                          value="published"
                          className="rounded-md data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-zinc-200/80"
                        >
                          <BarChart2 className="h-4 w-4 mr-2" />
                          Published
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="scheduled">
                        {isLoading || isRefetching ? (
                          <div className="space-y-3">
                            {[...Array(2)].map((_, i) => (
                              <Skeleton key={i} className="h-20 w-full rounded-lg" />
                            ))}
                          </div>
                        ) : scheduledPosts.length === 0 ? (
                          <EmptyState 
                            title="No scheduled posts"
                            description="Posts you schedule will appear here"
                            icon={Calendar}
                          />
                        ) : (
                          <div className="space-y-4">
                            {scheduledPosts.map((post) => (
                              <div
                                key={post.id}
                                className="rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-4 transition-colors hover:bg-zinc-100/80"
                              >
                                <div className="flex justify-between items-start">
                                  <p className="text-sm line-clamp-2">{post.content}</p>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-destructive"
                                    onClick={() => deletePost.mutate(post.id)}
                                    disabled={deletePost.isPending}
                                  >
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                                  <Calendar className="h-4 w-4" />
                                  {new Date(post.scheduledTime!).toLocaleString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="published">
                        {isLoading || isRefetching ? (
                          <div className="space-y-3">
                            {[...Array(2)].map((_, i) => (
                              <Skeleton key={i} className="h-20 w-full rounded-lg" />
                            ))}
                          </div>
                        ) : publishedPosts.length === 0 ? (
                          <EmptyState 
                            title="No published posts"
                            description="Your published posts will appear here"
                            icon={BarChart2}
                          />
                        ) : (
                          <div className="space-y-4">
                            {publishedPosts.map((post) => (
                              <div
                                key={post.id}
                                className="rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-4 transition-colors hover:bg-zinc-100/80"
                              >
                                <p className="text-sm line-clamp-2">{post.content}</p>
                                <div className="flex flex-wrap gap-2 mt-3">
                                  {Object.entries(post.analytics ?? {}).map(([key, value]) => {
                                    const display =
                                      typeof value === "number"
                                        ? value.toLocaleString()
                                        : JSON.stringify(value);
                                    return (
                                      <div
                                        key={key}
                                        className="text-xs px-2 py-1 bg-primary/5 rounded"
                                      >
                                        {key}: {display}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </section>

              <div className="space-y-6">
                <SocialConnect />
                <ConnectedAccounts />

                <Card className={appCard}>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-semibold text-zinc-900">Schedule</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScheduleCalendar posts={posts} />
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
    </AppLayout>
  );
}
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Post } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import PostEditor from "@/components/post-editor";
import ScheduleCalendar from "@/components/schedule-calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, BarChart2, Home, LogOut, Menu, Trash, CreditCard, Settings } from "lucide-react";
import { Link } from "wouter";
import SocialConnect from "@/components/social-connect";
import ConnectedAccounts from "@/components/connected-accounts";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import Clock from "@/components/ui/clock";
import { SubscriptionStatus } from "@/components/subscription-status";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

type Subscription = {
  plan: string;
  status: 'active' | 'canceled' | 'past_due';
  current_period_end: number;
  posts_used: number;
  posts_limit: number | typeof Infinity;
  featureDisabled?: boolean;
};

function Sidebar({ className = "" }: { className?: string }) {
  const { logoutMutation, user } = useAuth();

  const { data: subscription } = useQuery<Subscription>({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/subscription");
      return res.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    enabled: !!user?.id, // Only fetch if user is logged in
  });

  return (
    <div className={className}>
      <div className="p-6">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
          Multi<span className="text-primary">Social</span> Studio
        </h1>
        <Clock className="mt-2" />
      </div>
      <Separator />
      <nav className="p-4">
        <div className="space-y-2">
          <Link href="/app" className="flex items-center gap-3 px-3 py-2 text-primary rounded-lg bg-primary/5">
            <Home className="h-5 w-5" />
            Dashboard
          </Link>
          <Link href="/analytics" className="flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/5 transition-colors">
            <BarChart2 className="h-5 w-5" />
            Analytics
          </Link>
          <Link href="/billing" className="flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/5 transition-colors">
            <CreditCard className="h-5 w-5" />
            Billing
            {subscription?.plan && (
              <span className="ml-auto text-xs px-2 py-1 bg-primary/10 rounded-full">
                {subscription.plan}
              </span>
            )}
          </Link>
          <Link href="/admin" className="flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/5 transition-colors">
            <Settings className="h-5 w-5" />
            Admin Settings
          </Link>
        </div>
      </nav>
      <Separator />
      <div className="p-4">
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-primary"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
        >
          <LogOut className="h-5 w-5 mr-3" />
          {logoutMutation.isPending ? "Logging out..." : "Logout"}
        </Button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

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
      <div className="container max-w-7xl py-6">
        <EmptyState 
          title="Failed to load posts"
          description={error.message}
          action={
            <Button onClick={() => queryClient.refetchQueries({ queryKey: ["posts"] })}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 border-r bg-card">
        <Sidebar />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden fixed top-4 left-4 z-10"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="container max-w-7xl py-6">
          <div className="mb-8">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                  Welcome back, {user?.username}!
                </h2>
                <p className="text-muted-foreground mt-2">
                  Manage your social media presence across platforms.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <SubscriptionStatus />
                {!subscription?.featureDisabled && (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="hidden sm:flex"
                  >
                    <Link href="/billing">Upgrade</Link>
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            {/* Compose Section */}
            <section>
              <Card>
                <CardHeader>
                  <CardTitle>Create Post</CardTitle>
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
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Posts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="scheduled">
                      <TabsList className="mb-4">
                        <TabsTrigger value="scheduled">
                          <Calendar className="h-4 w-4 mr-2" />
                          Scheduled
                        </TabsTrigger>
                        <TabsTrigger value="published">
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
                                className="p-4 border rounded-lg bg-card hover:bg-accent transition-colors"
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
                                className="p-4 border rounded-lg bg-card hover:bg-accent transition-colors"
                              >
                                <p className="text-sm line-clamp-2">{post.content}</p>
                                <div className="flex flex-wrap gap-2 mt-3">
                                  {Object.entries(post.analytics ?? {}).map(
                                    ([key, value]) => (
                                      <div
                                        key={key}
                                        className="text-xs px-2 py-1 bg-primary/5 rounded"
                                      >
                                        {key}: {value}
                                      </div>
                                    )
                                  )}
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

                <Card>
                  <CardHeader>
                    <CardTitle>Schedule</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScheduleCalendar posts={posts} />
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
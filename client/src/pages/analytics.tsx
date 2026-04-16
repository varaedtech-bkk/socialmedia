import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Post } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { BarChart, ResponsiveContainer, XAxis, YAxis, Bar, Tooltip } from "recharts";
import { Home, BarChart2, LogOut, Menu } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import Clock from "@/components/ui/clock";

function Sidebar({ className = "" }: { className?: string }) {
  const { logoutMutation } = useAuth();
  return (
    <div className={className}>
      <div className="p-6">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
          Multi<span className="text-primary">Social</span> Studio
        </h1>
        <span><Clock/></span>
      </div>
      <Separator />
      <nav className="p-4">
        <div className="space-y-2">
          <Link href="/app">
            <a className="flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/5 transition-colors">
              <Home className="h-5 w-5" />
              Dashboard
            </a>
          </Link>
          <Link href="/analytics">
            <a className="flex items-center gap-3 px-3 py-2 text-primary rounded-lg bg-primary/5">
              <BarChart2 className="h-5 w-5" />
              Analytics
            </a>
          </Link>
        </div>
      </nav>
      <Separator />
      <div className="p-4">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-muted-foreground hover:text-primary"
          onClick={() => logoutMutation.mutate()}
        >
          <LogOut className="h-5 w-5 mr-3" />
          Logout
        </Button>
      </div>
    </div>
  );
}

export default function Analytics() {
  const { logoutMutation } = useAuth();
  // Share posts cache with dashboard – same queryKey and fetch
  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ["posts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/posts");
      return res.json();
    },
  });
  const [isOpen, setIsOpen] = useState(false);

  const publishedPosts = posts.filter(p => p.status === "published");

  const engagementData = publishedPosts.map(post => ({
    content: post.content.slice(0, 20) + "...",
    likes: (post.analytics as any)?.likes || 0,
    comments: (post.analytics as any)?.comments || 0,
    shares: (post.analytics as any)?.shares || 0
  }));

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 border-r bg-card">
        <Sidebar />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden absolute top-4 left-4">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar />
        </SheetContent>
      </Sheet>

      <main className="flex-1 overflow-auto p-4 md:p-0">
        <div className="container max-w-7xl py-6">
          <div className="mb-8 md:mb-6">
            <div className="h-12 md:h-0" /> {/* Spacer for mobile menu */}
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Analytics Overview</h2>
            <p className="text-muted-foreground mt-2">Track your social media performance and engagement.</p>
          </div>

          <div className="grid gap-6">
            {/* Stats Grid */}
            <div className="grid gap-4 md:gap-6 grid-cols-2 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="h-8 bg-muted/10 animate-pulse rounded" />
                  ) : (
                    <p className="text-2xl md:text-3xl font-bold">{publishedPosts.length}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total Engagement</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="h-8 bg-muted/10 animate-pulse rounded" />
                  ) : (
                    <p className="text-2xl md:text-3xl font-bold">
                      {publishedPosts.reduce((sum, post) => 
                        sum + ((post.analytics as any)?.likes || 0) + 
                        ((post.analytics as any)?.comments || 0) + 
                        ((post.analytics as any)?.shares || 0), 0
                      )}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="col-span-2 md:col-span-1">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Scheduled Posts</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="h-8 bg-muted/10 animate-pulse rounded" />
                  ) : (
                    <p className="text-2xl md:text-3xl font-bold">
                      {posts.filter(p => p.status === "scheduled").length}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Engagement Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Post Engagement</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-[300px] md:h-[400px] bg-muted/10 animate-pulse rounded-lg" />
                ) : (
                  <div className="h-[300px] md:h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={engagementData}>
                        <XAxis 
                          dataKey="content" 
                          tick={{ fontSize: 12 }}
                          interval={0}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis width={30} />
                        <Tooltip />
                        <Bar dataKey="likes" fill="hsl(var(--primary))" name="Likes" />
                        <Bar dataKey="comments" fill="hsl(var(--secondary))" name="Comments" />
                        <Bar dataKey="shares" fill="hsl(var(--accent))" name="Shares" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
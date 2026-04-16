import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowRight } from "lucide-react";

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Logged-in users go straight to dashboard
  useEffect(() => {
    if (!isLoading && user) {
      setLocation("/app");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading || user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      {/* Top navigation */}
      <header className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center font-bold text-sm">
              MS
            </div>
            <span className="font-semibold tracking-tight">
              Multi<span className="text-indigo-400">Social</span> Studio
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth">
              <a className="text-sm text-slate-300 hover:text-white">Log in</a>
            </Link>
            <Link href="/auth">
              <Button className="rounded-full px-4 py-2 text-sm font-medium shadow-lg shadow-indigo-500/40 bg-indigo-500 hover:bg-indigo-400">
                Get started free
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-12 md:py-20 space-y-20">
        {/* Hero */}
        <section className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <p className="inline-flex items-center rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300 ring-1 ring-indigo-500/30">
              New • Multi-platform social scheduler
            </p>

            <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
              Multi<span className="text-indigo-400">Social</span> Studio
              <span className="block mt-2 text-slate-200 text-xl md:text-2xl font-normal">
                Create once. Publish everywhere.
              </span>
            </h1>

            <p className="text-slate-300 text-sm md:text-base leading-relaxed">
              Plan, schedule, and publish posts to Facebook, Instagram, LinkedIn,
              YouTube, WhatsApp and more from a single, unified dashboard.
              Keep your brand consistent without juggling tabs, logins, or calendars.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link href="/auth">
                <Button className="rounded-full px-5 py-2.5 text-sm font-medium shadow-lg shadow-indigo-500/40 bg-indigo-500 hover:bg-indigo-400 flex items-center gap-2">
                  Start posting in minutes
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a
                href="#features"
                className="inline-flex items-center rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500 transition-colors"
              >
                View features
              </a>
            </div>

            <div className="flex flex-wrap gap-6 text-xs text-slate-400 pt-2">
              <div>
                <div className="font-semibold text-slate-200">Multi-platform</div>
                Post to multiple networks at once.
              </div>
              <div>
                <div className="font-semibold text-slate-200">Smart scheduling</div>
                Queue content across time zones.
              </div>
              <div>
                <div className="font-semibold text-slate-200">Built-in analytics</div>
                See what performs—at a glance.
              </div>
            </div>
          </div>

          {/* Simple right-side mockup */}
          <div className="relative">
            <div className="absolute -inset-10 bg-indigo-500/20 blur-3xl opacity-50" />
            <div className="relative rounded-2xl border border-white/10 bg-slate-900/70 p-4 md:p-6 shadow-2xl shadow-black/60">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-slate-300">
                  New post • Today at 10:00
                </span>
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300 border border-emerald-500/40">
                  Scheduled
                </span>
              </div>

              <div className="space-y-3 mb-4">
                <div className="h-9 rounded-md bg-slate-800 border border-slate-700/80 px-3 flex items-center text-xs text-slate-400">
                  Launching our new campaign next week 🚀
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="rounded-md border border-indigo-500/60 bg-indigo-500/10 px-2 py-1">
                    Facebook Page
                  </div>
                  <div className="rounded-md border border-pink-500/60 bg-pink-500/10 px-2 py-1">
                    Instagram
                  </div>
                  <div className="rounded-md border border-sky-500/60 bg-sky-500/10 px-2 py-1">
                    LinkedIn Page
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-[10px] text-slate-400">
                <span>Auto-optimized by time zone</span>
                <span>Preview in 4 channels →</span>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="space-y-6">
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            Everything you need to run social from one place
          </h2>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
              <div className="text-slate-200 font-semibold">Unified composer</div>
              <p className="text-slate-400">
                Write once and adapt content for each platform with platform-aware checks
                for media, character limits, and posting rules.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
              <div className="text-slate-200 font-semibold">Smart scheduling</div>
              <p className="text-slate-400">
                Queue posts, pick time zones, and let MultiSocial Studio publish on autopilot
                while you focus on strategy.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
              <div className="text-slate-200 font-semibold">Cross-platform analytics</div>
              <p className="text-slate-400">
                See performance across Facebook, Instagram, LinkedIn, YouTube, and WhatsApp
                in one clean dashboard.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <Separator className="bg-slate-800" />
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-300">
            <p>
              Ready to centralize your posting workflow?
            </p>
            <Link href="/auth">
              <Button variant="outline" className="rounded-full border-slate-600 text-slate-100 hover:bg-slate-800">
                Get started with MultiSocial Studio
              </Button>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}


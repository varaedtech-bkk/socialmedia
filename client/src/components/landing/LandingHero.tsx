import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

export function LandingHero() {
  return (
    <section className="grid items-center gap-12 md:grid-cols-2">
      <div className="space-y-7">
        <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">
          <Sparkles className="h-3.5 w-3.5" />
          Built for modern social media operations
        </p>

        <h1 className="text-4xl font-bold tracking-tight md:text-6xl md:leading-[1.1]">
          The complete{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-sky-600 bg-clip-text text-transparent">
            social media
          </span>{" "}
          command center
        </h1>
        <p className="text-lg leading-relaxed text-slate-600 md:text-xl">
          Plan, collaborate, publish, and analyze across your channels with role-aware controls and transparent BYOK
          AI.
        </p>

        <div className="flex flex-wrap gap-4 pt-2">
          <Link href="/auth">
            <Button className="flex items-center gap-2 rounded-full bg-indigo-600 px-8 py-6 text-base font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:bg-indigo-500 hover:shadow-xl">
              Start free trial
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <a
            href="#features"
            className="inline-flex items-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition-all hover:border-indigo-300 hover:bg-indigo-50"
          >
            Explore features
          </a>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-4">
          <div className="flex items-center gap-2 rounded-lg bg-white/60 px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-xs text-slate-700">Access request flow</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-white/60 px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-xs text-slate-700">7-day trial</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-white/60 px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-xs text-slate-700">BYOK AI</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-white/60 px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-xs text-slate-700">RBAC governance</span>
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="absolute -inset-10 bg-gradient-to-r from-indigo-200/40 to-sky-200/40 blur-3xl" />
        <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl shadow-indigo-100/50">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-xs font-medium text-slate-600">Campaign: Summer Launch</span>
            </div>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Scheduled
            </span>
          </div>
          <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            Introducing our summer collection - fresh designs, cooler prices.
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs text-indigo-700">Facebook</span>
            <span className="rounded-full bg-pink-100 px-3 py-1 text-xs text-pink-700">Instagram</span>
            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs text-sky-700">LinkedIn</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-500">
            <span>Best time: 10:00 AM (your timezone)</span>
            <span>Projected engagement +24%</span>
          </div>
        </div>
      </div>
    </section>
  );
}

import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 to-sky-500 text-sm font-bold text-white shadow-md">
            SM
          </div>
          <span className="font-semibold tracking-tight text-slate-800">
            Social{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-sky-600 bg-clip-text text-transparent">
              Media Manager
            </span>
          </span>
        </div>
        <div className="hidden items-center gap-6 md:flex">
          <a href="#features" className="text-sm text-slate-600 transition-colors hover:text-indigo-600">
            Features
          </a>
          <a href="#pricing" className="text-sm text-slate-600 transition-colors hover:text-indigo-600">
            Pricing
          </a>
          <a href="#faq" className="text-sm text-slate-600 transition-colors hover:text-indigo-600">
            FAQ
          </a>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link href="/request-access" className="text-sm text-slate-600 transition-colors hover:text-indigo-600">
            Request access
          </Link>
          <Link href="/auth" className="text-sm text-slate-600 transition-colors hover:text-indigo-600">
            Log in
          </Link>
          <Link href="/auth">
            <Button className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/30 transition-all hover:bg-indigo-500 hover:shadow-xl">
              Start free trial
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

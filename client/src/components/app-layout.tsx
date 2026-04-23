import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Menu } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/app-sidebar";
import { AppUserMenu } from "@/components/app-user-menu";
import { appHeaderBar, appShellAdmin, appShellNarrow, appShellWide } from "@/lib/app-surface";
import { cn } from "@/lib/utils";

export type AppLayoutShellWidth = "narrow" | "wide" | "full" | "admin";

export interface AppLayoutProps {
  children: ReactNode;
  /** Max width + horizontal padding for scrollable main. */
  shellWidth?: AppLayoutShellWidth;
  /** Optional label next to back / logo in the sticky top bar. */
  topBarTitle?: string;
  topBarIcon?: LucideIcon;
  /** When false, top bar shows product name instead of back to dashboard. */
  showBackLink?: boolean;
}

function topBarInnerClass(shellWidth: AppLayoutShellWidth) {
  switch (shellWidth) {
    case "wide":
      return appShellWide("flex flex-wrap items-center justify-between gap-3 py-4");
    case "full":
      return cn(
        "container mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6 xl:px-10",
      );
    case "admin":
      return appShellAdmin("flex flex-wrap items-center justify-between gap-3 py-4");
    default:
      return appShellNarrow("flex flex-wrap items-center justify-between gap-3 py-4");
  }
}

function mainShellClass(shellWidth: AppLayoutShellWidth) {
  const pad = "flex-1 min-h-0 overflow-y-auto py-7 pt-14 md:pt-7 lg:py-9";
  switch (shellWidth) {
    case "wide":
      return appShellWide(pad);
    case "full":
      return cn("container mx-auto max-w-7xl flex-1 min-h-0 overflow-y-auto px-4 py-7 pt-14 md:px-6 md:pt-7 lg:py-9 xl:px-10");
    case "admin":
      return appShellAdmin(pad);
    default:
      return appShellNarrow(pad);
  }
}

export function AppLayout({
  children,
  shellWidth = "narrow",
  topBarTitle,
  topBarIcon: TopBarIcon,
  showBackLink = true,
}: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-zinc-950">
      <aside className="hidden w-56 shrink-0 border-r border-zinc-800 md:flex md:w-60">
        <AppSidebar className="w-full" />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="fixed left-3 top-3 z-30 h-10 w-10 rounded-lg border-zinc-200/90 bg-white/95 shadow-md backdrop-blur-sm md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[min(100vw-2rem,18rem)] max-w-[18rem] border-zinc-800 bg-zinc-900 p-0 sm:max-w-xs">
          <AppSidebar className="min-h-[100dvh]" />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col bg-white">
        <header className={appHeaderBar}>
          <div className={topBarInnerClass(shellWidth)}>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
              {showBackLink ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 shrink-0 gap-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  asChild
                >
                  <Link href="/app">
                    <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="hidden sm:inline">Dashboard</span>
                    <span className="sm:hidden">Back</span>
                  </Link>
                </Button>
              ) : (
                <span className="shrink-0 text-sm font-semibold tracking-tight text-zinc-900 sm:text-base">
                  Multi<span className="text-primary">Social</span> Studio
                </span>
              )}
              {(topBarTitle || TopBarIcon) && (
                <div className="flex min-w-0 items-center gap-2.5 border-l border-zinc-200 pl-2.5 sm:pl-3.5">
                  {TopBarIcon ? <TopBarIcon className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden /> : null}
                  {topBarTitle ? (
                    <span className="truncate text-sm font-medium tracking-tight text-zinc-800 sm:text-[15px]">
                      {topBarTitle}
                    </span>
                  ) : null}
                </div>
              )}
            </div>
            <AppUserMenu variant="header" />
          </div>
        </header>

        <main className={mainShellClass(shellWidth)}>{children}</main>
      </div>
    </div>
  );
}

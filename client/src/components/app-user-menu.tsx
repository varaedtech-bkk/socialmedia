import { Link } from "wouter";
import { ChevronDown, CreditCard, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function initials(username: string | undefined) {
  if (!username?.length) return "?";
  const clean = username.replace(/[^a-zA-Z0-9]/g, "");
  if (clean.length >= 2) return clean.slice(0, 2).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

type AppUserMenuProps = {
  /** Top bar (light) vs sidebar footer (dark). */
  variant: "header" | "sidebar";
};

export function AppUserMenu({ variant }: AppUserMenuProps) {
  const { user, logoutMutation } = useAuth();
  if (!user?.username) return null;

  const isHeader = variant === "header";
  const letter = initials(user.username);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-w-0 items-center gap-2 rounded-lg text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2",
            isHeader
              ? "max-w-[min(92vw,16rem)] shrink-0 border border-zinc-200/90 bg-zinc-50/90 py-1.5 pl-1.5 pr-2 hover:bg-zinc-100 sm:max-w-xs"
              : "w-full border border-zinc-700/60 bg-zinc-800/50 px-2.5 py-2 hover:bg-zinc-800 focus-visible:ring-offset-zinc-900",
          )}
          aria-label="Account menu"
        >
          <Avatar className={cn("shrink-0", isHeader ? "h-7 w-7" : "h-9 w-9")}>
            <AvatarFallback
              className={cn(
                "text-[10px] font-semibold sm:text-xs",
                isHeader ? "bg-primary/15 text-primary" : "bg-zinc-700 text-zinc-100",
              )}
            >
              {letter}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 leading-tight">
            <p
              className={cn(
                "truncate font-medium",
                isHeader ? "text-sm text-zinc-900" : "text-sm text-white",
              )}
            >
              {user.username}
            </p>
            {user.email ? (
              <p
                className={cn(
                  "truncate text-xs",
                  isHeader ? "hidden text-zinc-500 sm:block" : "text-zinc-500",
                )}
              >
                {user.email}
              </p>
            ) : null}
          </div>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 opacity-70", isHeader ? "text-zinc-500" : "text-zinc-400")}
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-60 rounded-lg border-zinc-200 p-1.5 shadow-lg"
        align="end"
        side={isHeader ? "bottom" : "top"}
        sideOffset={isHeader ? 6 : 8}
      >
        <DropdownMenuLabel className="px-2 py-1.5 font-normal">
          <span className="block text-xs font-medium uppercase tracking-wide text-zinc-500">Signed in</span>
          <span className="mt-0.5 block truncate text-sm font-semibold text-zinc-900">{user.username}</span>
          {user.email ? (
            <span className="mt-0.5 block truncate text-xs text-zinc-500">{user.email}</span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-zinc-200" />
        <DropdownMenuItem asChild className="cursor-pointer rounded-md">
          <Link href="/billing" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-zinc-500" />
            Plan &amp; billing
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-zinc-200" />
        <DropdownMenuItem
          className="cursor-pointer rounded-md text-red-600 focus:bg-red-50 focus:text-red-700"
          disabled={logoutMutation.isPending}
          onClick={() => logoutMutation.mutate()}
        >
          <LogOut className="h-4 w-4" />
          {logoutMutation.isPending ? "Signing out…" : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

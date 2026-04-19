import { cn } from "@/lib/utils";

/** Dark sidebar section label (WORKSPACE / ACCOUNT). */
export function sidebarSectionTitleClass() {
  return "px-3 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 first:pt-2";
}

/** Dark sidebar nav row — OpenRouter-style active pill on zinc-900. */
export function sidebarNavLinkClass(active: boolean) {
  return cn(
    "flex min-h-[2.5rem] items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
    active
      ? "bg-zinc-800 font-medium text-white"
      : "font-medium text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200",
  );
}

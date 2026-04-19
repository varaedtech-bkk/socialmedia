import { cn } from "@/lib/utils";

/** Page canvas — full-viewport background (marketing, auth, centered states). */
export const appPageCanvas = "min-h-screen bg-zinc-50";

/** Sticky top bar on inner pages (Integrations, Billing, Analytics header strip). */
export const appHeaderBar =
  "sticky top-0 z-20 border-b border-zinc-200/80 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/90";

/** Primary content cards — white, thin border, soft shadow. */
export const appCard = "rounded-xl border border-zinc-200/80 bg-white shadow-sm";

/** Emphasized card (hero panels). */
export const appCardElevated = "rounded-xl border border-zinc-200/80 bg-white shadow-md";

/** Muted section inside a card (table toolbar, footers). */
export const appCardMutedBand = "border-zinc-200/80 bg-zinc-50/90";

export function appShellNarrow(className?: string) {
  return cn("mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8", className);
}

export function appShellWide(className?: string) {
  return cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className);
}

export function appShellAdmin(className?: string) {
  return cn("container mx-auto max-w-7xl px-4 md:px-6", className);
}

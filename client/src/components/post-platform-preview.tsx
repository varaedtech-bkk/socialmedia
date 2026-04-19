import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { AlertTriangle, Video as VideoIcon } from "lucide-react";
import { PLATFORM_CAPTION_MAX_CHARS, PLATFORM_DISPLAY_NAME } from "@shared/platform-limits";

function softLimitFor(platformId: string): number {
  return PLATFORM_CAPTION_MAX_CHARS[platformId] ?? 8000;
}

function displayName(id: string): string {
  return PLATFORM_DISPLAY_NAME[id] ?? id;
}

function effectiveCaptionForPlatform(
  platformId: string,
  sharedContent: string,
  captionOverrides: Record<string, string>,
): string {
  const o = captionOverrides[platformId];
  if (typeof o === "string" && o.trim().length > 0) return o;
  return sharedContent;
}

function PreviewShell({
  platformId,
  children,
  className,
}: {
  platformId: string;
  children: React.ReactNode;
  className?: string;
}) {
  const bar =
    platformId === "twitter"
      ? "bg-black text-white"
      : platformId === "instagram"
        ? "bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white"
        : platformId === "linkedin" || platformId === "linkedin-page"
          ? "bg-[#0a66c2] text-white"
          : platformId === "facebook-page" || platformId === "facebook-personal"
            ? "bg-[#1877f2] text-white"
            : platformId === "youtube"
              ? "bg-red-600 text-white"
              : platformId === "tiktok"
                ? "bg-black text-white"
                : "bg-muted text-foreground";

  return (
    <div
      className={cn(
        "max-w-full overflow-hidden rounded-xl border border-zinc-200/80 bg-white text-zinc-900 shadow-sm",
        className,
      )}
    >
      <div className={cn("px-3 py-2 text-xs font-semibold tracking-tight", bar)}>
        Preview · {displayName(platformId)}
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </div>
  );
}

function PreviewBody({
  platformId,
  caption,
  imageUrl,
  showVideoPlaceholder,
}: {
  platformId: string;
  caption: string;
  imageUrl: string | null;
  showVideoPlaceholder: boolean;
}) {
  const limit = softLimitFor(platformId);
  const len = caption.length;
  const over = len > limit;

  const fontClass =
    platformId === "twitter"
      ? "font-sans text-[15px] leading-5"
      : platformId === "instagram"
        ? "font-sans text-[15px] leading-relaxed"
        : platformId === "linkedin" || platformId === "linkedin-page"
          ? "font-serif text-[17px] leading-7 text-foreground/95"
          : "font-sans text-[15px] leading-6";

  const widthClass =
    platformId === "twitter" ? "max-w-[28rem]" : platformId === "instagram" ? "max-w-sm mx-auto" : "max-w-xl";

  return (
    <div className="space-y-3">
      {over && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-xs">Long for {displayName(platformId)}</AlertTitle>
          <AlertDescription className="text-xs">
            About {len.toLocaleString()} characters — typical soft limit ~{limit.toLocaleString()}. The network may
            truncate or reject; tighten copy if needed.
          </AlertDescription>
        </Alert>
      )}
      {!over && len > limit * 0.85 && (
        <Alert className="py-2 border-amber-500/40 bg-amber-500/5">
          <AlertTitle className="text-xs">Approaching length limit</AlertTitle>
          <AlertDescription className="text-xs">
            {len}/{limit} characters — fine for most posts, double-check for this channel.
          </AlertDescription>
        </Alert>
      )}

      {showVideoPlaceholder && (
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border bg-muted/40 py-10 text-muted-foreground",
            platformId === "instagram" ? "aspect-square max-w-sm mx-auto" : "min-h-[140px]",
          )}
        >
          <VideoIcon className="h-8 w-8 opacity-60" aria-hidden />
          <span className="text-xs">Video — frame preview not shown</span>
        </div>
      )}

      {imageUrl && (
        <div
          className={cn(
            "overflow-hidden rounded-lg border bg-muted/30",
            platformId === "instagram" ? "aspect-square max-w-sm mx-auto" : "max-h-56",
          )}
        >
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className={cn("whitespace-pre-wrap break-words text-foreground", fontClass, widthClass)}>
        {caption.trim() ? caption : <span className="text-muted-foreground italic">No caption yet</span>}
      </div>

      <p className="text-[11px] text-muted-foreground border-t pt-2">
        Line breaks and spacing are preserved as plain text. Actual fonts, link cards, and mentions differ per app —
        this is an approximate layout.
      </p>
    </div>
  );
}

type PostPlatformPreviewProps = {
  /** Platforms user may post to (dialog selection). */
  platformIds: string[];
  content: string;
  onContentChange: (value: string) => void;
  mediaFiles: File[];
  perPlatformCaptions: boolean;
  onPerPlatformCaptionsChange: (value: boolean) => void;
  captionOverrides: Record<string, string>;
  onCaptionOverrideChange: (platformId: string, value: string) => void;
};

export function PostPlatformPreviewTabs({
  platformIds,
  content,
  onContentChange,
  mediaFiles,
  perPlatformCaptions,
  onPerPlatformCaptionsChange,
  captionOverrides,
  onCaptionOverrideChange,
}: PostPlatformPreviewProps) {
  const [tab, setTab] = useState(platformIds[0] ?? "");

  useEffect(() => {
    if (platformIds.length && !platformIds.includes(tab)) {
      setTab(platformIds[0]);
    }
  }, [platformIds, tab]);

  const firstImage = useMemo(() => mediaFiles.find((f) => f.type.startsWith("image/")) ?? null, [mediaFiles]);
  const hasVideo = useMemo(() => mediaFiles.some((f) => f.type.startsWith("video/")), [mediaFiles]);

  const imageUrl = useMemo(() => {
    if (!firstImage) return null;
    return URL.createObjectURL(firstImage);
  }, [firstImage]);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const showVideoPlaceholder = hasVideo && !firstImage;

  if (platformIds.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">Select at least one platform to see previews.</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-zinc-200/80 bg-zinc-50/80 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5 min-w-0">
          <Label htmlFor="per-platform-captions" className="text-sm font-medium cursor-pointer">
            Customize caption per platform
          </Label>
          <p className="text-xs text-muted-foreground leading-snug">
            When on, each tab can use its own text for publishing; otherwise one caption is sent everywhere.
          </p>
        </div>
        <Switch
          id="per-platform-captions"
          className="shrink-0"
          checked={perPlatformCaptions}
          onCheckedChange={(v) => onPerPlatformCaptionsChange(Boolean(v))}
        />
      </div>

      <div>
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {perPlatformCaptions ? "Default caption (fallback)" : "Caption (all platforms)"}
        </Label>
        <Textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          className="mt-1.5 min-h-[100px] resize-y border-zinc-200/90 bg-white text-sm text-zinc-900 placeholder:text-zinc-400"
          placeholder={
            perPlatformCaptions
              ? "Used for any platform where you did not set a specific caption below."
              : "Edit your post text — previews update live."
          }
        />
      </div>

      <div>
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Approximate feed preview</Label>
        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList className="flex h-auto max-w-full flex-nowrap justify-start gap-1 overflow-x-auto rounded-lg border border-zinc-200/80 bg-zinc-100/80 p-1 [scrollbar-width:thin]">
            {platformIds.map((id) => (
              <TabsTrigger
                key={id}
                value={id}
                className="shrink-0 max-w-[10rem] truncate rounded-md px-2.5 py-1.5 text-xs text-zinc-600 data-[state=active]:bg-white data-[state=active]:font-medium data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-zinc-200/80"
                title={displayName(id)}
              >
                {displayName(id)}
              </TabsTrigger>
            ))}
          </TabsList>
          {platformIds.map((id) => {
            const effective = effectiveCaptionForPlatform(id, content, captionOverrides);
            return (
              <TabsContent key={id} value={id} className="mt-3 focus-visible:outline-none space-y-3">
                {perPlatformCaptions && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Caption for {displayName(id)}</Label>
                    <Textarea
                      value={captionOverrides[id] ?? content}
                      onChange={(e) => onCaptionOverrideChange(id, e.target.value)}
                      className="mt-1.5 min-h-[88px] resize-y border-zinc-200/90 bg-white text-sm text-zinc-900 placeholder:text-zinc-400"
                      placeholder={`Leave as default or write copy specific to ${displayName(id)}`}
                    />
                  </div>
                )}
                <PreviewShell platformId={id}>
                  <PreviewBody
                    platformId={id}
                    caption={effective}
                    imageUrl={imageUrl}
                    showVideoPlaceholder={showVideoPlaceholder}
                  />
                </PreviewShell>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </div>
  );
}

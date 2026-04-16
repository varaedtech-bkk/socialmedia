import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPostSchema, InsertPost } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { CalendarIcon, Loader2, ImageIcon, Video, X, File, Link2, AlertCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import TimezoneSelect from "react-timezone-select";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PostEditorProps {
  onSuccess?: () => void;
}

export default function PostEditor({ onSuccess }: PostEditorProps) {
  const [dateTime, setDateTime] = useState<Date | undefined>();
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [selectedTimezone, setSelectedTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone // Default to the user's current time zone
  );
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [dialogPlatforms, setDialogPlatforms] = useState<InsertPost["platforms"]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<InsertPost>({
    resolver: zodResolver(insertPostSchema),
    defaultValues: {
      content: "",
      platforms: [],
      scheduledTime: null,
      mediaUrls: [],
      mediaType: "text",
    },
  });

  const createPost = useMutation({
    mutationFn: async (
      data: InsertPost & { files?: File[]; timezone: string }
    ) => {
      if (data.platforms.length === 0) {
        throw new Error("Please connect at least one platform.");
      }

      const formData = new FormData();
      formData.append("content", data.content);
      formData.append("scheduledTime", dateTime ? dateTime.toISOString() : "");
      formData.append("platforms", JSON.stringify(data.platforms));
      formData.append(
        "mediaType",
        mediaFiles.length > 0
          ? mediaFiles[0].type.startsWith("image/")
            ? "image"
            : mediaFiles[0].type === "application/pdf"
            ? "pdf"
            : "video"
          : "text"
      );
      formData.append("timezone", data.timezone);

      mediaFiles.forEach((file) => {
        formData.append("media", file);
      });

      console.log("Sending form data to backend:", {
        content: data.content,
        platforms: data.platforms,
        mediaType: formData.get("mediaType"),
        mediaUrls: formData.get("mediaUrls"),
        timezone: data.timezone,
        files: mediaFiles,
      });

      const res = await fetch("/api/posts", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        console.error("Backend error response:", error);
        throw new Error(error.error || "Failed to create post");
      }

      const responseData = await res.json();
      console.log("Backend success response:", responseData);
      return responseData;
    },
    onSuccess: (data) => {
      console.log("Post created successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      form.reset();
      setDateTime(undefined);
      setMediaFiles([]);
      toast({
        title: "Success",
        description: data.message || "Post created successfully.",
        variant: "default",
      });
      // Call the onSuccess prop if provided
      onSuccess?.();
    },
    onError: (error: Error) => {
      console.error("Post creation error:", error);
      if (error.message.includes("partial_failure")) {
        toast({
          title: "Partial Success",
          description:
            "Post was partially successful. Check the logs for details.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to create post",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const generateWithAi = useMutation({
    mutationFn: async () => {
      if (!aiPrompt.trim()) throw new Error("Enter a prompt for AI generation");
      const selectedPlatforms = form.watch("platforms");
      const res = await apiRequest("POST", "/api/ai/generate-post", {
        prompt: aiPrompt,
        platforms: selectedPlatforms,
        tone: "professional",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate AI content");
      }
      return res.json() as Promise<{ content: string }>;
    },
    onSuccess: (data) => {
      form.setValue("content", data.content, { shouldValidate: true, shouldDirty: true });
      toast({
        title: "AI draft ready",
        description: "Post content generated. Review and edit before publishing.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "AI generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const platforms = form.watch("platforms") as string[];
  
      // Define allowed file types for each platform
      const allowedTypes = {
        "facebook-page": ["image/jpeg", "image/jpg", "image/png", "video/mp4"],
        "facebook-personal": [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "video/mp4",
        ],
        linkedin: [
          "application/pdf",
          "image/jpeg",
          "image/jpg",
          "image/png",
          "video/mp4",
        ],
        instagram: ["image/jpeg", "image/jpg", "image/png", "video/mp4"], // Instagram-specific file types
      };
  
      const maxFileSize = 100 * 1024 * 1024; // 100 MB
  
      const isValid = files.every((file) => {
        const isTypeValid = platforms.every((platform) => {
          return allowedTypes[platform as keyof typeof allowedTypes].includes(
            file.type
          );
        });
  
        const isSizeValid = file.size <= maxFileSize;
  
        if (!isTypeValid) {
          toast({
            title: "Invalid file type",
            description: `File ${file.name} is not a valid type for the selected platforms.`,
            variant: "destructive",
          });
        }
  
        if (!isSizeValid) {
          toast({
            title: "File too large",
            description: `File ${file.name} exceeds the maximum size of 100 MB.`,
            variant: "destructive",
          });
        }
  
        return isTypeValid && isSizeValid;
      });
  
      if (!isValid) {
        return; // Stop if any file is invalid
      }
  
      setMediaFiles(files);
    }
  };

  const removeMedia = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Helper function to determine if a platform supports the current content type
  const isPlatformCompatible = (platform: string): boolean => {
    const hasVideo = mediaFiles.some(file => file.type.startsWith("video/"));
    const hasImage = mediaFiles.some(file => file.type.startsWith("image/"));
    const hasMedia = mediaFiles.length > 0;

    switch (platform) {
      case "youtube":
        return hasVideo; // YouTube only supports videos
      case "instagram":
        return hasMedia; // Instagram requires media (image or video)
      case "whatsapp":
        return hasMedia; // WhatsApp Status requires media
      default:
        return true; // Other platforms support text, images, videos, etc.
    }
  };

  // Get all connected platforms
  const getConnectedPlatforms = (): Array<{ id: string; name: string; connected: boolean }> => {
    return [
      { id: "facebook-page", name: "Facebook Page", connected: !!user?.facebookPageToken },
      { id: "linkedin", name: "LinkedIn", connected: !!user?.linkedinToken },
      { id: "linkedin-page", name: "LinkedIn Page", connected: !!user?.linkedinPageToken },
      { id: "instagram", name: "Instagram", connected: !!user?.instagramToken },
      { id: "whatsapp", name: "WhatsApp", connected: !!user?.whatsappToken },
      { id: "twitter", name: "Twitter", connected: !!user?.twitterToken },
      { id: "youtube", name: "YouTube", connected: !!user?.youtubeToken },
      { id: "tiktok", name: "TikTok", connected: !!user?.tiktokToken },
      { id: "pinterest", name: "Pinterest", connected: !!user?.pinterestToken },
      { id: "snapchat", name: "Snapchat", connected: !!user?.snapchatToken },
    ].filter(p => p.connected);
  };

  // Handle form submission - show dialog instead of posting directly
  const handleFormSubmit = (data: InsertPost) => {
    const connectedPlatforms = getConnectedPlatforms();
    const compatiblePlatforms = connectedPlatforms.filter(p => isPlatformCompatible(p.id));
    
    // Pre-select compatible platforms that were already selected
    const preSelected = data.platforms.filter(p => 
      compatiblePlatforms.some(cp => cp.id === p)
    );

    // If no compatible platforms, show error
    if (compatiblePlatforms.length === 0) {
      toast({
        title: "No Compatible Platforms",
        description: "None of your connected platforms support this content type. Please add appropriate media files.",
        variant: "destructive",
      });
      return;
    }

    // Set dialog platforms to pre-selected or all compatible if none were selected
    setDialogPlatforms((preSelected.length > 0 ? preSelected : compatiblePlatforms.map(p => p.id)) as InsertPost["platforms"]);
    setShowConfirmDialog(true);
  };

  // Handle final post submission from dialog
  const handleFinalSubmit = (selectedPlatforms: InsertPost["platforms"]) => {
    if (selectedPlatforms.length === 0) {
      toast({
        title: "No Platforms Selected",
        description: "Please select at least one platform to post to.",
        variant: "destructive",
      });
      return;
    }

    const formData = form.getValues();
    
    // Validate Instagram requires media
    if (selectedPlatforms.includes("instagram") && mediaFiles.length === 0) {
      toast({
        title: "Instagram Post Error",
        description: "Instagram posts must include an image or video.",
        variant: "destructive",
      });
      return;
    }

    // Proceed with mutation
    createPost.mutate({
      ...formData,
      platforms: selectedPlatforms,
      files: mediaFiles,
      timezone: selectedTimezone,
    });

    setShowConfirmDialog(false);
  };

  return (
    <>
    <form
      onSubmit={form.handleSubmit(handleFormSubmit)}
      className="space-y-4"
    >
      <div className="grid gap-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <Textarea
            placeholder="Ask AI to write your post. Example: Launch announcement for our new product with friendly tone."
            className="min-h-[72px] resize-none"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            className="sm:w-[220px]"
            disabled={generateWithAi.isPending}
            onClick={() => generateWithAi.mutate()}
          >
            {generateWithAi.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate with AI
              </>
            )}
          </Button>
        </div>
      </div>

      <Textarea
        placeholder="What's on your mind?"
        className="min-h-[150px] resize-none"
        {...form.register("content")}
      />

      {/* Media Preview */}
      {mediaFiles.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {mediaFiles.map((file, index) => (
            <div
              key={index}
              className="relative aspect-video rounded-lg bg-muted"
            >
              {file.type.startsWith("image/") ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt="Preview"
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : file.type === "application/pdf" ? (
                <div className="flex items-center justify-center w-full h-full">
                  <File className="h-12 w-12 text-gray-500" />
                  <p className="text-sm text-gray-500 mt-2">{file.name}</p>
                </div>
              ) : (
                <video
                  src={URL.createObjectURL(file)}
                  className="w-full h-full object-cover rounded-lg"
                  controls
                />
              )}
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6"
                onClick={() => removeMedia(index)}
                type="button"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Check if any platforms are connected */}
      {(() => {
        const hasConnectedPlatforms = !!(
          user?.facebookPageToken ||
          user?.linkedinToken ||
          user?.linkedinPageToken ||
          user?.instagramToken ||
          user?.whatsappToken ||
          user?.twitterToken ||
          user?.youtubeToken ||
          user?.tiktokToken ||
          user?.pinterestToken ||
          user?.snapchatToken
        );

        if (!hasConnectedPlatforms) {
          return (
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
                <span>No social media accounts connected. Connect at least one platform to create posts.</span>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/?tab=connections">
                    <Link2 className="h-4 w-4 mr-2" />
                    Connect Platforms
                  </Link>
                </Button>
              </AlertDescription>
            </Alert>
          );
        }

        return (
          <>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-medium text-muted-foreground mr-2">Select Platforms:</span>
              
              {user?.facebookPageToken && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.watch("platforms").includes("facebook-page")}
                    onCheckedChange={(checked) => {
                      const platforms = form.watch("platforms");
                      form.setValue(
                        "platforms",
                        checked
                          ? [...platforms, "facebook-page"]
                          : platforms.filter((p) => p !== "facebook-page")
                      );
                    }}
                  />
                  <span>Facebook Page</span>
                </label>
              )}

              {user?.linkedinToken && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.watch("platforms").includes("linkedin")}
                    onCheckedChange={(checked) => {
                      const platforms = form.watch("platforms");
                      form.setValue(
                        "platforms",
                        checked
                          ? [...platforms, "linkedin"]
                          : platforms.filter((p) => p !== "linkedin")
                      );
                    }}
                  />
                  <span>LinkedIn</span>
                </label>
              )}

              {user?.linkedinPageToken && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.watch("platforms").includes("linkedin-page")}
                    onCheckedChange={(checked) => {
                      const platforms = form.watch("platforms");
                      form.setValue(
                        "platforms",
                        checked
                          ? [...platforms, "linkedin-page"]
                          : platforms.filter((p) => p !== "linkedin-page")
                      );
                    }}
                  />
                  <span>LinkedIn Page</span>
                </label>
              )}

              {user?.instagramToken && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.watch("platforms").includes("instagram")}
                    onCheckedChange={(checked) => {
                      const platforms = form.watch("platforms");
                      form.setValue(
                        "platforms",
                        checked
                          ? [...platforms, "instagram"]
                          : platforms.filter((p) => p !== "instagram")
                      );
                    }}
                    disabled={mediaFiles.length === 0}
                  />
                  <span>Instagram</span>
                </label>
              )}

              {user?.whatsappToken && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.watch("platforms").includes("whatsapp")}
                    onCheckedChange={(checked) => {
                      const platforms = form.watch("platforms");
                      form.setValue(
                        "platforms",
                        checked
                          ? [...platforms, "whatsapp"]
                          : platforms.filter((p) => p !== "whatsapp")
                      );
                    }}
                    disabled={mediaFiles.length === 0}
                  />
                  <span>WhatsApp Status</span>
                </label>
              )}

              {user?.twitterToken && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.watch("platforms").includes("twitter")}
                    onCheckedChange={(checked) => {
                      const platforms = form.watch("platforms");
                      form.setValue(
                        "platforms",
                        checked
                          ? [...platforms, "twitter"]
                          : platforms.filter((p) => p !== "twitter")
                      );
                    }}
                  />
                  <span>Twitter</span>
                </label>
              )}

              {user?.youtubeToken && (
                <label className={cn(
                  "flex items-center gap-2",
                  !isPlatformCompatible("youtube") && "cursor-not-allowed opacity-50"
                )}>
                  <Checkbox
                    checked={form.watch("platforms").includes("youtube")}
                    onCheckedChange={(checked) => {
                      const platforms = form.watch("platforms");
                      form.setValue(
                        "platforms",
                        checked
                          ? [...platforms, "youtube"]
                          : platforms.filter((p) => p !== "youtube")
                      );
                    }}
                    disabled={!isPlatformCompatible("youtube")}
                  />
                  <span>YouTube {!isPlatformCompatible("youtube") && "(Video only)"}</span>
                </label>
              )}

              {user?.tiktokToken && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.watch("platforms").includes("tiktok")}
                    onCheckedChange={(checked) => {
                      const platforms = form.watch("platforms");
                      form.setValue(
                        "platforms",
                        checked
                          ? [...platforms, "tiktok"]
                          : platforms.filter((p) => p !== "tiktok")
                      );
                    }}
                  />
                  <span>TikTok</span>
                </label>
              )}

              {user?.pinterestToken && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.watch("platforms").includes("pinterest")}
                    onCheckedChange={(checked) => {
                      const platforms = form.watch("platforms");
                      form.setValue(
                        "platforms",
                        checked
                          ? [...platforms, "pinterest"]
                          : platforms.filter((p) => p !== "pinterest")
                      );
                    }}
                  />
                  <span>Pinterest</span>
                </label>
              )}

              {user?.snapchatToken && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.watch("platforms").includes("snapchat")}
                    onCheckedChange={(checked) => {
                      const platforms = form.watch("platforms");
                      form.setValue(
                        "platforms",
                        checked
                          ? [...platforms, "snapchat"]
                          : platforms.filter((p) => p !== "snapchat")
                      );
                    }}
                  />
                  <span>Snapchat</span>
                </label>
              )}

              {/* Media Upload Buttons */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => document.getElementById("image-upload")?.click()}
                >
                  <ImageIcon className="h-4 w-4" />
                  <input
                    type="file"
                    id="image-upload"
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                  />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => document.getElementById("video-upload")?.click()}
                >
                  <Video className="h-4 w-4" />
                  <input
                    type="file"
                    id="video-upload"
                    className="hidden"
                    accept="video/*"
                    onChange={handleFileChange}
                  />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => document.getElementById("file-upload")?.click()}
                >
                  <File className="h-4 w-4" />
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    accept="application/pdf"
                    onChange={handleFileChange}
                  />
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 sm:ml-auto">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "sm:w-[240px] justify-start text-left font-normal",
                      !dateTime && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTime ? (
                      format(dateTime, "PPPp")
                    ) : (
                      <span>Schedule for later</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <DatePicker
                    selected={dateTime}
                    onChange={(date: Date | null) => setDateTime(date || undefined)}
                    showTimeSelect
                    timeFormat="HH:mm"
                    timeIntervals={1} // Allow selecting times at 1-minute intervals
                    timeCaption="time"
                    dateFormat="MMMM d, yyyy h:mm aa"
                    inline
                  />
                </PopoverContent>
              </Popover>

              {/* Time Zone Selector */}
              <div className="w-full sm:w-auto">
                <TimezoneSelect
                  value={selectedTimezone}
                  onChange={(tz) => setSelectedTimezone(tz.value)}
                  className="w-full"
                />
              </div>
              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={
                  createPost.isPending || form.watch("platforms").length === 0
                }
              >
                {createPost.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {dateTime ? "Schedule Post" : "Post Now"}
              </Button>
            </div>
          </div>
          </>
        );
      })()}
    </form>

    {/* Platform Selection Confirmation Dialog */}
    <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Select Platforms to Post</DialogTitle>
          <DialogDescription>
            Choose which platforms you want to post to. Some platforms may be disabled based on your content type.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-sm font-medium">Platforms</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const connectedPlatforms = getConnectedPlatforms();
                const compatiblePlatforms = connectedPlatforms
                  .filter(p => isPlatformCompatible(p.id))
                  .map(p => p.id) as InsertPost["platforms"];
                setDialogPlatforms(compatiblePlatforms);
              }}
            >
              Select All Compatible
            </Button>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {getConnectedPlatforms().map((platform) => {
              const isCompatible = isPlatformCompatible(platform.id);
              const isSelected = dialogPlatforms.includes(platform.id as InsertPost["platforms"][number]);
              
              return (
                <label
                  key={platform.id}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-md border cursor-pointer transition-colors",
                    isSelected && "bg-accent",
                    !isCompatible && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      if (isCompatible) {
                        setDialogPlatforms(prev =>
                          checked
                            ? [...prev, platform.id as InsertPost["platforms"][number]]
                            : prev.filter(p => p !== platform.id)
                        );
                      }
                    }}
                    disabled={!isCompatible}
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium">{platform.name}</span>
                    {!isCompatible && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {platform.id === "youtube" && "Requires video file"}
                        {platform.id === "instagram" && "Requires image or video"}
                        {platform.id === "whatsapp" && "Requires media file"}
                      </p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowConfirmDialog(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => handleFinalSubmit(dialogPlatforms)}
            disabled={dialogPlatforms.length === 0 || createPost.isPending}
          >
            {createPost.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {dateTime ? "Schedule Post" : "Post Now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

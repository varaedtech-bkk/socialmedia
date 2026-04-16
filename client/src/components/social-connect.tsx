import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SiFacebook,
  SiLinkedin,
  SiInstagram,
  SiX,
  SiYoutube,
  SiTiktok,
  SiPinterest,
  SiSnapchat,
  SiWhatsapp,
} from "react-icons/si";
import { useToast } from "@/hooks/use-toast";

export default function SocialConnect() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();

  // Handle OAuth callbacks (use window.location.search so /app?instagram_connected=true works after server redirect)
  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : location.split("?")[1] || "");

    // Handle successful connections
    if (params.has("facebook_page_connected")) {
      toast({
        title: "Facebook Connected",
        description: "Your Facebook page has been successfully connected.",
      });
    } else if (params.has("linkedin_connected")) {
      toast({
        title: "LinkedIn Connected",
        description: "Your LinkedIn account has been successfully connected.",
      });
    } else if (params.has("linkedin_page_connected")) {
      toast({
        title: "LinkedIn Page Connected",
        description: "Your LinkedIn Page has been successfully connected.",
      });
    } else if (params.has("instagram_connected")) {
      toast({
        title: "Instagram Connected",
        description: "Your Instagram account has been successfully connected.",
      });
    } else if (params.has("twitter_connected")) {
      toast({
        title: "Twitter (X) Connected",
        description:
          "Your Twitter (X) account has been successfully connected.",
      });
    } else if (params.has("youtube_connected")) {
      toast({
        title: "YouTube Connected",
        description: "Your YouTube account has been successfully connected.",
      });
    } else if (params.has("tiktok_connected")) {
      toast({
        title: "TikTok Connected",
        description: "Your TikTok account has been successfully connected.",
      });
    } else if (params.has("pinterest_connected")) {
      toast({
        title: "Pinterest Connected",
        description: "Your Pinterest account has been successfully connected.",
      });
    } else if (params.has("snapchat_connected")) {
      toast({
        title: "Snapchat Connected",
        description: "Your Snapchat account has been successfully connected.",
      });
    } else if (params.has("whatsapp_connected")) {
      toast({
        title: "WhatsApp Connected",
        description: "Your WhatsApp Business account has been successfully connected.",
      });
    }

    // Handle errors
    const error = params.get("error");
    const reason = params.get("reason");
    if (error) {
      let description = "Please try again.";
      if (reason === "no_code") {
        description = "Authorization was cancelled.";
      } else if (reason === "api_error") {
        description = "There was an error connecting to the service.";
      } else if (reason) {
        // Show the actual error reason if provided
        description = decodeURIComponent(reason);
      }

      toast({
        title: `${error.split("_")[0].toUpperCase()} Connection Failed`,
        description,
        variant: "destructive",
      });
    }
  }, [location, toast]);

  const connectPlatform = async (platform: string) => {
    try {
      const res = await fetch(`/api/auth/${platform}`);
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Failed to initiate OAuth flow. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Social Media Accounts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Facebook Page */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SiFacebook className="w-6 h-6 text-blue-600" />
            <span>Facebook Page</span>
          </div>
          <Button
            variant={user?.facebookPageToken ? "outline" : "default"}
            onClick={() => connectPlatform("facebook-page")}
            className="relative"
          >
            {user?.facebookPageToken ? (
              <>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full" />
                Reconnect
              </>
            ) : (
              "Connect"
            )}
          </Button>
        </div>

        {/* LinkedIn Account */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SiLinkedin className="w-6 h-6 text-[#0A66C2]" />
            <span>LinkedIn Account</span>
          </div>
          <Button
            variant={user?.linkedinToken ? "outline" : "default"}
            onClick={() => connectPlatform("linkedin")}
            className="relative"
          >
            {user?.linkedinToken ? (
              <>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full" />
                Reconnect
              </>
            ) : (
              "Connect"
            )}
          </Button>
        </div>

        {/* LinkedIn Page */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SiLinkedin className="w-6 h-6 text-[#0A66C2]" />
            <span>LinkedIn Page</span>
          </div>
          <Button
            variant={user?.linkedinPageToken ? "outline" : "default"}
            onClick={() => connectPlatform("linkedin-page")}
            className="relative"
          >
            {user?.linkedinPageToken ? (
              <>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full" />
                Reconnect
              </>
            ) : (
              "Connect"
            )}
          </Button>
        </div>

        {/* Instagram Account (Business/Creator) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SiInstagram className="w-6 h-6 text-[#E4405F]" />
            <div className="flex flex-col">
              <span>Instagram Business/Creator</span>
              <span className="text-xs text-muted-foreground">Requires Business or Creator account</span>
            </div>
          </div>
          <Button
            variant={user?.instagramToken ? "outline" : "default"}
            onClick={() => connectPlatform("instagram")}
            className="relative"
          >
            {user?.instagramToken ? (
              <>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full" />
                Reconnect
              </>
            ) : (
              "Connect"
            )}
          </Button>
        </div>

        {/* WhatsApp Business Account */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SiWhatsapp className="w-6 h-6 text-[#25D366]" />
            <div className="flex flex-col">
              <span>WhatsApp Business</span>
              <span className="text-xs text-muted-foreground">Requires WhatsApp Business Account</span>
            </div>
          </div>
          <Button
            variant={user?.whatsappToken ? "outline" : "default"}
            onClick={() => connectPlatform("whatsapp")}
            className="relative"
          >
            {user?.whatsappToken ? (
              <>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full" />
                Reconnect
              </>
            ) : (
              "Connect"
            )}
          </Button>
        </div>

        {/* Twitter (X) Account */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SiX className="w-6 h-6 text-[#1DA1F2]" />
            <span>Twitter (X) Account</span>
          </div>
          <Button
            variant={user?.twitterToken ? "outline" : "default"}
            onClick={() => connectPlatform("twitter")}
            className="relative"
          >
            {user?.twitterToken ? (
              <>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full" />
                Reconnect
              </>
            ) : (
              "Connect"
            )}
          </Button>
        </div>

        {/* YouTube Account */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SiYoutube className="w-6 h-6 text-[#FF0000]" />
            <span>YouTube Account</span>
          </div>
          <Button
            variant={user?.youtubeToken ? "outline" : "default"}
            onClick={() => connectPlatform("youtube")}
            className="relative"
          >
            {user?.youtubeToken ? (
              <>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full" />
                Reconnect
              </>
            ) : (
              "Connect"
            )}
          </Button>
        </div>

        {/* TikTok Account */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SiTiktok className="w-6 h-6 text-[#000000]" />
            <span>TikTok Account</span>
          </div>
          <Button
            variant={user?.tiktokToken ? "outline" : "default"}
            onClick={() => connectPlatform("tiktok")}
            className="relative"
          >
            {user?.tiktokToken ? (
              <>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full" />
                Reconnect
              </>
            ) : (
              "Connect"
            )}
          </Button>
        </div>

        {/* Pinterest Account */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SiPinterest className="w-6 h-6 text-[#E60023]" />
            <span>Pinterest Account</span>
          </div>
          <Button
            variant={user?.pinterestToken ? "outline" : "default"}
            onClick={() => connectPlatform("pinterest")}
            className="relative"
          >
            {user?.pinterestToken ? (
              <>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full" />
                Reconnect
              </>
            ) : (
              "Connect"
            )}
          </Button>
        </div>

        {/* Snapchat Account */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SiSnapchat className="w-6 h-6 text-[#FFFC00]" />
            <span>Snapchat Account</span>
          </div>
          <Button
            variant={user?.snapchatToken ? "outline" : "default"}
            onClick={() => connectPlatform("snapchat")}
            className="relative"
          >
            {user?.snapchatToken ? (
              <>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full" />
                Reconnect
              </>
            ) : (
              "Connect"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

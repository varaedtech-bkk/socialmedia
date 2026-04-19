import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";
import { appCard, appHeaderBar, appPageCanvas } from "@/lib/app-surface";
import { cn } from "@/lib/utils";

export default function RequestAccessPage() {
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [packageTier, setPackageTier] = useState<"basic" | "advance">("basic");
  const [honeypot, setHoneypot] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      const res = await fetch("/api/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          fullName,
          company: company || undefined,
          message: message || undefined,
          packageTier,
          website: honeypot,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Request failed");
      }
      toast({
        title: "Request received",
        description:
          "If email notifications are configured, a super admin has been notified. You will hear back soon.",
      });
      setEmail("");
      setFullName("");
      setCompany("");
      setMessage("");
    } catch (err) {
      toast({
        title: "Could not submit",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={cn(appPageCanvas, "flex flex-col")}>
      <header className={cn(appHeaderBar, "px-4 py-3 md:px-6")}>
        <Button variant="ghost" size="sm" className="text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Home
          </Link>
        </Button>
      </header>
      <main className="flex flex-1 items-center justify-center p-6">
        <Card className={cn(appCard, "w-full max-w-lg")}>
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-zinc-900">Request platform access</CardTitle>
            <CardDescription className="text-zinc-600">
              Tell us how to reach you and which plan you need. A super admin will review your request
              (often after payment is confirmed) and create your login.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company (optional)</Label>
                <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select
                  value={packageTier}
                  onValueChange={(v) => setPackageTier(v as "basic" | "advance")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic — dashboard & bot posting (no AI)</SelectItem>
                    <SelectItem value="advance">
                      Advance — AI drafts + Telegram / bot AI (OpenRouter key required)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Notes (optional)</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Invoice reference, team size, or anything helpful"
                  rows={3}
                />
              </div>
              <div className="hidden" aria-hidden>
                <Label htmlFor="website">Leave blank</Label>
                <Input
                  id="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit request"
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Already have an account?{" "}
                <Link href="/auth" className="text-primary underline-offset-4 hover:underline">
                  Log in
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

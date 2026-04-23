import { useMemo, useState } from "react";
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
import { ArrowLeft, CheckCircle2, Clock3, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { appCard, appHeaderBar, appPageCanvas } from "@/lib/app-surface";
import { cn } from "@/lib/utils";

type Tier = "basic" | "advance";

export default function RequestAccessPage() {
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [submittedId, setSubmittedId] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [packageTier, setPackageTier] = useState<Tier>("basic");
  const [useCase, setUseCase] = useState("agency");
  const [teamSize, setTeamSize] = useState("2-5");
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<{ email?: string; fullName?: string }>({});

  const getOrCreateDeviceId = (): string => {
    const key = "request_access_device_id";
    const existing = window.localStorage.getItem(key);
    if (existing && existing.length >= 16) return existing;
    const generated =
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`) + "-trial";
    window.localStorage.setItem(key, generated);
    return generated;
  };

  const freeEmailDomains = useMemo(
    () =>
      new Set([
        "gmail.com",
        "yahoo.com",
        "hotmail.com",
        "outlook.com",
        "icloud.com",
        "proton.me",
        "protonmail.com",
      ]),
    [],
  );

  const emailDomain = useMemo(() => {
    const idx = email.indexOf("@");
    if (idx === -1) return "";
    return email.slice(idx + 1).toLowerCase().trim();
  }, [email]);

  const hasFreeEmailDomain = emailDomain.length > 0 && freeEmailDomains.has(emailDomain);

  const validate = (): boolean => {
    const nextErrors: { email?: string; fullName?: string } = {};
    const normalizedEmail = email.trim();
    const normalizedName = fullName.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextErrors.email = "Please enter a valid work email address.";
    }
    if (normalizedName.length < 2) {
      nextErrors.fullName = "Please enter your full name.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setPending(true);
    try {
      const enrichedMessage = [
        message.trim(),
        `Use case: ${useCase}`,
        `Team size: ${teamSize}`,
      ]
        .filter(Boolean)
        .join("\n");

      const res = await fetch("/api/access-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": getOrCreateDeviceId(),
        },
        body: JSON.stringify({
          email,
          fullName,
          company: company || undefined,
          message: enrichedMessage || undefined,
          packageTier,
          website: honeypot,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Request failed");
      }
      const requestId = Number((data as { id?: unknown }).id);
      if (Number.isFinite(requestId)) setSubmittedId(requestId);
      toast({
        title: "Request received",
        description: "Your request is queued for super-admin review.",
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
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-start gap-6 p-6 lg:grid-cols-[1.05fr_1.25fr]">
        <Card className={cn(appCard, "order-2 w-full lg:order-1")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-semibold text-zinc-900">
              <Sparkles className="h-5 w-5 text-indigo-600" />
              Why teams request access
            </CardTitle>
            <CardDescription className="text-zinc-600">
              Built for controlled onboarding with clear approvals and billing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
              <p className="flex items-center gap-2 font-medium text-zinc-900">
                <ShieldCheck className="h-4 w-4 text-indigo-600" />
                Admin-reviewed onboarding
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Every request is reviewed by super admin before login activation.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
              <p className="flex items-center gap-2 font-medium text-zinc-900">
                <Clock3 className="h-4 w-4 text-indigo-600" />
                Predictable timeline
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Typical review windows are short during business hours.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
              <p className="font-medium text-zinc-900">What happens next?</p>
              <ol className="mt-1 list-decimal space-y-1 pl-4 text-xs text-zinc-600">
                <li>Submit request and choose your plan.</li>
                <li>Admin reviews and creates your account.</li>
                <li>You receive login access and start trial if eligible.</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(appCard, "order-1 w-full lg:order-2")}>
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-zinc-900">Request platform access</CardTitle>
            <CardDescription className="text-zinc-600">
              Share your details and use case. We route your request to super-admin review.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submittedId ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="flex items-center gap-2 font-medium text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" />
                    Request submitted successfully
                  </p>
                  <p className="mt-1 text-sm text-emerald-700">
                    Reference ID: <span className="font-semibold">#{submittedId}</span>
                  </p>
                </div>
                <p className="text-sm text-zinc-600">
                  Keep this ID for support follow-up. You can now return to login or submit another request.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <Link href="/auth">Go to login</Link>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSubmittedId(null)}
                  >
                    Submit another request
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Work email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    autoComplete="email"
                    placeholder="name@company.com"
                  />
                  {errors.email ? <p className="text-xs text-red-600">{errors.email}</p> : null}
                  {!errors.email && hasFreeEmailDomain ? (
                    <p className="text-xs text-amber-700">
                      Personal email detected. A company domain can speed up review.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    required
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
                    }}
                    autoComplete="name"
                    placeholder="Your name"
                  />
                  {errors.fullName ? <p className="text-xs text-red-600">{errors.fullName}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company (optional)</Label>
                  <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Plan</Label>
                    <Select value={packageTier} onValueChange={(v) => setPackageTier(v as Tier)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basic - posting and scheduling</SelectItem>
                        <SelectItem value="advance">Advance - includes AI tools</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Team size</Label>
                    <Select value={teamSize} onValueChange={setTeamSize}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solo">Solo</SelectItem>
                        <SelectItem value="2-5">2-5 people</SelectItem>
                        <SelectItem value="6-20">6-20 people</SelectItem>
                        <SelectItem value="20+">20+ people</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Primary use case</Label>
                  <Select value={useCase} onValueChange={setUseCase}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agency">Agency client operations</SelectItem>
                      <SelectItem value="brand">In-house brand team</SelectItem>
                      <SelectItem value="creator">Creator workflow</SelectItem>
                      <SelectItem value="mixed">Mixed / other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Notes (optional)</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Share goals, channels, or any deployment constraints"
                    rows={4}
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
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting request...
                    </>
                  ) : (
                    "Submit access request"
                  )}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Already have an account?{" "}
                  <Link href="/auth" className="text-primary underline-offset-4 hover:underline">
                    Log in
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

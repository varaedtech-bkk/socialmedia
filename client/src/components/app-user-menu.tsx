import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ChevronDown,
  CreditCard,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  UserCircle2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { canAccessAdminPanel } from "@/lib/admin-access";

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
  const { toast } = useToast();
  const [profileOpen, setProfileOpen] = useState(false);
  const [accountTab, setAccountTab] = useState<"profile" | "security">("profile");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  if (!user?.username) return null;

  const isHeader = variant === "header";
  const letter = initials(user.username);
  const roleLabel = user.role === "super_admin" ? "Super admin" : "Client";
  const membershipRole = (user as any)?.companyMembership?.role as string | undefined;
  const packageTier = (user.capabilities?.packageTier ?? user.packageTier ?? "basic").toLowerCase();
  const canSeeAdmin = canAccessAdminPanel(user.role, membershipRole);
  const securityTips = useMemo(
    () => [
      "Use a unique password for this account.",
      "Rotate your OpenRouter key if you suspect exposure.",
      "Sign out on shared or public devices.",
    ],
    [],
  );

  useEffect(() => {
    if (!profileOpen) return;
    setUsername(user.username);
    setEmail(user.email || "");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }, [profileOpen, user.email, user.username]);

  const profileMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/account/profile", {
        username: username.trim(),
        email: email.trim(),
      });
      return res.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["/api/user"], updatedUser);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Profile updated",
        description: "Your account details were saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not update profile",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/account/password", {
        currentPassword,
        newPassword,
      });
      return res.json();
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not update password",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const disableProfileSave =
    profileMutation.isPending ||
    username.trim().length < 3 ||
    !/^\S+@\S+\.\S+$/.test(email.trim());
  const disablePasswordSave =
    passwordMutation.isPending ||
    currentPassword.length < 1 ||
    newPassword.length < 8 ||
    newPassword !== confirmPassword;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex min-w-0 items-center gap-2 rounded-lg text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2",
              isHeader
                ? "max-w-[min(92vw,17rem)] shrink-0 border border-zinc-200/90 bg-zinc-50/90 py-1.5 pl-1.5 pr-2.5 hover:bg-zinc-100 sm:max-w-xs"
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
          className="w-72 rounded-xl border-zinc-200 p-1.5 shadow-lg"
          align="end"
          side={isHeader ? "bottom" : "top"}
          sideOffset={isHeader ? 8 : 10}
        >
          <DropdownMenuLabel className="rounded-lg border border-zinc-200/80 bg-zinc-50/80 px-3 py-2.5 font-normal">
            <div className="flex items-center gap-2.5">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">{letter}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <span className="block truncate text-sm font-semibold text-zinc-900">{user.username}</span>
                <span className="block truncate text-xs text-zinc-500">{user.email || "No email on file"}</span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-zinc-200" />
          <DropdownMenuItem className="cursor-pointer rounded-md" onClick={() => setProfileOpen(true)}>
            <UserCircle2 className="h-4 w-4 text-zinc-500" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer rounded-md">
            <Link href="/app" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4 text-zinc-500" />
              Dashboard
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer rounded-md">
            <Link href="/billing" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-zinc-500" />
              Plan &amp; billing
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer rounded-md">
            <Link href="/integrations" className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-zinc-500" />
              Integrations
            </Link>
          </DropdownMenuItem>
          {canSeeAdmin && (
            <DropdownMenuItem asChild className="cursor-pointer rounded-md">
              <Link href="/admin" className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-zinc-500" />
                Admin
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="bg-zinc-200" />
          <DropdownMenuItem
            className="cursor-pointer rounded-md text-red-600 focus:bg-red-50 focus:text-red-700"
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate()}
          >
            <LogOut className="h-4 w-4" />
            {logoutMutation.isPending ? "Signing out..." : "Log out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-2xl overflow-hidden rounded-2xl border-zinc-200 p-0">
          <div className="grid md:grid-cols-[15rem,1fr]">
            <aside className="border-b border-zinc-200 bg-zinc-50/80 p-5 md:border-b-0 md:border-r">
              <DialogHeader className="space-y-1 text-left">
                <DialogTitle className="text-xl font-semibold tracking-tight text-zinc-900">Account</DialogTitle>
                <DialogDescription className="text-sm leading-relaxed text-zinc-600">
                  Manage your profile and account security.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-5 space-y-1.5">
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors",
                    accountTab === "profile"
                      ? "border-primary/25 bg-primary/[0.08] text-primary"
                      : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50",
                  )}
                  onClick={() => setAccountTab("profile")}
                >
                  Profile
                </button>
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors",
                    accountTab === "security"
                      ? "border-primary/25 bg-primary/[0.08] text-primary"
                      : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50",
                  )}
                  onClick={() => setAccountTab("security")}
                >
                  Security
                </button>
              </div>
            </aside>

            <section className="space-y-5 p-5 md:p-6">
              {accountTab === "profile" ? (
                <>
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900">Profile details</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">{letter}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-900">{user.username}</p>
                          <p className="truncate text-xs text-zinc-500">Display profile</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {roleLabel}
                      </Badge>
                    </div>

                    <form
                      className="grid gap-3 rounded-xl border border-zinc-200 p-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        profileMutation.mutate();
                      }}
                    >
                      <div className="grid gap-1.5">
                        <Label htmlFor="profile-username">Username</Label>
                        <Input
                          id="profile-username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Enter username"
                          maxLength={64}
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="profile-email">Email</Label>
                        <Input
                          id="profile-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@company.com"
                          maxLength={254}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-zinc-500">
                          Workspace package: <span className="font-medium capitalize text-zinc-700">{packageTier}</span>
                        </p>
                        <Button type="submit" size="sm" disabled={disableProfileSave}>
                          {profileMutation.isPending ? "Saving..." : "Save profile"}
                        </Button>
                      </div>
                    </form>

                    <div className="rounded-xl border border-zinc-200 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-zinc-500" />
                        <p className="text-sm font-medium text-zinc-900">Security recommendations</p>
                      </div>
                      <ul className="space-y-1.5 text-xs leading-relaxed text-zinc-600">
                        {securityTips.map((tip) => (
                          <li key={tip}>- {tip}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900">Security</h3>
                    <p className="mt-1 text-sm text-zinc-600">
                      Update your password to protect your account access.
                    </p>
                  </div>

                  <form
                    className="grid gap-3 rounded-xl border border-zinc-200 p-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newPassword !== confirmPassword) {
                        toast({
                          title: "Passwords do not match",
                          description: "Confirm password must match the new password.",
                          variant: "destructive",
                        });
                        return;
                      }
                      passwordMutation.mutate();
                    }}
                  >
                    <div className="grid gap-1.5">
                      <Label htmlFor="current-password">Current password</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="new-password">New password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="confirm-password">Confirm password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-zinc-500">Use at least 8 characters with letters and numbers.</p>
                    <div className="flex justify-end">
                      <Button type="submit" size="sm" disabled={disablePasswordSave}>
                        {passwordMutation.isPending ? "Updating..." : "Update password"}
                      </Button>
                    </div>
                  </form>
                </>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline" asChild>
                  <Link href="/integrations">Manage API key</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/billing">Open billing</Link>
                </Button>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

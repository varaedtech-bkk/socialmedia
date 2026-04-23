import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { appCard } from "@/lib/app-surface";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, KeyRound, Save, Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type CompanyRole = "owner" | "moderator";
type PlatformId =
  | "facebook-page"
  | "instagram"
  | "linkedin"
  | "linkedin-page"
  | "twitter"
  | "youtube"
  | "tiktok"
  | "pinterest"
  | "snapchat"
  | "whatsapp";

type CompanyMember = {
  userId: number;
  username: string;
  email: string;
  companyRole: CompanyRole;
  aiEnabled: boolean;
  allowedPlatforms: string[];
  membershipActive: boolean;
  packageTier: string;
  appRole: string;
  isApproved: boolean;
};

type CompanyMembersPayload = {
  company: {
    id: number;
    name: string;
    packageTier: "basic" | "advance";
  };
  actorMembership: {
    role: CompanyRole;
  };
  members: CompanyMember[];
};

type ChannelUserPayload = {
  companyId: number;
  items: Array<{
    id: number;
    channel: string;
    channelUserId: string;
    isActive: boolean;
    userId: number;
    username: string;
    email: string;
    updatedAt: string;
  }>;
};

const PLATFORM_OPTIONS: Array<{ id: PlatformId; label: string }> = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "twitter", label: "X / Twitter" },
  { id: "facebook-page", label: "Facebook Page" },
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
  { id: "tiktok", label: "TikTok" },
  { id: "pinterest", label: "Pinterest" },
  { id: "snapchat", label: "Snapchat" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "linkedin-page", label: "LinkedIn Page" },
];

function roleBadgeVariant(role: CompanyRole): "default" | "secondary" | "outline" {
  if (role === "owner") return "default";
  return "outline";
}

const COMPANY_ROLE_LEVEL: Record<CompanyRole, number> = {
  moderator: 1,
  owner: 2,
};

export function AdminCompanyMembersTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [companyKey, setCompanyKey] = useState("");
  const [clearCompanyKey, setClearCompanyKey] = useState(false);

  const membersQuery = useQuery<CompanyMembersPayload>({
    queryKey: ["admin", "company", "members"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/company/members");
      return res.json();
    },
  });

  const saveMemberMutation = useMutation({
    mutationFn: async ({
      userId,
      payload,
    }: {
      userId: number;
      payload: {
        role?: CompanyRole;
        aiEnabled: boolean;
        allowedPlatforms: PlatformId[];
        isActive: boolean;
      };
    }) => {
      await apiRequest("PATCH", `/api/admin/company/members/${userId}`, payload);
    },
    onSuccess: () => {
      setEditingUserId(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "company", "members"] });
      toast({
        title: "Member controls updated",
        description: "Role, AI access, and platform permissions were saved.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Unable to update member",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const companyKeyMutation = useMutation({
    mutationFn: async (payload: { apiKey?: string; clear?: true }) => {
      await apiRequest("PUT", "/api/admin/company/openrouter-key", payload);
    },
    onSuccess: () => {
      setCompanyKey("");
      setClearCompanyKey(false);
      toast({
        title: "Company key updated",
        description: "Company OpenRouter key has been saved.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Could not update key",
        description: err.message,
        variant: "destructive",
      });
    },
  });
  const channelUsersQuery = useQuery<ChannelUserPayload>({
    queryKey: ["admin", "company", "channel-users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/company/channel-users");
      return res.json();
    },
  });
  const toggleChannelMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      await apiRequest("PATCH", `/api/admin/company/channel-users/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "company", "channel-users"] });
      toast({
        title: "Channel mapping updated",
        description: "Device mapping status was updated successfully.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Could not update channel mapping",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const actorRole = membersQuery.data?.actorMembership?.role ?? "moderator";
  const canManage = actorRole === "owner";

  const content = useMemo(() => {
    if (membersQuery.isLoading) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading company members...
        </div>
      );
    }
    if (!membersQuery.data) return null;
    return membersQuery.data.members;
  }, [membersQuery.data, membersQuery.isLoading]);

  return (
    <div className="space-y-5">
      <Card className={cn(appCard, "rounded-2xl border-zinc-200/90 shadow-sm")}>
        <CardHeader className="space-y-1 border-b border-zinc-100 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight text-zinc-900">
            <Shield className="h-4 w-4 text-zinc-500" aria-hidden />
            Company member controls
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed text-zinc-500 sm:text-sm">
            Manage owner/moderator permissions for AI and allowed posting platforms.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          {membersQuery.data?.company ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50/60 px-3 py-2 text-[13px]">
              <span className="text-zinc-500">Company</span>
              <span className="font-medium text-zinc-900">{membersQuery.data.company.name}</span>
              <Badge
                variant={membersQuery.data.company.packageTier === "advance" ? "default" : "secondary"}
                className="h-5 px-1.5 text-[10px] font-semibold uppercase tracking-wide"
              >
                {membersQuery.data.company.packageTier}
              </Badge>
              <span className="hidden h-3 w-px bg-zinc-200 sm:inline" aria-hidden />
              <Badge variant="outline" className="h-5 border-zinc-200 bg-white px-1.5 text-[10px] font-medium text-zinc-600">
                You · {actorRole.replace("_", " ")}
              </Badge>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <Table className="text-[13px]">
              <TableHeader>
                <TableRow className="border-zinc-100 bg-zinc-50/90 hover:bg-zinc-50/90">
                  <TableHead className="h-9 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    User
                  </TableHead>
                  <TableHead className="h-9 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Role
                  </TableHead>
                  <TableHead className="h-9 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    AI
                  </TableHead>
                  <TableHead className="h-9 min-w-[10rem] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Platforms
                  </TableHead>
                  <TableHead className="h-9 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Status
                  </TableHead>
                  <TableHead className="h-9 w-[100px] px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.isArray(content) && content.length > 0 ? (
                  content.map((member) => (
                    <MemberRow
                      key={member.userId}
                      member={member}
                      actorUserId={user?.id ?? null}
                      actorRole={actorRole}
                      isEditing={editingUserId === member.userId}
                      canManage={canManage}
                      onEdit={() => setEditingUserId(member.userId)}
                      onCancel={() => setEditingUserId(null)}
                      onSave={(payload) =>
                        saveMemberMutation.mutate({
                          userId: member.userId,
                          payload,
                        })
                      }
                      isSaving={saveMemberMutation.isPending}
                    />
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-[13px] text-zinc-500">
                      {membersQuery.isLoading ? "Loading…" : "No company members found."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className={cn(appCard, "rounded-2xl border-zinc-200/90 shadow-sm")}>
        <CardHeader className="space-y-1 border-b border-zinc-100 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight text-zinc-900">
            <KeyRound className="h-4 w-4 text-zinc-500" aria-hidden />
            Company OpenRouter key
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed text-zinc-500 sm:text-sm">
            Stored at company level for admin reference. Individual members still must add their own key to use AI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="space-y-2">
            <Label htmlFor="company-openrouter-key" className="text-xs font-medium text-zinc-600">
              API key
            </Label>
            <Input
              id="company-openrouter-key"
              type="password"
              placeholder="sk-or-v1-…"
              value={companyKey}
              onChange={(e) => setCompanyKey(e.target.value)}
              disabled={!canManage || companyKeyMutation.isPending}
              className="h-9 border-zinc-200 text-[13px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={clearCompanyKey}
              onCheckedChange={setClearCompanyKey}
              disabled={!canManage || companyKeyMutation.isPending}
            />
            <span className="text-[13px] text-zinc-600">Clear company key</span>
          </div>
          <Button
            size="sm"
            className="h-8"
            disabled={!canManage || companyKeyMutation.isPending || (!companyKey.trim() && !clearCompanyKey)}
            onClick={() => {
              if (clearCompanyKey) {
                companyKeyMutation.mutate({ clear: true });
                return;
              }
              companyKeyMutation.mutate({ apiKey: companyKey.trim() });
            }}
          >
            {companyKeyMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save company key
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className={cn(appCard, "rounded-2xl border-zinc-200/90 shadow-sm")}>
        <CardHeader className="space-y-1 border-b border-zinc-100 pb-4">
          <CardTitle className="text-lg font-semibold tracking-tight text-zinc-900">Connected chat users</CardTitle>
          <CardDescription className="text-xs leading-relaxed text-zinc-500 sm:text-sm">
            Telegram and WhatsApp identities linked to members. Disable a row to block that device immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <Table className="text-[13px]">
              <TableHeader>
                <TableRow className="border-zinc-100 bg-zinc-50/90 hover:bg-zinc-50/90">
                  <TableHead className="h-9 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Channel
                  </TableHead>
                  <TableHead className="h-9 min-w-[8rem] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Identity
                  </TableHead>
                  <TableHead className="h-9 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Member
                  </TableHead>
                  <TableHead className="h-9 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Status
                  </TableHead>
                  <TableHead className="h-9 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Updated
                  </TableHead>
                  <TableHead className="h-9 w-[88px] px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(channelUsersQuery.data?.items || []).length > 0 ? (
                  channelUsersQuery.data!.items.map((item) => (
                    <TableRow key={item.id} className="border-zinc-100">
                      <TableCell className="px-3 py-2 capitalize text-zinc-700">{item.channel}</TableCell>
                      <TableCell className="px-3 py-2 font-mono text-[11px] leading-snug text-zinc-600">
                        {item.channelUserId}
                      </TableCell>
                      <TableCell className="px-3 py-2 font-medium text-zinc-900">{item.username}</TableCell>
                      <TableCell className="px-3 py-2">
                        <Badge
                          variant={item.isActive ? "default" : "secondary"}
                          className="h-5 px-1.5 text-[10px] font-semibold"
                        >
                          {item.isActive ? "Active" : "Off"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 py-2 tabular-nums text-[11px] text-zinc-500">
                        {new Date(item.updatedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant={item.isActive ? "outline" : "default"}
                          className="h-7 px-2.5 text-xs"
                          disabled={!canManage || toggleChannelMutation.isPending}
                          onClick={() =>
                            toggleChannelMutation.mutate({ id: item.id, isActive: !item.isActive })
                          }
                        >
                          {item.isActive ? "Disable" : "Enable"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-[13px] text-zinc-500">
                      {channelUsersQuery.isLoading ? "Loading…" : "No linked chat users yet."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MemberRow({
  member,
  actorUserId,
  actorRole,
  isEditing,
  canManage,
  onEdit,
  onCancel,
  onSave,
  isSaving,
}: {
  member: CompanyMember;
  actorUserId: number | null;
  actorRole: CompanyRole;
  isEditing: boolean;
  canManage: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (payload: {
    role?: CompanyRole;
    aiEnabled: boolean;
    allowedPlatforms: PlatformId[];
    isActive: boolean;
  }) => void;
  isSaving: boolean;
}) {
  const [role, setRole] = useState<CompanyRole>(member.companyRole);
  const [aiEnabled, setAiEnabled] = useState(Boolean(member.aiEnabled));
  const [isActive, setIsActive] = useState(Boolean(member.membershipActive));
  const [allowedPlatforms, setAllowedPlatforms] = useState<PlatformId[]>(
    (member.allowedPlatforms.filter((p) =>
      PLATFORM_OPTIONS.some((opt) => opt.id === p),
    ) as PlatformId[]) ?? [],
  );

  const togglePlatform = (platform: PlatformId) => {
    setAllowedPlatforms((curr) =>
      curr.includes(platform) ? curr.filter((p) => p !== platform) : [...curr, platform],
    );
  };
  const canEditThisMember =
    canManage &&
    (actorRole === "owner" ||
      COMPANY_ROLE_LEVEL[member.companyRole] < COMPANY_ROLE_LEVEL[actorRole]);
  const canToggleMembershipActive = canEditThisMember && actorUserId !== member.userId;
  const roleOptions: CompanyRole[] =
    actorRole === "owner"
      ? ["owner", "moderator"]
      : ["moderator"];
  const canEditRole = canEditThisMember && actorUserId !== member.userId;

  const badgeDense = "h-5 px-1.5 text-[10px] font-semibold capitalize";

  if (!isEditing) {
    return (
      <TableRow className="border-zinc-100 transition-colors hover:bg-zinc-50/60">
        <TableCell className="px-3 py-2 align-middle">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-zinc-900">{member.username}</span>
            <span className="truncate text-[11px] leading-tight text-zinc-500">{member.email}</span>
          </div>
        </TableCell>
        <TableCell className="px-3 py-2 align-middle">
          <Badge variant={roleBadgeVariant(member.companyRole)} className={badgeDense}>
            {member.companyRole.replace("_", " ")}
          </Badge>
        </TableCell>
        <TableCell className="px-3 py-2 align-middle">
          <Badge variant={member.aiEnabled ? "default" : "secondary"} className={badgeDense}>
            {member.aiEnabled ? "On" : "Off"}
          </Badge>
        </TableCell>
        <TableCell className="max-w-[14rem] px-3 py-2 align-middle">
          <div className="flex max-h-24 flex-wrap gap-0.5 overflow-y-auto pr-0.5">
            {(member.allowedPlatforms || []).slice(0, 6).map((p) => (
              <Badge key={p} variant="outline" className="h-5 border-zinc-200 px-1.5 text-[10px] font-medium text-zinc-600">
                {p}
              </Badge>
            ))}
            {(member.allowedPlatforms || []).length > 6 ? (
              <Badge variant="outline" className="h-5 border-zinc-200 px-1.5 text-[10px] font-medium text-zinc-600">
                +{member.allowedPlatforms.length - 6}
              </Badge>
            ) : null}
          </div>
        </TableCell>
        <TableCell className="px-3 py-2 align-middle">
          <Badge variant={member.membershipActive ? "default" : "secondary"} className={badgeDense}>
            {member.membershipActive ? "Active" : "Off"}
          </Badge>
        </TableCell>
        <TableCell className="px-3 py-2 text-right align-middle">
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-zinc-200 px-2.5 text-xs"
            disabled={!canEditThisMember}
            onClick={onEdit}
          >
            Edit
          </Button>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className="border-zinc-100 bg-zinc-50/70">
      <TableCell className="px-3 py-2 align-middle">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-zinc-900">{member.username}</span>
          <span className="truncate text-[11px] leading-tight text-zinc-500">{member.email}</span>
        </div>
      </TableCell>
      <TableCell className="px-3 py-2 align-middle">
        <Select value={role} onValueChange={(v) => setRole(v as CompanyRole)} disabled={!canEditRole}>
          <SelectTrigger className="h-8 border-zinc-200 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roleOptions.map((optionRole) => (
              <SelectItem key={optionRole} value={optionRole}>
                {optionRole}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="px-3 py-2 align-middle">
        <div className="flex items-center gap-2">
          <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} disabled={!canEditThisMember} />
          <span className="text-[11px] tabular-nums text-zinc-600">{aiEnabled ? "On" : "Off"}</span>
        </div>
      </TableCell>
      <TableCell className="max-w-[18rem] px-3 py-2 align-middle">
        <div className="flex max-h-28 flex-wrap gap-0.5 overflow-y-auto pr-0.5">
          {PLATFORM_OPTIONS.map((option) => {
            const selected = allowedPlatforms.includes(option.id);
            return (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant={selected ? "default" : "outline"}
                className="h-6 shrink-0 px-1.5 text-[10px] font-medium"
                disabled={!canEditThisMember}
                onClick={() => togglePlatform(option.id)}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      </TableCell>
      <TableCell className="px-3 py-2 align-middle">
        <div className="flex items-center gap-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} disabled={!canToggleMembershipActive} />
          <span className="text-[11px] text-zinc-600">{isActive ? "Active" : "Off"}</span>
        </div>
      </TableCell>
      <TableCell className="px-3 py-2 text-right align-middle">
        <div className="flex flex-wrap justify-end gap-1.5">
          <Button
            size="sm"
            className="h-7 px-2.5 text-xs"
            disabled={isSaving || !canEditThisMember}
            onClick={() =>
              onSave({
                role: canEditRole ? role : undefined,
                aiEnabled,
                allowedPlatforms,
                isActive,
              })
            }
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={isSaving} onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

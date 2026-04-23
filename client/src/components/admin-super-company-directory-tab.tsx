import { useMemo, useState, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { appCard } from "@/lib/app-surface";
import { cn } from "@/lib/utils";
import { Building2, Search, Users, Link2, Bot, FileText, Activity } from "lucide-react";

type CompanyOverviewPayload = {
  companies: Array<{
    profile: {
      id: number;
      name: string;
      slug: string;
      packageTier: "basic" | "advance";
      createdAt: string;
      updatedAt: string;
      hasCompanyKey: boolean;
      owner: {
        userId: number;
        username: string | null;
        email: string | null;
        isApproved: boolean | null;
      } | null;
    };
    metrics: {
      membersTotal: number;
      membersActive: number;
      admins: number;
      moderators: number;
      postsTotal: number;
      postsPublished: number;
      postsScheduled: number;
      postsDraft: number;
      socialConnections: number;
      channelConnections: number;
      channelConnectionsActive: number;
      auditEvents: number;
    };
    members: Array<{
      membershipId: number;
      userId: number;
      username: string;
      email: string;
      appRole: string;
      companyRole: "owner" | "moderator";
      aiEnabled: boolean;
      membershipActive: boolean;
      allowedPlatforms: string[];
      isApproved: boolean;
      joinedAt: string;
    }>;
    recentAudit: Array<{
      id: number;
      action: string;
      createdAt: string;
      changedByUserId: number | null;
      targetUserId: number | null;
      changedByUsername: string | null;
      targetUsername: string | null;
    }>;
  }>;
};

function roleVariant(role: "owner" | "moderator"): "default" | "secondary" | "outline" {
  if (role === "owner") return "default";
  return "outline";
}

export function AdminSuperCompanyDirectoryTab() {
  const [query, setQuery] = useState("");
  const overviewQuery = useQuery<CompanyOverviewPayload>({
    queryKey: ["admin", "super", "companies-overview"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/super/companies-overview");
      return res.json();
    },
  });

  const companies = overviewQuery.data?.companies ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((company) => {
      const matchCompany =
        company.profile.name.toLowerCase().includes(q) ||
        company.profile.slug.toLowerCase().includes(q) ||
        company.profile.owner?.username?.toLowerCase().includes(q) ||
        company.profile.owner?.email?.toLowerCase().includes(q);
      if (matchCompany) return true;
      return company.members.some(
        (member) =>
          member.username.toLowerCase().includes(q) ||
          member.email.toLowerCase().includes(q) ||
          member.companyRole.toLowerCase().includes(q),
      );
    });
  }, [companies, query]);

  return (
    <div className="space-y-5">
      <Card className={cn(appCard, "rounded-2xl border-zinc-200/90 shadow-sm")}>
        <CardHeader className="space-y-1 border-b border-zinc-100 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight text-zinc-900">
            <Building2 className="h-4 w-4 text-zinc-500" aria-hidden />
            Company directory
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed text-zinc-500 sm:text-sm">
            Super-admin view grouped by company profile, with nested members, posting usage, connections, and recent activity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label="Companies" value={companies.length} icon={Building2} />
            <MetricTile
              label="Members"
              value={companies.reduce((sum, c) => sum + c.metrics.membersTotal, 0)}
              icon={Users}
            />
            <MetricTile
              label="Posts"
              value={companies.reduce((sum, c) => sum + c.metrics.postsTotal, 0)}
              icon={FileText}
            />
            <MetricTile
              label="Activity Events"
              value={companies.reduce((sum, c) => sum + c.metrics.auditEvents, 0)}
              icon={Activity}
            />
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search companies, owners, or nested members..."
              className="h-9 border-zinc-200 pl-9 text-[13px]"
            />
          </div>
        </CardContent>
      </Card>

      {overviewQuery.isLoading && (
        <Card className={cn(appCard, "rounded-2xl border-zinc-200/90")}>
          <CardContent className="p-6 text-sm text-zinc-500">Loading company directory...</CardContent>
        </Card>
      )}

      {!overviewQuery.isLoading && filtered.length === 0 && (
        <Card className={cn(appCard, "rounded-2xl border-zinc-200/90")}>
          <CardContent className="p-6 text-sm text-zinc-500">
            No companies match this filter.
          </CardContent>
        </Card>
      )}

      {filtered.map((company) => (
        <Card key={company.profile.id} className={cn(appCard, "rounded-2xl border-zinc-200/90 shadow-sm")}>
          <CardHeader className="space-y-3 border-b border-zinc-100 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="truncate text-lg font-semibold tracking-tight text-zinc-900">
                  {company.profile.name}
                </CardTitle>
                <CardDescription className="mt-1 text-xs text-zinc-500">
                  slug/{company.profile.slug} · created {new Date(company.profile.createdAt).toLocaleDateString()}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={company.profile.packageTier === "advance" ? "default" : "secondary"} className="h-5 px-1.5 text-[10px] uppercase tracking-wide">
                  {company.profile.packageTier}
                </Badge>
                <Badge variant={company.profile.hasCompanyKey ? "outline" : "secondary"} className="h-5 px-1.5 text-[10px]">
                  {company.profile.hasCompanyKey ? "Company key set" : "No company key"}
                </Badge>
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                  {company.metrics.membersActive}/{company.metrics.membersTotal} active members
                </Badge>
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/70 px-3 py-2 text-[13px]">
              <span className="text-zinc-500">Owner: </span>
              {company.profile.owner ? (
                <span className="font-medium text-zinc-800">
                  {company.profile.owner.username ?? "Unknown"} ({company.profile.owner.email ?? "No email"})
                </span>
              ) : (
                <span className="text-zinc-600">No owner linked</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <StatBadge label="Admins" value={company.metrics.admins} />
              <StatBadge label="Moderators" value={company.metrics.moderators} />
              <StatBadge label="Posts" value={company.metrics.postsTotal} />
              <StatBadge label="Published" value={company.metrics.postsPublished} />
              <StatBadge label="Connections" value={company.metrics.socialConnections + company.metrics.channelConnectionsActive} />
              <StatBadge label="Audit events" value={company.metrics.auditEvents} />
            </div>

            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
              <Table className="text-[13px]">
                <TableHeader>
                  <TableRow className="border-zinc-100 bg-zinc-50/90 hover:bg-zinc-50/90">
                    <TableHead className="h-9 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Member
                    </TableHead>
                    <TableHead className="h-9 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Company role
                    </TableHead>
                    <TableHead className="h-9 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      AI
                    </TableHead>
                    <TableHead className="h-9 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Platforms
                    </TableHead>
                    <TableHead className="h-9 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Status
                    </TableHead>
                    <TableHead className="h-9 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Joined
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {company.members.length ? (
                    company.members.map((member) => (
                      <TableRow key={member.membershipId} className="border-zinc-100">
                        <TableCell className="px-3 py-2">
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-medium text-zinc-900">{member.username}</span>
                            <span className="truncate text-[11px] text-zinc-500">{member.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <Badge variant={roleVariant(member.companyRole)} className="h-5 px-1.5 text-[10px] capitalize">
                            {member.companyRole.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <Badge variant={member.aiEnabled ? "default" : "secondary"} className="h-5 px-1.5 text-[10px]">
                            {member.aiEnabled ? "On" : "Off"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[16rem] px-3 py-2">
                          <div className="flex max-h-14 flex-wrap gap-0.5 overflow-y-auto">
                            {member.allowedPlatforms.slice(0, 8).map((platform) => (
                              <Badge key={platform} variant="outline" className="h-5 px-1.5 text-[10px]">
                                {platform}
                              </Badge>
                            ))}
                            {member.allowedPlatforms.length > 8 && (
                              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                                +{member.allowedPlatforms.length - 8}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <Badge variant={member.membershipActive ? "default" : "secondary"} className="h-5 px-1.5 text-[10px]">
                            {member.membershipActive ? "Active" : "Off"}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-3 py-2 text-[11px] tabular-nums text-zinc-500">
                          {new Date(member.joinedAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-[13px] text-zinc-500">
                        No members found for this company.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Connection & posting usage
                </p>
                <div className="grid grid-cols-2 gap-2 text-[13px]">
                  <MiniStat icon={FileText} label="Total posts" value={company.metrics.postsTotal} />
                  <MiniStat icon={FileText} label="Scheduled" value={company.metrics.postsScheduled} />
                  <MiniStat icon={Link2} label="Social accounts" value={company.metrics.socialConnections} />
                  <MiniStat icon={Bot} label="Agent links active" value={company.metrics.channelConnectionsActive} />
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Recent activity log
                </p>
                <div className="space-y-1.5">
                  {company.recentAudit.length > 0 ? (
                    company.recentAudit.slice(0, 5).map((entry) => (
                      <div key={entry.id} className="flex items-start justify-between gap-2 text-[12px]">
                        <p className="text-zinc-700">
                          <span className="font-medium">{entry.changedByUsername ?? "System"}</span> {entry.action}
                          {entry.targetUsername ? ` → ${entry.targetUsername}` : ""}
                        </p>
                        <span className="shrink-0 tabular-nums text-zinc-500">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[12px] text-zinc-500">No recent activity events recorded.</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MetricTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 px-3 py-2">
      <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-lg font-semibold tracking-tight text-zinc-900">{value.toLocaleString()}</p>
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-sm font-semibold text-zinc-900">{value.toLocaleString()}</p>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-2.5 py-2">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-zinc-900">{value.toLocaleString()}</p>
    </div>
  );
}

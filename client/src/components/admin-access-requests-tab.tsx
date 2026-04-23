import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { appCard } from "@/lib/app-surface";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";

type AccessRequest = {
  id: number;
  email: string;
  fullName: string;
  company: string | null;
  message: string | null;
  packageTierRequested: string;
  status: string;
  paymentStatus: "pending" | "trialing" | "paid" | "failed";
  trialEndsAt: string | null;
  approvedUserId: number | null;
  createdAt: string;
};

export function AdminAccessRequestsTab({ canApprove = false }: { canApprove?: boolean }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  /** Matches server `users.create` (super admin has it; org admins typically do not). */
  const canApproveRequests = canApprove;
  const [approveId, setApproveId] = useState<number | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [packageTier, setPackageTier] = useState<"basic" | "advance">("basic");

  const { data, isLoading } = useQuery<{ requests: AccessRequest[] }>({
    queryKey: ["admin", "access-requests", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/access-requests?status=pending");
      return res.json();
    },
    enabled: Boolean(user?.id),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/access-requests/${id}/reject`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || "Reject failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "access-requests"] });
      toast({ title: "Request rejected" });
    },
    onError: (e: Error) => {
      toast({ title: "Reject failed", description: e.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (payload: { id: number; username: string; password: string; packageTier: "basic" | "advance" }) => {
      const res = await fetch(`/api/admin/access-requests/${payload.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: payload.username,
          password: payload.password,
          packageTier: payload.packageTier,
          role: "user",
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || "Approve failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "access-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setApproveId(null);
      setUsername("");
      setPassword("");
      toast({ title: "User created", description: "Share credentials with the client securely." });
    },
    onError: (e: Error) => {
      toast({ title: "Approve failed", description: e.message, variant: "destructive" });
    },
  });

  const openApprove = (r: AccessRequest) => {
    setApproveId(r.id);
    setUsername("");
    setPassword("");
    setPackageTier(r.packageTierRequested === "advance" ? "advance" : "basic");
  };

  return (
    <div className="space-y-6">
      {!canApproveRequests && (
        <p className="text-sm text-muted-foreground border border-dashed rounded-lg px-3 py-2 bg-muted/30">
          You can review requests, but <strong>Approve</strong> is hidden until a super admin grants you account
          creation (<code className="text-xs">users.create</code>).
        </p>
      )}
      <Card className={appCard}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-zinc-900">Pending access requests</CardTitle>
          <CardDescription className="text-sm leading-snug">
            Approve to create a login after payment status is <strong>trialing</strong> or <strong>paid</strong>
            (requires <strong>account creation</strong> permission). Configure the notify inbox under{" "}
            <strong>Email</strong>; use <code className="text-[11px]">SMTP_*</code> in env for delivery. Anyone with{" "}
            <strong>users.view</strong> can reject pending requests.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !data?.requests.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No pending requests.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.email}</TableCell>
                    <TableCell>
                      <div className="font-medium text-zinc-900">{r.fullName}</div>
                      {r.company && (
                        <div className="text-xs text-zinc-500">{r.company}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.packageTierRequested}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.paymentStatus === "pending" ? "secondary" : "default"}>
                        {r.paymentStatus}
                      </Badge>
                      {r.trialEndsAt && (
                        <div className="text-[11px] text-muted-foreground mt-1">
                          trial ends {new Date(r.trialEndsAt).toLocaleDateString()}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {canApproveRequests && (
                        <Button size="sm" variant="default" onClick={() => openApprove(r)}>
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejectMutation.mutate(r.id)}
                        disabled={rejectMutation.isPending}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={approveId !== null} onOpenChange={(o) => !o && setApproveId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create user from request</DialogTitle>
            <DialogDescription>
              Sets the account to <strong>approved</strong> so the client can log in immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>Temporary password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label>Package tier</Label>
              <Select value={packageTier} onValueChange={(v) => setPackageTier(v as "basic" | "advance")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic (no AI)</SelectItem>
                  <SelectItem value="advance">Advance (AI + OpenRouter)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveId(null)}>
              Cancel
            </Button>
            <Button
              disabled={
                approveMutation.isPending || !username.trim() || password.length < 8 || approveId === null
              }
              onClick={() => {
                if (approveId === null) return;
                approveMutation.mutate({ id: approveId, username: username.trim(), password, packageTier });
              }}
            >
              {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

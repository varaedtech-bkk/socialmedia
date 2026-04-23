import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { appCard } from "@/lib/app-surface";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Search, Plus, Edit, Trash2, Check, X, RotateCcw, Eraser } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { formatRoleLabel, normalizeAdminRole, type AdminRole } from "@/lib/admin-access";

type AdminUserRow = {
  id: number;
  username: string;
  email: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  isApproved: boolean;
  packageTier: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

function getRoleBadgeVariant(role: string): "default" | "secondary" | "destructive" {
  switch (normalizeAdminRole(role)) {
    case "super_admin":
      return "destructive";
    case "admin":
      return "default";
    default:
      return "secondary";
  }
}

function AssignableRoleSelect({
  value,
  onChange,
  assignableRoles,
  triggerClassName,
}: {
  value: AdminRole;
  onChange: (v: AdminRole) => void;
  assignableRoles: AdminRole[];
  triggerClassName?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as AdminRole)}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {assignableRoles.map((r) => (
          <SelectItem key={r} value={r}>
            {formatRoleLabel(r)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CreateUserForm({
  onSubmit,
  isLoading,
  assignableRoles,
}: {
  onSubmit: (data: {
    username: string;
    email: string;
    password: string;
    role: string;
    isApproved: boolean;
    packageTier: "basic" | "advance";
  }) => void;
  isLoading: boolean;
  assignableRoles: AdminRole[];
}) {
  const defaultRole = assignableRoles[0] ?? "user";
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: defaultRole as string,
    isApproved: true,
    packageTier: "basic" as "basic" | "advance",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          required
          placeholder="johndoe"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
          placeholder="john@example.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required
          minLength={8}
          placeholder="Minimum 8 characters"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <AssignableRoleSelect
          value={normalizeAdminRole(formData.role)}
          onChange={(r) => setFormData({ ...formData, role: r })}
          assignableRoles={assignableRoles}
        />
        <p className="text-xs text-muted-foreground">
          Roles listed here match what your account is allowed to assign.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Workspace package</Label>
        <Select
          value={formData.packageTier}
          onValueChange={(value) => setFormData({ ...formData, packageTier: value as "basic" | "advance" })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="basic">Basic — posting & scheduling (no AI)</SelectItem>
            <SelectItem value="advance">Advance — AI drafts + Telegram /ai (needs OpenRouter)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isApproved"
          checked={formData.isApproved}
          onChange={(e) => setFormData({ ...formData, isApproved: e.target.checked })}
          className="rounded border"
        />
        <Label htmlFor="isApproved" className="font-normal cursor-pointer">
          Approved (can log in immediately)
        </Label>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Creating…
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Create user
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

function UserTableRow({
  user,
  isEditing,
  canEdit,
  assignableRoles,
  onEdit,
  onCancel,
  onUpdate,
  onDelete,
  isUpdating,
  isDeleting,
  isDeletedView = false,
  onRestore,
  onPermanentDelete,
  isRestoring = false,
  isPermanentDeleting = false,
}: {
  user: AdminUserRow;
  isEditing: boolean;
  canEdit: boolean;
  assignableRoles: AdminRole[];
  onEdit: () => void;
  onCancel: () => void;
  onUpdate: (updates: Partial<AdminUserRow>) => void;
  onDelete: () => void;
  isUpdating: boolean;
  isDeleting: boolean;
  isDeletedView?: boolean;
  onRestore?: () => void;
  onPermanentDelete?: () => void;
  isRestoring?: boolean;
  isPermanentDeleting?: boolean;
}) {
  const [role, setRole] = useState<AdminRole>(normalizeAdminRole(user.role));
  const [isActive, setIsActive] = useState(user.isActive);
  const [isApproved, setIsApproved] = useState(user.isApproved !== false);
  const [packageTier, setPackageTier] = useState<"basic" | "advance">(
    user.packageTier === "advance" ? "advance" : "basic",
  );

  useEffect(() => {
    if (isEditing) {
      setRole(normalizeAdminRole(user.role));
      setIsActive(user.isActive);
      setIsApproved(user.isApproved !== false);
      setPackageTier(user.packageTier === "advance" ? "advance" : "basic");
    }
  }, [isEditing, user]);

  const handleSave = () => {
    if (!assignableRoles.includes(role)) return;
    onUpdate({ role, isActive, isApproved, packageTier });
  };

  const tierLabel = user.packageTier === "advance" ? "Advance" : "Basic";

  return (
    <TableRow>
      <TableCell>
        <div>
          <div className="font-medium">{user.username}</div>
          <div className="text-sm text-muted-foreground">{user.email}</div>
        </div>
      </TableCell>
      <TableCell>
        {isEditing ? (
          <AssignableRoleSelect
            value={role}
            onChange={setRole}
            assignableRoles={assignableRoles}
            triggerClassName="w-[160px]"
          />
        ) : (
          <Badge variant={getRoleBadgeVariant(user.role)}>{formatRoleLabel(user.role)}</Badge>
        )}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <Select value={packageTier} onValueChange={(v) => setPackageTier(v as "basic" | "advance")}>
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="basic">Basic</SelectItem>
              <SelectItem value="advance">Advance</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Badge variant={user.packageTier === "advance" ? "default" : "secondary"} className="font-normal">
            {tierLabel}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span>Active</span>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span>Approved</span>
              <Switch checked={isApproved} onCheckedChange={setIsApproved} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <Badge variant={user.isActive ? "default" : "secondary"}>
              {user.isActive ? "Active" : "Inactive"}
            </Badge>
            <Badge variant={user.isApproved === false ? "destructive" : "outline"}>
              {user.isApproved === false ? "Pending approval" : "Approved"}
            </Badge>
          </div>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
        {isDeletedView && user.deletedAt
          ? new Date(user.deletedAt).toLocaleDateString()
          : new Date(user.createdAt).toLocaleDateString()}
      </TableCell>
      <TableCell className="text-right">
        {canEdit && (
          <div className="flex items-center justify-end gap-2">
            {isDeletedView ? (
              <>
                <Button size="sm" variant="ghost" onClick={onRestore} disabled={isRestoring}>
                  {isRestoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={onPermanentDelete} disabled={isPermanentDeleting}>
                  {isPermanentDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Eraser className="h-4 w-4 text-destructive" />
                  )}
                </Button>
              </>
            ) : isEditing ? (
              <>
                <Button size="sm" variant="ghost" onClick={handleSave} disabled={isUpdating}>
                  {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancel} disabled={isUpdating}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={onEdit}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={onDelete} disabled={isDeleting}>
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                </Button>
              </>
            )}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

export function AdminUserManagementTab({
  viewerId,
  assignableRoles,
  canCreateUsers,
}: {
  viewerId: number | undefined;
  assignableRoles: AdminRole[];
  canCreateUsers: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createFormKey, setCreateFormKey] = useState(0);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [deletedView, setDeletedView] = useState<"active" | "deleted">("active");

  const { data, isLoading } = useQuery<{
    users: AdminUserRow[];
    pagination: { page: number; total: number; totalPages: number };
  }>({
    queryKey: ["admin", "users", viewerId, page, search, roleFilter, deletedView],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        deleted: deletedView === "deleted" ? "true" : "false",
        ...(search && { search }),
        ...(roleFilter !== "all" && { role: roleFilter }),
      });
      const res = await apiRequest("GET", `/api/admin/users?${params}`);
      return res.json();
    },
    enabled: Boolean(viewerId),
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<AdminUserRow> }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setEditingUserId(null);
      toast({ title: "User updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({ title: "User removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const restoreUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/users/${id}/restore`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({ title: "User restored" });
    },
    onError: (error: Error) => {
      toast({ title: "Restore failed", description: error.message, variant: "destructive" });
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${id}/permanent`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({ title: "User permanently deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Permanent delete failed", description: error.message, variant: "destructive" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: {
      username: string;
      email: string;
      password: string;
      role: string;
      isApproved: boolean;
      packageTier: "basic" | "advance";
    }) => {
      const res = await apiRequest("POST", "/api/admin/users", userData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setIsCreateDialogOpen(false);
      toast({ title: "User created" });
    },
    onError: (error: Error) => {
      toast({ title: "Create failed", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by username or email…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="user">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="super_admin">Super admin</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={deletedView}
            onValueChange={(v) => {
              setDeletedView(v as "active" | "deleted");
              setPage(1);
              setEditingUserId(null);
            }}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active users</SelectItem>
              <SelectItem value="deleted">Deleted users</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {canCreateUsers && deletedView === "active" && (
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={(open) => {
              setIsCreateDialogOpen(open);
              if (open) setCreateFormKey((k) => k + 1);
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2 shrink-0">
                <Plus className="h-4 w-4" />
                Create user
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create user</DialogTitle>
                <DialogDescription>
                  Creates a login with the selected workspace package and access role (limited to roles you are
                  allowed to assign).
                </DialogDescription>
              </DialogHeader>
              <CreateUserForm
                key={createFormKey}
                onSubmit={(data) => createUserMutation.mutate(data)}
                isLoading={createUserMutation.isPending}
                assignableRoles={assignableRoles}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!canCreateUsers && (
        <p className="text-sm text-muted-foreground border border-dashed rounded-lg px-3 py-2 bg-muted/30">
          You can view and edit users, but only a <strong>super admin</strong> can create accounts or approve access
          requests (requires <code className="text-xs">users.create</code>).
        </p>
      )}

      <Card className={cn(appCard, "overflow-hidden")}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-zinc-900">Directory</CardTitle>
          <CardDescription className="text-zinc-600">
            {deletedView === "active"
              ? "Roles control admin panel access; packages control AI (Advance) vs posting-only (Basic)."
              : "Soft-deleted accounts can be restored or permanently removed."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Access role</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>{deletedView === "deleted" ? "Deleted" : "Joined"}</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      No users match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.users.map((user) => {
                    const isEditing = editingUserId === user.id;
                    const canEdit = currentUser?.role === "super_admin" || currentUser?.id !== user.id;
                    return (
                      <UserTableRow
                        key={user.id}
                        user={user}
                        isEditing={isEditing}
                        canEdit={canEdit}
                        assignableRoles={assignableRoles}
                        onEdit={() => setEditingUserId(user.id)}
                        onCancel={() => setEditingUserId(null)}
                        onUpdate={(updates) => updateUserMutation.mutate({ id: user.id, updates })}
                        onDelete={() => deleteUserMutation.mutate(user.id)}
                        isUpdating={updateUserMutation.isPending}
                        isDeleting={deleteUserMutation.isPending}
                        isDeletedView={deletedView === "deleted"}
                        onRestore={() => restoreUserMutation.mutate(user.id)}
                        onPermanentDelete={() => permanentDeleteMutation.mutate(user.id)}
                        isRestoring={restoreUserMutation.isPending}
                        isPermanentDeleting={permanentDeleteMutation.isPending}
                      />
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {data && data.pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>
            Page {page} of {data.pagination.totalPages} · {data.pagination.total} users
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
              disabled={page === data.pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

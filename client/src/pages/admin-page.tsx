import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
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
import { 
  Settings, 
  Shield, 
  CreditCard, 
  FileText, 
  Loader2, 
  Users, 
  BarChart3,
  Search,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  AlertCircle,
  TrendingUp,
  UserCheck,
  Calendar,
  Activity,
  Zap,
  Lock,
  Globe,
  ArrowLeft
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useState } from "react";
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
import { Link } from "wouter";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";

// Types
type FeatureFlag = {
  key: string;
  value: boolean;
  description: string | null;
  updatedAt: string;
};

type User = {
  id: number;
  username: string;
  email: string;
  role: "user" | "admin" | "super_admin";
  permissions: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type Statistics = {
  users: {
    total: number;
    active: number;
    roles: Array<{ role: string; count: number }>;
  };
  posts: {
    total: number;
    published: number;
    scheduled: number;
  };
  subscriptions: {
    total: number;
    active: number;
  };
};

type AdminConfig = {
  roles: Record<string, any>;
  availableFeatures: Array<{
    id: string;
    label: string;
    description: string;
    path: string;
  }>;
  userPermissions: string[];
  userRole: string;
};

const COLORS = {
  user: "#3b82f6",
  admin: "#8b5cf6",
  super_admin: "#ef4444",
};

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  subscriptions_enabled: <CreditCard className="h-5 w-5" />,
  post_quota_enabled: <FileText className="h-5 w-5" />,
  stripe_payments_enabled: <Shield className="h-5 w-5" />,
};

const getRoleBadgeVariant = (role: string): "default" | "secondary" | "destructive" => {
  switch (role) {
    case "super_admin":
      return "destructive";
    case "admin":
      return "default";
    default:
      return "secondary";
  }
};

// Feature Flags Tab Component
function FeatureFlagsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ features: FeatureFlag[] }>({
    queryKey: ["admin", "features"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/features");
      if (!res.ok) throw new Error("Failed to fetch feature flags");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      const res = await apiRequest("POST", `/api/admin/features/${key}`, { value });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update feature flag");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "features"] });
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      toast({
        title: "Feature flag updated",
        description: `${variables.key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())} has been ${variables.value ? "enabled" : "disabled"}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update feature flag",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {data?.features.map((feature) => {
          const isUpdating = updateMutation.isPending && updateMutation.variables?.key === feature.key;
          const featureName = feature.key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
          
          return (
            <Card key={feature.key} className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      {FEATURE_ICONS[feature.key] || <Zap className="h-5 w-5" />}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{featureName}</CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        {feature.description || "Feature flag"}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isUpdating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={feature.value}
                        onCheckedChange={(checked) => {
                          updateMutation.mutate({ key: feature.key, value: checked });
                        }}
                        disabled={isUpdating}
                      />
                      <Label className="text-sm font-medium">
                        {feature.value ? (
                          <span className="text-green-600 dark:text-green-400">Enabled</span>
                        ) : (
                          <span className="text-muted-foreground">Disabled</span>
                        )}
                      </Label>
                    </div>
                  </div>
                  <Badge variant={feature.value ? "default" : "secondary"} className="ml-auto">
                    {feature.value ? "Active" : "Inactive"}
                  </Badge>
                </div>
                {feature.updatedAt && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Last updated: {new Date(feature.updatedAt).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// User Management Tab Component
function UserManagementTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<{
    users: User[];
    pagination: { page: number; total: number; totalPages: number };
  }>({
    queryKey: ["admin", "users", page, search, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(search && { search }),
        ...(roleFilter !== "all" && { role: roleFilter }),
      });
      const res = await apiRequest("GET", `/api/admin/users?${params}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<User> }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}`, updates);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setEditingUserId(null);
      toast({ title: "User updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${id}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({ title: "User deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: {
      username: string;
      email: string;
      password: string;
      role: string;
    }) => {
      const res = await apiRequest("POST", "/api/admin/users", userData);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setIsCreateDialogOpen(false);
      toast({ title: "User created successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by name or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Add a new user to the system with specified role and permissions.
              </DialogDescription>
            </DialogHeader>
            <CreateUserForm
              onSubmit={(data) => createUserMutation.mutate(data)}
              isLoading={createUserMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Manage user accounts, roles, and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No users found
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
                      onEdit={() => setEditingUserId(user.id)}
                      onCancel={() => setEditingUserId(null)}
                      onUpdate={(updates) => {
                        updateUserMutation.mutate({ id: user.id, updates });
                      }}
                      onDelete={() => deleteUserMutation.mutate(user.id)}
                      isUpdating={updateUserMutation.isPending}
                      isDeleting={deleteUserMutation.isPending}
                    />
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing page {page} of {data.pagination.totalPages} ({data.pagination.total} total users)
          </p>
          <div className="flex items-center gap-2">
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

// User Table Row Component
function UserTableRow({
  user,
  isEditing,
  canEdit,
  onEdit,
  onCancel,
  onUpdate,
  onDelete,
  isUpdating,
  isDeleting,
}: {
  user: User;
  isEditing: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onUpdate: (updates: Partial<User>) => void;
  onDelete: () => void;
  isUpdating: boolean;
  isDeleting: boolean;
}) {
  const [role, setRole] = useState(user.role);
  const [isActive, setIsActive] = useState(user.isActive);

  const handleSave = () => {
    onUpdate({ role, isActive });
  };

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
          <Select 
            value={role} 
            onValueChange={(value) => setRole(value as "user" | "admin" | "super_admin")}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Badge variant={getRoleBadgeVariant(user.role)}>
            {user.role.replace("_", " ")}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        ) : (
          <Badge variant={user.isActive ? "default" : "secondary"}>
            {user.isActive ? "Active" : "Inactive"}
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {new Date(user.createdAt).toLocaleDateString()}
      </TableCell>
      <TableCell className="text-right">
        {canEdit && (
          <div className="flex items-center justify-end gap-2">
            {isEditing ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSave}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onCancel}
                  disabled={isUpdating}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onEdit}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-destructive" />
                  )}
                </Button>
              </>
            )}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

// Create User Form Component
function CreateUserForm({
  onSubmit,
  isLoading,
}: {
  onSubmit: (data: { username: string; email: string; password: string; role: string }) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "user",
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
        <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
          <SelectTrigger id="role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Create User
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

// Statistics Tab Component
function StatisticsTab() {
  const { data, isLoading } = useQuery<Statistics>({
    queryKey: ["admin", "statistics"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/statistics");
      if (!res.ok) throw new Error("Failed to fetch statistics");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const roleChartData = data?.users.roles.map((role) => ({
    name: role.role.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase()),
    value: role.count,
    fill: COLORS[role.role as keyof typeof COLORS] || "#6b7280",
  })) || [];

  const postsData = [
    { name: "Published", value: data?.posts.published || 0, fill: "#10b981" },
    { name: "Scheduled", value: data?.posts.scheduled || 0, fill: "#3b82f6" },
    { name: "Draft", value: (data?.posts.total || 0) - (data?.posts.published || 0) - (data?.posts.scheduled || 0), fill: "#6b7280" },
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.users.total || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-green-600 dark:text-green-400">{data?.users.active || 0}</span> active
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.posts.total || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-green-600 dark:text-green-400">{data?.posts.published || 0}</span> published
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscriptions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.subscriptions.total || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-green-600 dark:text-green-400">{data?.subscriptions.active || 0}</span> active
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled Posts</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.posts.scheduled || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Pending publication
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Role Distribution</CardTitle>
            <CardDescription>User roles across the platform</CardDescription>
          </CardHeader>
          <CardContent>
            {roleChartData.length > 0 ? (
              <ChartContainer
                config={{
                  users: { label: "Users", color: "hsl(var(--chart-1))" },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={roleChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {roleChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Post Status</CardTitle>
            <CardDescription>Distribution of post statuses</CardDescription>
          </CardHeader>
          <CardContent>
            {postsData.length > 0 ? (
              <ChartContainer
                config={{
                  published: { label: "Published", color: "#10b981" },
                  scheduled: { label: "Scheduled", color: "#3b82f6" },
                  draft: { label: "Draft", color: "#6b7280" },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={postsData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" fill="#8884d8" radius={[8, 8, 0, 0]}>
                      {postsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No posts available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Main Admin Page Component
export default function AdminPage() {
  const { user } = useAuth();
  const { data: config } = useQuery<AdminConfig>({
    queryKey: ["admin", "config"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/config");
      if (!res.ok) throw new Error("Failed to fetch admin config");
      return res.json();
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              You must be logged in to access the admin panel.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="container max-w-7xl mx-auto py-6 space-y-6">
          {/* Header with Back Button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="gap-2"
              >
                <Link href="/app">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Dashboard
                </Link>
              </Button>
              <div className="h-6 w-px bg-border hidden sm:block" />
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Settings className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-primary" />
                  </div>
                  <span className="whitespace-nowrap">Admin Panel</span>
                </h1>
                <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base md:text-lg">
                  Manage users, features, and system settings
                </p>
              </div>
            </div>
            {config && (
              <Badge variant="outline" className="text-sm px-3 py-1 shrink-0">
                <Lock className="h-3 w-3 mr-1" />
                {config.userRole.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
              </Badge>
            )}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="statistics" className="space-y-4 sm:space-y-6">
            <TabsList className="grid w-full sm:max-w-md grid-cols-3">
              <TabsTrigger value="statistics" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Statistics</span>
                <span className="sm:hidden">Stats</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                Users
              </TabsTrigger>
              <TabsTrigger value="features" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                <Zap className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Features</span>
                <span className="sm:hidden">Flags</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="statistics" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
              <StatisticsTab />
            </TabsContent>

            <TabsContent value="users" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
              <UserManagementTab />
            </TabsContent>

            <TabsContent value="features" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
              <FeatureFlagsTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

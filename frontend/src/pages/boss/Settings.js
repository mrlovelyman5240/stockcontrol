import { useState, useEffect } from 'react';
import LoadingScreen from '../../components/LoadingScreen';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { settingsApi, usersApi, authApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';
import {
  Settings, DollarSign, Clock, Package, Loader2, Save, UserPlus,
  Users, Truck, Headphones, Lock, Trash2, AlertTriangle, Pencil, User
} from 'lucide-react';

const BossSettings = () => {
  const { createUser, user: currentUser, refreshUser } = useAuth();
  const [settings, setSettings] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // My Profile
  const [myProfile, setMyProfile] = useState({ full_name: '', username: '', password: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  // Add User dialog
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', fullName: '', password: '', role: '' });
  const [creatingUser, setCreatingUser] = useState(false);

  // Edit User dialog
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ full_name: '', username: '', password: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete User dialog
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (currentUser) {
      setMyProfile({
        full_name: currentUser.full_name || '',
        username: currentUser.username || '',
        password: ''
      });
    }
  }, [currentUser]);

  const fetchData = async () => {
    try {
      const [settingsRes, usersRes] = await Promise.all([
        settingsApi.get(),
        usersApi.getAll()
      ]);
      setSettings(settingsRes.data);
      setAllUsers(usersRes.data);
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  // ===== My Profile =====
  const handleSaveMyProfile = async () => {
    if (!myProfile.full_name.trim() || !myProfile.username.trim()) {
      toast.error('Full Name and Username are required');
      return;
    }
    if (myProfile.password && myProfile.password.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }
    setSavingProfile(true);
    try {
      const payload = { full_name: myProfile.full_name, username: myProfile.username };
      if (myProfile.password) payload.password = myProfile.password;
      await usersApi.update(currentUser.id, payload);
      toast.success('Profile updated');
      setMyProfile(prev => ({ ...prev, password: '' }));
      await refreshUser();
      fetchData();
    } catch (error) {
      const msg = error.response?.data?.detail;
      toast.error(typeof msg === 'string' ? msg : 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  // ===== Compensation =====
  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsApi.update({
        payment_method: settings.payment_method,
        hourly_rate: settings.hourly_rate,
        per_delivery_rate: settings.per_delivery_rate,
        per_pickup_rate: settings.per_pickup_rate,
      });
      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const togglePaymentMethod = () => {
    setSettings({
      ...settings,
      payment_method: settings.payment_method === 'hourly' ? 'per_package' : 'hourly',
    });
  };

  // ===== Create User =====
  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.password || !newUser.role) {
      toast.error('Please fill in all required fields');
      return;
    }
    setCreatingUser(true);
    try {
      const result = await createUser(newUser.username, newUser.password, newUser.role, newUser.fullName);
      if (result.success) {
        toast.success(`User "${newUser.fullName || newUser.username}" created`);
        setNewUser({ username: '', fullName: '', password: '', role: '' });
        setIsUserDialogOpen(false);
        fetchData();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error('Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  // ===== Edit User =====
  const openEditDialog = (u) => {
    setEditTarget(u);
    setEditForm({ full_name: u.full_name || '', username: u.username || '', password: '' });
  };

  const handleSaveEdit = async () => {
    if (!editForm.full_name.trim() || !editForm.username.trim()) {
      toast.error('Full Name and Username are required');
      return;
    }
    if (editForm.password && editForm.password.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }
    setSavingEdit(true);
    try {
      const payload = { full_name: editForm.full_name, username: editForm.username };
      if (editForm.password) payload.password = editForm.password;
      await usersApi.update(editTarget.id, payload);
      toast.success(`User "${editForm.full_name}" updated`);
      setEditTarget(null);
      fetchData();
    } catch (error) {
      const msg = error.response?.data?.detail;
      toast.error(typeof msg === 'string' ? msg : 'Failed to update user');
    } finally {
      setSavingEdit(false);
    }
  };

  // ===== Delete User =====
  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await usersApi.delete(deleteTarget.id);
      toast.success(`User "${deleteTarget.full_name || deleteTarget.username}" deleted`);
      setDeleteTarget(null);
      fetchData();
    } catch (error) {
      const msg = error.response?.data?.detail;
      toast.error(typeof msg === 'string' ? msg : 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const staffUsers = allUsers.filter(u => u.id !== currentUser?.id);
  const roleIcon = (role) => role === 'driver' ? Truck : role === 'customer_service' ? Headphones : Users;
  const roleBadge = (role) => role === 'driver' ? 'Driver' : role === 'customer_service' ? 'CS' : 'Boss';

  if (loading) return <LoadingScreen />;

  return (
    <div className="p-4 max-w-2xl mx-auto pb-28" data-testid="boss-settings">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your business</p>
        </div>
      </div>

      {/* ========== My Profile ========== */}
      <Card className="mb-6" data-testid="my-profile-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            My Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-sm">Full Name</Label>
            <Input
              value={myProfile.full_name}
              onChange={(e) => setMyProfile({ ...myProfile, full_name: e.target.value })}
              placeholder="Your display name"
              data-testid="my-fullname-input"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Username (login)</Label>
            <Input
              value={myProfile.username}
              onChange={(e) => setMyProfile({ ...myProfile, username: e.target.value })}
              placeholder="Login username"
              data-testid="my-username-input"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">New Password <span className="text-muted-foreground text-xs">(leave blank to keep current)</span></Label>
            <Input
              type="password"
              value={myProfile.password}
              onChange={(e) => setMyProfile({ ...myProfile, password: e.target.value })}
              placeholder="Enter new password"
              data-testid="my-password-input"
            />
          </div>
          <Button className="w-full" onClick={handleSaveMyProfile} disabled={savingProfile} data-testid="save-my-profile-btn">
            {savingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Profile
          </Button>
        </CardContent>
      </Card>

      {/* ========== User Management ========== */}
      <Card className="mb-6" data-testid="user-management-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Staff
          </CardTitle>
          <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="add-user-btn">
                <UserPlus className="h-4 w-4 mr-2" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-1">
                  <Label>Full Name</Label>
                  <Input value={newUser.fullName} onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })} placeholder="e.g. Mustafa Y." data-testid="new-user-fullname" />
                  <p className="text-xs text-muted-foreground">Displayed throughout the app</p>
                </div>
                <div className="space-y-1">
                  <Label>Username (for login)</Label>
                  <Input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} placeholder="e.g. mustafa123" data-testid="new-user-username" />
                </div>
                <div className="space-y-1">
                  <Label>Password</Label>
                  <Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Min 4 characters" data-testid="new-user-password" />
                </div>
                <div className="space-y-1">
                  <Label>Role</Label>
                  <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                    <SelectTrigger data-testid="new-user-role"><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer_service"><div className="flex items-center gap-2"><Headphones className="h-4 w-4" /> Customer Service</div></SelectItem>
                      <SelectItem value="driver"><div className="flex items-center gap-2"><Truck className="h-4 w-4" /> Driver</div></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleCreateUser} disabled={creatingUser} data-testid="create-user-btn">
                  {creatingUser ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                  Create User
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {staffUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No staff accounts yet. Click "Add" to create one.</p>
          ) : (
            <ScrollArea className="max-h-[280px]">
              <div className="space-y-2">
                {staffUsers.map((u) => {
                  const Icon = roleIcon(u.role);
                  return (
                    <div key={u.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg" data-testid={`user-row-${u.id}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <span className="font-medium text-sm block truncate">{u.full_name || u.username}</span>
                          <span className="text-[11px] text-muted-foreground block">@{u.username}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="outline" className="text-[10px] mr-1">{roleBadge(u.role)}</Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(u)} data-testid={`edit-user-${u.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => setDeleteTarget(u)} data-testid={`delete-user-${u.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ========== Edit User Dialog ========== */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5" /> Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label>Full Name</Label>
              <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} data-testid="edit-fullname-input" />
            </div>
            <div className="space-y-1">
              <Label>Username (login)</Label>
              <Input value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} data-testid="edit-username-input" />
            </div>
            <div className="space-y-1">
              <Label>New Password <span className="text-muted-foreground text-xs">(leave blank to keep current)</span></Label>
              <Input type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="Enter new password" data-testid="edit-password-input" />
            </div>
            <Button className="w-full" onClick={handleSaveEdit} disabled={savingEdit} data-testid="save-edit-btn">
              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========== Delete Confirmation Dialog ========== */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Delete User
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteTarget?.full_name || deleteTarget?.username}</strong>? This action cannot be undone.
          </p>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)} data-testid="cancel-delete-btn">Cancel</Button>
            <Button variant="destructive" className="flex-1 gap-1" onClick={handleDeleteUser} disabled={deleting} data-testid="confirm-delete-btn">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========== Compensation ========== */}
      <Card className="mb-6" data-testid="payment-method-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Compensation Method
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {settings?.payment_method === 'hourly' ? (
                <Clock className="h-5 w-5 text-amber-500" />
              ) : (
                <Package className="h-5 w-5 text-emerald-500" />
              )}
              <div>
                <Label className="text-base">
                  {settings?.payment_method === 'hourly' ? 'Hourly Rate' : 'Per Package'}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {settings?.payment_method === 'hourly' ? 'Pay drivers by the hour' : 'Pay per delivery & pickup'}
                </p>
              </div>
            </div>
            <Switch checked={settings?.payment_method === 'hourly'} onCheckedChange={togglePaymentMethod} data-testid="payment-method-toggle" />
          </div>

          {settings?.payment_method === 'hourly' ? (
            <div className="space-y-2">
              <Label className="text-sm">Rate per Hour</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input type="number" className="pl-7" value={settings?.hourly_rate || ''} onChange={(e) => setSettings({ ...settings, hourly_rate: parseFloat(e.target.value) || 0 })} data-testid="hourly-rate-input" />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-2"><Truck className="h-4 w-4" /> Delivery Rate</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input type="number" className="pl-7" value={settings?.per_delivery_rate || ''} onChange={(e) => setSettings({ ...settings, per_delivery_rate: parseFloat(e.target.value) || 0 })} data-testid="delivery-rate-input" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-2"><Package className="h-4 w-4" /> Pickup Rate</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input type="number" className="pl-7" value={settings?.per_pickup_rate || ''} onChange={(e) => setSettings({ ...settings, per_pickup_rate: parseFloat(e.target.value) || 0 })} data-testid="pickup-rate-input" />
                </div>
              </div>
            </div>
          )}

          <Button className="w-full mt-4" onClick={handleSave} disabled={saving} data-testid="save-settings-btn">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Compensation Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default BossSettings;

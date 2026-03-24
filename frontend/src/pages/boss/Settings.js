import { useState, useEffect } from 'react';
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
import { formatCurrency, getRoleLabel } from '../../lib/utils';
import { toast } from 'sonner';
import { Settings, DollarSign, Clock, Package, Loader2, Save, UserPlus, Users, Truck, Headphones, Lock, Trash2, AlertTriangle } from 'lucide-react';

const BossSettings = () => {
  const { createUser, user: currentUser } = useAuth();
  const [settings, setSettings] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: '' });
  const [creatingUser, setCreatingUser] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

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

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsApi.update({
        payment_method: settings.payment_method,
        hourly_rate: settings.hourly_rate,
        per_delivery_rate: settings.per_delivery_rate,
        per_pickup_rate: settings.per_pickup_rate,
      });
      toast.success('Settings saved successfully');
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

  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.password || !newUser.role) {
      toast.error('Please fill in all fields');
      return;
    }

    setCreatingUser(true);
    try {
      const result = await createUser(newUser.username, newUser.password, newUser.role);
      if (result.success) {
        toast.success(`User "${newUser.username}" created successfully`);
        setNewUser({ username: '', password: '', role: '' });
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

  const handleChangePassword = async () => {
    if (!passwordForm.current || !passwordForm.newPass) {
      toast.error('Please fill in all password fields');
      return;
    }
    if (passwordForm.newPass !== passwordForm.confirm) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordForm.newPass.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }
    setChangingPassword(true);
    try {
      await authApi.changePassword(passwordForm.current, passwordForm.newPass);
      toast.success('Password changed successfully');
      setPasswordForm({ current: '', newPass: '', confirm: '' });
    } catch (error) {
      const msg = error.response?.data?.detail;
      toast.error(typeof msg === 'string' ? msg : 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await usersApi.delete(deleteTarget.id);
      toast.success(`User "${deleteTarget.username}" deleted`);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24" data-testid="boss-settings">
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

      {/* User Management */}
      <Card className="mb-6" data-testid="user-management-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </CardTitle>
          <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="add-user-btn">
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="new-username">Username</Label>
                  <Input
                    id="new-username"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="Enter username"
                    data-testid="new-user-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Enter password"
                    data-testid="new-user-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-role">Role</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                  >
                    <SelectTrigger data-testid="new-user-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer_service">
                        <div className="flex items-center gap-2">
                          <Headphones className="h-4 w-4" />
                          Customer Service
                        </div>
                      </SelectItem>
                      <SelectItem value="driver">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4" />
                          Driver
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreateUser}
                  disabled={creatingUser}
                  data-testid="create-user-btn"
                >
                  {creatingUser ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create User
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {/* Delete confirmation dialog */}
          {deleteTarget && (
            <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Delete User
                  </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to delete <strong>{deleteTarget.username}</strong>? This action cannot be undone.
                </p>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)} data-testid="cancel-delete-btn">
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 gap-1"
                    onClick={handleDeleteUser}
                    disabled={deleting}
                    data-testid="confirm-delete-btn"
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Delete
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <p className="text-sm text-muted-foreground mb-3">Staff Accounts ({staffUsers.length})</p>
          {staffUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No staff accounts yet. Click "Add User" to create one.</p>
          ) : (
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-2">
                {staffUsers.map((u) => {
                  const Icon = roleIcon(u.role);
                  return (
                    <div key={u.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg" data-testid={`user-row-${u.id}`}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{u.username}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{roleBadge(u.role)}</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => setDeleteTarget(u)}
                          data-testid={`delete-user-${u.id}`}
                        >
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

      {/* Change Password */}
      <Card className="mb-6" data-testid="change-password-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="current-password" className="text-sm">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              value={passwordForm.current}
              onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
              placeholder="Enter current password"
              data-testid="current-password-input"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-password" className="text-sm">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={passwordForm.newPass}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPass: e.target.value })}
              placeholder="Enter new password"
              data-testid="new-password-input"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirm-password" className="text-sm">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
              placeholder="Confirm new password"
              data-testid="confirm-password-input"
            />
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleChangePassword}
            disabled={changingPassword}
            data-testid="change-password-btn"
          >
            {changingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
            Update Password
          </Button>
        </CardContent>
      </Card>

      {/* Payment Method Toggle */}
      <Card className="mb-6" data-testid="payment-method-card">
        <CardHeader>
          <CardTitle className="text-lg">Driver Payment Method</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                settings?.payment_method === 'hourly' ? 'bg-primary text-white' : 'bg-muted'
              }`}>
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Hourly Rate</p>
                <p className="text-sm text-muted-foreground">Pay by hours worked</p>
              </div>
            </div>
            <Switch
              checked={settings?.payment_method === 'per_package'}
              onCheckedChange={togglePaymentMethod}
              data-testid="payment-method-toggle"
            />
            <div className="flex items-center gap-3">
              <div>
                <p className="font-medium text-right">Per Package</p>
                <p className="text-sm text-muted-foreground">Pay per delivery</p>
              </div>
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                settings?.payment_method === 'per_package' ? 'bg-primary text-white' : 'bg-muted'
              }`}>
                <Package className="h-5 w-5" />
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-3 text-center">
            Current: <span className="font-semibold text-foreground">
              {settings?.payment_method === 'hourly' ? 'Hourly Rate' : 'Per Package Rate'}
            </span>
          </p>
        </CardContent>
      </Card>

      {/* Rate Configuration */}
      <Card className="mb-6" data-testid="rates-card">
        <CardHeader>
          <CardTitle className="text-lg">Rate Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Hourly Rate */}
          <div className={`p-4 rounded-xl border-2 transition-colors ${
            settings?.payment_method === 'hourly' 
              ? 'border-primary bg-primary/5' 
              : 'border-border'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <Label htmlFor="hourly-rate" className="text-base font-medium">
                Hourly Rate
              </Label>
              {settings?.payment_method === 'hourly' && (
                <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full">Active</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <Input
                id="hourly-rate"
                type="number"
                step="0.01"
                min="0"
                value={settings?.hourly_rate || 0}
                onChange={(e) => setSettings({ ...settings, hourly_rate: parseFloat(e.target.value) || 0 })}
                className="text-2xl font-bold h-14"
                data-testid="hourly-rate-input"
              />
              <span className="text-muted-foreground">/hour</span>
            </div>
          </div>

          {/* Per Delivery Rate */}
          <div className={`p-4 rounded-xl border-2 transition-colors ${
            settings?.payment_method === 'per_package' 
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' 
              : 'border-border'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <Truck className="h-5 w-5 text-blue-600" />
              <Label htmlFor="delivery-rate" className="text-base font-medium">
                Per Delivery Rate
              </Label>
              {settings?.payment_method === 'per_package' && (
                <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Active</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <Input
                id="delivery-rate"
                type="number"
                step="0.01"
                min="0"
                value={settings?.per_delivery_rate || 0}
                onChange={(e) => setSettings({ ...settings, per_delivery_rate: parseFloat(e.target.value) || 0 })}
                className="text-2xl font-bold h-14"
                data-testid="delivery-rate-input"
              />
              <span className="text-muted-foreground whitespace-nowrap">/delivery</span>
            </div>
          </div>

          {/* Per Pickup Rate */}
          <div className={`p-4 rounded-xl border-2 transition-colors ${
            settings?.payment_method === 'per_package' 
              ? 'border-violet-500 bg-violet-50/50 dark:bg-violet-900/10' 
              : 'border-border'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-5 w-5 text-violet-600" />
              <Label htmlFor="pickup-rate" className="text-base font-medium">
                Per Pickup Rate
              </Label>
              {settings?.payment_method === 'per_package' && (
                <span className="text-xs bg-violet-600 text-white px-2 py-0.5 rounded-full">Active</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <Input
                id="pickup-rate"
                type="number"
                step="0.01"
                min="0"
                value={settings?.per_pickup_rate || 0}
                onChange={(e) => setSettings({ ...settings, per_pickup_rate: parseFloat(e.target.value) || 0 })}
                className="text-2xl font-bold h-14"
                data-testid="pickup-rate-input"
              />
              <span className="text-muted-foreground whitespace-nowrap">/pickup</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button
        className="w-full h-12"
        onClick={handleSave}
        disabled={saving}
        data-testid="save-settings"
      >
        {saving ? (
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
        ) : (
          <Save className="h-5 w-5 mr-2" />
        )}
        Save Settings
      </Button>

      {/* Last Updated */}
      {settings?.updated_at && (
        <p className="text-center text-sm text-muted-foreground mt-4">
          Last updated: {new Date(settings.updated_at).toLocaleString()}
          {settings.updated_by && ` by ${settings.updated_by}`}
        </p>
      )}
    </div>
  );
};

export default BossSettings;

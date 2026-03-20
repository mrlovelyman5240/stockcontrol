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
import { settingsApi, usersApi } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, getRoleLabel } from '../../lib/utils';
import { toast } from 'sonner';
import { Settings, DollarSign, Clock, Package, Loader2, Save, UserPlus, Users, Truck, Headphones } from 'lucide-react';

const BossSettings = () => {
  const { createUser } = useAuth();
  const [settings, setSettings] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: '' });
  const [creatingUser, setCreatingUser] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [settingsRes, driversRes] = await Promise.all([
        settingsApi.get(),
        usersApi.getDrivers()
      ]);
      setSettings(settingsRes.data);
      setDrivers(driversRes.data);
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
        fetchData(); // Refresh drivers list
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error('Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

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
          <p className="text-sm text-muted-foreground mb-3">Active Drivers ({drivers.length})</p>
          {drivers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No drivers yet</p>
          ) : (
            <ScrollArea className="max-h-[150px]">
              <div className="space-y-2">
                {drivers.map((driver) => (
                  <div key={driver.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{driver.username}</span>
                    </div>
                    <Badge variant="outline">Driver</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
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

import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { getRoleLabel } from '../../lib/utils';
import { authApi } from '../../lib/api';
import { toast } from 'sonner';
import { User, Moon, Sun, LogOut, Truck, Lock, Loader2 } from 'lucide-react';

const DriverProfile = () => {
  const { user, logout } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' });
  const [changing, setChanging] = useState(false);

  const handleChangePassword = async () => {
    if (!passwordForm.current || !passwordForm.newPass) {
      toast.error('Fill in all fields'); return;
    }
    if (passwordForm.newPass !== passwordForm.confirm) {
      toast.error('Passwords do not match'); return;
    }
    if (passwordForm.newPass.length < 4) {
      toast.error('Min 4 characters'); return;
    }
    setChanging(true);
    try {
      await authApi.changePassword(passwordForm.current, passwordForm.newPass);
      toast.success('Password changed!');
      setPasswordForm({ current: '', newPass: '', confirm: '' });
    } catch (error) {
      const msg = error.response?.data?.detail;
      toast.error(typeof msg === 'string' ? msg : 'Failed to change password');
    } finally {
      setChanging(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto pb-28" data-testid="driver-profile">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="text-muted-foreground">Account settings</p>
        </div>
      </div>

      <Card className="mb-4">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Truck className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{user?.full_name || user?.username}</h2>
              <p className="text-muted-foreground">{getRoleLabel(user?.role)}</p>
              {user?.full_name && <p className="text-xs text-muted-foreground">@{user?.username}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Lock className="h-5 w-5" /> Change Password</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input type="password" placeholder="Current password" value={passwordForm.current} onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })} data-testid="current-password-input" />
          <Input type="password" placeholder="New password" value={passwordForm.newPass} onChange={(e) => setPasswordForm({ ...passwordForm, newPass: e.target.value })} data-testid="new-password-input" />
          <Input type="password" placeholder="Confirm new password" value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} data-testid="confirm-password-input" />
          <Button variant="outline" className="w-full" onClick={handleChangePassword} disabled={changing} data-testid="change-password-btn">
            {changing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />} Update Password
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader><CardTitle className="text-lg">Preferences</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {resolvedTheme === 'dark' ? <Moon className="h-5 w-5 text-muted-foreground" /> : <Sun className="h-5 w-5 text-muted-foreground" />}
              <div>
                <Label className="text-base">Dark Mode</Label>
                <p className="text-sm text-muted-foreground">Toggle dark theme</p>
              </div>
            </div>
            <Switch checked={resolvedTheme === 'dark'} onCheckedChange={toggleTheme} data-testid="theme-toggle" />
          </div>
        </CardContent>
      </Card>

      <Button variant="destructive" className="w-full h-12" onClick={logout} data-testid="logout-btn">
        <LogOut className="h-5 w-5 mr-2" /> Sign Out
      </Button>
    </div>
  );
};

export default DriverProfile;

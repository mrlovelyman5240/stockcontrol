import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { getRoleLabel } from '../../lib/utils';
import { User, Moon, Sun, LogOut } from 'lucide-react';

const ServiceProfile = () => {
  const { user, logout } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <div className="p-4 max-w-2xl mx-auto" data-testid="service-profile">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="text-muted-foreground">Account settings</p>
        </div>
      </div>

      {/* User Info */}
      <Card className="mb-4">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{user?.username}</h2>
              <p className="text-muted-foreground">{getRoleLabel(user?.role)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg">Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {resolvedTheme === 'dark' ? (
                <Moon className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Sun className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <Label className="text-base">Dark Mode</Label>
                <p className="text-sm text-muted-foreground">Toggle dark theme</p>
              </div>
            </div>
            <Switch
              checked={resolvedTheme === 'dark'}
              onCheckedChange={toggleTheme}
              data-testid="theme-toggle"
            />
          </div>
        </CardContent>
      </Card>

      {/* Logout */}
      <Button
        variant="destructive"
        className="w-full h-12"
        onClick={logout}
        data-testid="logout-btn"
      >
        <LogOut className="h-5 w-5 mr-2" />
        Sign Out
      </Button>
    </div>
  );
};

export default ServiceProfile;

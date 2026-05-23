import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Sun, Moon, Loader2 } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      redirectByRole(user.role);
    }
  }, [isAuthenticated, user]);

  const redirectByRole = (role) => {
    console.log('Redirecting user with role:', role);
    switch (role) {
      case 'boss':
        navigate('/boss', { replace: true });
        break;
      case 'customer_service':
        navigate('/service', { replace: true });
        break;
      case 'driver':
        navigate('/driver', { replace: true });
        break;
      default:
        navigate('/', { replace: true });
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginData.username || !loginData.password) {
      toast.error('Please fill in all fields');
      return;
    }
    
    setLoading(true);
    const result = await login(loginData.username, loginData.password);
    setLoading(false);
    
    if (result.success) {
      // Redirect without toast
      setTimeout(() => {
        redirectByRole(result.user.role);
      }, 100);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-background">
      {/* Decorative gradient background — subtle, theme-aware */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.15),transparent_50%),radial-gradient(ellipse_at_bottom_right,hsl(var(--accent)/0.10),transparent_60%)]"
      />

      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors"
        data-testid="theme-toggle"
        aria-label="Toggle theme"
      >
        {resolvedTheme === 'dark' ? (
          <Sun className="h-5 w-5" />
        ) : (
          <Moon className="h-5 w-5" />
        )}
      </button>

      {/* Brand */}
      <div className="flex flex-col items-center gap-3 mb-10">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shadow-sm">
          <img src="/logo.png" alt="" className="h-12 w-12 rounded-xl object-cover" />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight">Mixy Logistics</h1>
          <p className="text-sm text-muted-foreground mt-1">Delivery Management</p>
        </div>
      </div>

      <Card className="w-full max-w-md shadow-lg border-border/60 backdrop-blur-sm bg-card/95">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-username">Username</Label>
              <Input
                id="login-username"
                type="text"
                placeholder="Enter your username"
                autoComplete="username"
                value={loginData.username}
                onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                data-testid="login-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                data-testid="login-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold"
              disabled={loading}
              data-testid="login-submit"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;

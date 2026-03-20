import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Truck, Sun, Moon, Loader2 } from 'lucide-react';
import { seedApi } from '../lib/api';

const Login = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

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
      toast.success(`Welcome back, ${result.user.username}!`);
      console.log('Login successful, user role:', result.user.role);
      // Small delay to ensure state is updated
      setTimeout(() => {
        redirectByRole(result.user.role);
      }, 100);
    } else {
      toast.error(result.error);
    }
  };

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      await seedApi.seed();
      toast.success('Demo data seeded! Try logging in with boss/boss123');
    } catch (error) {
      if (error.response?.data?.message === 'Data already seeded') {
        toast.info('Demo data already exists');
      } else {
        toast.error('Failed to seed data');
      }
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors"
        data-testid="theme-toggle"
      >
        {resolvedTheme === 'dark' ? (
          <Sun className="h-5 w-5" />
        ) : (
          <Moon className="h-5 w-5" />
        )}
      </button>

      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
          <Truck className="h-7 w-7 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">LogiFlow Pro</h1>
          <p className="text-sm text-muted-foreground">Delivery Management</p>
        </div>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Welcome</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-username">Username</Label>
              <Input
                id="login-username"
                type="text"
                placeholder="Enter your username"
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
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                data-testid="login-password"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-12" 
              disabled={loading}
              data-testid="login-submit"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Sign In
            </Button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground text-center mb-3">Demo Credentials</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div 
                className="p-2 rounded-lg bg-muted text-center cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => setLoginData({ username: 'boss', password: 'boss123' })}
              >
                <p className="font-medium">Boss</p>
                <p className="text-muted-foreground">boss / boss123</p>
              </div>
              <div 
                className="p-2 rounded-lg bg-muted text-center cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => setLoginData({ username: 'service1', password: 'service123' })}
              >
                <p className="font-medium">Service</p>
                <p className="text-muted-foreground">service1 / service123</p>
              </div>
              <div 
                className="p-2 rounded-lg bg-muted text-center cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => setLoginData({ username: 'driver1', password: 'driver123' })}
              >
                <p className="font-medium">Driver</p>
                <p className="text-muted-foreground">driver1 / driver123</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full mt-3"
              onClick={handleSeedData}
              disabled={seeding}
              data-testid="seed-data-btn"
            >
              {seeding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Load Demo Data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;

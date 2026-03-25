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
      // Redirect without toast
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
        <img src="/logo.png" alt="Mixy Logistics" className="h-12 w-12 rounded-xl object-cover" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mixy Logistics</h1>
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
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Truck, Sun, Moon, Loader2 } from 'lucide-react';
import { seedApi } from '../lib/api';

const Login = () => {
  const navigate = useNavigate();
  const { login, register, isAuthenticated, user } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [registerData, setRegisterData] = useState({ username: '', password: '', role: '' });
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      redirectByRole(user.role);
    }
  }, [isAuthenticated, user]);

  const redirectByRole = (role) => {
    switch (role) {
      case 'boss':
        navigate('/boss');
        break;
      case 'customer_service':
        navigate('/service');
        break;
      case 'driver':
        navigate('/driver');
        break;
      default:
        navigate('/');
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
      redirectByRole(result.user.role);
    } else {
      toast.error(result.error);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!registerData.username || !registerData.password || !registerData.role) {
      toast.error('Please fill in all fields');
      return;
    }
    
    setLoading(true);
    const result = await register(registerData.username, registerData.password, registerData.role);
    setLoading(false);
    
    if (result.success) {
      toast.success('Account created successfully!');
      redirectByRole(result.user.role);
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
          <CardDescription>Sign in to your account or create a new one</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login" data-testid="login-tab">Login</TabsTrigger>
              <TabsTrigger value="register" data-testid="register-tab">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
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
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-username">Username</Label>
                  <Input
                    id="register-username"
                    type="text"
                    placeholder="Choose a username"
                    value={registerData.username}
                    onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                    data-testid="register-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="Choose a password"
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    data-testid="register-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-role">Role</Label>
                  <Select
                    value={registerData.role}
                    onValueChange={(value) => setRegisterData({ ...registerData, role: value })}
                  >
                    <SelectTrigger data-testid="register-role">
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="boss">Boss (Patron)</SelectItem>
                      <SelectItem value="customer_service">Customer Service</SelectItem>
                      <SelectItem value="driver">Driver</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-12" 
                  disabled={loading}
                  data-testid="register-submit"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Account
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* Demo credentials */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground text-center mb-3">Demo Credentials</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-muted text-center">
                <p className="font-medium">Boss</p>
                <p className="text-muted-foreground">boss / boss123</p>
              </div>
              <div className="p-2 rounded-lg bg-muted text-center">
                <p className="font-medium">Service</p>
                <p className="text-muted-foreground">service1 / service123</p>
              </div>
              <div className="p-2 rounded-lg bg-muted text-center">
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

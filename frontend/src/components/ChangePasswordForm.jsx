import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { authApi } from '../lib/api';
import { toast } from 'sonner';
import { Lock, Loader2 } from 'lucide-react';

const ChangePasswordForm = () => {
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
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Lock className="h-5 w-5" /> Change Password
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          type="password"
          placeholder="Current password"
          value={passwordForm.current}
          onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
          data-testid="current-password-input"
        />
        <Input
          type="password"
          placeholder="New password"
          value={passwordForm.newPass}
          onChange={(e) => setPasswordForm({ ...passwordForm, newPass: e.target.value })}
          data-testid="new-password-input"
        />
        <Input
          type="password"
          placeholder="Confirm new password"
          value={passwordForm.confirm}
          onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
          data-testid="confirm-password-input"
        />
        <Button
          variant="outline"
          className="w-full"
          onClick={handleChangePassword}
          disabled={changing}
          data-testid="change-password-btn"
        >
          {changing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
          Update Password
        </Button>
      </CardContent>
    </Card>
  );
};

export default ChangePasswordForm;

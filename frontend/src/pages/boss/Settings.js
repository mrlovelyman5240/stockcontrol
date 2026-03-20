import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { settingsApi } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';
import { Settings, DollarSign, Clock, Package, Loader2, Save } from 'lucide-react';

const BossSettings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await settingsApi.get();
      setSettings(response.data);
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
        per_package_rate: settings.per_package_rate,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto" data-testid="boss-settings">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure driver compensation</p>
        </div>
      </div>

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

          {/* Per Package Rate */}
          <div className={`p-4 rounded-xl border-2 transition-colors ${
            settings?.payment_method === 'per_package' 
              ? 'border-primary bg-primary/5' 
              : 'border-border'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-5 w-5 text-muted-foreground" />
              <Label htmlFor="package-rate" className="text-base font-medium">
                Per Package Rate
              </Label>
              {settings?.payment_method === 'per_package' && (
                <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full">Active</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <Input
                id="package-rate"
                type="number"
                step="0.01"
                min="0"
                value={settings?.per_package_rate || 0}
                onChange={(e) => setSettings({ ...settings, per_package_rate: parseFloat(e.target.value) || 0 })}
                className="text-2xl font-bold h-14"
                data-testid="package-rate-input"
              />
              <span className="text-muted-foreground">/delivery</span>
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

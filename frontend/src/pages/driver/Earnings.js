import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Calendar } from '../../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { statsApi, paymentsApi, driverHoursApi } from '../../lib/api';
import { formatCurrency, formatDate, formatDateTime, getStatusColor, getStatusLabel } from '../../lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  Wallet, 
  Calendar as CalendarIcon, 
  Clock,
  Package,
  DollarSign,
  Send,
  Loader2,
  TrendingUp,
  History
} from 'lucide-react';

const DriverEarnings = () => {
  const [stats, setStats] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [paymentAmount, setPaymentAmount] = useState('');
  const [hoursWorked, setHoursWorked] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loggingHours, setLoggingHours] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const [statsRes, paymentsRes, hoursRes] = await Promise.all([
        statsApi.getDriverStats(dateStr),
        paymentsApi.getAll(),
        driverHoursApi.getAll({ date: dateStr })
      ]);
      
      setStats(statsRes.data);
      setPayments(paymentsRes.data);
      
      // Set hours if logged for this date
      const todayHours = hoursRes.data.find(h => h.date === dateStr);
      setHoursWorked(todayHours ? todayHours.hours.toString() : '');
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogHours = async () => {
    if (!hoursWorked || parseFloat(hoursWorked) <= 0) {
      toast.error('Please enter valid hours');
      return;
    }

    setLoggingHours(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      await driverHoursApi.log(dateStr, parseFloat(hoursWorked));
      toast.success('Hours logged successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to log hours');
    } finally {
      setLoggingHours(false);
    }
  };

  const handleSubmitPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setSubmitting(true);
    try {
      await paymentsApi.submit(parseFloat(paymentAmount));
      toast.success('Payment submitted for approval');
      setPaymentAmount('');
      fetchData();
    } catch (error) {
      toast.error('Failed to submit payment');
    } finally {
      setSubmitting(false);
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
    <div className="p-4 max-w-2xl mx-auto pb-24" data-testid="driver-earnings">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">My Earnings</h1>
            <p className="text-muted-foreground">Track your income</p>
          </div>
        </div>
        
        {/* Date Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2" data-testid="date-picker-trigger">
              <CalendarIcon className="h-4 w-4" />
              {format(selectedDate, 'MMM d')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              initialFocus
              data-testid="date-calendar"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Earnings Summary */}
      <Card className="hero-gradient text-white mb-6" data-testid="earnings-summary">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-2 opacity-90">
            <TrendingUp className="h-5 w-5" />
            <span className="text-sm font-medium">My Earnings</span>
          </div>
          <p className="money-large">{formatCurrency(stats?.earnings || 0)}</p>
          <p className="text-sm opacity-80 mt-2">
            {stats?.payment_method === 'hourly' 
              ? `${stats?.hours_logged || 0} hours × ${formatCurrency(stats?.hourly_rate || 0)}/hr`
              : `${stats?.packages_delivered || 0} packages × ${formatCurrency(stats?.per_package_rate || 0)}/pkg`
            }
          </p>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card data-testid="total-sales-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium">Total Sales</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(stats?.total_sales || 0)}</p>
          </CardContent>
        </Card>

        <Card data-testid="holding-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Wallet className="h-4 w-4" />
              <span className="text-xs font-medium">TO BOSS / HOLDING</span>
            </div>
            <p className="text-2xl font-bold text-accent">{formatCurrency(stats?.holding || 0)}</p>
          </CardContent>
        </Card>

        <Card data-testid="packages-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Package className="h-4 w-4" />
              <span className="text-xs font-medium">Packages</span>
            </div>
            <p className="text-2xl font-bold">{stats?.packages_delivered || 0}</p>
          </CardContent>
        </Card>

        <Card data-testid="total-paid-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Send className="h-4 w-4" />
              <span className="text-xs font-medium">Total Paid</span>
            </div>
            <p className="text-2xl font-bold text-primary">{formatCurrency(stats?.total_paid || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Log Hours (if hourly rate is active) */}
      {stats?.payment_method === 'hourly' && (
        <Card className="mb-6" data-testid="log-hours-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Log Hours Worked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Current rate: <span className="font-semibold">{formatCurrency(stats?.hourly_rate || 0)}/hour</span>
            </p>
            <div className="flex gap-3">
              <Input
                type="number"
                step="0.5"
                min="0"
                placeholder="Hours worked"
                value={hoursWorked}
                onChange={(e) => setHoursWorked(e.target.value)}
                className="flex-1"
                data-testid="hours-input"
              />
              <Button
                onClick={handleLogHours}
                disabled={loggingHours}
                data-testid="log-hours-btn"
              >
                {loggingHours ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Log Hours'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pay Boss Section */}
      <Card className="mb-6" data-testid="pay-boss-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Send className="h-5 w-5" />
            Pay Boss
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Pending amount: <span className="font-semibold text-accent">{formatCurrency(stats?.pending_to_boss || 0)}</span>
          </p>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="Amount to pay"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="pl-9"
                data-testid="payment-amount-input"
              />
            </div>
            <Button
              onClick={handleSubmitPayment}
              disabled={submitting}
              data-testid="submit-payment-btn"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Submit Payment'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card data-testid="payment-history-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Payment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No payment history</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    data-testid={`payment-history-${payment.id}`}
                  >
                    <div>
                      <p className="font-bold">{formatCurrency(payment.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(payment.submitted_at)}
                      </p>
                    </div>
                    <Badge className={getStatusColor(payment.status)}>
                      {getStatusLabel(payment.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverEarnings;

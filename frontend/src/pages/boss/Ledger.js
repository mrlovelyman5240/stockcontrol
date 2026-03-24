import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { usersApi, ledgerApi, paymentsApi } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { toast } from 'sonner';
import { 
  Landmark, 
  Search, 
  Loader2, 
  User, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Wallet,
  Calendar
} from 'lucide-react';

const typeColors = {
  order: { completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400', cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  deposit: { approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  hours: { logged: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400' },
};

const BossLedger = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'deposits' ? 'deposits' : 'history';
  const initialDriver = searchParams.get('driver_id') || '';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [ledger, setLedger] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // History filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState(initialDriver);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => { fetchDrivers(); }, []);
  useEffect(() => { fetchLedger(); }, [typeFilter, driverFilter, dateFrom, dateTo]);
  useEffect(() => { fetchPendingPayments(); }, []);

  const fetchDrivers = async () => {
    try {
      const res = await usersApi.getDrivers();
      setDrivers(res.data);
    } catch (e) { /* ignore */ }
  };

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const params = {};
      if (typeFilter && typeFilter !== 'all') params.type = typeFilter;
      if (driverFilter && driverFilter !== 'all') params.driver_id = driverFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await ledgerApi.getAll(params);
      setLedger(res.data);
    } catch (error) {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingPayments = async () => {
    setPaymentsLoading(true);
    try {
      const res = await paymentsApi.getAll({ status: 'pending' });
      setPendingPayments(res.data);
    } catch (error) {
      toast.error('Failed to load pending deposits');
    } finally {
      setPaymentsLoading(false);
    }
  };

  const handleApprove = async (paymentId) => {
    setActionLoading(paymentId);
    try {
      await paymentsApi.approve(paymentId);
      toast.success('Deposit approved');
      fetchPendingPayments();
      fetchLedger();
    } catch (error) {
      toast.error('Failed to approve deposit');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (paymentId) => {
    setActionLoading(paymentId);
    try {
      await paymentsApi.reject(paymentId);
      toast.success('Deposit rejected');
      fetchPendingPayments();
    } catch (error) {
      toast.error('Failed to reject deposit');
    } finally {
      setActionLoading(null);
    }
  };

  const handleTabChange = (val) => {
    setActiveTab(val);
    const params = new URLSearchParams(searchParams);
    params.set('tab', val);
    setSearchParams(params, { replace: true });
  };

  const filteredLedger = search
    ? ledger.filter(e => e.description?.toLowerCase().includes(search.toLowerCase()) || e.driver_name?.toLowerCase().includes(search.toLowerCase()))
    : ledger;

  const getDriverName = (id) => drivers.find(d => d.id === id)?.username || 'Unknown';

  return (
    <div className="flex flex-col h-[100dvh] bg-background" data-testid="boss-ledger-page">
      {/* Fixed Header */}
      <div className="shrink-0 p-4 pb-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Landmark className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Finance Center</h1>
            <p className="text-muted-foreground text-sm">Deposits & transaction history</p>
          </div>
          <Button variant="ghost" size="icon" className="ml-auto" onClick={() => { fetchLedger(); fetchPendingPayments(); }} data-testid="refresh-finance">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col flex-1 min-h-0">
        <div className="shrink-0 px-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="deposits" data-testid="deposits-tab" className="gap-2">
              <Wallet className="h-4 w-4" />
              Pending Deposits
              {pendingPayments.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-xs">
                  {pendingPayments.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="history-tab" className="gap-2">
              <Clock className="h-4 w-4" />
              Transaction History
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Pending Deposits */}
        <TabsContent value="deposits" className="flex-1 min-h-0 px-4 mt-4">
          {paymentsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : pendingPayments.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <CheckCircle className="h-14 w-14 mx-auto mb-4 opacity-40" />
              <p className="font-medium text-lg">No pending deposits</p>
              <p className="text-sm mt-1">All driver deposits have been processed.</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[calc(100dvh-220px)] pb-24">
              {/* Table Header */}
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b">
                <span>Driver</span>
                <span className="text-right min-w-[80px]">Amount</span>
                <span className="text-right min-w-[130px]">Actions</span>
              </div>
              {/* Rows */}
              <div className="divide-y divide-border">
                {pendingPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-3 py-2.5 hover:bg-muted/40 transition-colors"
                    data-testid={`deposit-${payment.id}`}
                  >
                    {/* Left: Driver + Date */}
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{payment.driver_name}</p>
                      <p className="text-[11px] text-muted-foreground">{formatDateTime(payment.submitted_at)}</p>
                    </div>
                    {/* Middle: Amount */}
                    <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400 tabular-nums text-right min-w-[80px]">
                      {formatCurrency(payment.amount)}
                    </p>
                    {/* Right: Action Buttons */}
                    <div className="flex items-center gap-1.5 min-w-[130px] justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                        onClick={() => handleApprove(payment.id)}
                        disabled={actionLoading === payment.id}
                        data-testid={`approve-deposit-${payment.id}`}
                      >
                        {actionLoading === payment.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <><CheckCircle className="h-3 w-3" /> Approve</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs gap-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                        onClick={() => handleReject(payment.id)}
                        disabled={actionLoading === payment.id}
                        data-testid={`reject-deposit-${payment.id}`}
                      >
                        {actionLoading === payment.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <><XCircle className="h-3 w-3" /> Reject</>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Transaction History */}
        <TabsContent value="history" className="flex-1 min-h-0 flex flex-col px-4 mt-4">
          {/* Filters */}
          <div className="shrink-0 space-y-2 mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-9"
                data-testid="ledger-search"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 text-xs" data-testid="type-filter">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="orders">Orders</SelectItem>
                  <SelectItem value="deposits">Deposits</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                </SelectContent>
              </Select>
              <Select value={driverFilter} onValueChange={setDriverFilter}>
                <SelectTrigger className="h-8 text-xs" data-testid="driver-filter">
                  <SelectValue placeholder="All Drivers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Drivers</SelectItem>
                  {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.username}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Start Date</label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs" data-testid="ledger-date-from" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">End Date</label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs" data-testid="ledger-date-to" />
              </div>
            </div>
          </div>

          {/* Transaction List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pb-24 -mx-1 px-1">
              {filteredLedger.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Landmark className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No transactions found</p>
                  <p className="text-sm mt-1">Try adjusting your filters.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">{filteredLedger.length} transactions</p>
                  {filteredLedger.map((entry) => (
                    <Card key={`${entry.type}-${entry.id}`} data-testid={`ledger-entry-${entry.id}`}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                              <Badge className={`text-[10px] ${typeColors[entry.type]?.[entry.subtype] || 'bg-muted text-muted-foreground'}`}>
                                {entry.type === 'order' ? (entry.subtype === 'completed' ? 'Sale' : 'Cancelled') : entry.type === 'deposit' ? 'Deposit' : 'Hours'}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">{entry.subtype}</Badge>
                            </div>
                            <p className="text-sm font-medium truncate">{entry.description}</p>
                            {entry.driver_name && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <User className="h-3 w-3" /> {entry.driver_name}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <div className={`font-bold ${entry.type === 'order' && entry.subtype === 'completed' ? 'text-emerald-600' : entry.type === 'deposit' && entry.subtype === 'approved' ? 'text-blue-600' : ''}`}>
                              {entry.type === 'hours' ? `${entry.amount}h` : formatCurrency(entry.amount)}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {formatDateTime(entry.timestamp)}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BossLedger;

import { useState, useEffect } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ScrollArea } from '../../components/ui/scroll-area';
import { usersApi, ledgerApi } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';
import { BookOpen, Search, Loader2, ArrowUpRight, ArrowDownRight, Clock, Filter, User, RefreshCw } from 'lucide-react';

const typeColors = {
  order: { completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400', cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  deposit: { approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  hours: { logged: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400' },
};

const BossLedger = () => {
  const [ledger, setLedger] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => { fetchDrivers(); }, []);
  useEffect(() => { fetchLedger(); }, [typeFilter, driverFilter, dateFrom, dateTo]);

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
      if (search) params.search = search;
      const res = await ledgerApi.getAll(params);
      setLedger(res.data);
    } catch (error) {
      toast.error('Failed to load ledger');
    } finally {
      setLoading(false);
    }
  };

  const filteredLedger = search
    ? ledger.filter(e => e.description.toLowerCase().includes(search.toLowerCase()) || e.driver_name?.toLowerCase().includes(search.toLowerCase()))
    : ledger;

  const formatTs = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24" data-testid="boss-ledger-page">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Financial Ledger</h1>
          <p className="text-muted-foreground">{filteredLedger.length} transactions</p>
        </div>
        <Button variant="ghost" size="icon" className="ml-auto" onClick={fetchLedger}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search transactions..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-9" data-testid="ledger-search" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="orders">Orders</SelectItem>
              <SelectItem value="deposits">Deposits</SelectItem>
              <SelectItem value="hours">Hours</SelectItem>
            </SelectContent>
          </Select>
          <Select value={driverFilter} onValueChange={setDriverFilter}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Driver" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Drivers</SelectItem>
              {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.username}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-1">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs flex-1" placeholder="From" data-testid="ledger-date-from" />
          </div>
        </div>
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs" placeholder="To" data-testid="ledger-date-to" />
      </div>

      {/* Ledger entries */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <ScrollArea className="h-[calc(100vh-420px)]">
          <div className="space-y-2">
            {filteredLedger.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>No transactions found</p>
              </div>
            ) : (
              filteredLedger.map((entry) => (
                <Card key={`${entry.type}-${entry.id}`} data-testid={`ledger-entry-${entry.id}`}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge className={typeColors[entry.type]?.[entry.subtype] || 'bg-muted text-muted-foreground'}>
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
                        <div className={`font-bold ${entry.type === 'order' && entry.subtype === 'completed' ? 'text-emerald-600' : entry.type === 'deposit' ? 'text-blue-600' : ''}`}>
                          {entry.type === 'hours' ? `${entry.amount}h` : formatCurrency(entry.amount)}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{formatTs(entry.timestamp)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default BossLedger;

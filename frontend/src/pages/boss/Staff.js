import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Badge } from '../../components/ui/badge';
import { usersApi, driverHoursApi } from '../../lib/api';
import { toast } from 'sonner';
import { Clock, Users, Loader2, Calendar, Save, User } from 'lucide-react';

const BossStaff = () => {
  const [drivers, setDrivers] = useState([]);
  const [hoursLog, setHoursLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [hoursValue, setHoursValue] = useState('');
  const [filterDriver, setFilterDriver] = useState('');

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { fetchHours(); }, [filterDriver]);

  const fetchData = async () => {
    try {
      const [driversRes, hoursRes] = await Promise.all([
        usersApi.getDrivers(),
        driverHoursApi.getAll()
      ]);
      setDrivers(driversRes.data);
      setHoursLog(hoursRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchHours = async () => {
    try {
      const params = {};
      if (filterDriver) params.driver_id = filterDriver;
      const res = await driverHoursApi.getAll(params);
      setHoursLog(res.data);
    } catch (error) {
      toast.error('Failed to load hours');
    }
  };

  const handleSubmit = async () => {
    if (!selectedDriver || !selectedDate || !hoursValue) {
      toast.error('Please fill in all fields');
      return;
    }
    setSaving(true);
    try {
      await driverHoursApi.log(selectedDriver, selectedDate, parseFloat(hoursValue));
      toast.success('Hours logged successfully');
      setHoursValue('');
      fetchHours();
    } catch (error) {
      const msg = error.response?.data?.detail;
      toast.error(typeof msg === 'string' ? msg : 'Failed to log hours');
    } finally {
      setSaving(false);
    }
  };

  const getDriverName = (id) => drivers.find(d => d.id === id)?.username || 'Unknown';

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24" data-testid="boss-staff-page">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Staff Hours</h1>
          <p className="text-muted-foreground">Log daily hours for drivers</p>
        </div>
      </div>

      {/* Log Hours Form */}
      <Card className="mb-6" data-testid="log-hours-form">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Log Hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Driver</Label>
              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger data-testid="staff-driver-select"><SelectValue placeholder="Select driver" /></SelectTrigger>
                <SelectContent>
                  {drivers.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      <span className="flex items-center gap-2"><User className="h-3 w-3" />{d.username}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Date</Label>
              <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} data-testid="staff-date-input" />
            </div>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label className="text-sm">Hours Worked</Label>
              <Input type="number" step="0.5" min="0" max="24" value={hoursValue} onChange={(e) => setHoursValue(e.target.value)} placeholder="e.g., 8" data-testid="staff-hours-input" />
            </div>
            <Button onClick={handleSubmit} disabled={saving} className="h-10" data-testid="staff-submit-btn">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" /> Log</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filter + History */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground">HOURS HISTORY</h2>
        <Select value={filterDriver} onValueChange={setFilterDriver}>
          <SelectTrigger className="w-[160px] h-8 text-sm"><SelectValue placeholder="All drivers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All drivers</SelectItem>
            {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.username}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="h-[calc(100vh-520px)]">
        <div className="space-y-2">
          {hoursLog.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground"><Clock className="h-10 w-10 mx-auto mb-2 opacity-40" /><p>No hours logged yet</p></div>
          ) : (
            hoursLog.map((h) => (
              <Card key={h.id} data-testid={`hours-entry-${h.id}`}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{h.driver_name || getDriverName(h.driver_id)}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" /> {h.date}
                      {h.logged_by && <span>by {h.logged_by}</span>}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-base font-bold">{h.hours}h</Badge>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default BossStaff;

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { auditLogsApi } from '../../lib/api';
import { formatDateTime } from '../../lib/utils';
import { toast } from 'sonner';
import { FileText, Trash2, Edit, Loader2, AlertTriangle } from 'lucide-react';

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await auditLogsApi.getAll();
      setLogs(response.data);
    } catch (error) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'delete':
        return <Trash2 className="h-4 w-4 text-red-500" />;
      case 'update':
        return <Edit className="h-4 w-4 text-amber-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'delete':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'update':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      default:
        return 'bg-muted text-muted-foreground';
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
    <div className="p-4 max-w-2xl mx-auto" data-testid="audit-log-page">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground">Track all modifications</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Activity History</span>
            <Badge variant="outline">{logs.length} entries</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No audit logs yet</p>
              <p className="text-sm">Modifications by Customer Service will appear here</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 bg-muted/50 rounded-xl border-l-4 border-l-transparent hover:border-l-primary transition-colors"
                    data-testid={`audit-log-${log.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{getActionIcon(log.action)}</div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={getActionColor(log.action)}>
                              {log.action.toUpperCase()}
                            </Badge>
                            <Badge variant="outline">{log.entity_type}</Badge>
                          </div>
                          <p className="font-medium mt-2">{log.entity_name}</p>
                          <p className="text-sm text-muted-foreground">{log.details}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            By <span className="font-medium">{log.performed_by_name}</span>
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(log.timestamp)}
                      </p>
                    </div>
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

export default AuditLog;

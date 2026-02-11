import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import { Card, Badge, Button } from '../../components/ui';
import { Loader2 } from 'lucide-react';

interface AggregatedData {
  user: any;
  rosterHistory: any[];
  applications: any[];
  tasks: any[];
  volunteerShifts: any[];
  activityLog: any[];
}

const Contact360View: React.FC = () => {
  const { campId, userId } = useParams();
  const [data, setData] = useState<AggregatedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/camps/${campId}/contacts/${userId}`);
        console.log('🔍 [Contact360View] API Response:', res);
        console.log('🔍 [Contact360View] Applications data:', res.applications);
        console.log('🔍 [Contact360View] Applications length:', res.applications?.length);
        setData(res);
      } catch (e: any) {
        console.error('❌ [Contact360View] Error loading contact:', e);
        setError(e?.response?.data?.message || 'Failed to load contact');
      } finally {
        setLoading(false);
      }
    };
    if (campId && userId) load();
  }, [campId, userId]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-custom-primary" />
      </div>
    );
  }

  if (error) {
    return <div className="container mx-auto px-4 py-8 text-red-600">{error}</div>;
  }

  if (!data) return null;

  const { user, rosterHistory, applications, tasks, volunteerShifts, activityLog } = data;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-lato-bold text-custom-text">
              {user.firstName} {user.lastName} {user.playaName && <span className="text-custom-text-secondary">({user.playaName})</span>}
            </h1>
            <p className="text-sm text-custom-text-secondary">{user.email}</p>
          </div>
          <div className="flex gap-2">
            {user.skills?.slice(0, 5).map((s: string) => (
              <Badge key={s} variant="info">{s}</Badge>
            ))}
          </div>
        </div>
      </Card>

      {/* Roster History */}
      <Card className="p-6">
        <h2 className="text-h2 font-lato-bold text-custom-text mb-4">Roster History</h2>
        {rosterHistory.length === 0 ? (
          <p className="text-custom-text-secondary">No roster entries found.</p>
        ) : (
          <ul className="space-y-3">
            {rosterHistory.map((r) => (
              <li key={`${r.rosterId}-${r.joinedAt}`} className="border-b pb-2">
                <div className="font-medium">{r.name || 'Roster'}</div>
                <div className="text-sm text-custom-text-secondary">
                  Year: {r.year || 'N/A'} · Dues: <span className={r.duesStatus === 'Paid' ? 'text-green-600 font-medium' : 'text-red-600'}>{r.duesStatus || 'Unpaid'}</span>
                </div>
                <div className="text-sm text-custom-text-secondary">
                  Added: {r.addedAt ? new Date(r.addedAt).toLocaleDateString() : 'N/A'} · Via: <Badge variant={r.addedVia === 'application' ? 'success' : 'info'}>{r.addedVia === 'application' ? 'Application' : 'Manual'}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Applications */}
      <Card className="p-6">
        <h2 className="text-h2 font-lato-bold text-custom-text mb-4">Applications</h2>
        {(() => {
          console.log('🔍 [Contact360View] Rendering applications:', applications);
          console.log('🔍 [Contact360View] Applications length:', applications?.length);
          console.log('🔍 [Contact360View] Applications type:', typeof applications);
          return null;
        })()}
        {applications.length === 0 ? (
          <p className="text-custom-text-secondary">No applications for this camp.</p>
        ) : (
          <div className="space-y-4">
            {applications.map((application) => (
              <div key={application._id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-custom-text">
                      Application #{application._id.slice(-6)}
                    </h3>
                    <p className="text-sm text-custom-text-secondary">
                      Submitted: {application.appliedAt ? new Date(application.appliedAt).toLocaleDateString() : '-'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {application.inviteToken && (
                      <Badge variant="success">Link</Badge>
                    )}
                    <Badge variant={
                      application.status === 'approved' ? 'success' : 
                      application.status === 'rejected' ? 'error' : 
                      'warning'
                    }>
                      {application.status}
                    </Badge>
                  </div>
                </div>
                
                <p className="text-sm text-custom-text-secondary mb-3">
                  <strong>Motivation:</strong> {application.applicationData?.motivation || '-'}
                </p>
                
                {/* Action History deprecated in favor of Activity Log */}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Tasks */}
      <Card className="p-6">
        <h2 className="text-h2 font-lato-bold text-custom-text mb-4">Tasks</h2>
        {tasks.length === 0 ? (
          <p className="text-custom-text-secondary">No tasks assigned.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-sm text-custom-text-secondary">Title</th>
                  <th className="px-4 py-2 text-left text-sm text-custom-text-secondary">Status</th>
                  <th className="px-4 py-2 text-left text-sm text-custom-text-secondary">Created</th>
                  <th className="px-4 py-2 text-left text-sm text-custom-text-secondary">Due</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t._id} className="border-t">
                    <td className="px-4 py-2 text-sm">{t.title}</td>
                    <td className="px-4 py-2 text-sm"><Badge variant={t.status === 'completed' ? 'success' : t.status === 'in_progress' ? 'info' : 'warning'}>{t.status}</Badge></td>
                    <td className="px-4 py-2 text-sm">{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-2 text-sm">{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Volunteer Shifts */}
      <Card className="p-6">
        <h2 className="text-h2 font-lato-bold text-custom-text mb-4">Volunteer History</h2>
        {volunteerShifts.length === 0 ? (
          <p className="text-custom-text-secondary">No volunteer shifts.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-sm text-custom-text-secondary">Event</th>
                  <th className="px-4 py-2 text-left text-sm text-custom-text-secondary">Shift</th>
                  <th className="px-4 py-2 text-left text-sm text-custom-text-secondary">Date</th>
                  <th className="px-4 py-2 text-left text-sm text-custom-text-secondary">Time</th>
                </tr>
              </thead>
              <tbody>
                {volunteerShifts.map((s) => (
                  <tr key={s.shiftId} className="border-t">
                    <td className="px-4 py-2 text-sm font-medium">{s.eventName}</td>
                    <td className="px-4 py-2 text-sm">{s.title}</td>
                    <td className="px-4 py-2 text-sm">{s.date ? new Date(s.date).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-2 text-sm">{s.startTime || '-'}{s.endTime ? ` - ${s.endTime}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Activity Log */}
      <Card className="p-6">
        <h2 className="text-h2 font-lato-bold text-custom-text mb-4">Activity Log</h2>
        {activityLog.length === 0 ? (
          <p className="text-custom-text-secondary">No activity logged for this member.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-sm text-custom-text-secondary">When</th>
                  <th className="px-4 py-2 text-left text-sm text-custom-text-secondary">Activity</th>
                  <th className="px-4 py-2 text-left text-sm text-custom-text-secondary">By</th>
                  <th className="px-4 py-2 text-left text-sm text-custom-text-secondary">Details</th>
                </tr>
              </thead>
              <tbody>
                {activityLog.map((log) => (
                  <tr key={log._id} className="border-t">
                    <td className="px-4 py-2 text-sm">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm">{log.activityType || '-'}</td>
                    <td className="px-4 py-2 text-sm">
                      {log.actingUserId?.firstName || log.actingUserId?.lastName
                        ? `${log.actingUserId?.firstName || ''} ${log.actingUserId?.lastName || ''}`.trim()
                        : log.actingUserId?.email || '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-custom-text-secondary">
                      {log.details?.field ? `${log.details.field}: ` : ''}
                      {log.details?.newValueDisplay || log.details?.newValue || log.details?.message || ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Contact360View;



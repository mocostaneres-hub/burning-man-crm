import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { Card, Badge } from '../../components/ui';
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
  const safeUser = user || {};
  const formatDisplayValue = (value: any): string => {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (Array.isArray(value)) {
      return value.map((item) => formatDisplayValue(item)).join(', ');
    }
    if (typeof value === 'object') {
      // Common location payload shape from structured location fields.
      if ('city' in value || 'state' in value || 'country' in value) {
        const parts = [value.city, value.state, value.country].filter(Boolean);
        if (parts.length > 0) return parts.join(', ');
      }
      try {
        return JSON.stringify(value);
      } catch (_error) {
        return '[object]';
      }
    }
    return String(value);
  };
  const toIdString = (value: any): string => {
    if (value === null || value === undefined) return '';
    try {
      return String(value);
    } catch (_error) {
      return '';
    }
  };
  const getApplicationIdLabel = (application: any): string => {
    const id = toIdString(application?._id);
    return id ? `Application #${id.slice(-6)}` : 'Application';
  };
  const skillBadges = Array.isArray(user?.skills) ? user.skills.slice(0, 5) : [];
  const rosterHistoryItems = Array.isArray(rosterHistory) ? rosterHistory : [];
  const applicationItems = Array.isArray(applications) ? applications : [];
  const taskItems = Array.isArray(tasks) ? tasks : [];
  const volunteerShiftItems = Array.isArray(volunteerShifts) ? volunteerShifts : [];
  const activityItems = Array.isArray(activityLog) ? activityLog : [];

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-lato-bold text-custom-text">
              {formatDisplayValue(safeUser.firstName) === '-' ? 'Unknown' : formatDisplayValue(safeUser.firstName)} {formatDisplayValue(safeUser.lastName) === '-' ? 'User' : formatDisplayValue(safeUser.lastName)} {safeUser.playaName && <span className="text-custom-text-secondary">({formatDisplayValue(safeUser.playaName)})</span>}
            </h1>
            <p className="text-sm text-custom-text-secondary">{formatDisplayValue(safeUser.email)}</p>
          </div>
          <div className="flex gap-2">
            {skillBadges.map((s: string) => (
              <Badge key={toIdString(s)} variant="info">{formatDisplayValue(s)}</Badge>
            ))}
          </div>
        </div>
      </Card>

      {/* Roster History */}
      <Card className="p-6">
        <h2 className="text-h2 font-lato-bold text-custom-text mb-4">Roster History</h2>
        {rosterHistoryItems.length === 0 ? (
          <p className="text-custom-text-secondary">No roster entries found.</p>
        ) : (
          <ul className="space-y-3">
            {rosterHistoryItems.map((r, index) => (
              <li key={`${toIdString(r.rosterId) || 'roster'}-${toIdString(r.joinedAt) || index}`} className="border-b pb-2">
                <div className="font-medium">{formatDisplayValue(r.name) === '-' ? 'Roster' : formatDisplayValue(r.name)}</div>
                <div className="text-sm text-custom-text-secondary">
                  Year: {formatDisplayValue(r.year) === '-' ? 'N/A' : formatDisplayValue(r.year)} · Dues: <span className={r.duesStatus === 'Paid' ? 'text-green-600 font-medium' : 'text-red-600'}>{formatDisplayValue(r.duesStatus) === '-' ? 'Unpaid' : formatDisplayValue(r.duesStatus)}</span>
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
        {applicationItems.length === 0 ? (
          <p className="text-custom-text-secondary">No applications for this camp.</p>
        ) : (
          <div className="space-y-4">
            {applicationItems.map((application, index) => (
              <div key={toIdString(application?._id) || `application-${index}`} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-custom-text">
                      {getApplicationIdLabel(application)}
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
                      {application.status === 'new' ? 'New' : formatDisplayValue(application.status)}
                    </Badge>
                  </div>
                </div>
                
                <p className="text-sm text-custom-text-secondary mb-3">
                  <strong>Motivation:</strong> {formatDisplayValue(application.applicationData?.motivation)}
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
        {taskItems.length === 0 ? (
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
                {taskItems.map((t, index) => (
                  <tr key={toIdString(t?._id) || `task-${index}`} className="border-t">
                    <td className="px-4 py-2 text-sm">{formatDisplayValue(t.title)}</td>
                    <td className="px-4 py-2 text-sm"><Badge variant={t.status === 'completed' ? 'success' : t.status === 'in_progress' ? 'info' : 'warning'}>{formatDisplayValue(t.status)}</Badge></td>
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
        {volunteerShiftItems.length === 0 ? (
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
                {volunteerShiftItems.map((s, index) => (
                  <tr key={toIdString(s?.shiftId) || `shift-${index}`} className="border-t">
                    <td className="px-4 py-2 text-sm font-medium">{formatDisplayValue(s.eventName)}</td>
                    <td className="px-4 py-2 text-sm">{formatDisplayValue(s.title)}</td>
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
        {activityItems.length === 0 ? (
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
                {activityItems.map((log, index) => (
                  <tr key={toIdString(log?._id) || `activity-${index}`} className="border-t">
                    <td className="px-4 py-2 text-sm">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm">{formatDisplayValue(log.activityType)}</td>
                    <td className="px-4 py-2 text-sm">
                      {log.actingUserId?.firstName || log.actingUserId?.lastName
                        ? `${formatDisplayValue(log.actingUserId?.firstName) === '-' ? '' : formatDisplayValue(log.actingUserId?.firstName)} ${formatDisplayValue(log.actingUserId?.lastName) === '-' ? '' : formatDisplayValue(log.actingUserId?.lastName)}`.trim()
                        : formatDisplayValue(log.actingUserId?.email)}
                    </td>
                    <td className="px-4 py-2 text-sm text-custom-text-secondary">
                      {log.details?.field ? `${formatDisplayValue(log.details.field)}: ` : ''}
                      {formatDisplayValue(log.details?.newValueDisplay || log.details?.newValue || log.details?.message)}
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



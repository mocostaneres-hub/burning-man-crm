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
        setData(res);
      } catch (e: any) {
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

  const { user, rosterHistory, applications, tasks, volunteerShifts } = data;

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
          <ul className="space-y-2">
            {rosterHistory.map((r) => (
              <li key={`${r.rosterId}-${r.joinedAt}`} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{r.name || 'Roster'}</div>
                  <div className="text-sm text-custom-text-secondary">Year: {r.year || 'N/A'} · Dues: {r.duesStatus || 'Unpaid'}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Applications */}
      <Card className="p-6">
        <h2 className="text-h2 font-lato-bold text-custom-text mb-4">Applications</h2>
        {applications.length === 0 ? (
          <p className="text-custom-text-secondary">No applications for this camp.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-sm text-custom-text-secondary">Submitted</th>
                  <th className="px-4 py-2 text-left text-sm text-custom-text-secondary">Status</th>
                  <th className="px-4 py-2 text-left text-sm text-custom-text-secondary">Motivation</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((a) => (
                  <tr key={a._id} className="border-t">
                    <td className="px-4 py-2 text-sm">{new Date(a.appliedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-sm">{a.status}</td>
                    <td className="px-4 py-2 text-sm">{a.applicationData?.motivation || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                  <th className="px-4 py-2 text-left text-sm text-custom-text-secondary">Due</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t._id} className="border-t">
                    <td className="px-4 py-2 text-sm">{t.title}</td>
                    <td className="px-4 py-2 text-sm">{t.status}</td>
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
          <ul className="space-y-2">
            {volunteerShifts.map((s) => (
              <li key={s.shiftId} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{s.eventName} · {s.title}</div>
                  <div className="text-sm text-custom-text-secondary">
                    {s.date ? new Date(s.date).toLocaleDateString() : ''} {s.startTime || ''}{s.endTime ? ` - ${s.endTime}` : ''}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default Contact360View;



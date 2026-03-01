import React, { useEffect, useMemo, useState } from 'react';
import { Card, Button, Badge } from '../ui';
import { MapPin, Building, Loader2 } from 'lucide-react';
import api from '../../services/api';

interface CampSummary {
  _id?: string;
  slug?: string;
  name?: string;
  campName?: string;
  hometown?: string;
  location?: string;
  city?: string;
}

interface MembershipSummary {
  _id: string;
  status?: string;
  role?: string;
  isPrimary?: boolean;
  camp?: CampSummary | null;
}

const ACCEPTED_STATUSES = new Set(['active', 'approved', 'accepted']);

const MyCampCard: React.FC = () => {
  const [memberships, setMemberships] = useState<MembershipSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadMemberships = async () => {
      try {
        setLoading(true);
        const response = await api.getMyApplications();
        if (!isMounted) return;
        setMemberships((response.applications || []) as unknown as MembershipSummary[]);
        setError('');
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Error loading memberships for profile:', err);
        setError('Failed to load camp membership.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadMemberships();
    return () => {
      isMounted = false;
    };
  }, []);

  const acceptedMemberships = useMemo(
    () => memberships.filter((m) => ACCEPTED_STATUSES.has(String(m.status || '').toLowerCase()) && m.camp),
    [memberships]
  );

  const selectedMembership = useMemo(() => {
    const primary = acceptedMemberships.find((m) => m.isPrimary === true);
    return primary || acceptedMemberships[0] || null;
  }, [acceptedMemberships]);

  const selectedCamp = selectedMembership?.camp || null;
  const campName = selectedCamp?.campName || selectedCamp?.name || 'Unknown Camp';
  const campLocation = selectedCamp?.hometown || selectedCamp?.location || selectedCamp?.city || '';
  const campRole = selectedMembership?.role ? String(selectedMembership.role) : 'member';
  const campPath = selectedCamp ? `/camps/${selectedCamp.slug || selectedCamp._id}` : '/camps/discovery';

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-lato-bold text-custom-text flex items-center gap-2">
          <Building className="w-5 h-5 text-custom-primary" />
          My Camp
        </h2>
        {selectedMembership?.isPrimary && <Badge variant="info">Primary</Badge>}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-custom-text-secondary">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading camp membership...
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !selectedMembership || !selectedCamp ? (
        <p className="text-sm text-custom-text-secondary">
          You are not currently an accepted member of any camp.
        </p>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-lg font-semibold text-custom-text">{campName}</p>
            {campLocation && (
              <p className="text-sm text-custom-text-secondary flex items-center gap-1 mt-1">
                <MapPin className="w-4 h-4" />
                {campLocation}
              </p>
            )}
          </div>

          <p className="text-sm text-custom-text-secondary">
            Role in camp: <span className="font-medium text-custom-text">{campRole}</span>
          </p>

          {acceptedMemberships.length > 1 && (
            <p className="text-xs text-custom-text-secondary">
              {acceptedMemberships.length} accepted camp memberships found.
            </p>
          )}

          <Button variant="outline" size="sm" onClick={() => window.location.assign(campPath)}>
            View Camp
          </Button>
        </div>
      )}
    </Card>
  );
};

export default MyCampCard;

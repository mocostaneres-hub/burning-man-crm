import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';
import { MyShiftsResponse } from '../../types';
import ShiftCard from '../../components/shifts/ShiftCard';
import { Card } from '../../components/ui';

const emptyData: MyShiftsResponse = {
  camps: [],
  availableShifts: [],
  signedUpShifts: []
};

const MyShiftsPage: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<MyShiftsResponse>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionShiftId, setActionShiftId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getMyShifts();
      setData(response || emptyData);
    } catch (err: any) {
      console.error('Failed to load my shifts:', err);
      setError(err?.response?.data?.message || 'Failed to load your shifts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.accountType === 'personal') {
      loadData();
    }
  }, [user?.accountType, loadData]);

  const handleSignUp = async (shiftId: string) => {
    try {
      setActionShiftId(shiftId);
      await apiService.signUpForShift(shiftId);
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to sign up for shift.');
    } finally {
      setActionShiftId(null);
    }
  };

  const handleCancel = async (shiftId: string) => {
    try {
      setActionShiftId(shiftId);
      await apiService.cancelShiftSignup(shiftId);
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to cancel shift signup.');
    } finally {
      setActionShiftId(null);
    }
  };

  const available = useMemo(() => data.availableShifts || [], [data.availableShifts]);
  const signed = useMemo(() => data.signedUpShifts || [], [data.signedUpShifts]);

  if (user?.accountType !== 'personal') {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <Card className="p-6">
          <h1 className="text-xl font-semibold text-custom-text">My Shifts</h1>
          <p className="text-sm text-gray-600 mt-2">This page is available for member accounts.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-h1 font-lato-bold text-custom-text">My Shifts</h1>
        <p className="text-sm text-gray-600 mt-1">Sign up for camp shifts and manage your commitments.</p>
      </div>

      {error && (
        <div className="p-3 border border-red-200 bg-red-50 text-red-800 rounded-md text-sm">{error}</div>
      )}

      <Card className="p-4">
        <h2 className="text-lg font-semibold text-custom-text mb-3">Shifts Needing Signup</h2>
        {loading ? (
          <div className="text-sm text-gray-500">Loading shifts...</div>
        ) : available.length === 0 ? (
          <div className="text-sm text-gray-500">No available shifts right now.</div>
        ) : (
          <div className="space-y-3">
            {available.map((shift) => (
              <ShiftCard
                key={shift.shiftId}
                shift={shift}
                mode="available"
                loading={actionShiftId === shift.shiftId}
                onSignUp={handleSignUp}
              />
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-semibold text-custom-text mb-3">My Signed-Up Shifts</h2>
        {loading ? (
          <div className="text-sm text-gray-500">Loading shifts...</div>
        ) : signed.length === 0 ? (
          <div className="text-sm text-gray-500">You have not signed up for shifts yet.</div>
        ) : (
          <div className="space-y-3">
            {signed.map((shift) => (
              <ShiftCard
                key={shift.shiftId}
                shift={shift}
                mode="signed"
                loading={actionShiftId === shift.shiftId}
                onCancel={handleCancel}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default MyShiftsPage;

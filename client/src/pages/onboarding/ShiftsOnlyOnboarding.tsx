import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Input } from '../../components/ui';
import apiService from '../../services/api';
import { useSkills } from '../../hooks/useSkills';
import { useAuth } from '../../contexts/AuthContext';

const ShiftsOnlyOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const { refreshUser, user } = useAuth();
  const { skills: skillOptions, loading: skillsLoading } = useSkills();
  const [selectedSkills, setSelectedSkills] = useState<string[]>(user?.skills || []);
  const [playaName, setPlayaName] = useState(user?.playaName || '');
  const [profilePhoto, setProfilePhoto] = useState(user?.profilePhoto || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
  };

  const handleSubmit = async () => {
    try {
      setError('');
      if (selectedSkills.length === 0) {
        setError('Please select at least one skill.');
        return;
      }
      setSaving(true);
      await apiService.post('/onboarding/shifts-only-complete', {
        skills: selectedSkills,
        playaName: playaName.trim(),
        profilePhoto: profilePhoto.trim()
      });
      await refreshUser();
      navigate('/my-shifts', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to complete onboarding');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-custom-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-6">
        <h1 className="text-2xl font-lato-bold text-custom-text mb-2">Complete your shifts profile</h1>
        <p className="text-custom-text-secondary mb-6">
          Select at least one skill to continue. Playa name and profile photo are optional.
        </p>

        {error && <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-red-700 text-sm">{error}</div>}

        <div className="mb-5">
          <p className="text-sm font-medium text-custom-text mb-2">Skills (required)</p>
          {skillsLoading ? (
            <p className="text-sm text-custom-text-secondary">Loading skills...</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {skillOptions.map((skill) => {
                const active = selectedSkills.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className={`px-3 py-1 rounded-full border text-sm ${active ? 'bg-custom-primary text-white border-custom-primary' : 'bg-white text-custom-text border-gray-300'}`}
                  >
                    {skill}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Playa Name (optional)" value={playaName} onChange={(e) => setPlayaName(e.target.value)} />
          <Input
            label="Profile Photo URL (optional)"
            value={profilePhoto}
            onChange={(e) => setProfilePhoto(e.target.value)}
          />
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Continue to My Shifts'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ShiftsOnlyOnboarding;

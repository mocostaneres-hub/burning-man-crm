import { useState, useEffect } from 'react';
import api from '../services/api';

interface Skill {
  _id: number;
  name: string;
  description: string;
  isActive: boolean;
}

export const useSkills = () => {
  const [skills, setSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        setLoading(true);
        const response = await api.get('/skills');
        // Extract just the skill names, sorted alphabetically
        const skillNames = response.map((skill: Skill) => skill.name).sort();
        setSkills(skillNames);
        setError(null);
      } catch (err) {
        console.error('Error fetching skills:', err);
        setError('Failed to load skills');
        // Fallback to empty array if fetch fails
        setSkills([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSkills();
  }, []);

  return { skills, loading, error };
};


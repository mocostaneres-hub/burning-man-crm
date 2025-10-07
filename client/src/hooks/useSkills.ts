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
        
        // If API returns empty array, use fallback skills
        if (skillNames.length === 0) {
          console.log('⚠️ [useSkills] API returned empty array, using fallback skills');
          setSkills([
            'Art/Creative',
            'Building/Construction',
            'Cooking',
            'DJ/Music',
            'Electrical',
            'Event Planning',
            'First Aid/Medical',
            'Leadership',
            'Plumbing',
            'Teaching/Mentoring',
            'Welding'
          ]);
        } else {
          setSkills(skillNames);
        }
        setError(null);
      } catch (err) {
        console.error('Error fetching skills:', err);
        setError('Failed to load skills');
        // Fallback to common Burning Man skills if fetch fails
        setSkills([
          'Art/Creative',
          'Building/Construction',
          'Cooking',
          'DJ/Music',
          'Electrical',
          'Event Planning',
          'First Aid/Medical',
          'Leadership',
          'Plumbing',
          'Teaching/Mentoring',
          'Welding'
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchSkills();
  }, []);

  return { skills, loading, error };
};


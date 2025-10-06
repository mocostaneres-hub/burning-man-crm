import React, { useState, useEffect } from 'react';
import { Button, Input } from '../ui';
import { Plus, Edit, Trash2, X, CheckCircle } from 'lucide-react';
import api from '../../services/api';

interface Skill {
  _id: number;
  name: string;
  description: string;
  isActive: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

const SkillsManagement: React.FC = () => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchSkills();
  }, []);

  const fetchSkills = async () => {
    try {
      setLoading(true);
      const response = await api.get('/skills/all');
      // Handle response - api.get already extracts .data
      setSkills(Array.isArray(response) ? response : []);
    } catch (err: any) {
      console.error('Error fetching skills:', err);
      setError('Failed to load skills');
      setSkills([]); // Ensure skills is always an array
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name.trim()) {
      setError('Skill name is required');
      return;
    }

    try {
      await api.post('/skills', formData);
      setSuccess('Skill created successfully');
      setFormData({ name: '', description: '' });
      setShowCreateForm(false);
      await fetchSkills();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create skill');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSkill) return;
    
    setError('');
    setSuccess('');

    if (!formData.name.trim()) {
      setError('Skill name is required');
      return;
    }

    try {
      await api.put(`/skills/${editingSkill._id}`, formData);
      setSuccess('Skill updated successfully');
      setEditingSkill(null);
      setFormData({ name: '', description: '' });
      await fetchSkills();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update skill');
    }
  };

  const handleDelete = async (skillId: number) => {
    if (!window.confirm('Are you sure you want to deactivate this skill? It will no longer appear in dropdown menus.')) {
      return;
    }

    try {
      await api.delete(`/skills/${skillId}`);
      setSuccess('Skill deactivated successfully');
      await fetchSkills();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to deactivate skill');
    }
  };

  const handleActivate = async (skillId: number) => {
    try {
      await api.put(`/skills/${skillId}`, { isActive: true });
      setSuccess('Skill activated successfully');
      await fetchSkills();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to activate skill');
    }
  };

  const startEdit = (skill: Skill) => {
    setEditingSkill(skill);
    setFormData({
      name: skill.name,
      description: skill.description
    });
    setShowCreateForm(false);
    setError('');
    setSuccess('');
  };

  const cancelEdit = () => {
    setEditingSkill(null);
    setFormData({ name: '', description: '' });
    setError('');
  };

  const startCreate = () => {
    setShowCreateForm(true);
    setEditingSkill(null);
    setFormData({ name: '', description: '' });
    setError('');
    setSuccess('');
  };

  const cancelCreate = () => {
    setShowCreateForm(false);
    setFormData({ name: '', description: '' });
    setError('');
  };

  if (loading) {
    return <div className="text-center py-8">Loading skills...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Skills Management</h2>
          <p className="text-gray-600 mt-1">
            Manage skills that users can select across the platform. Changes are reflected immediately.
          </p>
        </div>
        {!showCreateForm && !editingSkill && (
          <Button onClick={startCreate} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Skill
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Create New Skill</h3>
          
          <Input
            label="Skill Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Welding, First Aid"
            required
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the skill..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3">
            <Button type="submit" className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Create Skill
            </Button>
            <Button type="button" variant="outline" onClick={cancelCreate} className="flex items-center gap-2">
              <X className="w-4 h-4" />
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Edit Form */}
      {editingSkill && (
        <form onSubmit={handleUpdate} className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Edit Skill</h3>
          
          <Input
            label="Skill Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3">
            <Button type="submit" className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Update Skill
            </Button>
            <Button type="button" variant="outline" onClick={cancelEdit} className="flex items-center gap-2">
              <X className="w-4 h-4" />
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Skills List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Skill Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {skills.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                  No skills found
                </td>
              </tr>
            ) : (
              skills.map((skill) => (
                <tr key={skill._id} className={!skill.isActive ? 'bg-gray-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{skill.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600">
                      {skill.description || <span className="italic text-gray-400">No description</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {skill.isActive ? (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    {skill.isActive ? (
                      <>
                        <button
                          onClick={() => startEdit(skill)}
                          className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(skill._id)}
                          className="text-red-600 hover:text-red-900 inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" />
                          Deactivate
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleActivate(skill._id)}
                        className="text-green-600 hover:text-green-900 inline-flex items-center gap-1"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Activate
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-gray-600 space-y-2">
        <p><strong>Note:</strong> Skills are used throughout the platform:</p>
        <ul className="list-disc list-inside ml-4 space-y-1">
          <li>User profile skill selection</li>
          <li>Camp application forms</li>
          <li>Member roster information</li>
          <li>Add member forms</li>
        </ul>
        <p className="text-xs text-gray-500 mt-3">
          <strong>Deactivating</strong> a skill will remove it from dropdown menus but won't delete existing user skill assignments.
        </p>
      </div>
    </div>
  );
};

export default SkillsManagement;


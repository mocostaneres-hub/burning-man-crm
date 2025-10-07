import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Input } from '../../components/ui';
import { 
  Plus, Edit, Trash2, Save, 
  Home
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import SkillsManagement from '../../components/admin/SkillsManagement';

interface CampCategory {
  _id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface GlobalPerk {
  _id: string;
  name: string;
  icon: string;
  color: string;
  createdAt?: string;
  updatedAt?: string;
}

const SystemConfig: React.FC = () => {
  const { user } = useAuth();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'perks' | 'categories' | 'skills'>('perks');
  
  // Categories state
  const [categories, setCategories] = useState<CampCategory[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CampCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '' });
  const [categoryLoading, setCategoryLoading] = useState(false);

  // Perks state
  const [perks, setPerks] = useState<GlobalPerk[]>([]);
  const [showPerkModal, setShowPerkModal] = useState(false);
  const [editingPerk, setEditingPerk] = useState<GlobalPerk | null>(null);
  const [perkForm, setPerkForm] = useState({ name: '', icon: '', color: '' });
  const [perkLoading, setPerkLoading] = useState(false);

  useEffect(() => {
    if (user?.accountType === 'admin') {
      loadCategories();
      loadPerks();
    }
  }, [user]);

  const loadCategories = async () => {
    try {
      const response = await api.get('/categories');
      console.log('SystemConfig loadCategories response:', response);
      // The API service already unwraps response.data, so response IS the data
      const categoriesData = response.categories || [];
      console.log('Setting categories:', categoriesData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadPerks = async () => {
    try {
      const response = await api.get('/admin/perks');
      console.log('SystemConfig loadPerks response:', response);
      // The API service already unwraps response.data, so response IS the data
      const perksData = response.perks || response.data || [];
      setPerks(perksData);
    } catch (error) {
      console.error('Failed to load perks:', error);
    }
  };

  const handleCreateCategory = async () => {
    console.log('Creating category with form data:', categoryForm);
    setCategoryLoading(true);
    try {
      const response = await api.post('/categories', categoryForm);
      console.log('Category creation response:', response);
      await loadCategories();
      setShowCategoryModal(false);
      setCategoryForm({ name: '' });
    } catch (error) {
      console.error('Failed to create category:', error);
      console.error('Error details:', error.response?.data);
    } finally {
      setCategoryLoading(false);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;
    
    setCategoryLoading(true);
    try {
      await api.put(`/categories/${editingCategory._id}`, categoryForm);
      await loadCategories();
      setShowCategoryModal(false);
      setEditingCategory(null);
      setCategoryForm({ name: '' });
    } catch (error) {
      console.error('Failed to update category:', error);
    } finally {
      setCategoryLoading(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    
    try {
      await api.delete(`/categories/${id}`);
      await loadCategories();
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };


  const openEditCategory = (category: CampCategory) => {
    setEditingCategory(category);
    setCategoryForm({ name: category.name });
    setShowCategoryModal(true);
  };

  // Perk handlers
  const handleCreatePerk = async () => {
    console.log('Creating perk with form data:', perkForm);
    setPerkLoading(true);
    try {
      const response = await api.post('/admin/perks', perkForm);
      console.log('Perk creation response:', response);
      await loadPerks();
      setShowPerkModal(false);
      setPerkForm({ name: '', icon: '', color: '' });
    } catch (error) {
      console.error('Failed to create perk:', error);
      console.error('Error details:', error.response?.data);
    } finally {
      setPerkLoading(false);
    }
  };

  const handleUpdatePerk = async () => {
    if (!editingPerk) return;
    
    setPerkLoading(true);
    try {
      await api.put(`/admin/perks/${editingPerk._id}`, perkForm);
      await loadPerks();
      setShowPerkModal(false);
      setEditingPerk(null);
      setPerkForm({ name: '', icon: '', color: '' });
    } catch (error) {
      console.error('Failed to update perk:', error);
    } finally {
      setPerkLoading(false);
    }
  };

  const handleDeletePerk = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this perk?')) return;
    
    try {
      await api.delete(`/admin/perks/${id}`);
      await loadPerks();
    } catch (error) {
      console.error('Failed to delete perk:', error);
    }
  };

  const openEditPerk = (perk: GlobalPerk) => {
    setEditingPerk(perk);
    setPerkForm({ name: perk.name, icon: perk.icon, color: perk.color });
    setShowPerkModal(true);
  };

  if (user?.accountType !== 'admin') {
    return (
      <Card className="p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
        <p className="text-gray-600">You need system admin privileges to access this page.</p>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">System Configuration</h2>
        <p className="text-gray-600 mt-1">
          Manage shared amenities and camp categories for the platform.
        </p>
      </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('perks')}
              className={`${
                activeTab === 'perks'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
                    <Home className="w-4 h-4" />
              Shared Amenities
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`${
                activeTab === 'categories'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <Edit className="w-4 h-4" />
              Camp Categories
            </button>
            <button
              onClick={() => setActiveTab('skills')}
              className={`${
                activeTab === 'skills'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <Save className="w-4 h-4" />
              Skills
            </button>
          </nav>
        </div>

        {/* Shared Amenities Tab */}
        {activeTab === 'perks' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Shared Amenities</h2>
              <Button
                onClick={() => {
                  setEditingPerk(null);
                  setPerkForm({ name: '', icon: '', color: '' });
                  setShowPerkModal(true);
                }}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Amenity
              </Button>
            </div>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Icon
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Color
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {perks.map((perk) => (
                      <tr key={perk._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{perk.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{perk.icon}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${perk.color} text-gray-700`}>
                            {perk.color}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => openEditPerk(perk)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePerk(perk._id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Camp Categories</h2>
              <Button
                onClick={() => {
                  setEditingCategory(null);
                  setCategoryForm({ name: '' });
                  setShowCategoryModal(true);
                }}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Category
              </Button>
            </div>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {categories.map((category) => (
                      <tr key={category._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{category.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {new Date(category.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => openEditCategory(category)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(category._id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Perk Modal */}
        <Modal
          isOpen={showPerkModal}
          onClose={() => {
            setShowPerkModal(false);
            setEditingPerk(null);
            setPerkForm({ name: '', icon: '', color: '' });
          }}
          title={editingPerk ? 'Edit Amenity' : 'Add New Amenity'}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amenity Name
              </label>
              <Input
                value={perkForm.name}
                onChange={(e) => setPerkForm({ ...perkForm, name: e.target.value })}
                placeholder="e.g., WiFi, Coffee, Showers"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Icon Name (Lucide React)
              </label>
              <Input
                value={perkForm.icon}
                onChange={(e) => setPerkForm({ ...perkForm, icon: e.target.value })}
                placeholder="e.g., Wifi, Coffee, Waves"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use valid Lucide React icon names (case-sensitive)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color (Tailwind Class)
              </label>
              <Input
                value={perkForm.color}
                onChange={(e) => setPerkForm({ ...perkForm, color: e.target.value })}
                placeholder="e.g., bg-blue-100, bg-green-100"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use Tailwind CSS background color classes
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPerkModal(false);
                  setEditingPerk(null);
                  setPerkForm({ name: '', icon: '', color: '' });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={editingPerk ? handleUpdatePerk : handleCreatePerk}
                disabled={perkLoading || !perkForm.name || !perkForm.icon || !perkForm.color}
                className="flex items-center gap-2"
              >
                {perkLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {editingPerk ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Category Modal */}
        <Modal
          isOpen={showCategoryModal}
          onClose={() => {
            setShowCategoryModal(false);
            setEditingCategory(null);
            setCategoryForm({ name: '' });
          }}
          title={editingCategory ? 'Edit Category' : 'Add New Category'}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category Name
              </label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ name: e.target.value })}
                placeholder="e.g., Art & Music, Food, Infrastructure"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategory(null);
                  setCategoryForm({ name: '' });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={editingCategory ? handleUpdateCategory : handleCreateCategory}
                disabled={categoryLoading || !categoryForm.name}
                className="flex items-center gap-2"
              >
                {categoryLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {editingCategory ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Skills Tab */}
        {activeTab === 'skills' && (
          <SkillsManagement />
        )}
    </div>
  );
};

export default SystemConfig;

import React, { useState, useEffect } from 'react';
import { Button, Card, Badge, Modal, Input } from '../../components/ui';
import { Users, Building as BuildingIcon, Shield, RefreshCw, Edit, Ban as BanIcon, CheckCircle as CheckCircleIcon, Search as SearchIcon, Loader2, User as UserIcon, Clock, Eye, Trash2 } from 'lucide-react';
import apiService from '../../services/api';
import { User as UserType } from '../../types';
import SystemConfig from './SystemConfig';
import UserProfileHistory from '../../components/admin/UserProfileHistory';

// Extended User interface for admin editing with all fields
interface ExtendedUser extends UserType {
  // Override specific fields that need different types for admin editing
  hasTicket?: boolean | null;
  hasVehiclePass?: boolean | null;
  userHistory?: any[];
}

interface DashboardStats {
  totalUsers: number;
  totalCamps: number;
  totalMembers: number;
  activeCamps: number;
}

interface Camp {
  _id: string;
  name: string;
  campName?: string; // Keep for backward compatibility
  slug?: string;
  hometown?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  memberCount?: number;
  members?: any[];
  isActive: boolean;
  createdAt: string;
  description?: string;
  theme?: string;
  contactEmail?: string;
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalCamps: 0,
    totalMembers: 0,
    activeCamps: 0
  });
  const [users, setUsers] = useState<UserType[]>([]);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedCamp, setSelectedCamp] = useState<Camp | null>(null);
  const [showCampModal, setShowCampModal] = useState(false);
  const [showDeleteCampModal, setShowDeleteCampModal] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadStats(),
        loadUsers(),
        loadCamps()
      ]);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await apiService.get('/admin/dashboard');
      console.log('🔍 [AdminDashboard] Stats response:', response);
      // Ensure response.data exists and has the expected structure
      if (response && response.stats && typeof response.stats === 'object') {
        console.log('✅ [AdminDashboard] Setting stats:', response.stats);
        setStats({
          totalUsers: response.stats.totalUsers || 0,
          totalCamps: response.stats.totalCamps || 0,
          totalMembers: response.stats.totalMembers || 0,
          activeCamps: response.stats.activeCamps || 0
        });
      } else {
        console.log('❌ [AdminDashboard] Invalid stats response structure:', response);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
      // Keep the existing default stats on error - don't reset to undefined
    }
  };

  const loadUsers = async () => {
    try {
      const response = await apiService.get('/admin/users');
      console.log('🔍 [AdminDashboard] Users response:', response);
      // Backend returns { users: users[], totalPages, currentPage, total }
      const userData = response.users || response.data?.users || response.data;
      setUsers(Array.isArray(userData) ? userData : []);
    } catch (err) {
      console.error('Error loading users:', err);
      setUsers([]); // Ensure users is always an array
    }
  };

  const loadCamps = async () => {
    try {
      const response = await apiService.get('/admin/camps');
      console.log('🔍 [AdminDashboard] Camps response:', response);
      // Backend returns { data: camps[], totalPages, currentPage, total }
      const campData = response.data || response.camps;
      setCamps(Array.isArray(campData) ? campData : []);
    } catch (err) {
      console.error('Error loading camps:', err);
      setCamps([]); // Ensure camps is always an array
    }
  };

  const handleUserEdit = (user: UserType) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const handleViewHistory = (userId: number) => {
    setSelectedUserId(userId);
    setShowHistoryModal(true);
  };

  const handleUserSave = async (updatedUser: UserType) => {
    try {
      const response = await apiService.put(`/users/${updatedUser._id}`, updatedUser);
      // Update the user in the local state with the response from the server
      const savedUser = response.user || response.data?.user || updatedUser;
      setUsers(users.map(u => u._id === updatedUser._id ? savedUser : u));
      setShowUserModal(false);
      setSelectedUser(null);
      
      // Show success message
      alert('User updated successfully! Changes will be reflected across all views.');
    } catch (err) {
      console.error('Error updating user:', err);
      alert('Failed to update user. Please try again.');
    }
  };

  const handleUserToggleActive = async (userId: number) => {
    try {
      const user = users.find(u => u._id === userId);
      if (user) {
        const updatedUser = { ...user, isActive: !user.isActive };
        const response = await apiService.put(`/users/${userId}`, updatedUser);
        const savedUser = response.user || response.data?.user || updatedUser;
        setUsers(users.map(u => u._id === userId ? savedUser : u));
      }
    } catch (err) {
      console.error('Error toggling user status:', err);
    }
  };

  const handleCampView = (camp: Camp) => {
    // Open camp in new tab
    const slug = camp.slug || camp._id;
    window.open(`/camps/public/${slug}`, '_blank');
  };

  const handleCampEdit = (camp: Camp) => {
    setSelectedCamp(camp);
    setShowCampModal(true);
  };

  const handleCampDelete = (camp: Camp) => {
    setSelectedCamp(camp);
    setShowDeleteCampModal(true);
  };

  const confirmDeleteCamp = async () => {
    if (!selectedCamp) return;

    try {
      await apiService.delete(`/admin/camps/${selectedCamp._id}`);
      setCamps(camps.filter(c => c._id !== selectedCamp._id));
      setShowDeleteCampModal(false);
      setSelectedCamp(null);
      alert('Camp deleted successfully!');
      loadStats(); // Refresh stats
    } catch (err) {
      console.error('Error deleting camp:', err);
      alert('Failed to delete camp. Please try again.');
    }
  };

  const handleCampSave = async (updatedCamp: Camp) => {
    try {
      const response = await apiService.put(`/admin/camps/${updatedCamp._id}`, updatedCamp);
      const savedCamp = response.camp || response.data?.camp || updatedCamp;
      setCamps(camps.map(c => c._id === updatedCamp._id ? savedCamp : c));
      setShowCampModal(false);
      setSelectedCamp(null);
      alert('Camp updated successfully!');
    } catch (err) {
      console.error('Error updating camp:', err);
      alert('Failed to update camp. Please try again.');
    }
  };

  const filteredUsers = (users || []).filter(user =>
    (user.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.lastName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCamps = (camps || []).filter(camp =>
    (camp.name || camp.campName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (camp.hometown && camp.hometown.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (camp.location?.city && camp.location.city.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-custom-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-h1 font-lato-bold text-custom-text mb-2">
            Admin
          </h1>
          <p className="text-body text-custom-text-secondary">
            Manage users, camps, and system settings
          </p>
        </div>
        <Button
          variant="outline"
          onClick={loadDashboardData}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-custom-text-secondary">Total Users</p>
              <p className="text-2xl font-lato-bold text-custom-text">{stats?.totalUsers || 0}</p>
            </div>
            <Users className="w-8 h-8 text-custom-primary" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-custom-text-secondary">Total Camps</p>
              <p className="text-2xl font-lato-bold text-custom-text">{stats?.totalCamps || 0}</p>
            </div>
            <BuildingIcon className="w-8 h-8 text-custom-primary" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-custom-text-secondary">Total Members</p>
              <p className="text-2xl font-lato-bold text-custom-text">{stats?.totalMembers || 0}</p>
            </div>
            <Users className="w-8 h-8 text-custom-secondary" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-custom-text-secondary">Active Camps</p>
              <p className="text-2xl font-lato-bold text-custom-text">{stats?.activeCamps || 0}</p>
            </div>
            <Shield className="w-8 h-8 text-custom-accent" />
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {['Users', 'Camps', 'Configuration'].map((tab, index) => (
              <button
                key={tab}
                onClick={() => setActiveTab(index)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === index
                    ? 'border-custom-primary text-custom-primary'
                    : 'border-transparent text-custom-text-secondary hover:text-custom-text hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Search - only show for Users and Camps tabs */}
      {activeTab !== 2 && (
        <div className="mb-6">
          <div className="relative max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search users or camps..."
              className="pl-10"
            />
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 0 && (
        <Card>
          <div className="p-6">
            <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
              Users Management
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      UID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Account Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Camp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono text-gray-900 font-medium">
                          {user._id}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={user.accountType === 'admin' ? 'success' : user.accountType === 'camp' ? 'info' : 'neutral'}>
                          {user.accountType}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.campName ? (
                          <div>
                            <div className="font-medium">{user.campName}</div>
                            <div className="text-xs text-gray-500">Active Member</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={user.isActive ? 'success' : 'error'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUserEdit(user)}
                            className="flex items-center gap-1"
                          >
                            <Edit className="w-3 h-3" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewHistory(user._id)}
                            className="flex items-center gap-1 text-blue-600 border-blue-600 hover:bg-blue-50"
                          >
                            <Clock className="w-3 h-3" />
                            History
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUserToggleActive(user._id)}
                            className={`flex items-center gap-1 ${
                              user.isActive 
                                ? 'text-red-600 border-red-600 hover:bg-red-50' 
                                : 'text-green-600 border-green-600 hover:bg-green-50'
                            }`}
                          >
                            {user.isActive ? (
                              <>
                                <BanIcon className="w-3 h-3" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <CheckCircleIcon className="w-3 h-3" />
                                Activate
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredUsers.length === 0 && (
              <div className="text-center py-12">
                <p className="text-custom-text-secondary">No users found</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Camps Tab */}
      {activeTab === 1 && (
        <Card>
          <div className="p-6">
            <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
              Camps Management
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Camp Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hometown
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Members
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
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
                  {filteredCamps.map((camp) => (
                    <tr key={camp._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {camp.name || camp.campName || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {camp.hometown || camp.location?.city || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {camp.memberCount || camp.members?.length || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={camp.isActive !== false ? 'success' : 'error'}>
                          {camp.isActive !== false ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {camp.createdAt ? new Date(camp.createdAt).toLocaleDateString() : 'Invalid Date'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCampView(camp)}
                            className="flex items-center gap-1 text-blue-600 border-blue-600 hover:bg-blue-50"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCampEdit(camp)}
                            className="flex items-center gap-1"
                          >
                            <Edit className="w-3 h-3" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCampDelete(camp)}
                            className="flex items-center gap-1 text-red-600 border-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredCamps.length === 0 && (
              <div className="text-center py-12">
                <p className="text-custom-text-secondary">No camps found</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Configuration Tab */}
      {activeTab === 2 && (
        <SystemConfig />
      )}

      {/* User Edit Modal */}
      {showUserModal && selectedUser && (
        <UserEditModal
          user={selectedUser}
          onClose={() => {
            setShowUserModal(false);
            setSelectedUser(null);
          }}
          onSave={handleUserSave}
        />
      )}

      {/* User History Modal */}
      {showHistoryModal && selectedUserId && (
        <UserProfileHistory
          userId={selectedUserId}
          isOpen={showHistoryModal}
          onClose={() => {
            setShowHistoryModal(false);
            setSelectedUserId(null);
          }}
        />
      )}

      {/* Camp Edit Modal */}
      <Modal
        isOpen={showCampModal}
        onClose={() => {
          setShowCampModal(false);
          setSelectedCamp(null);
        }}
        title="Edit Camp"
      >
        {selectedCamp && (
          <div className="space-y-6">
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Camp Name
              </label>
              <Input
                value={selectedCamp.name}
                onChange={(e) => setSelectedCamp({ ...selectedCamp, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Description
              </label>
              <textarea
                value={selectedCamp.description || ''}
                onChange={(e) => setSelectedCamp({ ...selectedCamp, description: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent min-h-[100px]"
              />
            </div>
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Theme
              </label>
              <Input
                value={selectedCamp.theme || ''}
                onChange={(e) => setSelectedCamp({ ...selectedCamp, theme: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Hometown
              </label>
              <Input
                value={selectedCamp.hometown || ''}
                onChange={(e) => setSelectedCamp({ ...selectedCamp, hometown: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedCamp.isActive !== false}
                onChange={(e) => setSelectedCamp({ ...selectedCamp, isActive: e.target.checked })}
                className="rounded border-gray-300 text-custom-primary focus:ring-custom-primary"
              />
              <label className="text-sm text-custom-text">Active</label>
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => handleCampSave(selectedCamp)}
                className="flex-1"
              >
                Save Changes
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCampModal(false);
                  setSelectedCamp(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Camp Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteCampModal}
        onClose={() => {
          setShowDeleteCampModal(false);
          setSelectedCamp(null);
        }}
        title="Delete Camp"
      >
        {selectedCamp && (
          <div className="space-y-4">
            <p className="text-custom-text">
              Are you sure you want to delete <strong>{selectedCamp.name}</strong>? 
              This action cannot be undone and will remove all associated data.
            </p>
            <div className="flex gap-3 pt-4">
              <Button
                onClick={confirmDeleteCamp}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Delete Camp
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteCampModal(false);
                  setSelectedCamp(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

// Enhanced User Edit Modal Component with Full SystemAdmin Controls
const UserEditModal: React.FC<{
  user: UserType;
  onClose: () => void;
  onSave: (user: UserType) => void;
}> = ({ user, onClose, onSave }) => {
  const [formData, setFormData] = useState<ExtendedUser>({
    ...user,
    location: typeof user.location === 'string' 
      ? { city: user.location, state: '', country: '' }
      : user.location || { city: '', state: '', country: '' }
  } as ExtendedUser);
  const [photoPreview, setPhotoPreview] = useState<string | null>(user.profilePhoto || null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleSave = () => {
    // TODO: Handle photo upload if photoFile exists
    onSave(formData as UserType);
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoDelete = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setFormData({ ...formData, profilePhoto: '' });
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`SystemAdmin: Edit User ${formData._id}`}
      size="lg"
    >
      <div className="space-y-6 max-h-[80vh] overflow-y-auto">
        {/* Profile Photo Management */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <label className="block text-label font-medium text-custom-text mb-3">
            Profile Photo Management
          </label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
              {photoPreview ? (
                <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload Photo
              </Button>
              {photoPreview && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePhotoDelete}
                  className="text-red-600 border-red-600 hover:bg-red-50"
                >
                  Delete Photo
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Basic Information */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-medium text-custom-text mb-4">Basic Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                User ID (UID)
              </label>
              <Input
                value={formData._id}
                disabled
                className="bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Email
              </label>
              <Input
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                First Name
              </label>
              <Input
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Last Name
              </label>
              <Input
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Account Settings */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-medium text-custom-text mb-4">Account Settings</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Account Type
              </label>
              <select
                value={formData.accountType}
                onChange={(e) => setFormData({ ...formData, accountType: e.target.value as any })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent"
              >
                <option value="personal">Personal</option>
                <option value="camp">Camp</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Camp Affiliation
              </label>
              <Input
                value={formData.campName || ''}
                onChange={(e) => setFormData({ ...formData, campName: e.target.value })}
                placeholder="Current camp (if any)"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-gray-300 text-custom-primary focus:ring-custom-primary"
              />
              <label className="text-sm text-custom-text">Active</label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.isVerified}
                onChange={(e) => setFormData({ ...formData, isVerified: e.target.checked })}
                className="rounded border-gray-300 text-custom-primary focus:ring-custom-primary"
              />
              <label className="text-sm text-custom-text">Verified</label>
            </div>
          </div>
        </div>

        {/* Personal Details */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-medium text-custom-text mb-4">Personal Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Phone Number
              </label>
              <Input
                value={formData.phoneNumber || ''}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              />
            </div>
                <div>
                  <label className="block text-label font-medium text-custom-text mb-2">
                    City
                  </label>
                  <Input
                    value={formData.city || ''}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Playa Name
              </label>
              <Input
                value={formData.playaName || ''}
                onChange={(e) => setFormData({ ...formData, playaName: e.target.value })}
                placeholder="Burner name"
              />
            </div>
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Years Burned
              </label>
              <Input
                type="number"
                value={formData.yearsBurned || 0}
                onChange={(e) => setFormData({ ...formData, yearsBurned: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Previous Camps
              </label>
              <Input
                value={formData.previousCamps || ''}
                onChange={(e) => setFormData({ ...formData, previousCamps: e.target.value })}
              />
            </div>
                <div>
                  <label className="block text-label font-medium text-custom-text mb-2">
                    Location (State)
                  </label>
                  <Input
                    value={formData.location?.state || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      location: { ...formData.location, state: e.target.value }
                    })}
                    placeholder="State/Province"
                  />
                </div>
                <div>
                  <label className="block text-label font-medium text-custom-text mb-2">
                    Location (Country)
                  </label>
                  <Input
                    value={formData.location?.country || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      location: { ...formData.location, country: e.target.value }
                    })}
                    placeholder="Country"
                  />
                </div>
          </div>
          
          <div className="mt-4">
            <label className="block text-label font-medium text-custom-text mb-2">
              Bio
            </label>
            <textarea
              value={formData.bio || ''}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              rows={3}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent"
            />
          </div>

          <div className="mt-4">
            <label className="block text-label font-medium text-custom-text mb-2">
              Burning Man Experience
            </label>
            <select
              value={formData.burningManExperience || ''}
              onChange={(e) => setFormData({ ...formData, burningManExperience: e.target.value as any })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent"
            >
              <option value="">Select experience level</option>
              <option value="first-timer">First-timer</option>
              <option value="1-2-years">1-2 years</option>
              <option value="3-5-years">3-5 years</option>
              <option value="5+ years">5+ years</option>
              <option value="veteran">Veteran</option>
            </select>
          </div>
        </div>

        {/* Social Media */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-medium text-custom-text mb-4">Social Media</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Instagram
              </label>
              <Input
                value={formData.socialMedia?.instagram || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  socialMedia: { ...formData.socialMedia, instagram: e.target.value }
                })}
                placeholder="@username"
              />
            </div>
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Facebook
              </label>
              <Input
                value={formData.socialMedia?.facebook || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  socialMedia: { ...formData.socialMedia, facebook: e.target.value }
                })}
                placeholder="Facebook URL or username"
              />
            </div>
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                LinkedIn
              </label>
              <Input
                value={formData.socialMedia?.linkedin || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  socialMedia: { ...formData.socialMedia, linkedin: e.target.value }
                })}
                placeholder="LinkedIn URL or username"
              />
            </div>
          </div>
        </div>

        {/* Skills and Interests */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-medium text-custom-text mb-4">Skills and Interests</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Skills (comma-separated)
              </label>
              <Input
                value={formData.skills?.join(', ') || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  skills: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                })}
                placeholder="Carpentry, Electrical, Art, etc."
              />
            </div>
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Interests (comma-separated)
              </label>
              <Input
                value={formData.interests?.join(', ') || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  interests: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                })}
                placeholder="Music, Art, Technology, etc."
              />
            </div>
          </div>
        </div>

        {/* Ticket and Vehicle Pass Status */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-medium text-custom-text mb-4">Ticket & Vehicle Pass Status</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-label font-medium text-custom-text mb-3">
                Has Ticket
              </label>
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="hasTicket"
                    value="true"
                    checked={formData.hasTicket === true}
                    onChange={() => setFormData({ ...formData, hasTicket: true })}
                    className="text-custom-primary focus:ring-custom-primary"
                  />
                  <span className="text-sm text-custom-text">Yes</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="hasTicket"
                    value="false"
                    checked={formData.hasTicket === false}
                    onChange={() => setFormData({ ...formData, hasTicket: false })}
                    className="text-custom-primary focus:ring-custom-primary"
                  />
                  <span className="text-sm text-custom-text">No</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="hasTicket"
                    value="null"
                    checked={formData.hasTicket === null || formData.hasTicket === undefined}
                    onChange={() => setFormData({ ...formData, hasTicket: null })}
                    className="text-custom-primary focus:ring-custom-primary"
                  />
                  <span className="text-sm text-custom-text">Not informed</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-label font-medium text-custom-text mb-3">
                Has Vehicle Pass
              </label>
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="hasVehiclePass"
                    value="true"
                    checked={formData.hasVehiclePass === true}
                    onChange={() => setFormData({ ...formData, hasVehiclePass: true })}
                    className="text-custom-primary focus:ring-custom-primary"
                  />
                  <span className="text-sm text-custom-text">Yes</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="hasVehiclePass"
                    value="false"
                    checked={formData.hasVehiclePass === false}
                    onChange={() => setFormData({ ...formData, hasVehiclePass: false })}
                    className="text-custom-primary focus:ring-custom-primary"
                  />
                  <span className="text-sm text-custom-text">No</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="hasVehiclePass"
                    value="null"
                    checked={formData.hasVehiclePass === null || formData.hasVehiclePass === undefined}
                    onChange={() => setFormData({ ...formData, hasVehiclePass: null })}
                    className="text-custom-primary focus:ring-custom-primary"
                  />
                  <span className="text-sm text-custom-text">Not informed</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Travel Plans */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-medium text-custom-text mb-4">Travel Plans</h3>
          <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-label font-medium text-custom-text mb-2">
                    Arrival Date
                  </label>
                  <Input
                    type="date"
                    value={formData.arrivalDate ? (typeof formData.arrivalDate === 'string' ? formData.arrivalDate : formData.arrivalDate.toISOString().split('T')[0]) : ''}
                    onChange={(e) => setFormData({ ...formData, arrivalDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-label font-medium text-custom-text mb-2">
                    Departure Date
                  </label>
                  <Input
                    type="date"
                    value={formData.departureDate ? (typeof formData.departureDate === 'string' ? formData.departureDate : formData.departureDate.toISOString().split('T')[0]) : ''}
                    onChange={(e) => setFormData({ ...formData, departureDate: e.target.value })}
                  />
                </div>
          </div>
        </div>

        {/* Volunteering Interests */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-medium text-custom-text mb-4">Volunteering Interests</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.interestedInEAP || false}
                onChange={(e) => setFormData({ ...formData, interestedInEAP: e.target.checked })}
                className="rounded border-gray-300 text-custom-primary focus:ring-custom-primary"
              />
              <label className="text-sm text-custom-text">Interested in Early Arrival (EA)</label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.interestedInStrike || false}
                onChange={(e) => setFormData({ ...formData, interestedInStrike: e.target.checked })}
                className="rounded border-gray-300 text-custom-primary focus:ring-custom-primary"
              />
              <label className="text-sm text-custom-text">Interested in Strike/Load-out</label>
            </div>
          </div>
        </div>

        {/* Camp Bio (for camp accounts) */}
        {formData.accountType === 'camp' && (
          <div className="bg-white border rounded-lg p-4">
            <h3 className="text-lg font-medium text-custom-text mb-4">Camp Information</h3>
            <div className="mt-4">
              <label className="block text-label font-medium text-custom-text mb-2">
                Camp Bio
              </label>
              <textarea
                value={formData.campBio || ''}
                onChange={(e) => setFormData({ ...formData, campBio: e.target.value })}
                rows={4}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent"
                placeholder="Describe the camp's mission, activities, and what makes it special..."
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            className="flex-1"
          >
            Save All Changes
          </Button>
          <Button
            variant="outline"
            className="text-red-600 border-red-600 hover:bg-red-50"
            onClick={() => {
              if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
                // TODO: Implement user deletion
                alert('User deletion functionality coming soon...');
              }
            }}
          >
            Delete User
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AdminDashboard;

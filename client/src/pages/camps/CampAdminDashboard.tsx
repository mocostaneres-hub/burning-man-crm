import React, { useState, useEffect } from 'react';
import { Button, Card, Badge, Modal, Input } from '../../components/ui';
import { Users, Building as BuildingIcon, Shield, RefreshCw, Edit, Ban as BanIcon, CheckCircle as CheckCircleIcon, Search as SearchIcon, Loader2, User as UserIcon } from 'lucide-react';
import apiService from '../../services/api';
import { User as UserType } from '../../types';

// Extended User interface for camp admin editing with all fields
interface ExtendedUser extends UserType {
  profilePhoto?: string;
  phoneNumber?: string;
  city?: string;
  yearsBurned?: number;
  previousCamps?: string;
  bio?: string;
}

interface DashboardStats {
  totalUsers: number;
  totalCamps: number;
  totalMembers: number;
  activeCamps: number;
}

const CampAdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<UserType[]>([]);
  const [camps, setCamps] = useState<any[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalCamps: 0,
    totalMembers: 0,
    activeCamps: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'camps'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);

  // Load dashboard data
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadUsers(),
        loadCamps(),
        loadStats()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await apiService.get('/admin/users');
      const userData = response.data?.data || response.data || [];
      setUsers(Array.isArray(userData) ? userData : []);
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
    }
  };

  const loadCamps = async () => {
    try {
      const response = await apiService.get('/admin/camps');
      const campData = response.data?.data || response.data || [];
      setCamps(Array.isArray(campData) ? campData : []);
    } catch (error) {
      console.error('Error loading camps:', error);
      setCamps([]);
    }
  };

  const loadStats = async () => {
    try {
      const response = await apiService.get('/admin/dashboard');
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Filter users and camps based on search term
  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (user.firstName || '').toLowerCase().includes(searchLower) ||
      (user.lastName || '').toLowerCase().includes(searchLower) ||
      (user.email || '').toLowerCase().includes(searchLower) ||
      (user.campName || '').toLowerCase().includes(searchLower)
    );
  });

  const filteredCamps = camps.filter(camp => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (camp.campName || '').toLowerCase().includes(searchLower) ||
      (camp.hometown || '').toLowerCase().includes(searchLower)
    );
  });

  const handleUserEdit = (user: UserType) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const handleUserSave = async (updatedUser: UserType) => {
    try {
      // TODO: Implement user update API call
      console.log('Saving user:', updatedUser);
      alert('User update functionality coming soon...');
      setShowUserModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error saving user:', error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Are you sure you want to deactivate this user?')) {
      try {
        // TODO: Implement user deactivation API call
        console.log('Deactivating user:', userId);
        alert('User deactivation functionality coming soon...');
      } catch (error) {
        console.error('Error deactivating user:', error);
      }
    }
  };

  const handleCampEdit = (camp: any) => {
    // TODO: Implement camp editing
    alert('Camp editing functionality coming soon...');
  };

  const handleDeleteCamp = async (campId: string) => {
    if (window.confirm('Are you sure you want to deactivate this camp?')) {
      try {
        // TODO: Implement camp deactivation API call
        console.log('Deactivating camp:', campId);
        alert('Camp deactivation functionality coming soon...');
      } catch (error) {
        console.error('Error deactivating camp:', error);
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-h1 font-lato-bold text-custom-text mb-2">
            Camp Admin Dashboard
          </h1>
          <p className="text-body text-custom-text-secondary">
            Manage camp members, applications, and camp settings
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
              <p className="text-sm font-medium text-custom-text-secondary">Total Members</p>
              <p className="text-2xl font-lato-bold text-custom-text">{stats.totalMembers}</p>
            </div>
            <Users className="w-8 h-8 text-custom-primary" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-custom-text-secondary">Active Applications</p>
              <p className="text-2xl font-lato-bold text-custom-text">{stats.totalUsers}</p>
            </div>
            <Shield className="w-8 h-8 text-custom-primary" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-custom-text-secondary">Camp Status</p>
              <p className="text-2xl font-lato-bold text-custom-text">Active</p>
            </div>
            <BuildingIcon className="w-8 h-8 text-custom-primary" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-custom-text-secondary">System Health</p>
              <p className="text-2xl font-lato-bold text-custom-text">Good</p>
            </div>
            <CheckCircleIcon className="w-8 h-8 text-green-500" />
          </div>
        </Card>
      </div>

      {/* User/Camp Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'users' ? 'border-b-2 border-custom-primary text-custom-primary' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('users')}
        >
          Camp Members
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'camps' ? 'border-b-2 border-custom-primary text-custom-primary' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('camps')}
        >
          Camp Settings
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <Input
          type="text"
          placeholder={`Search ${activeTab === 'users' ? 'members' : 'camp settings'}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Camp Members Management Table */}
      {activeTab === 'users' && (
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-lato-bold text-custom-text mb-4">
            Camp Members Management
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    UID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Member
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
                          <Edit className="w-4 h-4" /> Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUser(user._id.toString())}
                          className="flex items-center gap-1 text-red-600 border-red-600 hover:bg-red-50"
                        >
                          <BanIcon className="w-4 h-4" /> Deactivate
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Camp Settings Table */}
      {activeTab === 'camps' && (
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-lato-bold text-custom-text mb-4">
            Camp Settings Management
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Setting
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Value
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
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Application Status
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    Open
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant="success">Active</Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => alert('Edit application status coming soon...')}
                        className="flex items-center gap-1"
                      >
                        <Edit className="w-4 h-4" /> Edit
                      </Button>
                    </div>
                  </td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Member Capacity
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    50 members
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant="success">Active</Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => alert('Edit capacity coming soon...')}
                        className="flex items-center gap-1"
                      >
                        <Edit className="w-4 h-4" /> Edit
                      </Button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
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
    </div>
  );
};

// Enhanced User Edit Modal Component with Full Camp Admin Controls
const UserEditModal: React.FC<{
  user: UserType;
  onClose: () => void;
  onSave: (user: UserType) => void;
}> = ({ user, onClose, onSave }) => {
  const [formData, setFormData] = useState<ExtendedUser>(user as ExtendedUser);
  const [photoPreview, setPhotoPreview] = useState<string | null>((user as any).profilePhoto || null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleSave = () => {
    // TODO: Handle photo upload if photoFile exists
    onSave(formData);
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
      title={`Camp Admin: Edit Member ${formData._id}`}
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

        {/* Camp-Specific Information */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-medium text-custom-text mb-4">Camp-Specific Information</h3>
          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Phone Number
              </label>
              <Input
                value={(formData as any).phoneNumber || ''}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value } as any)}
              />
            </div>
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                City/Location
              </label>
              <Input
                value={(formData as any).city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value } as any)}
              />
            </div>
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Years Burned
              </label>
              <Input
                type="number"
                value={(formData as any).yearsBurned || 0}
                onChange={(e) => setFormData({ ...formData, yearsBurned: parseInt(e.target.value) || 0 } as any)}
              />
            </div>
          </div>
          
          <div className="mt-4">
            <label className="block text-label font-medium text-custom-text mb-2">
              Bio
            </label>
            <textarea
              value={(formData as any).bio || ''}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value } as any)}
              rows={3}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent"
            />
          </div>
        </div>

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
        </div>
      </div>
    </Modal>
  );
};

export default CampAdminDashboard;

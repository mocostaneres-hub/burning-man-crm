import React, { useState, useEffect } from 'react';
import { Button, Card, Badge, Modal, Input } from '../../components/ui';
import { Users, Building as BuildingIcon, Shield, RefreshCw, Edit, Ban as BanIcon, CheckCircle as CheckCircleIcon, Search as SearchIcon, Loader2, User as UserIcon, Clock, Eye, Trash2, X } from 'lucide-react';
import apiService from '../../services/api';
import { User as UserType } from '../../types';
import SystemConfig from './SystemConfig';
import UserProfileHistory from '../../components/admin/UserProfileHistory';
import EmailTemplateEditor from '../../components/admin/EmailTemplateEditor';
import { useSkills } from '../../hooks/useSkills';

// Extended User interface for admin editing with all fields
interface ExtendedUser extends UserType {
  // Override specific fields that need different types for admin editing
  hasTicket?: boolean | null;
  hasVehiclePass?: boolean | null;
  userHistory?: any[];
}

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  totalCamps: number;
  activeCamps: number;
  recruitingCamps: number;
  totalMembers: number;
  accountTypeStats: {
    personal: number;
    camp: number;
    admin: number;
    unassigned: number;
  };
  userGrowth: Array<{
    _id: { year: number; month: number };
    count: number;
  }>;
  campStats: Array<{
    _id: string;
    count: number;
  }>;
}

interface SystemHealth {
  totalAccounts: number;
  activeAccounts: number;
  inactiveAccounts: number;
  totalCamps: number;
  activeCamps: number;
  recruitingCamps: number;
  totalMembers: number;
  accountTypeBreakdown: {
    personal: number;
    camp: number;
    admin: number;
    unassigned: number;
  };
  recentActivity: {
    newUsers: number;
    newCamps: number;
  };
}

interface ActivityLog {
  action: string;
  adminId: string;
  adminName: string;
  targetId: string;
  targetName: string;
  changes: any;
  timestamp: string;
  type?: string;
}

interface AnalyticsData {
  period: string;
  userAnalytics: {
    total: number;
    active: number;
    retentionRate: string;
  };
  campAnalytics: {
    total: number;
    active: number;
    recruiting: number;
    new: number;
  };
  applicationStats: {
    total: number;
    new: number;
    pending: number;
    approved: number;
    rejected: number;
    approvalRate: string;
  };
  accountTypeDistribution: {
    personal: number;
    camp: number;
    admin: number;
    unassigned: number;
  };
  growthTrends: Array<{
    date: string;
    users: number;
    camps: number;
    applications: number;
  }>;
}

interface Camp {
  _id: string;
  name: string;
  campName?: string; // Keep for backward compatibility
  slug?: string;
  hometown?: string;
  location?: {
    street?: string;
  };
  memberCount?: number;
  members?: any[];
  isActive: boolean;
  createdAt: string;
  description?: string;
  contactEmail?: string;
  website?: string;
  burningSince?: number;
  categories?: string[];
  selectedPerks?: any[];
  isPubliclyVisible?: boolean;
  acceptingApplications?: boolean;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    tiktok?: string;
  };
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    totalCamps: 0,
    activeCamps: 0,
    recruitingCamps: 0,
    totalMembers: 0,
    accountTypeStats: {
      personal: 0,
      camp: 0,
      admin: 0,
      unassigned: 0
    },
    userGrowth: [],
    campStats: []
  });
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [users, setUsers] = useState<UserType[]>([]);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedCamp, setSelectedCamp] = useState<Camp | null>(null);
  const [showCampModal, setShowCampModal] = useState(false);
  const [showDeleteCampModal, setShowDeleteCampModal] = useState(false);
  
  // Enhanced state for new features
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [auditLogs, setAuditLogs] = useState<ActivityLog[]>([]);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [selectedAccountType, setSelectedAccountType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkAction, setBulkAction] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [dateRange, setDateRange] = useState<string>('30d');
  const [activityHistory, setActivityHistory] = useState<ActivityLog[]>([]);
  const [showActivityHistory, setShowActivityHistory] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadStats(),
        loadUsers(),
        loadCamps(),
        loadAnalytics(),
        loadAuditLogs()
      ]);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await apiService.get(`/admin/analytics?period=${dateRange}`);
      setAnalytics(response);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const response = await apiService.get('/admin/audit-logs?limit=100');
      setAuditLogs(response.logs || []);
    } catch (error) {
      console.error('Error loading audit logs:', error);
    }
  };

  const loadUserHistory = async (userId: string) => {
    try {
      const response = await apiService.get(`/admin/users/${userId}/history`);
      setActivityHistory(response.activities || []);
      setShowActivityHistory(true);
    } catch (error) {
      console.error('Error loading user history:', error);
    }
  };

  const loadCampHistory = async (campId: string) => {
    try {
      const response = await apiService.get(`/admin/camps/${campId}/history`);
      setActivityHistory(response.activities || []);
      setShowActivityHistory(true);
    } catch (error) {
      console.error('Error loading camp history:', error);
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedUsers.length === 0) return;

    try {
      const response = await apiService.post('/admin/users/bulk-action', {
        action: bulkAction,
        userIds: selectedUsers,
        accountType: bulkAction === 'changeAccountType' ? selectedAccountType : undefined
      });

      console.log('Bulk action completed:', response);
      
      // Refresh data
      await loadUsers();
      setSelectedUsers([]);
      setShowBulkActions(false);
      setBulkAction('');
    } catch (error) {
      console.error('Error performing bulk action:', error);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllUsers = () => {
    setSelectedUsers(users.map(user => user._id));
  };

  const clearSelection = () => {
    setSelectedUsers([]);
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
          activeUsers: response.stats.activeUsers || 0,
          inactiveUsers: response.stats.inactiveUsers || 0,
          totalCamps: response.stats.totalCamps || 0,
          activeCamps: response.stats.activeCamps || 0,
          recruitingCamps: response.stats.recruitingCamps || 0,
          totalMembers: response.stats.totalMembers || 0,
          accountTypeStats: response.stats.accountTypeStats || {
            personal: 0,
            camp: 0,
            admin: 0,
            unassigned: 0
          },
          userGrowth: response.stats.userGrowth || [],
          campStats: response.stats.campStats || []
        });
      } else {
        console.log('❌ [AdminDashboard] Invalid stats response structure:', response);
      }

      if (response && response.systemHealth) {
        setSystemHealth(response.systemHealth);
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

  const handleUserView = (user: UserType) => {
    // For personal accounts, open public profile if available
    if (user.accountType === 'personal') {
      // Try to open public member profile
      window.open(`/members/${user._id}`, '_blank');
    } else {
      // For camp/admin accounts, open their camp profile if available
      if (user.campId || user.urlSlug) {
        const slug = user.urlSlug || user.campId;
        window.open(`/camps/${slug}`, '_blank');
      }
    }
  };

  const handleUserEdit = (user: UserType) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const handleViewHistory = (userId: string) => {
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

  const handleUserToggleActive = async (userId: string) => {
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

  const handleToggleAcceptingApplications = async (campId: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      console.log(`🔄 [Admin] Toggling acceptingApplications for camp ${campId} from ${currentStatus} to ${newStatus}`);
      
      const response = await apiService.put(`/admin/camps/${campId}/accepting-applications`, {
        acceptingApplications: newStatus
      });

      // Update local state
      setCamps(camps.map(c => 
        c._id === campId 
          ? { ...c, acceptingApplications: newStatus }
          : c
      ));

      console.log(`✅ [Admin] Successfully toggled acceptingApplications for camp ${campId}`);
    } catch (err) {
      console.error('❌ [Admin] Error toggling acceptingApplications:', err);
      alert('Failed to update application status. Please try again.');
    }
  };

  const handleTogglePubliclyVisible = async (campId: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      console.log(`🔄 [Admin] Toggling isPubliclyVisible for camp ${campId} from ${currentStatus} to ${newStatus}`);
      
      const response = await apiService.put(`/admin/camps/${campId}/publicly-visible`, {
        isPubliclyVisible: newStatus
      });

      // Update local state
      setCamps(camps.map(c => 
        c._id === campId 
          ? { ...c, isPubliclyVisible: newStatus }
          : c
      ));

      console.log(`✅ [Admin] Successfully toggled isPubliclyVisible for camp ${campId}`);
    } catch (err) {
      console.error('❌ [Admin] Error toggling isPubliclyVisible:', err);
      alert('Failed to update profile visibility. Please try again.');
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

  // Filter to show only personal/member accounts in Users tab (exclude camps and admins from user list)
  const filteredUsers = (users || []).filter(user => {
    const matchesSearch = (user.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.lastName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    // Only show personal accounts in Users tab
    const isPersonalAccount = user.accountType === 'personal';
    
    return matchesSearch && isPersonalAccount;
  });

  const filteredCamps = (camps || []).filter(camp =>
    (camp.name || camp.campName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (camp.hometown && camp.hometown.toLowerCase().includes(searchTerm.toLowerCase()))
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
              <p className="text-sm font-medium text-custom-text-secondary">Total Members</p>
              <p className="text-2xl font-lato-bold text-custom-text">{stats?.accountTypeStats?.personal || 0}</p>
              <div className="flex items-center gap-4 mt-2 text-xs">
                <span className="text-green-600">Active: {stats?.activeUsers || 0}</span>
                <span className="text-red-600">Inactive: {stats?.inactiveUsers || 0}</span>
              </div>
            </div>
            <Users className="w-8 h-8 text-custom-primary" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-custom-text-secondary">Total Camps</p>
              <p className="text-2xl font-lato-bold text-custom-text">{stats?.totalCamps || 0}</p>
              <div className="flex items-center gap-4 mt-2 text-xs">
                <span className="text-green-600">Active: {stats?.activeCamps || 0}</span>
                <span className="text-blue-600">Recruiting: {stats?.recruitingCamps || 0}</span>
              </div>
            </div>
            <BuildingIcon className="w-8 h-8 text-custom-primary" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-custom-text-secondary">Roster Members</p>
              <p className="text-2xl font-lato-bold text-custom-text">{stats?.totalMembers || 0}</p>
              <div className="mt-2 text-xs text-custom-text-secondary">
                Active roster members
              </div>
            </div>
            <Shield className="w-8 h-8 text-custom-primary" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-custom-text-secondary">Account Types</p>
              <div className="mt-2 text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Personal:</span>
                  <span className="font-medium">{stats?.accountTypeStats?.personal || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Camp:</span>
                  <span className="font-medium">{stats?.accountTypeStats?.camp || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Admin:</span>
                  <span className="font-medium">{stats?.accountTypeStats?.admin || 0}</span>
                </div>
              </div>
            </div>
            <Shield className="w-8 h-8 text-custom-primary" />
          </div>
        </Card>
      </div>

      {/* System Health Overview */}
      {systemHealth && (
        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-custom-text">System Health</h3>
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5 text-green-600" />
              <span className="text-sm text-green-600 font-medium">Healthy</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-custom-text">{systemHealth.totalAccounts}</p>
              <p className="text-sm text-custom-text-secondary">Total Accounts</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{systemHealth.activeAccounts}</p>
              <p className="text-sm text-custom-text-secondary">Active Accounts</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{systemHealth.recruitingCamps}</p>
              <p className="text-sm text-custom-text-secondary">Recruiting Camps</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{systemHealth.recentActivity.newUsers + systemHealth.recentActivity.newCamps}</p>
              <p className="text-sm text-custom-text-secondary">New This Month</p>
            </div>
          </div>
        </Card>
      )}

      {/* Navigation Tabs */}
      <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg overflow-x-auto">
        {[
          { id: 0, name: 'Overview', icon: Shield },
          { id: 1, name: 'Members', icon: Users },
          { id: 2, name: 'Camps', icon: BuildingIcon },
          { id: 3, name: 'Analytics', icon: Shield },
          { id: 4, name: 'Audit Logs', icon: Clock },
          { id: 5, name: 'Email Templates', icon: Edit },
          { id: 6, name: 'System', icon: Shield }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-custom-primary shadow-sm'
                : 'text-custom-text-secondary hover:text-custom-text hover:bg-gray-200'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.name}
          </button>
        ))}
      </div>


      {/* Search - only show for Users and Camps tabs */}
      {activeTab !== 2 && activeTab !== 3 && (
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

      {/* Overview Tab */}
      {activeTab === 0 && (
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
              System Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Recent Activity</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-green-600" />
                      <span className="text-sm">New users this month</span>
                    </div>
                    <span className="font-medium">{systemHealth?.recentActivity.newUsers || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      <BuildingIcon className="w-4 h-4 text-blue-600" />
                      <span className="text-sm">New camps this month</span>
                    </div>
                    <span className="font-medium">{systemHealth?.recentActivity.newCamps || 0}</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => setShowAnalytics(true)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Analytics
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => setShowAuditLogs(true)}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    View Audit Logs
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => setActiveTab(1)}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Manage Members
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 1 && (
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-h2 font-lato-bold text-custom-text">
                Members Management
              </h2>
              <div className="flex items-center gap-2">
                {selectedUsers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-custom-text-secondary">
                      {selectedUsers.length} selected
                    </span>
                    <Button 
                      onClick={() => setShowBulkActions(true)}
                      variant="outline"
                      size="sm"
                    >
                      Bulk Actions
                    </Button>
                    <Button 
                      onClick={clearSelection}
                      variant="outline"
                      size="sm"
                    >
                      Clear
                    </Button>
                  </div>
                )}
                <Button 
                  onClick={selectAllUsers}
                  variant="outline"
                  size="sm"
                >
                  Select All
                </Button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input 
                        type="checkbox" 
                        checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                        onChange={(e) => e.target.checked ? selectAllUsers() : clearSelection()}
                        className="rounded"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Account Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Login
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
                  {filteredUsers.map((user) => (
                    <tr key={user._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input 
                          type="checkbox" 
                          checked={selectedUsers.includes(user._id)}
                          onChange={() => toggleUserSelection(user._id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                          <div className="text-xs text-gray-400 font-mono">ID: {user._id}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={user.accountType === 'admin' ? 'success' : user.accountType === 'camp' ? 'info' : 'neutral'}>
                          {user.accountType}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Badge variant={user.isActive ? 'success' : 'error'}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          {user.campName && (
                            <Badge variant="info" className="text-xs">
                              {user.campName}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.lastLogin ? (
                          <div>
                            <div>{new Date(user.lastLogin).toLocaleDateString()}</div>
                            <div className="text-xs text-gray-400">
                              {new Date(user.lastLogin).toLocaleTimeString()}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">Never</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>
                          <div>{new Date(user.createdAt).toLocaleDateString()}</div>
                          <div className="text-xs text-gray-400">
                            {new Date(user.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUserView(user)}
                            className="flex items-center gap-1 text-blue-600 border-blue-600 hover:bg-blue-50"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUserEdit(user)}
                            className="flex items-center gap-1"
                          >
                            <Edit className="w-3 h-3" />
                            Edit
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
      {activeTab === 2 && (
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
                      Camp ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hometown
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Members
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Profile Visibility
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Applications
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {camp._id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {camp.hometown || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {camp.memberCount || camp.members?.length || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleTogglePubliclyVisible(camp._id, camp.isPubliclyVisible !== false)}
                          className="flex items-center gap-2"
                        >
                          <Badge variant={camp.isPubliclyVisible !== false ? 'success' : 'neutral'}>
                            {camp.isPubliclyVisible !== false ? 'Public' : 'Private'}
                          </Badge>
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleAcceptingApplications(camp._id, camp.acceptingApplications !== false)}
                          className="flex items-center gap-2"
                        >
                          <Badge variant={camp.acceptingApplications !== false ? 'success' : 'neutral'}>
                            {camp.acceptingApplications !== false ? 'Open' : 'Closed'}
                          </Badge>
                        </button>
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

      {/* FAQ Management Tab */}
      {activeTab === 3 && (
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-h2 font-lato-bold text-custom-text">
                FAQ Management
              </h2>
              <Button
                onClick={() => window.open('/help/admin', '_blank')}
                className="bg-custom-primary hover:bg-custom-primary-dark text-white"
              >
                Open FAQ Admin
              </Button>
            </div>
            <div className="text-custom-text-secondary">
              <p className="mb-4">
                Manage frequently asked questions for different user types. You can create, edit, and organize FAQs that will be displayed to users based on their account type.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">FAQ Features:</h3>
                <ul className="text-blue-800 space-y-1">
                  <li>• Create and edit FAQs with categories</li>
                  <li>• Set display audience (Camps, Members, or Both)</li>
                  <li>• Control FAQ ordering and active status</li>
                  <li>• Automatic filtering based on user account type</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Analytics Tab */}
      {activeTab === 3 && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-h2 font-lato-bold text-custom-text">
                System Analytics
              </h2>
              <div className="flex items-center gap-2">
                <select 
                  value={dateRange} 
                  onChange={(e) => setDateRange(e.target.value)}
                  className="px-3 py-1 border rounded-md text-sm"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="1y">Last year</option>
                </select>
                <Button onClick={loadAnalytics} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {analytics ? (
              <div className="space-y-6">
                {/* User Analytics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-semibold text-blue-900 mb-2">User Retention</h3>
                    <p className="text-2xl font-bold text-blue-600">{analytics.userAnalytics.retentionRate}%</p>
                    <p className="text-sm text-blue-700">
                      {analytics.userAnalytics.active} of {analytics.userAnalytics.total} users active
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h3 className="font-semibold text-green-900 mb-2">Camp Activity</h3>
                    <p className="text-2xl font-bold text-green-600">{analytics.campAnalytics.recruiting}</p>
                    <p className="text-sm text-green-700">Currently recruiting</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <h3 className="font-semibold text-purple-900 mb-2">Application Rate</h3>
                    <p className="text-2xl font-bold text-purple-600">{analytics.applicationStats.approvalRate}%</p>
                    <p className="text-sm text-purple-700">Approval rate</p>
                  </div>
                </div>

                {/* Account Type Distribution */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Account Type Distribution</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(analytics.accountTypeDistribution).map(([type, count]) => (
                      <div key={type} className="text-center p-3 bg-gray-50 rounded">
                        <p className="text-2xl font-bold text-custom-text">{count}</p>
                        <p className="text-sm text-custom-text-secondary capitalize">{type}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Growth Trends */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Growth Trends (Last 30 Days)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Date</th>
                          <th className="text-right py-2">Users</th>
                          <th className="text-right py-2">Camps</th>
                          <th className="text-right py-2">Applications</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.growthTrends.slice(-10).map((trend, index) => (
                          <tr key={index} className="border-b">
                            <td className="py-2">{trend.date}</td>
                            <td className="text-right py-2">{trend.users}</td>
                            <td className="text-right py-2">{trend.camps}</td>
                            <td className="text-right py-2">{trend.applications}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-custom-primary" />
                <p className="text-custom-text-secondary">Loading analytics...</p>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 4 && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-h2 font-lato-bold text-custom-text">
                Audit Logs
              </h2>
              <div className="flex items-center gap-2">
                <Button onClick={loadAuditLogs} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} variant="outline" size="sm">
                  <SearchIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {showAdvancedFilters && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-3">Advanced Filters</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Action</label>
                    <select className="w-full px-3 py-1 border rounded-md text-sm">
                      <option value="">All Actions</option>
                      <option value="user_updated">User Updated</option>
                      <option value="camp_updated">Camp Updated</option>
                      <option value="bulk_activate">Bulk Activate</option>
                      <option value="bulk_deactivate">Bulk Deactivate</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Target Type</label>
                    <select className="w-full px-3 py-1 border rounded-md text-sm">
                      <option value="">All Types</option>
                      <option value="user">User</option>
                      <option value="camp">Camp</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Start Date</label>
                    <input type="date" className="w-full px-3 py-1 border rounded-md text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">End Date</label>
                    <input type="date" className="w-full px-3 py-1 border rounded-md text-sm" />
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Timestamp</th>
                    <th className="text-left py-2">Action</th>
                    <th className="text-left py-2">Admin</th>
                    <th className="text-left py-2">Target</th>
                    <th className="text-left py-2">Changes</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-2">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2">
                        <Badge variant="info" className="text-xs">
                          {log.action}
                        </Badge>
                      </td>
                      <td className="py-2">{log.adminName}</td>
                      <td className="py-2">{log.targetName}</td>
                      <td className="py-2">
                        <code className="text-xs bg-gray-100 px-1 rounded">
                          {JSON.stringify(log.changes).slice(0, 50)}...
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Email Templates Tab */}
      {activeTab === 5 && (
        <EmailTemplateEditor />
      )}

      {/* System Tab */}
      {activeTab === 6 && (
        <SystemConfig />
      )}

      {/* Bulk Actions Modal */}
      {showBulkActions && (
        <Modal isOpen={showBulkActions} onClose={() => setShowBulkActions(false)}>
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Bulk Actions</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Action</label>
                <select 
                  value={bulkAction} 
                  onChange={(e) => setBulkAction(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select an action</option>
                  <option value="activate">Activate Users</option>
                  <option value="deactivate">Deactivate Users</option>
                  <option value="changeAccountType">Change Account Type</option>
                  <option value="delete">Delete Users (Soft)</option>
                </select>
              </div>
              
              {bulkAction === 'changeAccountType' && (
                <div>
                  <label className="block text-sm font-medium mb-2">New Account Type</label>
                  <select 
                    value={selectedAccountType} 
                    onChange={(e) => setSelectedAccountType(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="personal">Personal</option>
                    <option value="camp">Camp</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              )}
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  This action will affect <strong>{selectedUsers.length}</strong> selected users.
                </p>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowBulkActions(false)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleBulkAction}
                  disabled={!bulkAction || selectedUsers.length === 0}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Execute Action
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Activity History Modal */}
      {showActivityHistory && (
        <Modal isOpen={showActivityHistory} onClose={() => setShowActivityHistory(false)}>
          <div className="p-6 max-w-4xl">
            <h2 className="text-xl font-semibold mb-4">Activity History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Timestamp</th>
                    <th className="text-left py-2">Action</th>
                    <th className="text-left py-2">Admin</th>
                    <th className="text-left py-2">Changes</th>
                  </tr>
                </thead>
                <tbody>
                  {activityHistory.map((activity, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-2">
                        {new Date(activity.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2">
                        <Badge variant="info" className="text-xs">
                          {activity.action}
                        </Badge>
                      </td>
                      <td className="py-2">{activity.adminName}</td>
                      <td className="py-2">
                        <code className="text-xs bg-gray-100 px-1 rounded">
                          {JSON.stringify(activity.changes).slice(0, 100)}...
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
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
      {showCampModal && selectedCamp && (
        <CampEditModal
          camp={selectedCamp}
          onClose={() => {
            setShowCampModal(false);
            setSelectedCamp(null);
          }}
          onSave={handleCampSave}
        />
      )}

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
  const { skills: availableSkills, loading: skillsLoading } = useSkills();
  const [formData, setFormData] = useState<ExtendedUser>({
    ...user,
    skills: user.skills || [],
    location: typeof user.location === 'string' 
      ? { city: user.location, state: '', country: '' }
      : user.location || { city: '', state: '', country: '' }
  } as ExtendedUser);
  const [photoPreview, setPhotoPreview] = useState<string | null>(user.profilePhoto || null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [auditLogLoading, setAuditLogLoading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load audit log when modal opens
  useEffect(() => {
    loadAuditLog();
  }, [user._id]);

  const loadAuditLog = async () => {
    try {
      setAuditLogLoading(true);
      const response = await apiService.get(`/admin/users/${user._id}/history`);
      setAuditLog(response.activities || []);
    } catch (error) {
      console.error('Error loading audit log:', error);
      setAuditLog([]);
    } finally {
      setAuditLogLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      // Photo data is already in formData from handlePhotoUpload/handlePhotoDelete
      // Just validate and save
      console.log('💾 [AdminDashboard] Saving user with photo:', formData.profilePhoto ? 'Photo included' : 'No photo');
      onSave(formData as UserType);
    } catch (err) {
      console.error('Error preparing user data:', err);
      alert('Failed to prepare user data. Please try again.');
    }
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Result = e.target?.result as string;
        setPhotoPreview(base64Result);
        // Update formData immediately so it's ready for save
        setFormData(prev => ({ ...prev, profilePhoto: base64Result }));
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

        {/* Password Reset */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-custom-text mb-2">Reset Password</h3>
          <p className="text-sm text-gray-600 mb-4">Leave blank to keep current password</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                New Password
              </label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
              />
            </div>
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Confirm Password
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
              )}
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
              Years Burned {formData.yearsBurned === 0 && <span className="text-purple-600 font-semibold ml-2">(Virgin)</span>}
            </label>
            <p className="text-sm text-gray-600 mb-2">
              {formData.yearsBurned === 0 ? 'This user is a Burning Man virgin (0 years)' : `This user has attended Burning Man for ${formData.yearsBurned} year${formData.yearsBurned !== 1 ? 's' : ''}`}
            </p>
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
              </div>
            </div>
            <div>
              <label className="block text-label font-medium text-custom-text mb-3">
                Has VP
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

        {/* Skills & Interests */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-medium text-custom-text mb-4">Skills & Interests</h3>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {formData.skills?.map((skill, index) => (
                <div key={index} className="flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const newSkills = formData.skills?.filter((_, i) => i !== index) || [];
                      setFormData({ ...formData, skills: newSkills });
                    }}
                    className="hover:bg-green-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Select Skills
              </label>
              <select
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent text-gray-900"
                value=""
                onChange={(e) => {
                  const skill = e.target.value;
                  if (skill && !formData.skills?.includes(skill)) {
                    setFormData({ ...formData, skills: [...(formData.skills || []), skill].sort() });
                  }
                  // Reset dropdown
                  e.target.value = '';
                }}
                disabled={skillsLoading}
              >
                <option value="">{skillsLoading ? 'Loading skills...' : 'Choose a skill to add...'}</option>
                {availableSkills.map((skill) => (
                  <option key={skill} value={skill}>{skill}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Account Deactivation Control */}
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-red-900 mb-1">
                Account Status
              </h3>
              <p className="text-sm text-red-800">
                {formData.isActive ? 'Account is currently active' : 'Account is currently deactivated'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
            </label>
          </div>
        </div>

        {/* Audit Log Section */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-custom-text mb-4">
            Activity History (Audit Log)
          </h3>
          {auditLogLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-custom-primary" />
              <span className="ml-2 text-sm text-custom-text-secondary">Loading activity history...</span>
            </div>
          ) : auditLog.length === 0 ? (
            <div className="text-center py-8 text-custom-text-secondary">
              <p>No activity history found for this member.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {auditLog.map((activity, index) => (
                <div key={index} className="bg-gray-50 border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-custom-text">
                        {activity.action || activity.activityType || 'Activity'}
                      </div>
                      {activity.details?.field && (
                        <div className="text-sm text-custom-text-secondary mt-1">
                          <span className="font-medium">Field:</span> {activity.details.field}
                          {activity.details.oldValue !== undefined && activity.details.newValue !== undefined && (
                            <span className="ml-2">
                              <span className="text-red-600 line-through">{String(activity.details.oldValue)}</span>
                              {' → '}
                              <span className="text-green-600">{String(activity.details.newValue)}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-custom-text-secondary">
                      {new Date(activity.timestamp).toLocaleString()}
                    </div>
                  </div>
                  {activity.actingUserId && typeof activity.actingUserId === 'object' && (
                    <div className="text-xs text-custom-text-secondary">
                      By: {activity.actingUserId.firstName} {activity.actingUserId.lastName} ({activity.actingUserId.email})
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
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

// Camp Edit Modal Component - Full features for System Admin
const CampEditModal: React.FC<{
  camp: Camp;
  onClose: () => void;
  onSave: (camp: Camp) => void;
}> = ({ camp, onClose, onSave }) => {
  const [formData, setFormData] = useState<Camp>(camp);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [campCategories, setCampCategories] = useState<{_id: string, name: string}[]>([]);
  const [globalPerks, setGlobalPerks] = useState<{_id: string, name: string, icon: string, color: string}[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [auditLogLoading, setAuditLogLoading] = useState(false);

  useEffect(() => {
    loadCategoriesAndPerks();
    loadAuditLog();
  }, [camp._id]);

  const loadAuditLog = async () => {
    try {
      setAuditLogLoading(true);
      const response = await apiService.get(`/admin/camps/${camp._id}/history`);
      setAuditLog(response.activities || []);
    } catch (error) {
      console.error('Error loading audit log:', error);
      setAuditLog([]);
    } finally {
      setAuditLogLoading(false);
    }
  };

  const loadCategoriesAndPerks = async () => {
    try {
      const [categoriesRes, perksRes] = await Promise.all([
        apiService.get('/categories'),
        apiService.get('/perks')
      ]);
      setCampCategories(categoriesRes.categories || []);
      setGlobalPerks(perksRes.perks || []);
    } catch (err) {
      console.error('Failed to load categories and perks:', err);
    }
  };

  const handleCategoryToggle = (categoryId: string) => {
    const currentCategories = formData.categories || [];
    const updated = currentCategories.includes(categoryId)
      ? currentCategories.filter(id => id !== categoryId)
      : [...currentCategories, categoryId];
    setFormData({ ...formData, categories: updated });
  };

  const handlePerkToggle = (perkId: string) => {
    const currentPerks = formData.selectedPerks || [];
    const existingIndex = currentPerks.findIndex(p => p.perkId === perkId);
    
    if (existingIndex >= 0) {
      // Toggle off
      const updated = currentPerks.filter(p => p.perkId !== perkId);
      setFormData({ ...formData, selectedPerks: updated });
    } else {
      // Toggle on
      const updated = [...currentPerks, { perkId, isOn: true }];
      setFormData({ ...formData, selectedPerks: updated });
    }
  };

  const handleSave = () => {
    // Validate password if provided
    if (newPassword && newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    
    // Add password to save data if provided
    const saveData = { ...formData };
    if (newPassword && newPassword.length >= 6) {
      (saveData as any).newPassword = newPassword;
    }
    
    onSave(saveData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-h2 font-lato-bold text-custom-text">
              SystemAdmin: Edit Camp
            </h2>
            <Button variant="outline" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-6">
            {/* Password Reset for Camp Account */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-custom-text mb-2">Reset Camp Account Password</h3>
              <p className="text-sm text-gray-600 mb-4">Leave blank to keep current password</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-label font-medium text-custom-text mb-2">
                    New Password
                  </label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 characters)"
                  />
                </div>
                <div>
                  <label className="block text-label font-medium text-custom-text mb-2">
                    Confirm Password
                  </label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
                  )}
                </div>
              </div>
            </div>

            {/* Basic Information */}
            <div className="bg-gray-50 border rounded-lg p-4">
              <h3 className="text-lg font-medium text-custom-text mb-4">Basic Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-label font-medium text-custom-text mb-2">
                    Camp Name
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter camp name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-label font-medium text-custom-text mb-2">
                      Burning Since
                    </label>
                    <Input
                      type="number"
                      value={formData.burningSince || new Date().getFullYear()}
                      onChange={(e) => setFormData({ ...formData, burningSince: parseInt(e.target.value) })}
                      placeholder="Year"
                    />
                  </div>
                  <div>
                    <label className="block text-label font-medium text-custom-text mb-2">
                      Hometown
                    </label>
                    <Input
                      value={formData.hometown || ''}
                      onChange={(e) => setFormData({ ...formData, hometown: e.target.value })}
                      placeholder="Enter hometown"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-label font-medium text-custom-text mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent resize-none"
                    placeholder="Describe your camp..."
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Categories */}
            <div className="bg-gray-50 border rounded-lg p-4">
              <h3 className="text-lg font-medium text-custom-text mb-4">Camp Categories</h3>
              <div className="grid grid-cols-3 gap-3 max-h-48 overflow-y-auto">
                {campCategories.map((category) => (
                  <label key={category._id} className="flex items-center space-x-2 cursor-pointer hover:bg-white p-2 rounded">
                    <input
                      type="checkbox"
                      checked={formData.categories?.includes(category._id)}
                      onChange={() => handleCategoryToggle(category._id)}
                      className="rounded border-gray-300 text-custom-primary focus:ring-custom-primary"
                    />
                    <span className="text-sm text-custom-text">{category.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Shared Amenities */}
            <div className="bg-gray-50 border rounded-lg p-4">
              <h3 className="text-lg font-medium text-custom-text mb-4">Shared Amenities</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                {globalPerks.map((perk) => (
                  <label key={perk._id} className="flex items-center space-x-2 cursor-pointer hover:bg-white p-2 rounded">
                    <input
                      type="checkbox"
                      checked={formData.selectedPerks?.some(p => p.perkId === perk._id)}
                      onChange={() => handlePerkToggle(perk._id)}
                      className="rounded border-gray-300 text-custom-primary focus:ring-custom-primary"
                    />
                    <span className="text-sm text-custom-text">{perk.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-gray-50 border rounded-lg p-4">
              <h3 className="text-lg font-medium text-custom-text mb-4">Contact Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-label font-medium text-custom-text mb-2">
                    Contact Email
                  </label>
                  <Input
                    type="email"
                    value={formData.contactEmail || ''}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    placeholder="Enter contact email"
                  />
                </div>
                <div>
                  <label className="block text-label font-medium text-custom-text mb-2">
                    Website
                  </label>
                  <Input
                    value={formData.website || ''}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="Enter website URL"
                  />
                </div>
              </div>
            </div>

            {/* Social Media - Only Facebook and Instagram */}
            <div className="bg-gray-50 border rounded-lg p-4">
              <h3 className="text-lg font-medium text-custom-text mb-4">Social Media</h3>
              <div className="grid grid-cols-2 gap-4">
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
                    placeholder="https://facebook.com/yourcamp"
                  />
                </div>
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
                    placeholder="https://instagram.com/yourcamp"
                  />
                </div>
              </div>
            </div>

            {/* Camp Settings */}
            <div className="bg-gray-50 border rounded-lg p-4">
              <h3 className="text-lg font-medium text-custom-text mb-4">Camp Settings</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-custom-text">Make Profile Public</label>
                    <p className="text-xs text-gray-500">Display camp on public discovery page</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.isPubliclyVisible !== false}
                    onChange={(e) => setFormData({ ...formData, isPubliclyVisible: e.target.checked })}
                    className="rounded border-gray-300 text-custom-primary focus:ring-custom-primary"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-custom-text">Accepting Applications</label>
                    <p className="text-xs text-gray-500">Allow applications and show Apply Now button</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.acceptingApplications !== false}
                    onChange={(e) => setFormData({ ...formData, acceptingApplications: e.target.checked })}
                    className="rounded border-gray-300 text-custom-primary focus:ring-custom-primary"
                  />
                </div>
              </div>
            </div>

            {/* Account Deactivation Control */}
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-red-900 mb-1">
                    Camp Status
                  </h3>
                  <p className="text-sm text-red-800">
                    {formData.isActive !== false ? 'Camp is currently active' : 'Camp is currently deactivated'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive !== false}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                </label>
              </div>
            </div>

            {/* Audit Log Section */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-custom-text mb-4">
                Activity History (Audit Log)
              </h3>
              {auditLogLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-custom-primary" />
                  <span className="ml-2 text-sm text-custom-text-secondary">Loading activity history...</span>
                </div>
              ) : auditLog.length === 0 ? (
                <div className="text-center py-8 text-custom-text-secondary">
                  <p>No activity history found for this camp.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {auditLog.map((activity, index) => (
                    <div key={index} className="bg-gray-50 border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-medium text-custom-text">
                            {activity.action || activity.activityType || 'Activity'}
                          </div>
                          {activity.details?.field && (
                            <div className="text-sm text-custom-text-secondary mt-1">
                              <span className="font-medium">Field:</span> {activity.details.field}
                              {activity.details.oldValue !== undefined && activity.details.newValue !== undefined && (
                                <span className="ml-2">
                                  <span className="text-red-600 line-through">{String(activity.details.oldValue)}</span>
                                  {' → '}
                                  <span className="text-green-600">{String(activity.details.newValue)}</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-custom-text-secondary">
                          {new Date(activity.timestamp).toLocaleString()}
                        </div>
                      </div>
                      {activity.actingUserId && typeof activity.actingUserId === 'object' && (
                        <div className="text-xs text-custom-text-secondary">
                          By: {activity.actingUserId.firstName} {activity.actingUserId.lastName} ({activity.actingUserId.email})
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSave} className="flex-1">
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

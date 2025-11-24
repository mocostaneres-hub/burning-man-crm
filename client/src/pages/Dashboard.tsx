import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { Card, Button } from '../components/ui';
import Footer from '../components/layout/Footer';
import {
  Users as Group,
  Plus,
  Search as SearchIcon,
  Users as People,
  ClipboardList as Assignment,
  TrendingUp as TrendingUpIcon,
  UserCheck,
  Eye,
  User,
  Phone,
} from 'lucide-react';

interface DashboardStats {
  pendingApplications?: number;
  approvedApplications?: number;
  totalTasks?: number;
  openTasks?: number;
  completedTasks?: number;
  totalCamps?: number;
  activeCamps?: number;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        if (user?.accountType === 'admin') {
          const response = await apiService.get('/admin/stats');
          setStats(response.data);
        } else if (user?.accountType === 'camp') {
          // Get camp data first
          const campData = await apiService.getMyCamp();
          const campId = campData._id;

          const [applicationsRes, tasksRes] = await Promise.all([
            apiService.get(`/applications/camp/${campId}`),
            apiService.get('/tasks')
          ]);
          
          // applicationsRes is an array of applications
          const applications = applicationsRes || [];
          
          setStats({
            pendingApplications: applications.filter((app: { status: string }) => app.status === 'pending').length || 0,
            approvedApplications: applications.filter((app: { status: string }) => app.status === 'approved').length || 0,
            totalTasks: tasksRes.data?.length || 0,
            openTasks: tasksRes.data?.filter((task: { status: string }) => task.status === 'open').length || 0,
            completedTasks: tasksRes.data?.filter((task: { status: string }) => task.status === 'completed').length || 0,
          });
        } else {
          // Personal account stats
          const [applicationsRes, tasksRes] = await Promise.all([
            apiService.get('/applications/my-applications'),
            apiService.get('/tasks/my-tasks')
          ]);
          
          setStats({
            pendingApplications: applicationsRes.applications?.filter((app: { status: string }) => app.status === 'pending').length || 0,
            approvedApplications: applicationsRes.applications?.filter((app: { status: string }) => app.status === 'approved').length || 0,
            totalTasks: tasksRes?.length || 0,
            openTasks: tasksRes?.filter((task: { status: string }) => task.status === 'open').length || 0,
            completedTasks: tasksRes?.filter((task: { status: string }) => task.status === 'completed').length || 0,
          });
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchStats();
    }
  }, [user]);

  const getDashboardTiles = () => {
    // Debug logging
    console.log('Dashboard - User data:', user);
    console.log('Dashboard - Account type:', user?.accountType);
    console.log('Dashboard - Camp ID:', user?.campId);
    
    const commonTiles = [
      {
        title: 'My Profile',
        description: user?.accountType === 'camp' ? 'Manage camp information' : 'Manage your profile',
        icon: <User size={24} />,
        onClick: () => {
          if (user?.accountType === 'camp') {
            const campId = user?.campId?.toString() || user?._id?.toString() || '';
            navigate(campId ? `/camp/${campId}/profile` : '/camp/profile');
          } else {
            navigate('/profile/edit');
          }
        },
        color: 'bg-blue-500'
      },
      {
        title: 'My Tasks',
        description: `${stats.openTasks || 0} open tasks`,
        icon: <Assignment size={24} />,
        onClick: () => navigate(user?.accountType === 'camp' ? '/camp/tasks' : '/tasks'),
        color: 'bg-green-500'
      }
    ];

    if (user?.accountType === 'camp' || (user?.accountType === 'admin' && user?.campId)) {
      return [
        ...commonTiles,
        {
          title: 'Applications',
          description: `${stats.pendingApplications || 0} pending applications`,
          icon: <Assignment size={24} />,
          onClick: () => navigate('/camp/applications'),
          color: 'bg-purple-500'
        },
        {
          title: 'Members',
          description: 'View camp roster',
          icon: <People size={24} />,
          onClick: () => navigate('/camp/rosters'),
          color: 'bg-orange-500'
        },
        {
          title: 'Call Times',
          description: 'Manage orientation calls',
          icon: <Phone size={24} />,
          onClick: () => navigate('/camp/call-slots'),
          color: 'bg-teal-500'
        }
      ];
    }

    if (user?.accountType === 'personal') {
      return [
        ...commonTiles,
        {
          title: 'Discover Camps',
          description: 'Find camps to join',
          icon: <SearchIcon size={24} />,
          onClick: () => navigate('/camps'),
          color: 'bg-indigo-500'
        },
        {
          title: 'My Applications',
          description: `${stats.pendingApplications || 0} pending`,
          icon: <Assignment size={24} />,
          onClick: () => navigate('/applications'),
          color: 'bg-purple-500'
        }
      ];
    }

    if (user?.accountType === 'admin') {
      return [
        ...commonTiles,
        {
          title: 'Admin',
          description: 'System administration',
          icon: <UserCheck size={24} />,
          onClick: () => navigate('/admin'),
          color: 'bg-red-500'
        },
        {
          title: 'All Camps',
          description: `${stats.totalCamps || 0} camps`,
          icon: <Group size={24} />,
          onClick: () => navigate('/admin'),
          color: 'bg-yellow-500'
        }
      ];
    }

    return commonTiles;
  };

  const getQuickActions = () => {
    const commonActions = [];

    if (user?.accountType === 'camp' || (user?.accountType === 'admin' && user?.campId)) {
      return [
        {
          title: 'Create Task',
          icon: <Plus size={24} />,
          onClick: () => navigate('/camp/tasks?action=create'),
          description: 'Assign a new task'
        },
        {
          title: 'Review Applications',
          icon: <Eye size={24} />,
          onClick: () => navigate('/camp/applications'),
          description: 'Review pending applications'
        },
        {
          title: 'Manage Roster',
          icon: <People size={24} />,
          onClick: () => navigate('/camp/rosters'),
          description: 'View and manage members'
        },
        {
          title: 'Call Times',
          icon: <Phone size={24} />,
          onClick: () => navigate('/camp/call-slots'),
          description: 'Manage orientation calls'
        },
        {
          title: 'Role Management',
          icon: <UserCheck size={24} />,
          onClick: () => navigate('/camp/roles'),
          description: 'Manage member roles'
        }
      ];
    }

    if (user?.accountType === 'personal') {
      return [
        {
          title: 'Find Camps',
          icon: <SearchIcon size={24} />,
          onClick: () => navigate('/camps'),
          description: 'Discover new camps'
        },
        {
          title: 'View Applications',
          icon: <Eye size={24} />,
          onClick: () => navigate('/applications'),
          description: 'Check application status'
        }
      ];
    }

    return commonActions;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-custom-primary"></div>
          <p className="mt-2 text-custom-text-secondary">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-h1 font-lato-bold text-custom-text mb-2">
          Welcome back, {user?.firstName || 'User'}!
        </h1>
        <p className="text-body text-custom-text-secondary">
          {user?.accountType === 'camp' ? 'Manage your camp and members' : 
           user?.accountType === 'admin' ? 'System administration dashboard' :
           'Your personal dashboard'}
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card className="p-6 text-center">
          <Assignment size={40} className="text-orange-500 mx-auto mb-3" />
          <h3 className="text-h3 font-lato-bold text-custom-text mb-1">
            {stats.pendingApplications || 0}
          </h3>
          <p className="text-body text-custom-text-secondary">
            Pending Applications
          </p>
        </Card>

        <Card className="p-6 text-center">
          <Assignment size={40} className="text-purple-500 mx-auto mb-3" />
          <h3 className="text-h3 font-lato-bold text-custom-text mb-1">
            {stats.openTasks || 0}
          </h3>
          <p className="text-body text-custom-text-secondary">
            Open Tasks
          </p>
        </Card>

        <Card className="p-6 text-center">
          <TrendingUpIcon size={40} className="text-green-500 mx-auto mb-3" />
          <h3 className="text-h3 font-lato-bold text-custom-text mb-1">
            {stats.completedTasks || 0}
          </h3>
          <p className="text-body text-custom-text-secondary">
            Completed Tasks
          </p>
        </Card>
      </div>

      {/* Main Dashboard Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {getDashboardTiles().map((tile, index) => (
          <Card 
            key={index} 
            className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={tile.onClick}
          >
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-lg ${tile.color} text-white`}>
                {tile.icon}
              </div>
              <div>
                <h3 className="text-h3 font-lato-bold text-custom-text mb-1">
                  {tile.title}
                </h3>
                <p className="text-body text-custom-text-secondary">
                  {tile.description}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <h2 className="text-h2 font-lato-bold text-custom-text mb-6">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {getQuickActions().map((action, index) => (
            <Button
              key={index}
              variant="outline"
              className="h-auto p-4 flex flex-col items-center space-y-2"
              onClick={action.onClick}
            >
              {action.icon}
              <span className="font-medium">{action.title}</span>
              <span className="text-xs text-center opacity-70">
                {action.description}
              </span>
            </Button>
          ))}
        </div>
      </Card>
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Dashboard;
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
  Calendar,
  ArrowRight,
  ClipboardCheck,
  FileText,
} from 'lucide-react';

interface DashboardStats {
  pendingApplications?: number;
  approvedApplications?: number;
  totalTasks?: number;
  openTasks?: number;
  completedTasks?: number;
  totalMembers?: number;
  totalCamps?: number;
  activeCamps?: number;
}

interface DashboardTile {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  count?: number;
}

const countVisibleRosterMembers = (rosterMembers: any[] = []): number => {
  return rosterMembers
    .filter((memberEntry: any) => memberEntry?.member)
    .map((memberEntry: any) => {
      const memberData = memberEntry.member || {};
      return {
        _id: memberData?._id?.toString?.() || memberEntry.member?.toString?.() || null,
        status: memberData.status || memberEntry.status || 'active',
      };
    })
    .filter((member: any) => member._id)
    .filter((member: any) => {
      const normalizedStatus = String(member?.status || '').toLowerCase();
      return !['deleted', 'rejected', 'withdrawn'].includes(normalizedStatus);
    }).length;
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { campIdentifier } = useParams<{ campIdentifier?: string }>();
  const [stats, setStats] = useState<DashboardStats>({});
  const [loading, setLoading] = useState(true);
  const isCampContext =
    user?.accountType === 'camp' ||
    (user?.accountType === 'admin' && !!user?.campId) ||
    (user?.isCampLead === true && !!user?.campLeadCampId);
  const currentCampId = user?.campId?.toString() || user?.campLeadCampId || user?._id?.toString() || '';
  const campBasePath = currentCampId ? `/camp/${currentCampId}` : '';
  const eventsLeadCampBasePath = user?.eventsLeadCampId ? `/camp/${user.eventsLeadCampId}` : '';
  const eventsLeadCampProfilePath = user?.eventsLeadCampSlug
    ? `/camps/${user.eventsLeadCampSlug}`
    : user?.eventsLeadCampId
      ? `/camps/${user.eventsLeadCampId}`
      : '';

  // Security check: Verify camp identifier matches authenticated user's camp
  useEffect(() => {
    if (
      campIdentifier &&
      user &&
      (user.accountType === 'camp' || (user.accountType === 'admin' && user.campId) || user.isCampLead)
    ) {
      const userCampId = user.campId?.toString() || user.campLeadCampId || user._id?.toString();
      const identifierMatches = campIdentifier === userCampId || 
                                campIdentifier === user.urlSlug ||
                                campIdentifier === user.campLeadCampSlug ||
                                (user.campName && campIdentifier === user.campName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
      
      if (!identifierMatches) {
        console.error('❌ [Dashboard] Camp identifier mismatch. Redirecting...');
        navigate('/dashboard', { replace: true });
        return;
      }
    }
  }, [campIdentifier, user, navigate]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        if (isCampContext) {
          let campId = user?.campLeadCampId || '';
          if (!campId) {
            const campData = await apiService.getMyCamp();
            campId = campData._id;
          }

          const [applicationsRes, tasksRes, rosterRes] = await Promise.all([
            apiService.get(`/applications/camp/${campId}`),
            apiService.get('/tasks'),
            apiService.get(`/rosters/active?campId=${campId}`).catch((err) => {
              console.log('ℹ️ [Dashboard] No active roster found:', err.response?.status);
              return null;
            })
          ]);

          const applications = applicationsRes?.applications || [];
          const tasks = Array.isArray(tasksRes) ? tasksRes : [];
          const totalMembers = countVisibleRosterMembers(rosterRes?.members || []);

          const openApplicationStatuses = new Set(['new', 'pending', 'call-scheduled', 'pending-orientation', 'under-review', 'undecided']);

          setStats({
            pendingApplications: applications.filter((app: { status?: string }) =>
              openApplicationStatuses.has(String(app.status || '').toLowerCase())
            ).length,
            approvedApplications: applications.filter((app: { status?: string }) =>
              String(app.status || '').toLowerCase() === 'approved'
            ).length,
            totalTasks: tasks.length,
            openTasks: tasks.filter((task: { status?: string }) => String(task.status || '').toLowerCase() === 'open').length,
            completedTasks: tasks.filter((task: { status?: string }) => String(task.status || '').toLowerCase() === 'closed').length,
            totalMembers
          });
        } else if (user?.accountType === 'admin' || user?.isSystemAdmin) {
          const response = await apiService.get('/admin/stats');
          setStats(response.data);
        } else {
          // Personal account stats
          const [applicationsRes, tasksRes] = await Promise.all([
            apiService.get('/applications/my-applications'),
            apiService.get('/tasks/my-tasks')
          ]);
          
          setStats({
            pendingApplications: applicationsRes.applications?.filter((app: { status: string }) =>
              ['pending', 'new', 'call-scheduled', 'pending-orientation', 'under-review', 'undecided'].includes(app.status)
            ).length || 0,
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
  }, [user, isCampContext]);

  const getDashboardTiles = (): DashboardTile[] => {
    // Debug logging
    console.log('Dashboard - User data:', user);
    console.log('Dashboard - Account type:', user?.accountType);
    console.log('Dashboard - Camp ID:', user?.campId);
    
    const commonTiles = [
      {
        title: 'My Profile',
        description: user?.accountType === 'camp' ? 'Manage camp information' : 'Manage your profile',
        icon: <User size={24} />,
        path: user?.accountType === 'camp'
          ? (campBasePath ? `${campBasePath}/profile` : '/camp/profile')
          : '/user/profile',
        color: 'bg-blue-500'
      },
      {
        title: isCampContext ? 'Tasks' : 'To-dos',
        description: `${stats.openTasks || 0} open tasks`,
        icon: <Assignment size={24} />,
        path: isCampContext ? (campBasePath ? `${campBasePath}/tasks` : '/camp/tasks') : '/tasks',
        color: 'bg-green-500'
      }
    ];

    if (isCampContext) {
      return [
        {
          title: 'Camp Profile',
          description: 'Public profile, photos, settings',
          icon: <User size={22} />,
          path: campBasePath ? `${campBasePath}/profile` : '/camp/profile',
          color: 'bg-blue-500'
        },
        {
          title: 'Applications',
          description: `${stats.pendingApplications || 0} open`,
          icon: <FileText size={22} />,
          path: campBasePath ? `${campBasePath}/applications` : '/camp/applications',
          color: 'bg-purple-500',
          count: stats.pendingApplications || 0
        },
        {
          title: 'Roster',
          description: `${stats.totalMembers || 0} members`,
          icon: <People size={22} />,
          path: campBasePath ? `${campBasePath}/roster` : '/camp/rosters',
          color: 'bg-orange-500',
          count: stats.totalMembers || 0
        },
        {
          title: 'Tasks',
          description: `${stats.openTasks || 0} open`,
          icon: <ClipboardCheck size={22} />,
          path: campBasePath ? `${campBasePath}/tasks` : '/camp/tasks',
          color: 'bg-green-500',
          count: stats.openTasks || 0
        },
        {
          title: 'Surveys',
          description: 'Build and send surveys',
          icon: <Assignment size={22} />,
          path: campBasePath ? `${campBasePath}/surveys` : '/camp/surveys',
          color: 'bg-cyan-500'
        },
        {
          title: 'Events',
          description: 'Events and volunteer shifts',
          icon: <Calendar size={22} />,
          path: campBasePath ? `${campBasePath}/events` : '/camp/shifts',
          color: 'bg-teal-500'
        }
      ];
    }

    if (user?.accountType === 'personal') {
      const eventsLeadTiles: DashboardTile[] = user?.isEventsLead && eventsLeadCampBasePath
        ? [
            {
              title: 'Camp Profile',
              description: user.eventsLeadCampName || 'View camp profile',
              icon: <User size={24} />,
              path: eventsLeadCampProfilePath || eventsLeadCampBasePath,
              color: 'bg-blue-500'
            },
            {
              title: 'Meals & Roster',
              description: 'Meal payments and preferences',
              icon: <People size={24} />,
              path: `${eventsLeadCampBasePath}/roster`,
              color: 'bg-orange-500'
            },
            {
              title: 'Camp Tasks',
              description: 'Manage camp tasks',
              icon: <ClipboardCheck size={24} />,
              path: `${eventsLeadCampBasePath}/tasks`,
              color: 'bg-green-500'
            },
            {
              title: 'Camp Surveys',
              description: 'Build and send surveys',
              icon: <Assignment size={24} />,
              path: `${eventsLeadCampBasePath}/surveys`,
              color: 'bg-cyan-500'
            },
            {
              title: 'Camp Events',
              description: 'Events and volunteer shifts',
              icon: <Calendar size={24} />,
              path: `${eventsLeadCampBasePath}/events`,
              color: 'bg-teal-500'
            }
          ]
        : [];

      return [
        ...commonTiles,
        {
          title: 'Discover Camps',
          description: 'Find camps to join',
          icon: <SearchIcon size={24} />,
          path: '/camps',
          color: 'bg-indigo-500'
        },
        {
          title: 'My Applications',
          description: `${stats.pendingApplications || 0} pending`,
          icon: <Assignment size={24} />,
          path: '/applications/my',
          color: 'bg-purple-500'
        },
        ...eventsLeadTiles
      ];
    }

    if (user?.accountType === 'admin' || user?.isSystemAdmin) {
      return [
        ...commonTiles,
        {
          title: 'Admin',
          description: 'System administration',
          icon: <UserCheck size={24} />,
          path: '/admin',
          color: 'bg-red-500'
        },
        {
          title: 'All Camps',
          description: `${stats.totalCamps || 0} camps`,
          icon: <Group size={24} />,
          path: '/admin',
          color: 'bg-yellow-500'
        }
      ];
    }

    return commonTiles;
  };

  const getQuickActions = () => {
    const commonActions = [];

    if (isCampContext) {
      return [
        {
          title: 'Create Task',
          icon: <Plus size={24} />,
          onClick: () => navigate(campBasePath ? `${campBasePath}/tasks?action=create` : '/camp/tasks?action=create'),
          description: 'Assign a new task'
        },
        {
          title: 'Review Applications',
          icon: <Eye size={24} />,
          onClick: () => navigate(campBasePath ? `${campBasePath}/applications` : '/camp/applications'),
          description: 'Review pending applications'
        },
        {
          title: 'Manage Roster',
          icon: <People size={24} />,
          onClick: () => navigate(campBasePath ? `${campBasePath}/roster` : '/camp/rosters'),
          description: 'View and manage members'
        },
        {
          title: 'Manage Surveys',
          icon: <Assignment size={24} />,
          onClick: () => navigate(campBasePath ? `${campBasePath}/surveys` : '/camp/surveys'),
          description: 'Build and send surveys'
        },
        {
          title: 'Manage Shifts',
          icon: <TrendingUpIcon size={24} />,
          onClick: () => navigate(campBasePath ? `${campBasePath}/events` : '/camp/shifts'),
          description: 'Create and manage shifts'
        }
      ];
    }

    if (user?.accountType === 'personal') {
      const personalActions = [
        {
          title: 'Find Camps',
          icon: <SearchIcon size={24} />,
          onClick: () => navigate('/camps'),
          description: 'Discover new camps'
        },
        {
          title: 'View Applications',
          icon: <Eye size={24} />,
          onClick: () => navigate('/applications/my'),
          description: 'Check application status'
        }
      ];

      if (user?.isEventsLead && eventsLeadCampBasePath) {
        personalActions.push(
          {
            title: 'Manage Meals',
            icon: <People size={24} />,
            onClick: () => navigate(`${eventsLeadCampBasePath}/roster`),
            description: 'Meal payments and preferences'
          },
          {
            title: 'Manage Events',
            icon: <Calendar size={24} />,
            onClick: () => navigate(`${eventsLeadCampBasePath}/events`),
            description: 'Create and manage events'
          },
          {
            title: 'Manage Surveys',
            icon: <Assignment size={24} />,
            onClick: () => navigate(`${eventsLeadCampBasePath}/surveys`),
            description: 'Build and send surveys'
          },
          {
            title: 'Manage Camp Tasks',
            icon: <ClipboardCheck size={24} />,
            onClick: () => navigate(`${eventsLeadCampBasePath}/tasks`),
            description: 'Assign and close tasks'
          }
        );
      }

      return personalActions;
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

  const dashboardTiles = getDashboardTiles();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-h1 font-lato-bold text-custom-text mb-2">
          Welcome back, {user?.firstName || 'User'}!
        </h1>
        <p className="text-body text-custom-text-secondary">
          {user?.accountType === 'camp' ? 'Manage your camp and members' : 
           (user?.accountType === 'admin' || user?.isSystemAdmin) ? 'System administration dashboard' :
           'Your personal dashboard'}
        </p>
      </div>

      {/* Stats Overview */}
      {!isCampContext && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card className="p-6 text-center">
          <Assignment size={40} className="text-orange-500 mx-auto mb-3" />
          <h3 className="text-h3 font-lato-bold text-custom-text mb-1">
            {stats.pendingApplications || 0}
          </h3>
          <p className="text-body text-custom-text-secondary">
            {isCampContext ? 'Open Applications' : 'Pending Applications'}
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
            {isCampContext ? 'Closed Tasks' : 'Completed Tasks'}
          </p>
        </Card>
      </div>
      )}

      {/* Main Dashboard Tiles */}
      {isCampContext && (
        <div className="grid grid-cols-1 gap-3 mb-6 sm:max-w-lg sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <p className="text-xl font-lato-bold text-custom-text">{stats.pendingApplications || 0}</p>
            <p className="text-sm text-custom-text-secondary">Open applications</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <p className="text-xl font-lato-bold text-custom-text">{stats.openTasks || 0}</p>
            <p className="text-sm text-custom-text-secondary">Open tasks</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <p className="text-xl font-lato-bold text-custom-text">{stats.totalMembers || 0}</p>
            <p className="text-sm text-custom-text-secondary">Members</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {dashboardTiles.map((tile) => (
          <Link
            key={tile.path}
            to={tile.path}
            className="group rounded-lg border border-gray-200 bg-white p-5 transition hover:border-custom-primary hover:shadow-md focus:outline-none focus:ring-2 focus:ring-custom-primary focus:ring-offset-2"
          >
            <div className="flex items-center gap-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tile.color} text-white`}>
                {tile.icon}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-lato-bold text-custom-text mb-1">
                  {tile.title}
                </h3>
                <p className="text-sm text-custom-text-secondary">
                  {tile.description}
                </p>
              </div>
              <ArrowRight size={18} className="text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-custom-primary" />
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions (deprecated for camp dashboards) */}
      {!isCampContext && (
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
      )}
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Dashboard;

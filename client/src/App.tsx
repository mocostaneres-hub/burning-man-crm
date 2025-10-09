import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Navbar from './components/layout/Navbar';
import Home from './pages/Home';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Dashboard from './pages/Dashboard';
import CampProfile from './pages/camps/CampProfile';
import CampCreate from './pages/camps/CampCreate';
import CampEdit from './pages/camps/CampEdit';
import CampDiscovery from './pages/camps/CampDiscovery';
import PublicCampProfile from './pages/camps/PublicCampProfile';
import MemberRoster from './pages/members/MemberRoster';
import MemberProfile from './pages/members/MemberProfile';
import UserProfile from './pages/users/UserProfile';
import AdminDashboard from './pages/admin/AdminDashboard';
import VolunteerShifts from './pages/shifts/VolunteerShifts';
import Help from './pages/Help';
import FAQAdmin from './pages/help/FAQAdmin';
import Principles from './pages/Principles';
import SupportInbox from './components/support/SupportInbox';
import ApplicationManagementTable from './pages/applications/ApplicationManagementTable';
import MyApplications from './pages/applications/MyApplications';
import Contact360View from './pages/contacts/Contact360View';
import RosterManagement from './pages/rosters/RosterManagement';
import MemberProfileEdit from './pages/members/MemberProfileEdit';
import PublicMemberProfile from './pages/members/PublicMemberProfile';
import CallSlotManagement from './pages/camps/CallSlotManagement';
import TaskManagement from './pages/camps/TaskManagement';
import MyTasks from './pages/tasks/MyTasks';
import InviteTrackingPage from './pages/invites/InviteTrackingPage';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Dashboard redirect component for personal accounts
const DashboardRedirect: React.FC = () => {
  const { user } = useAuth();
  
  console.log('🔍 [DashboardRedirect] User account type:', user?.accountType);
  console.log('🔍 [DashboardRedirect] User data:', user);
  
  // Personal accounts go to profile, others see the dashboard
  if (user?.accountType === 'personal') {
    console.log('🔍 [DashboardRedirect] Redirecting personal account to /user/profile');
    return <Navigate to="/user/profile" replace />;
  }
  
  console.log('🔍 [DashboardRedirect] Showing dashboard for account type:', user?.accountType);
  return <Dashboard />;
};

function App() {
  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
  if (!googleClientId) {
    console.warn('Google OAuth not configured - REACT_APP_GOOGLE_CLIENT_ID missing');
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId || 'not-configured'}>
      <AuthProvider>
        <SocketProvider>
          <NotificationProvider>
          <Router>
            <div className="min-h-screen bg-custom-bg">
              <Navbar />
              <main className="pt-16">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/dashboard" element={
                    <ProtectedRoute>
                      <DashboardRedirect />
                    </ProtectedRoute>
                  } />
                  <Route path="/camp/profile" element={
                    <ProtectedRoute requireCampAccount>
                      <CampProfile />
                    </ProtectedRoute>
                  } />
                  <Route path="/camp/create" element={
                    <ProtectedRoute requirePersonalAccount>
                      <CampCreate />
                    </ProtectedRoute>
                  } />
                  <Route path="/camp/edit" element={
                    <ProtectedRoute requireCampAccount>
                      <CampEdit />
                    </ProtectedRoute>
                  } />
                  <Route path="/camp/rosters" element={
                    <ProtectedRoute requireCampAccount>
                      <MemberRoster />
                    </ProtectedRoute>
                  } />
                  <Route path="/camp/applications" element={
                    <ProtectedRoute requireCampAccount>
                      <ApplicationManagementTable />
                    </ProtectedRoute>
                  } />
                  <Route path="/camp/call-slots" element={
                    <ProtectedRoute requireCampAccount>
                      <CallSlotManagement />
                    </ProtectedRoute>
                  } />
                  <Route path="/camp/tasks" element={
                    <ProtectedRoute requireCampAccount>
                      <TaskManagement />
                    </ProtectedRoute>
                  } />
                  <Route path="/camp/shifts" element={
                    <ProtectedRoute requireCampAccount>
                      <VolunteerShifts />
                    </ProtectedRoute>
                  } />
                  <Route path="/camp/:campId/contacts/:userId" element={
                    <ProtectedRoute requireCampAccount>
                      <Contact360View />
                    </ProtectedRoute>
                  } />
                  <Route path="/camp/invites" element={
                    <ProtectedRoute requireCampAccount>
                      <InviteTrackingPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/camps" element={<CampDiscovery />} />
                  <Route path="/camps/public/:slug" element={<PublicCampProfile />} />
                  <Route path="/camps/:slug" element={<PublicCampProfile />} />
                  <Route path="/member/profile" element={
                    <ProtectedRoute requirePersonalAccount>
                      <MemberProfile />
                    </ProtectedRoute>
                  } />
                  <Route path="/member/edit" element={
                    <ProtectedRoute requirePersonalAccount>
                      <MemberProfileEdit />
                    </ProtectedRoute>
                  } />
                  <Route path="/members/public/:identifier" element={<PublicMemberProfile />} />
                  <Route path="/members/:identifier" element={<PublicMemberProfile />} />
                  <Route path="/user/profile" element={
                    <ProtectedRoute>
                      <UserProfile />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin" element={
                    <ProtectedRoute requireAdmin>
                      <AdminDashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/help" element={<Help />} />
                  <Route path="/help/admin" element={
                    <ProtectedRoute requireAdmin>
                      <FAQAdmin />
                    </ProtectedRoute>
                  } />
                  <Route path="/principles" element={<Principles />} />
                  <Route path="/support/inbox" element={
                    <ProtectedRoute requireCampAccount>
                      <SupportInbox />
                    </ProtectedRoute>
                  } />
                  <Route path="/applications/my" element={
                    <ProtectedRoute requirePersonalAccount>
                      <MyApplications />
                    </ProtectedRoute>
                  } />
                  <Route path="/rosters/manage" element={
                    <ProtectedRoute requireCampAccount>
                      <RosterManagement />
                    </ProtectedRoute>
                  } />
                  <Route path="/tasks" element={
                    <ProtectedRoute requirePersonalAccount>
                      <MyTasks />
                    </ProtectedRoute>
                  } />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
          </Router>
        </SocketProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
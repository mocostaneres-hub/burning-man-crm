import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Navbar from './components/layout/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
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
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import About from './pages/About';
import PublicMemberProfile from './pages/members/PublicMemberProfile';
import CallSlotManagement from './pages/camps/CallSlotManagement';
import TaskManagement from './pages/camps/TaskManagement';
import TaskDetailsPage from './pages/camps/TaskDetailsPage';
import MyTasks from './pages/tasks/MyTasks';
import InviteTrackingPage from './pages/invites/InviteTrackingPage';
import SelectRole from './pages/onboarding/SelectRole';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useLocation } from 'react-router-dom';

// Conditional Navbar component that hides on onboarding pages
const ConditionalNavbar: React.FC = () => {
  const location = useLocation();
  
  // Hide navbar on onboarding/select-role page
  if (location.pathname === '/onboarding/select-role') {
    return null;
  }
  
  return <Navbar />;
};

// Conditional Main component that adjusts padding based on navbar visibility
interface ConditionalMainProps {
  children: React.ReactNode;
}

const ConditionalMain: React.FC<ConditionalMainProps> = ({ children }) => {
  const location = useLocation();
  
  // No padding top if navbar is hidden
  if (location.pathname === '/onboarding/select-role') {
    return <main>{children}</main>;
  }
  
  return <main className="pt-16">{children}</main>;
};

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
  return (
    <ErrorBoundary>
        <AuthProvider>
          <SocketProvider>
            <Router>
            <div className="min-h-screen bg-custom-bg">
              <ConditionalNavbar />
              <ConditionalMain>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/onboarding/select-role" element={
                    <ProtectedRoute>
                      <SelectRole />
                    </ProtectedRoute>
                  } />
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
                    <ProtectedRoute>
                      <TaskManagement />
                    </ProtectedRoute>
                  } />
                  <Route path="/tasks/:taskIdCode" element={
                    <ProtectedRoute>
                      <TaskDetailsPage />
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
                  <Route path="/camp/help" element={
                    <ProtectedRoute requireCampAccount>
                      <Help />
                    </ProtectedRoute>
                  } />
                  <Route path="/member/help" element={
                    <ProtectedRoute>
                      <Help />
                    </ProtectedRoute>
                  } />
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
              </ConditionalMain>
            </div>
          </Router>
        </SocketProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
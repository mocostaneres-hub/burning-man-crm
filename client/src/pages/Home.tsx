import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Badge, Button, Card } from '../components/ui';
import FAQ from '../components/FAQ';
import Footer from '../components/layout/Footer';
import {
  Calendar,
  CheckCircle,
  ClipboardList,
  Search,
  Ticket,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  colorClass: string;
  iconBgClass: string;
}

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBgClass: string;
  iconColorClass: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  colorClass,
  iconBgClass,
}) => (
  <Card className="p-4">
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
      </div>
      <div className={`p-3 rounded-full ${iconBgClass}`}>
        {icon}
      </div>
    </div>
  </Card>
);

const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  description,
  icon,
  iconBgClass,
  iconColorClass,
}) => (
  <Card className="p-6">
    <div className={`inline-flex p-3 rounded-full ${iconBgClass} mb-4`}>
      <div className={iconColorClass}>{icon}</div>
    </div>
    <h3 className="text-h3 font-lato-bold text-custom-text mb-2">{title}</h3>
    <p className="text-body-sm text-custom-text-secondary">{description}</p>
  </Card>
);

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const dashboardPath = user?.accountType === 'camp' ? '/dashboard' : '/user/profile';
  const dashboardLabel = user?.accountType === 'camp' ? 'Go to Dashboard' : 'My Profile';
  const campProfilePath = !isAuthenticated
    ? '/register'
    : user?.accountType === 'personal'
      ? '/camp/create'
      : '/camp/edit';
  const memberProfilePath = isAuthenticated && user?.accountType === 'personal'
    ? '/member/edit'
    : '/register';

  return (
    <div className="bg-custom-bg">
      <section className="py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-8 lg:gap-12 items-center">
            <div>
              <Badge variant="success" className="mb-4 bg-green-50 text-green-800">
                Roster-first camp operations
              </Badge>
              <h1 className="text-h1 md:text-[2.75rem] md:leading-tight font-lato-bold text-custom-text mb-4">
                Know what is ready before playa week gets loud.
              </h1>
              <p className="text-body text-custom-text-secondary mb-6 max-w-2xl">
                G8Road gives camps an operational dashboard for roster health,
                applications, shifts, dues, tickets, vehicle passes, and member
                readiness, while members get a clear personal workspace after login.
              </p>
              <div className="flex flex-wrap gap-3">
                {!isAuthenticated ? (
                  <>
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={() => navigate('/register')}
                    >
                      Get Started
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => navigate('/camps')}
                    >
                      Discover Camps
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={() => navigate(dashboardPath)}
                    >
                      {dashboardLabel}
                    </Button>
                    {user?.accountType !== 'camp' && (
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => navigate('/camps')}
                      >
                        Find Your Camp
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <MetricCard
                title="Roster members"
                value="42"
                icon={<Users className="w-6 h-6 text-purple-600" />}
                colorClass="text-purple-600"
                iconBgClass="bg-purple-100"
              />
              <MetricCard
                title="Dues paid"
                value="76%"
                icon={<CheckCircle className="w-6 h-6 text-green-600" />}
                colorClass="text-green-600"
                iconBgClass="bg-green-100"
              />
              <MetricCard
                title="Open tasks"
                value="11"
                icon={<ClipboardList className="w-6 h-6 text-orange-600" />}
                colorClass="text-orange-600"
                iconBgClass="bg-orange-100"
              />
              <MetricCard
                title="Shift gaps"
                value="5"
                icon={<TrendingUp className="w-6 h-6 text-blue-600" />}
                colorClass="text-blue-600"
                iconBgClass="bg-blue-100"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-6 lg:py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6 sm:p-8 border-2 border-green-200 bg-green-50/20">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-custom-primary font-lato-bold text-xl">C</span>
                </div>
                <Badge variant="success" className="bg-green-100 text-green-800">
                  Camp account
                </Badge>
              </div>
              <h2 className="text-h2 font-lato-bold text-custom-text mb-3">
                Manage a camp
              </h2>
              <p className="text-body text-custom-text-secondary mb-6">
                Build your roster, review applications, assign work, manage shifts,
                and track logistics from a camp-level dashboard.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}
                >
                  Go to camp tools
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate(campProfilePath)}
                >
                  Create camp profile
                </Button>
              </div>
            </Card>

            <Card className="p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-700 font-lato-bold text-xl">M</span>
                </div>
                <Badge variant="info" className="bg-blue-100 text-blue-800">
                  Member account
                </Badge>
              </div>
              <h2 className="text-h2 font-lato-bold text-custom-text mb-3">
                Join and participate
              </h2>
              <p className="text-body text-custom-text-secondary mb-6">
                Find camps, keep your profile ready, follow application status,
                view tasks, sign up for shifts, and read updates.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/camps')}
                >
                  Find camps
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate(memberProfilePath)}
                >
                  Complete my profile
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-14 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h2 className="text-h2 font-lato-bold text-custom-text mb-2">
              Operational coverage
            </h2>
            <p className="text-body text-custom-text-secondary max-w-3xl">
              The homepage should preview the same workstreams users see inside the app,
              with Roster as the visual and functional anchor.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <FeatureCard
              title="Roster"
              description="Members, leads, skills, arrival, departure, tickets, vehicle passes, and dues."
              icon={<Users className="w-6 h-6" />}
              iconBgClass="bg-green-100"
              iconColorClass="text-green-600"
            />
            <FeatureCard
              title="Applications"
              description="Review queues, call states, decisions, and next steps for prospective members."
              icon={<ClipboardList className="w-6 h-6" />}
              iconBgClass="bg-orange-100"
              iconColorClass="text-orange-600"
            />
            <FeatureCard
              title="Shifts"
              description="Events, volunteer signups, coverage gaps, reminders, and personal schedules."
              icon={<Calendar className="w-6 h-6" />}
              iconBgClass="bg-blue-100"
              iconColorClass="text-blue-600"
            />
            <FeatureCard
              title="Tasks"
              description="Assignment, completion, and member-specific follow-through for camp work."
              icon={<CheckCircle className="w-6 h-6" />}
              iconBgClass="bg-purple-100"
              iconColorClass="text-purple-600"
            />
          </div>
        </div>
      </section>

      <section className="py-14 bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-8 items-start">
            <div>
              <h2 className="text-h2 font-lato-bold text-custom-text mb-2">
                Ready signals at a glance
              </h2>
              <p className="text-body text-custom-text-secondary">
                Public visitors see the product's operational shape before they log in.
                The same status language carries into the authenticated dashboards.
              </p>
            </div>
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <div className="min-w-[680px]">
                  <div className="grid grid-cols-4 gap-4 px-6 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span>Signal</span>
                    <span>Status</span>
                    <span>Owner</span>
                    <span>Next step</span>
                  </div>
                  <div className="divide-y divide-gray-200 bg-white">
                    <div className="grid grid-cols-4 gap-4 px-6 py-4 text-sm text-custom-text">
                      <span className="font-medium">Roster health</span>
                      <Badge variant="success">On track</Badge>
                      <span>Camp leads</span>
                      <span className="text-custom-primary font-medium">Review members</span>
                    </div>
                    <div className="grid grid-cols-4 gap-4 px-6 py-4 text-sm text-custom-text">
                      <span className="font-medium">Tickets + VP</span>
                      <Badge variant="warning">Needs review</Badge>
                      <span>Logistics</span>
                      <span className="text-custom-primary font-medium">Close gaps</span>
                    </div>
                    <div className="grid grid-cols-4 gap-4 px-6 py-4 text-sm text-custom-text">
                      <span className="font-medium">Member tasks</span>
                      <Badge variant="info">Active</Badge>
                      <span>Members</span>
                      <span className="text-custom-primary font-medium">Complete actions</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {!isAuthenticated && (
        <section className="py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Card className="p-6 sm:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-center">
                <div>
                  <h2 className="text-h2 font-lato-bold text-custom-text mb-2">
                    Start from the role that fits your camp life.
                  </h2>
                  <p className="text-body text-custom-text-secondary">
                    Camp accounts land in management tools. Members land in profile,
                    task, shift, and community updates.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => navigate('/register')}
                  >
                    Sign Up
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => navigate('/login')}
                  >
                    Log In
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </section>
      )}

      {isAuthenticated && user?.accountType === 'personal' && (
        <section className="py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <FeatureCard
                title="Find Your Camp"
                description="Browse camp profiles, review mission and needs, and choose where to contribute."
                icon={<Search className="w-6 h-6" />}
                iconBgClass="bg-green-100"
                iconColorClass="text-green-600"
              />
              <FeatureCard
                title="Bring Your Readiness"
                description="Keep your profile, logistics, and skills current before camp teams need them."
                icon={<User className="w-6 h-6" />}
                iconBgClass="bg-blue-100"
                iconColorClass="text-blue-600"
              />
              <FeatureCard
                title="Track Your Commitments"
                description="Follow tasks, shifts, application status, and updates from one member workspace."
                icon={<Ticket className="w-6 h-6" />}
                iconBgClass="bg-orange-100"
                iconColorClass="text-orange-600"
              />
            </div>
          </div>
        </section>
      )}

      {!isAuthenticated && <FAQ />}

      <Footer />
    </div>
  );
};

export default Home;

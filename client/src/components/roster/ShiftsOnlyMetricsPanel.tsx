import React from 'react';
import { Card } from '../ui';
import { Bell, CheckCircle, CheckSquare, ClipboardList, Shield, UserPlus, Users } from 'lucide-react';
import { Member } from '../../types';

interface ShiftsOnlyMetricsPanelProps {
  members: Member[];
}

interface MetricCardProps {
  title: string;
  count: number;
  icon: React.ReactNode;
  colorClass: string;
  percentage?: number;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, count, icon, colorClass, percentage }) => (
  <Card className="p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <div className="flex items-baseline gap-2">
          <p className={`text-2xl font-bold ${colorClass}`}>{count}</p>
          {percentage !== undefined && (
            <p className="text-sm font-medium text-gray-500">({percentage}%)</p>
          )}
        </div>
      </div>
      <div className={`p-3 rounded-full ${
        colorClass.includes('amber') ? 'bg-amber-100' :
        colorClass.includes('blue') ? 'bg-blue-100' :
        colorClass.includes('emerald') ? 'bg-emerald-100' :
        colorClass.includes('indigo') ? 'bg-indigo-100' :
        colorClass.includes('purple') ? 'bg-purple-100' :
        colorClass.includes('rose') ? 'bg-rose-100' :
        'bg-green-100'
      }`}>
        {icon}
      </div>
    </div>
  </Card>
);

const hasLinkedUserAccount = (member: any): boolean => {
  const userRef = member?.member?.user;
  return Boolean(userRef && (typeof userRef === 'string' || userRef._id));
};

const getShiftSignupCount = (member: any): number => {
  return Number(member?.member?.shiftSignupCount || 0);
};

const getSkills = (member: any): string[] => {
  const userSkills = Array.isArray(member?.user?.skills) ? member.user.skills : [];
  const memberSkills = Array.isArray(member?.member?.skills) ? member.member.skills : [];
  return userSkills.length >= memberSkills.length ? userSkills : memberSkills;
};

const ShiftsOnlyMetricsPanel: React.FC<ShiftsOnlyMetricsPanelProps> = ({ members }) => {
  const totalMembers = members.length;
  const activeAccountsCount = members.filter(hasLinkedUserAccount).length;
  const invitedCount = totalMembers - activeAccountsCount;
  const signedUpForShiftsCount = members.filter((member) => getShiftSignupCount(member) > 0).length;
  const noShiftsCount = members.filter((member) => getShiftSignupCount(member) === 0).length;
  const campLeadsCount = members.filter((member: any) => member.isCampLead === true).length;
  const skillsListedCount = members.filter((member) => getSkills(member).length > 0).length;

  const calculatePercentage = (count: number) => {
    return totalMembers > 0 ? Math.round((count / totalMembers) * 100) : 0;
  };

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
        <MetricCard
          title="Total Members"
          count={totalMembers}
          icon={<Users className="w-6 h-6 text-purple-600" />}
          colorClass="text-purple-600"
        />
        <MetricCard
          title="Active Accounts"
          count={activeAccountsCount}
          icon={<CheckCircle className="w-6 h-6 text-green-600" />}
          colorClass="text-green-600"
          percentage={calculatePercentage(activeAccountsCount)}
        />
        <MetricCard
          title="Invited"
          count={invitedCount}
          icon={<UserPlus className="w-6 h-6 text-amber-600" />}
          colorClass="text-amber-600"
          percentage={calculatePercentage(invitedCount)}
        />
        <MetricCard
          title="Signed Up for Shifts"
          count={signedUpForShiftsCount}
          icon={<ClipboardList className="w-6 h-6 text-blue-600" />}
          colorClass="text-blue-600"
          percentage={calculatePercentage(signedUpForShiftsCount)}
        />
        <MetricCard
          title="No Shifts Yet"
          count={noShiftsCount}
          icon={<Bell className="w-6 h-6 text-rose-600" />}
          colorClass="text-rose-600"
          percentage={calculatePercentage(noShiftsCount)}
        />
        <MetricCard
          title="Camp Leads"
          count={campLeadsCount}
          icon={<Shield className="w-6 h-6 text-indigo-600" />}
          colorClass="text-indigo-600"
          percentage={calculatePercentage(campLeadsCount)}
        />
        <MetricCard
          title="Skills Listed"
          count={skillsListedCount}
          icon={<CheckSquare className="w-6 h-6 text-emerald-600" />}
          colorClass="text-emerald-600"
          percentage={calculatePercentage(skillsListedCount)}
        />
      </div>
    </div>
  );
};

export default ShiftsOnlyMetricsPanel;

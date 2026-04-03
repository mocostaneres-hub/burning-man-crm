import React from 'react';
import { Card } from '../ui';
import { Ticket, Car, Calendar, Clock, Users, User, CheckCircle } from 'lucide-react';
import { Member } from '../../types';

interface MetricsPanelProps {
  members: Member[];
  customFields?: Array<{ key: string; label: string; type: string }>;
  hideBreakdownSection?: boolean;
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
      <div className={`p-3 rounded-full ${colorClass.includes('red') ? 'bg-red-100' : 
                                           colorClass.includes('orange') ? 'bg-orange-100' :
                                           colorClass.includes('blue') ? 'bg-blue-100' : 
                                           colorClass.includes('purple') ? 'bg-purple-100' :
                                           colorClass.includes('pink') ? 'bg-pink-100' :
                                           'bg-green-100'}`}>
        {icon}
      </div>
    </div>
  </Card>
);

const MetricsPanel: React.FC<MetricsPanelProps> = ({
  members,
  customFields = [],
  hideBreakdownSection = false
}) => {
  // Define camp standard dates (you can move these to environment variables)
  const CAMP_STANDARD_OPEN_DATE = new Date('2025-08-25');
  const CAMP_STANDARD_CLOSE_DATE = new Date('2025-09-02');

  // Calculate metrics
  const membersWithoutTickets = members.filter(member => {
    const user = typeof member.user === 'object' ? member.user : null;
    return !user?.hasTicket;
  }).length;

  const membersWithoutVP = members.filter(member => {
    const user = typeof member.user === 'object' ? member.user : null;
    return !user?.hasVehiclePass;
  }).length;

  const earlyArrivalCount = members.filter(member => {
    const user = typeof member.user === 'object' ? member.user : null;
    if (user?.interestedInEAP) return true;
    
    if (user?.arrivalDate) {
      const arrivalDate = new Date(user.arrivalDate);
      return arrivalDate < CAMP_STANDARD_OPEN_DATE;
    }
    
    return false;
  }).length;

  const lateDepartureCount = members.filter(member => {
    const user = typeof member.user === 'object' ? member.user : null;
    if (user?.interestedInStrike) return true;
    
    if (user?.departureDate) {
      const departureDate = new Date(user.departureDate);
      return departureDate > CAMP_STANDARD_CLOSE_DATE;
    }
    
    return false;
  }).length;

  const virginsCount = members.filter(member => {
    const user = typeof member.user === 'object' ? member.user : null;
    return user?.yearsBurned === 0;
  }).length;

  const duesPaidCount = members.filter(member => {
    return member.duesPaid === true;
  }).length;

  const statusBreakdown = members.reduce<Record<string, number>>((acc, member) => {
    const key = (member.status || 'unknown').toString();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const skillsBreakdown = members.reduce<Record<string, number>>((acc, member) => {
    const user = typeof member.user === 'object' ? member.user : null;
    const skills = member.skills || user?.skills || [];
    for (const skill of skills) {
      if (!skill) continue;
      acc[skill] = (acc[skill] || 0) + 1;
    }
    return acc;
  }, {});

  const customFieldBreakdown = customFields.map((field) => {
    const counts: Record<string, number> = {};
    members.forEach((member) => {
      const value = (member.customFieldValues || {})[field.key];
      if (value === undefined || value === null || value === '') return;
      const asKey = String(value);
      counts[asKey] = (counts[asKey] || 0) + 1;
    });
    return { key: field.key, label: field.label, counts };
  });

  // Calculate percentages (rounded to nearest whole number)
  const totalMembers = members.length;
  const calculatePercentage = (count: number) => {
    return totalMembers > 0 ? Math.round((count / totalMembers) * 100) : 0;
  };

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
        <MetricCard
          title="Total Members"
          count={members.length}
          icon={<Users className="w-6 h-6 text-purple-600" />}
          colorClass="text-purple-600"
        />
        <MetricCard
          title="Dues Paid"
          count={duesPaidCount}
          icon={<CheckCircle className="w-6 h-6 text-green-600" />}
          colorClass="text-green-600"
          percentage={calculatePercentage(duesPaidCount)}
        />
        <MetricCard
          title="First-Year Burners"
          count={virginsCount}
          icon={<User className="w-6 h-6 text-pink-600" />}
          colorClass="text-pink-600"
          percentage={calculatePercentage(virginsCount)}
        />
        <MetricCard
          title="Members Without Tickets"
          count={membersWithoutTickets}
          icon={<Ticket className="w-6 h-6 text-red-600" />}
          colorClass="text-red-600"
          percentage={calculatePercentage(membersWithoutTickets)}
        />
        <MetricCard
          title="Members Without VP"
          count={membersWithoutVP}
          icon={<Car className="w-6 h-6 text-orange-600" />}
          colorClass="text-orange-600"
          percentage={calculatePercentage(membersWithoutVP)}
        />
        <MetricCard
          title="Early Arrival"
          count={earlyArrivalCount}
          icon={<Calendar className="w-6 h-6 text-blue-600" />}
          colorClass="text-blue-600"
          percentage={calculatePercentage(earlyArrivalCount)}
        />
        <MetricCard
          title="Late Departure"
          count={lateDepartureCount}
          icon={<Clock className="w-6 h-6 text-green-600" />}
          colorClass="text-green-600"
          percentage={calculatePercentage(lateDepartureCount)}
        />
      </div>
      {!hideBreakdownSection && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <Card className="p-4">
            <p className="text-sm font-medium text-gray-600 mb-2">By Status</p>
            <div className="space-y-1 text-sm">
              {Object.entries(statusBreakdown).map(([status, count]) => (
                <div key={status} className="flex justify-between">
                  <span>{status}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <p className="text-sm font-medium text-gray-600 mb-2">Top Skills</p>
            <div className="space-y-1 text-sm">
              {Object.entries(skillsBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([skill, count]) => (
                <div key={skill} className="flex justify-between">
                  <span>{skill}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <p className="text-sm font-medium text-gray-600 mb-2">Custom Fields</p>
            <div className="space-y-2 text-sm">
              {customFieldBreakdown.length === 0 ? (
                <span className="text-gray-500">No custom fields configured</span>
              ) : customFieldBreakdown.map((field) => (
                <div key={field.key}>
                  <p className="font-medium">{field.label}</p>
                  {Object.entries(field.counts).slice(0, 4).map(([value, count]) => (
                    <div key={`${field.key}-${value}`} className="flex justify-between text-gray-600">
                      <span>{value}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default MetricsPanel;

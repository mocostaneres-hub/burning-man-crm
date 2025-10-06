import React from 'react';
import { Card } from '../ui';
import { Ticket, Car, Calendar, Clock, Users, User, CheckCircle } from 'lucide-react';
import { Member } from '../../types';

interface MetricsPanelProps {
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

const MetricsPanel: React.FC<MetricsPanelProps> = ({ members }) => {
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
          title="Virgins"
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
          title="Early Arrival (EA)"
          count={earlyArrivalCount}
          icon={<Calendar className="w-6 h-6 text-blue-600" />}
          colorClass="text-blue-600"
          percentage={calculatePercentage(earlyArrivalCount)}
        />
        <MetricCard
          title="Late Departure (LD)"
          count={lateDepartureCount}
          icon={<Clock className="w-6 h-6 text-green-600" />}
          colorClass="text-green-600"
          percentage={calculatePercentage(lateDepartureCount)}
        />
      </div>
    </div>
  );
};

export default MetricsPanel;

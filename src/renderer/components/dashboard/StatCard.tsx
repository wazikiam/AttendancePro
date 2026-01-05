import React from 'react';
import { 
  PersonIcon,
  CheckCircledIcon,
  BookmarkIcon,
  CalendarIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@radix-ui/react-icons';

export interface StatCardProps {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  icon: 'person' | 'check' | 'book' | 'calendar' | 'custom';
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  change, 
  trend, 
  icon,
  color 
}) => {
  const colorClasses = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
    green: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
    red: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200' }
  };

  const iconMap = {
    person: PersonIcon,
    check: CheckCircledIcon,
    book: BookmarkIcon,
    calendar: CalendarIcon,
    custom: PersonIcon
  };

  const IconComponent = iconMap[icon] || PersonIcon;
  const { bg, text, border } = colorClasses[color] || colorClasses.blue;

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${border} p-6`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          <div className="flex items-center mt-2">
            {trend === 'up' ? (
              <ArrowUpIcon className="w-4 h-4 text-green-600 mr-1" />
            ) : (
              <ArrowDownIcon className="w-4 h-4 text-red-600 mr-1" />
            )}
            <span className={`text-sm font-medium ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              {change}
            </span>
            <span className="text-sm text-gray-500 ml-2">from last month</span>
          </div>
        </div>
        <div className={`w-14 h-14 ${bg} rounded-full flex items-center justify-center`}>
          <IconComponent className={`w-7 h-7 ${text}`} />
        </div>
      </div>
    </div>
  );
};

export default StatCard;
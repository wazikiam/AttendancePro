import React from 'react';

interface Activity {
  id: number;
  action: string;
  user: string;
  time: string;
  icon: React.ReactNode;
}

interface RecentActivityProps {
  activities: Activity[];
}

const RecentActivity: React.FC<RecentActivityProps> = ({ activities }) => {
  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="flex items-start p-3 rounded-lg hover:bg-neutral-50 transition-colors"
        >
          <div className="mr-3 mt-0.5">
            <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center">
              {activity.icon}
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm text-neutral-900">
              <span className="font-medium">{activity.user}</span>{' '}
              {activity.action}
            </p>
            <p className="text-xs text-neutral-500 mt-1">{activity.time}</p>
          </div>
          <button className="text-neutral-400 hover:text-neutral-600 p-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
};

export default RecentActivity;
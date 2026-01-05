import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import StatCard from '../components/dashboard/StatCard';
import { database } from '../../shared/utils/electron-api';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState({
    subscribers: 0,
    activeSubscribers: 0,
    classes: 0,
    upcomingClasses: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const statsResult = await database.getStats();
      if (statsResult.success && statsResult.data) {
        const data = statsResult.data;
        setStats({
          subscribers: data.subscribers || 0,
          activeSubscribers: data.active_subscribers || 0,
          classes: data.classes || 0,
          upcomingClasses: 0
        });
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: t('dashboard.totalSubscribers', 'Total Subscribers'),
      value: stats.subscribers.toString(),
      change: '+0',
      trend: 'up' as const,
      icon: 'person' as const,
      color: 'blue' as const
    },
    {
      title: t('dashboard.active', 'Active'),
      value: stats.activeSubscribers.toString(),
      change: '+0',
      trend: 'up' as const,
      icon: 'check' as const,
      color: 'green' as const
    },
    {
      title: t('dashboard.classes', 'Classes'),
      value: stats.classes.toString(),
      change: '+0',
      trend: 'up' as const,
      icon: 'book' as const,
      color: 'purple' as const
    },
    {
      title: t('dashboard.upcomingClasses', 'Upcoming Classes'),
      value: stats.upcomingClasses.toString(),
      change: '+0',
      trend: 'up' as const,
      icon: 'calendar' as const,
      color: 'orange' as const
    }
  ];

  const quickActions = [
    {
      title: t('dashboard.addSubscriber', 'Add New Subscriber'),
      description: t('dashboard.addSubscriberDesc', 'Register a new person to the system'),
      icon: '👤',
      color: 'blue',
      onClick: () => (window.location.href = '/subscribers?action=create')
    },
    {
      title: t('dashboard.markAttendance', 'Mark Attendance'),
      description: t('dashboard.markAttendanceDesc', "Record today's attendance for all classes"),
      icon: '✅',
      color: 'green',
      onClick: () => (window.location.href = '/attendance')
    },
    {
      title: t('dashboard.generateReport', 'Generate Report'),
      description: t('dashboard.generateReportDesc', 'Create monthly attendance report'),
      icon: '📊',
      color: 'purple',
      onClick: async () => {
        try {
          const result = await database.backup();
          if (result.success) {
            alert(t('dashboard.backupSuccess', 'Backup created successfully!'));
          } else {
            alert(t('dashboard.backupFailed', 'Backup failed: ') + result.message);
          }
        } catch (error) {
          console.error('Could not backup database:', error);
          alert(t('dashboard.backupError', 'Error creating backup'));
        }
      }
    }
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {t('dashboard.title', 'Attendance Pro')}
        </h1>
        <p className="text-gray-600 mt-2">
          {t('dashboard.subtitle', 'Professional Attendance Management')}
        </p>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="mb-8 p-4 bg-blue-50 rounded-lg">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 inline-block mr-3"></div>
          <span className="text-blue-700">
            {t('dashboard.loading', 'Loading dashboard data...')}
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {t('dashboard.quickActions', 'Quick Actions')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              className={`p-6 bg-${action.color}-50 border border-${action.color}-200 rounded-lg hover:bg-${action.color}-100 text-left transition-colors`}
            >
              <div className="flex items-start space-x-4">
                <div className={`w-12 h-12 bg-${action.color}-100 rounded-lg flex items-center justify-center`}>
                  <span className="text-2xl">{action.icon}</span>
                </div>
                <div className="flex-1">
                  <h3 className={`text-lg font-semibold text-${action.color}-700 mb-1`}>
                    {action.title}
                  </h3>
                  <p className="text-sm text-gray-600">{action.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

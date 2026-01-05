import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SubscriberList from '../components/subscribers/SubscriberList';
import SubscriberForm from '../components/subscribers/SubscriberForm';
import Sidebar from '../components/layout/Sidebar';
import TitleBar from '../components/layout/TitleBar';

const SubscribersPage: React.FC = () => {
  const { t } = useTranslation();
  const [selectedSubscriber, setSelectedSubscriber] = useState<any>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSelectSubscriber = (subscriber: any) => {
    setSelectedSubscriber(subscriber);
    setFormOpen(true);
  };

  const handleAddSubscriber = () => {
    setSelectedSubscriber(null);
    setFormOpen(true);
  };

  const handleFormSuccess = () => {
    setFormOpen(false);
    setSelectedSubscriber(null);
    setRefreshTrigger(prev => prev + 1); // Trigger refresh
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TitleBar />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">
                {t('navigation.subscribers')}
              </h1>
              <p className="text-gray-600 mt-2">
                {t('subscribers.pageDescription')}
              </p>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {t('subscribers.total')}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      0
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 font-semibold">T</span>
                  </div>
                </div>
                <div className="mt-4 text-sm text-green-600">
                  {/* Growth indicator would go here */}
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {t('subscribers.active')}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      0
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-green-600 font-semibold">A</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {t('subscribers.newThisMonth')}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      0
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <span className="text-purple-600 font-semibold">N</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {t('subscribers.attendanceRate')}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      0%
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <span className="text-orange-600 font-semibold">%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t('subscribers.quickActions')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={handleAddSubscriber}
                  className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-center transition-colors"
                >
                  <div className="text-blue-600 font-semibold mb-2">
                    {t('subscribers.addSingle')}
                  </div>
                  <p className="text-sm text-gray-600">
                    {t('subscribers.addSingleDescription')}
                  </p>
                </button>

                <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 text-center transition-colors">
                  <div className="text-green-600 font-semibold mb-2">
                    {t('subscribers.importExcel')}
                  </div>
                  <p className="text-sm text-gray-600">
                    {t('subscribers.importExcelDescription')}
                  </p>
                </button>

                <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 text-center transition-colors">
                  <div className="text-purple-600 font-semibold mb-2">
                    {t('subscribers.bulkActions')}
                  </div>
                  <p className="text-sm text-gray-600">
                    {t('subscribers.bulkActionsDescription')}
                  </p>
                </button>
              </div>
            </div>

            {/* Main Subscriber List */}
            <div key={refreshTrigger}>
              <SubscriberList
                onSelectSubscriber={handleSelectSubscriber}
                onAddSubscriber={handleAddSubscriber}
              />
            </div>
          </div>
        </main>

        {/* Form Dialog */}
        <SubscriberForm
          subscriber={selectedSubscriber}
          open={formOpen}
          onOpenChange={setFormOpen}
          onSuccess={handleFormSuccess}
        />
      </div>
    </div>
  );
};

export default SubscribersPage;
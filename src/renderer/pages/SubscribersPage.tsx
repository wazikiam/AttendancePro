import React from 'react';
import { useTranslation } from 'react-i18next';
import SubscriberList from '../components/subscribers/SubscriberList';

const SubscribersPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">
          {t('navigation.subscribers') || 'Subscribers'}
        </h1>
        {/* Keep description only if you already have it translated; otherwise it will silently disappear */}
        <p className="text-gray-600 mt-1">
          {t('subscribers.pageDescription') || ''}
        </p>
      </div>

      {/* SubscriberList is the single owner of: search, pagination, add/edit modal, import/export */}
      <SubscriberList />
    </div>
  );
};

export default SubscribersPage;

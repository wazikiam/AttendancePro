import React from 'react';

interface QuickAction {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  action: () => void;
}

interface QuickActionsProps {
  actions: QuickAction[];
}

const QuickActions: React.FC<QuickActionsProps> = ({ actions }) => {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <h2 className="text-lg font-semibold text-neutral-900 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={action.action}
            className="p-4 rounded-lg border border-neutral-200 hover:border-neutral-300 hover:shadow-subtle transition-all text-left"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${action.color}`}>
              {action.icon}
            </div>
            <h3 className="font-medium text-neutral-900 mb-1">{action.title}</h3>
            <p className="text-xs text-neutral-500">{action.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
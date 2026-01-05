import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import {
  DashboardIcon,
  PersonIcon,
  CalendarIcon,
  BookmarkIcon,
  BarChartIcon,
  GearIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MoonIcon,
  SunIcon,
  GlobeIcon
} from '@radix-ui/react-icons';

const Sidebar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState('en');

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setLanguage(lng);
    document.documentElement.dir = i18n.dir(lng);
    document.documentElement.lang = lng;
  };

  const navigation = [
    { name: t('navigation.dashboard'), href: '/dashboard', icon: DashboardIcon },
    { name: t('navigation.subscribers'), href: '/subscribers', icon: PersonIcon },
    { name: t('navigation.attendance'), href: '/attendance', icon: CalendarIcon },
    { name: t('navigation.classes'), href: '/classes', icon: BookmarkIcon },
    { name: t('navigation.reports'), href: '/reports', icon: BarChartIcon },
    { name: t('navigation.settings'), href: '/settings', icon: GearIcon },
  ];

  return (
    <div className={`${collapsed ? 'w-20' : 'w-64'} flex flex-col h-screen bg-gray-900 text-white transition-all duration-300`}>
      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <span className="font-bold">AP</span>
              </div>
              <h1 className="text-xl font-bold">{t('app.name')}</h1>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mx-auto">
              <span className="font-bold">AP</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-400 hover:text-white"
          >
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }: { isActive: boolean }) => `
                flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
                ${isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }
                ${collapsed ? 'justify-center' : ''}
              `}
            >
              <Icon className="w-5 h-5" />
              {!collapsed && <span>{item.name}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Settings */}
      <div className="p-4 border-t border-gray-800">
        {/* Language Selector */}
        {!collapsed && (
          <div className="mb-4">
            <div className="flex items-center space-x-2 text-gray-300 mb-2">
              <GlobeIcon className="w-4 h-4" />
              <span className="text-sm">{t('settings.language')}</span>
            </div>
            <div className="flex space-x-2">
              {['en', 'ar', 'fr'].map((lng) => (
                <button
                  key={lng}
                  onClick={() => changeLanguage(lng)}
                  className={`px-3 py-1 rounded text-sm ${
                    language === lng
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {lng.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dark Mode Toggle */}
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && (
            <div className="flex items-center space-x-2 text-gray-300">
              {darkMode ? <MoonIcon className="w-4 h-4" /> : <SunIcon className="w-4 h-4" />}
              <span className="text-sm">
                {darkMode ? 'Dark Mode' : 'Light Mode'}
              </span>
            </div>
          )}
          <button
            onClick={toggleDarkMode}
            className={`p-2 rounded-lg ${
              darkMode
                ? 'bg-gray-800 text-yellow-400'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {darkMode ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* User Profile */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
              <span className="font-semibold">A</span>
            </div>
            <div className="flex-1">
              <p className="font-medium">Admin User</p>
              <p className="text-sm text-gray-400">System Administrator</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
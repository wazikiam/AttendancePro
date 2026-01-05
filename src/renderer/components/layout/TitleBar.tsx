import React, { useEffect, useMemo, useState } from 'react';
import {
  MinusIcon,
  SquareIcon,
  Cross2Icon,
  SunIcon,
  MoonIcon,
  BellIcon,
  QuestionMarkCircledIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@radix-ui/react-icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { windowControls } from '../../../shared/utils/electron-api';

const TitleBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isMaximized, setIsMaximized] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  const canGoBack = useMemo(() => {
    // In Electron SPA, history length is usually reliable enough.
    return window.history.length > 1;
  }, [location.key]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkMaximized = async () => {
      try {
        const maximized = await windowControls.isMaximized();
        setIsMaximized(maximized);
      } catch (error) {
        console.error('Could not check window maximized state:', error);
      }
    };

    checkMaximized();
    window.addEventListener('resize', checkMaximized);
    return () => window.removeEventListener('resize', checkMaximized);
  }, []);

  const handleMinimize = () => {
    try {
      windowControls.minimize();
    } catch (error) {
      console.error('Could not minimize window:', error);
    }
  };

  const handleMaximize = () => {
    try {
      windowControls.maximize();
      setIsMaximized(!isMaximized);
    } catch (error) {
      console.error('Could not maximize window:', error);
    }
  };

  const handleClose = () => {
    try {
      windowControls.close();
    } catch (error) {
      console.error('Could not close window:', error);
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const goBack = () => {
    if (canGoBack) navigate(-1);
    else navigate('/dashboard');
  };

  const goForward = () => {
    navigate(1);
  };

  return (
    <div className="flex justify-between items-center px-3 py-2 bg-gray-900 text-white border-b border-gray-800 drag-region">
      {/* Left side */}
      <div className="flex items-center space-x-2 no-drag">
        {/* Navigation */}
        <button
          onClick={goBack}
          className="p-2 rounded hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
          title={canGoBack ? 'Back' : 'Back to Dashboard'}
          disabled={!canGoBack && location.pathname === '/dashboard'}
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>

        <button
          onClick={goForward}
          className="p-2 rounded hover:bg-gray-800"
          title="Forward"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-700 mx-1" />

        {/* App info */}
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
          <span className="font-bold">AP</span>
        </div>
        <div className="leading-tight">
          <h1 className="font-semibold text-sm">Attendance Pro</h1>
          <p className="text-xs text-gray-400">{currentTime}</p>
        </div>
      </div>

      {/* Center */}
      <div className="flex-1 text-center drag-region">
        <span className="text-sm text-gray-400">Professional Attendance Management</span>
      </div>

      {/* Right side */}
      <div className="flex items-center space-x-2 no-drag">
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded hover:bg-gray-800"
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
        </button>

        <button className="p-2 rounded hover:bg-gray-800 relative" title="Notifications">
          <BellIcon className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        <button className="p-2 rounded hover:bg-gray-800" title="Help">
          <QuestionMarkCircledIcon className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-700 mx-2" />

        <button onClick={handleMinimize} className="p-2 rounded hover:bg-gray-800" title="Minimize">
          <MinusIcon className="w-4 h-4" />
        </button>

        <button
          onClick={handleMaximize}
          className="p-2 rounded hover:bg-gray-800"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          <SquareIcon className="w-3 h-3" />
        </button>

        <button onClick={handleClose} className="p-2 rounded hover:bg-red-600" title="Close">
          <Cross2Icon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;

import React from 'react';
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
} from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';

import Sidebar from './components/layout/Sidebar';
import TitleBar from './components/layout/TitleBar';

import Dashboard from './pages/Dashboard';
import SubscribersPage from './pages/SubscribersPage';
import SubscriberDetailsPage from './pages/SubscriberDetailsPage';
import Attendance from './pages/Attendance';
import Classes from './pages/Classes';
import ClassAttendance from './pages/ClassAttendance';
import ClassDetails from './pages/ClassDetails';
import Settings from './pages/Settings';

// ✅ PRINT PAGE (NO LAYOUT)
import AttendancePrintReport from './pages/AttendancePrintReport';

import './App.css';

/* =========================
   APP LAYOUT (WITH SIDEBAR)
   ========================= */
const AppLayout: React.FC = () => {
  return (
    <div className="h-screen w-screen flex bg-gray-100 overflow-hidden">
      {/* GLOBAL SIDEBAR */}
      <Sidebar />

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* GLOBAL TITLE BAR */}
        <TitleBar />

        {/* PAGE CONTENT */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

/* =========================
   ROOT APP
   ========================= */
const App: React.FC = () => {
  return (
    <I18nextProvider i18n={i18n}>
      <Router>
        <Routes>
          {/* ================= PRINT ROUTES (NO SIDEBAR / NO TITLEBAR) ================= */}
          <Route
            path="/print/attendance"
            element={<AttendancePrintReport />}
          />

          {/* ================= MAIN APPLICATION ================= */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            <Route path="/dashboard" element={<Dashboard />} />

            {/* Subscribers */}
            <Route path="/subscribers" element={<SubscribersPage />} />
            <Route path="/subscribers/:id" element={<SubscriberDetailsPage />} />

            {/* Attendance */}
            <Route path="/attendance" element={<Attendance />} />

            {/* Classes */}
            <Route path="/classes" element={<Classes />} />
            <Route path="/classes/:id" element={<ClassDetails />} />
            <Route
              path="/classes/:classId/attendance"
              element={<ClassAttendance />}
            />

            {/* Reports */}
            <Route
              path="/reports"
              element={
                <div className="max-w-7xl mx-auto">
                  Reports (coming soon)
                </div>
              }
            />

            {/* Settings */}
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </Router>
    </I18nextProvider>
  );
};

export default App;

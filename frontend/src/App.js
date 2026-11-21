import React, { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './hooks/useAppContext';
import { AuthProvider } from './hooks/useAuthContext';
import { useAuth } from './hooks/useAuthContext';
import { useApp } from './hooks/useAppContext';

import NavBar from './components/NavBar';
import SplashScreen from './components/SplashScreen';
import TutorialOverlay from './components/TutorialOverlay';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SurveyGatePage from './pages/SurveyGatePage';
import BudgetPage from './pages/BudgetPage';
import RiskCheckPage from './pages/RiskCheckPage';
import ComparePage from './pages/ComparePage';
import DashboardPage from './pages/DashboardPage';
import BrowsePage from './pages/BrowsePage';
import SettingsPage from './pages/SettingsPage';
import FriendsPage from './pages/FriendsPage';
import AwardsPage  from './pages/AwardsPage';

/**
 * ProtectedRoute – redirects unauthenticated users to /login.
 * Shows a spinner while auth status is being determined.
 */
function ProtectedRoute({ children }) {
  const { token, authReady } = useAuth();

  if (!authReady) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-4 border-[#c9920a] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

/**
 * PublicOnlyRoute – redirects already-logged-in users away from login/register.
 */
function PublicOnlyRoute({ children }) {
  const { token, authReady } = useAuth();

  if (!authReady) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-4 border-[#c9920a] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (token) {
    return <Navigate to="/survey-gate" replace />;
  }

  return children;
}

function AppRoutes() {
  const { tutorialOpen, closeTutorial } = useApp();
  return (
    <>
      {tutorialOpen && <TutorialOverlay onClose={closeTutorial} />}
      <NavBar />
      <main className="max-w-2xl mx-auto px-4 pb-20 pt-6">
        <Routes>
          {/* Public: redirect root to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Public auth pages */}
          <Route
            path="/login"
            element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>}
          />
          <Route
            path="/register"
            element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>}
          />

          {/* Protected: survey gate (first time only, then skips to /start) */}
          <Route
            path="/survey-gate"
            element={<ProtectedRoute><SurveyGatePage /></ProtectedRoute>}
          />

          {/* Protected: main app */}
          <Route
            path="/start"
            element={<ProtectedRoute><BudgetPage /></ProtectedRoute>}
          />
          <Route
            path="/risk-check"
            element={<ProtectedRoute><RiskCheckPage /></ProtectedRoute>}
          />
          <Route
            path="/compare"
            element={<ProtectedRoute><ComparePage /></ProtectedRoute>}
          />
          <Route
            path="/dashboard"
            element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}
          />
          <Route
            path="/settings"
            element={<ProtectedRoute><SettingsPage /></ProtectedRoute>}
          />
          <Route
            path="/browse"
            element={<ProtectedRoute><BrowsePage /></ProtectedRoute>}
          />
          <Route
            path="/friends"
            element={<ProtectedRoute><FriendsPage /></ProtectedRoute>}
          />
          <Route
            path="/awards"
            element={<ProtectedRoute><AwardsPage /></ProtectedRoute>}
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </main>
    </>
  );
}

function ThemedRoot({ children }) {
  const { theme } = useApp();
  return (
    <div className="min-h-screen bg-bg" data-theme={theme}>
      {children}
    </div>
  );
}

export default function App() {
  // Show splash every time the app is opened
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashDone = useCallback(() => {
    setShowSplash(false);
  }, []);

  return (
    <AuthProvider>
      <AppProvider>
        <ThemedRoot>
          {showSplash && <SplashScreen onDone={handleSplashDone} />}
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ThemedRoot>
      </AppProvider>
    </AuthProvider>
  );
}

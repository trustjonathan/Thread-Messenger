import { useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { onAuthChange, updateLastSeen } from '@/lib/apiClient';
import { getPendingInviteCode } from '@/lib/inviteStorage';
import type { CurrentUser } from '@/types/api';

// Pages
import LandingPage from './features/landing/LandingPage';
import SignInPage from './features/auth/SignInPage';
import ChooseUsernamePage from './features/auth/ChooseUsernamePage';
import NewGroupPage from './features/chat/NewGroupPage';
import ChatLayout from './components/layout/ChatLayout';
import SettingsPage from './features/settings/SettingsPage';
import AvatarPage from './features/settings/AvatarPage';
import PrivacyPage from './features/legal/PrivacyPage';
import TermsPage from './features/legal/TermsPage';
import InviteLandingPage from './features/invite/InviteLandingPage';

// Context
import { AvatarOverrideProvider } from '@/lib/avatarOverride';

// PWA Components
import InstallPrompt from './pwa/InstallPrompt';
import OfflineBanner from './pwa/OfflineBanner';
import UpdateBanner from './pwa/UpdateBanner';
import NotificationPrompt from './features/settings/NotificationPrompt';

interface ProtectedRouteProps {
  user: CurrentUser | null;
  loading: boolean;
  children: ReactNode;
}

/**
 * Root route guard:
 * - Signed out -> /signin
 * - Signed in with usernameSet === false -> /choose-username
 * - Signed in with usernameSet === true -> /chats
 */
function RootRoute({
  user,
  loading,
}: {
  user: CurrentUser | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  if (!user.usernameSet) {
    return <Navigate to="/choose-username" replace />;
  }

  const pendingInvite = getPendingInviteCode();
  if (pendingInvite) {
    return <Navigate to={`/invite/${encodeURIComponent(pendingInvite)}`} replace />;
  }

  return <Navigate to="/chats" replace />;
}

/**
 * Guards protected routes:
 * - Signed out -> /signin
 * - Signed in with usernameSet === false -> /choose-username
 */
function ProtectedRoute({ user, loading, children }: ProtectedRouteProps) {
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  if (!user.usernameSet) {
    return <Navigate to="/choose-username" replace />;
  }

  return <>{children}</>;
}

/**
 * Guards guest-only routes (/ and /signin):
 * - Signed in with usernameSet -> /chats
 * - Signed in without usernameSet -> /choose-username
 */
function GuestRoute({
  user,
  loading,
  children,
}: {
  user: CurrentUser | null;
  loading: boolean;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (user) {
    if (!user.usernameSet) {
      return <Navigate to="/choose-username" replace />;
    }
    const pendingInvite = getPendingInviteCode();
    if (pendingInvite) {
      return <Navigate to={`/invite/${encodeURIComponent(pendingInvite)}`} replace />;
    }
    return <Navigate to="/chats" replace />;
  }

  return <>{children}</>;
}

/**
 * Guards choose-username route:
 * - Signed out -> /signin
 * - Signed in with usernameSet === true -> /chats
 */
function ChooseUsernameRoute({
  user,
  loading,
  children,
}: {
  user: CurrentUser | null;
  loading: boolean;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  if (user.usernameSet) {
    return <Navigate to="/chats" replace />;
  }

  return <>{children}</>;
}

export function App() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Auth state listener — onAuthChange fires immediately with INITIAL_SESSION
  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthChange((newUser) => {
      if (mounted) {
        setUser(newUser);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Heartbeat: updateLastSeen on app open & every 5 minutes while visible
  const triggerUpdateLastSeen = useCallback(() => {
    if (user) {
      updateLastSeen().catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Call on initial mount / login
    triggerUpdateLastSeen();

    // 5 minutes interval while visible
    const INTERVAL_MS = 5 * 60 * 1000;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        triggerUpdateLastSeen();
      }
    }, INTERVAL_MS);

    // Call when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerUpdateLastSeen();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, triggerUpdateLastSeen]);

  return (
    <AvatarOverrideProvider>
      <BrowserRouter>
        <OfflineBanner />
        <UpdateBanner />
        <NotificationPrompt />
        <Routes>
        {/* Root Route: signed-out -> /signin; signed-in -> /chats or /choose-username */}
        <Route path="/" element={<RootRoute user={user} loading={loading} />} />

        {/* Invite link landing route */}
        <Route path="/invite/:code" element={<InviteLandingPage />} />

        {/* Public Landing Page */}
        <Route path="/landing" element={<LandingPage />} />

        {/* Sign In */}
        <Route
          path="/signin"
          element={
            <GuestRoute user={user} loading={loading}>
              <SignInPage />
            </GuestRoute>
          }
        />

        {/* Choose Username */}
        <Route
          path="/choose-username"
          element={
            <ChooseUsernameRoute user={user} loading={loading}>
              <ChooseUsernamePage />
            </ChooseUsernameRoute>
          }
        />

        {/* Specific chat sub-routes — must come BEFORE the wildcard :chatId? pattern
            so that /chats/new and /chats/new-group are matched as literal segments.
            React Router v7 scores static segments higher than dynamic ones, but
            ordering these first makes the intent explicit. */}

        {/* /chats/new – routed through ChatLayout so the sidebar stays visible
            on desktop. ChatLayout detects isNewChatRoute and renders NewChatContent
            in the right pane. On mobile it fills the whole screen. */}
        <Route
          path="/chats/new"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <ChatLayout />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chats/new-group"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <NewGroupPage />
            </ProtectedRoute>
          }
        />

        {/* Protected Chat Routes */}
        <Route
          path="/chats/:chatId?"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <ChatLayout />
            </ProtectedRoute>
          }
        />
        {/* AI pane route — desktop renders AiChat in the right pane inside ChatLayout */}
        <Route
          path="/ai"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <ChatLayout />
            </ProtectedRoute>
          }
        />

        {/* Settings */}
        <Route
          path="/settings/avatar"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <AvatarPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        {/* Public Legal Pages */}
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />

        {/* Catch-all fallback */}
        <Route
          path="*"
          element={
            <Navigate
              to={user ? (user.usernameSet ? '/chats' : '/choose-username') : '/signin'}
              replace
            />
          }
        />
      </Routes>
      <InstallPrompt />
    </BrowserRouter>
    </AvatarOverrideProvider>
  );
}

export default App;

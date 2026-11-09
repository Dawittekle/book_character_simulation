import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import './App.css';
import AppShell from './components/AppShell';
import AuthScreen from './components/AuthScreen';
import LandingPage from './pages/LandingPage';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import Discover from './pages/Discover';
import MyLibrary from './pages/MyLibrary';
import CharacterGallery from './pages/CharacterGallery';
import ChatScreen from './pages/ChatScreen';
import Conversations from './pages/Conversations';
import Settings from './pages/Settings';
import AdminRouteGuard from './pages/admin/AdminRouteGuard';
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import AdminOverview from './pages/admin/AdminOverview';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminCatalog from './pages/admin/AdminCatalog';
import AdminJobs from './pages/admin/AdminJobs';
import AdminUsers from './pages/admin/AdminUsers';
import AdminPlans from './pages/admin/AdminPlans';
import AdminSubscribers from './pages/admin/AdminSubscribers';
import AdminSettings from './pages/admin/AdminSettings';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { lorelyApi } from './services/lorelyApi';

function LegacyWorkspaceRedirect() {
  const { textId } = useParams();
  return <Navigate replace to={`/books/${textId}`} />;
}

function LegacyChatRedirect() {
  const { characterId } = useParams();
  return <Navigate replace to={`/chat/${characterId}`} />;
}

/**
 * Universal administrative routes definition.
 * Must remain accessible whether a Supabase reader session is active or not,
 * protected exclusively by AdminRouteGuard (lorely_admin_token).
 */
function renderAdminRoutes() {
  return (
    <>
      <Route path="admin/login" element={<AdminLogin />} />
      <Route element={<AdminRouteGuard />}>
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="catalog" element={<AdminCatalog />} />
          <Route path="jobs" element={<AdminJobs />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="plans" element={<AdminPlans />} />
          <Route path="subscribers" element={<AdminSubscribers />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Route>
    </>
  );
}

function MainApp({ session, userRole, loadingRole, handleSignOut, onPromoteToAdmin }) {
  return (
    <BrowserRouter>
      <Routes>
        {/* Dedicated Authoritative Admin Portal */}
        {renderAdminRoutes()}

        {/* Reader Application Layout */}
        <Route
          path="/"
          element={
            <AppShell
              session={session}
              onSignOut={handleSignOut}
            />
          }
        >
          <Route index element={<Discover />} />
          <Route path="discover" element={<Discover />} />
          <Route path="library" element={<MyLibrary />} />
          <Route path="books/:bookId" element={<CharacterGallery />} />
          <Route path="characters" element={<CharacterGallery />} />
          <Route path="chat/:characterId" element={<ChatScreen />} />
          <Route path="chat/:characterId/:sessionId" element={<ChatScreen />} />
          <Route path="conversations" element={<Conversations />} />
          <Route path="settings" element={<Settings />} />

          {/* Backward compatibility redirects */}
          <Route path="workspace/:textId" element={<LegacyWorkspaceRedirect />} />
          <Route path="chat/:textId/:characterId" element={<LegacyChatRedirect />} />
          <Route path="login" element={<Navigate replace to="/" />} />
          <Route path="signup" element={<Navigate replace to="/" />} />
        </Route>

        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [userRole, setUserRole] = useState('user');
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    if (supabase === null) {
      setAuthReady(true);
      return undefined;
    }

    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) {
          return;
        }

        if (error) {
          console.error('Failed to restore auth session:', error);
        }

        setSession(data.session ?? null);
        setAuthReady(true);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        console.error('Failed to initialize auth:', error);
        setAuthReady(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Fetch authoritative user role
  useEffect(() => {
    let isMounted = true;
    async function fetchRole() {
      if (!session?.access_token) {
        setUserRole('user');
        setLoadingRole(false);
        return;
      }

      try {
        setLoadingRole(true);
        const me = await lorelyApi.getMe(session.access_token);
        if (isMounted && me) {
          setUserRole(me.role || 'user');
        }
      } catch (err) {
        if (isMounted) setUserRole('user');
      } finally {
        if (isMounted) setLoadingRole(false);
      }
    }

    fetchRole();
    return () => {
      isMounted = false;
    };
  }, [session]);

  if (!authReady) {
    return (
      <div className="app-loading-screen">
        <div className="app-loading-card">
          <span className="app-loading-badge">Preparing Lorely</span>
          <h1>Entering the Stories</h1>
          <p>
            Restoring your reader session and preparing the literary salon.
          </p>
        </div>
      </div>
    );
  }

  if (!isSupabaseConfigured || supabase === null) {
    return <AuthScreen setupMode />;
  }

  // When no Supabase reader session is active, render public routes + the dedicated admin portal
  if (session === null) {
    return (
      <BrowserRouter>
        <Routes>
          {/* Dedicated Authoritative Admin Portal */}
          {renderAdminRoutes()}

          {/* Public Marketing & Reader Entry */}
          <Route
            path="/"
            element={
              <LandingPage
                onGetStarted={() => {
                  window.location.href = '/signup';
                }}
                onSignIn={() => {
                  window.location.href = '/login';
                }}
              />
            }
          />
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
      </BrowserRouter>
    );
  }

  const handlePromoteToAdmin = async () => {
    try {
      await lorelyApi.switchRole('admin', session?.access_token);
      setUserRole('admin');
    } catch (error) {
      console.error('Failed to switch role:', error);
      setUserRole('admin');
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  return (
    <MainApp
      session={session}
      userRole={userRole}
      loadingRole={loadingRole}
      handleSignOut={handleSignOut}
      onPromoteToAdmin={handlePromoteToAdmin}
    />
  );
}

export default App;

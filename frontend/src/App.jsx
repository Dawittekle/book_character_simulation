import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import './App.css';
import AppShell from './components/AppShell';
import AuthScreen from './components/AuthScreen';
import Discover from './pages/Discover';
import MyLibrary from './pages/MyLibrary';
import CharacterGallery from './pages/CharacterGallery';
import ChatScreen from './pages/ChatScreen';
import Conversations from './pages/Conversations';
import Settings from './pages/Settings';
import AdminRouteGuard from './pages/admin/AdminRouteGuard';
import AdminLayout from './pages/admin/AdminLayout';
import AdminOverview from './pages/admin/AdminOverview';
import AdminCatalog from './pages/admin/AdminCatalog';
import AdminJobs from './pages/admin/AdminJobs';
import AdminUsers from './pages/admin/AdminUsers';
import AdminPlans from './pages/admin/AdminPlans';
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

function MainApp({ session, userRole, loadingRole, handleSignOut, onPromoteToAdmin }) {
  const accessToken = session?.access_token;

  return (
    <BrowserRouter>
      <Routes>
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
        </Route>

        {/* Dedicated Authoritative Admin Portal */}
        <Route element={<AdminRouteGuard userRole={userRole} loading={loadingRole} onPromoteToAdmin={onPromoteToAdmin} />}>
          <Route path="admin" element={<AdminLayout accessToken={accessToken} />}>
            <Route index element={<AdminOverview />} />
            <Route path="catalog" element={<AdminCatalog />} />
            <Route path="jobs" element={<AdminJobs />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="plans" element={<AdminPlans />} />
          </Route>
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

  if (session === null) {
    return <AuthScreen />;
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

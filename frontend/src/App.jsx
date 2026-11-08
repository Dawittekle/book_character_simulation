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
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { RoleProvider } from './lib/RoleProvider';

function LegacyWorkspaceRedirect() {
  const { textId } = useParams();
  return <Navigate replace to={`/books/${textId}`} />;
}

function LegacyChatRedirect() {
  const { characterId } = useParams();
  return <Navigate replace to={`/chat/${characterId}`} />;
}

function MainApp({ session, handleSignOut }) {
  return (
    <BrowserRouter>
      <Routes>
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

          <Route path="*" element={<Navigate replace to="/" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);

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

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  return (
    <RoleProvider>
      <MainApp session={session} handleSignOut={handleSignOut} />
    </RoleProvider>
  );
}

export default App;

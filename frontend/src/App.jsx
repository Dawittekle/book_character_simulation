import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import AppShell from './components/AppShell';
import AuthScreen from './components/AuthScreen';
import CharacterSelection from './components/CharacterSelection';
import ChatInterface from './components/ChatInterface';
import TextUpload from './components/TextUpload';
import { getWorkspaceState } from './lib/workspaceStore';
import { isSupabaseConfigured, supabase } from './lib/supabase';

function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [workspaceVersion, setWorkspaceVersion] = useState(0);

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
          <span className="app-loading-badge">Preparing workspace</span>
          <h1>Loading your reading studio</h1>
          <p>
            Restoring your session, reconnecting the library, and getting the
            dashboard ready.
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

  const ownerKey = session.user.id;
  const workspace = getWorkspaceState(ownerKey);

  const handleWorkspaceChanged = () => {
    setWorkspaceVersion((currentValue) => currentValue + 1);
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setWorkspaceSearch('');
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <AppShell
              session={session}
              workspace={workspace}
              workspaceSearch={workspaceSearch}
              onSearchChange={setWorkspaceSearch}
              onSignOut={handleSignOut}
              onWorkspaceChanged={handleWorkspaceChanged}
            />
          }
        >
          <Route
            index
            element={
              <TextUpload
                ownerKey={ownerKey}
                session={session}
                workspace={workspace}
                searchQuery={workspaceSearch}
                onWorkspaceChanged={handleWorkspaceChanged}
              />
            }
          />
          <Route
            path="workspace/:textId"
            element={
              <CharacterSelection
                ownerKey={ownerKey}
                workspaceVersion={workspaceVersion}
                onWorkspaceChanged={handleWorkspaceChanged}
              />
            }
          />
          <Route
            path="chat/:textId/:characterId"
            element={
              <ChatInterface
                ownerKey={ownerKey}
                session={session}
                workspaceVersion={workspaceVersion}
                onWorkspaceChanged={handleWorkspaceChanged}
              />
            }
          />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

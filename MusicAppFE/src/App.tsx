import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AudioProvider } from './context/AudioContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { NowPlaying } from './pages/NowPlaying';
import { PlaylistPage } from './pages/PlaylistPage';
import { StudioPage } from './pages/StudioPage';
import { SearchPage } from './pages/SearchPage';
import { RegisterPage } from './pages/RegisterPage';
import { LibraryPage } from './pages/LibraryPage';
import { TracksPage } from './pages/TracksPage';
import { NotFoundPage } from './pages/NotFoundPage';

import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AlbumsPage } from './pages/AlbumsPage';
import { ArtistsPage } from './pages/ArtistsPage';
import { GenresPage } from './pages/GenresPage';
import { QueuePage } from './pages/QueuePage';
import { OAuthCallback } from './pages/OAuthCallback';
import { UploadProvider } from './context/UploadContext';
import { LibraryProvider } from './context/LibraryContext';
import { Navigate } from 'react-router-dom';
import { ConfirmProvider } from './context/ConfirmContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/oauth2/callback" element={<OAuthCallback />} />

        <Route path="/" element={<Layout />}>
          <Route index element={<NowPlaying />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route path="playlist" element={
            <ProtectedRoute><PlaylistPage /></ProtectedRoute>
          } />
          <Route path="studio" element={<StudioPage />} />
          <Route path="library" element={
            <ProtectedRoute><LibraryPage /></ProtectedRoute>
          } />
          <Route path="tracks" element={
            <ProtectedRoute><TracksPage /></ProtectedRoute>
          } />
          <Route path="albums" element={<AlbumsPage />} />
          <Route path="artists" element={<ArtistsPage />} />
          <Route path="genres" element={<GenresPage />} />
          <Route path="queue" element={<QueuePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function AppProviders() {
  const { isAuthenticated } = useAuth();
  const audioScope = isAuthenticated ? 'authenticated' : 'guest';

  return (
    <AudioProvider key={audioScope}>
      <LibraryProvider>
        <UploadProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </UploadProvider>
      </LibraryProvider>
    </AudioProvider>
  );
}

export default function AppWrapper() {
  return (
    <AuthProvider>
      <AppProviders />
    </AuthProvider>
  );
}

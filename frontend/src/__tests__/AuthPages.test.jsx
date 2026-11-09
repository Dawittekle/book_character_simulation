import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Login from '../pages/auth/Login';
import Signup from '../pages/auth/Signup';
import AdminLogin from '../pages/admin/AdminLogin';
import { supabase } from '../lib/supabase';
import { lorelyApi } from '../services/lorelyApi';

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
  },
}));

vi.mock('../services/lorelyApi', () => ({
  lorelyApi: {
    adminLogin: vi.fn(),
  },
}));

describe('Phase 3: Independent Authentication Pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Login Page', () => {
    it('renders split-screen layout with email, password, Google OAuth, and back button without Microsoft or admin portal leaks', () => {
      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>,
      );

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Welcome to Lorely/i);
      expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /continue with microsoft/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();

      // Ensure secret admin portal link is NOT present on reader login
      expect(screen.queryByText(/staff portal/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/curator or administrator/i)).not.toBeInTheDocument();

      // Right side book and sky atmosphere (artistic open folio and clouds)
      expect(screen.getByTestId('auth-book-graphic')).toBeInTheDocument();
      expect(screen.getByText(/Step into the stories/i)).toBeInTheDocument();

      // Ensure artificial metric cards are removed
      expect(screen.queryByText('Rodion Raskolnikov')).not.toBeInTheDocument();
      expect(screen.queryByText('Elizabeth Bennet')).not.toBeInTheDocument();
      expect(screen.queryByText('Improvement rate')).not.toBeInTheDocument();
    });

    it('toggles password visibility when the eye button is clicked', () => {
      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>,
      );

      const passwordInput = screen.getByLabelText(/^password$/i);
      expect(passwordInput).toHaveAttribute('type', 'password');

      const toggleBtn = screen.getByRole('button', { name: /show password/i });
      fireEvent.click(toggleBtn);
      expect(passwordInput).toHaveAttribute('type', 'text');

      const hideBtn = screen.getByRole('button', { name: /hide password/i });
      fireEvent.click(hideBtn);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('submits login form and calls supabase signInWithPassword', async () => {
      supabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: { session: { access_token: 'fake-token' } },
        error: null,
      });

      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>,
      );

      fireEvent.change(screen.getByLabelText(/Email address/i), {
        target: { value: 'reader@lorely.ai' },
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'secretPass123' },
      });

      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() => {
        expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'reader@lorely.ai',
          password: 'secretPass123',
        });
      });
    });

    it('displays error banner when signInWithPassword fails', async () => {
      supabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: null,
        error: new Error('Invalid email or password.'),
      });

      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>,
      );

      fireEvent.change(screen.getByLabelText(/Email address/i), {
        target: { value: 'wrong@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'badpass' },
      });

      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Invalid email or password/i);
      });
    });

    it('triggers OAuth flow on Google button click', async () => {
      supabase.auth.signInWithOAuth.mockResolvedValueOnce({
        data: { provider: 'google', url: 'https://accounts.google.com' },
        error: null,
      });

      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>,
      );

      fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

      await waitFor(() => {
        expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
          },
        });
      });
    });
  });

  describe('Signup Page', () => {
    it('renders display name field and handles registration without Microsoft OAuth', async () => {
      supabase.auth.signUp.mockResolvedValueOnce({
        data: { session: null, user: { id: 'new-user-123' } },
        error: null,
      });

      render(
        <BrowserRouter>
          <Signup />
        </BrowserRouter>,
      );

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Create Lorely account/i);
      expect(screen.getByLabelText(/Display name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /continue with microsoft/i })).not.toBeInTheDocument();

      // Test password visibility toggle on signup
      const passwordInput = screen.getByLabelText(/^password$/i);
      expect(passwordInput).toHaveAttribute('type', 'password');
      const toggleBtn = screen.getByRole('button', { name: /show password/i });
      fireEvent.click(toggleBtn);
      expect(passwordInput).toHaveAttribute('type', 'text');

      fireEvent.change(screen.getByLabelText(/Display name/i), {
        target: { value: 'Dawit Teklebrhan' },
      });
      fireEvent.change(screen.getByLabelText(/Email address/i), {
        target: { value: 'dawit@lorely.ai' },
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'NewSecurePass2026!' },
      });

      fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

      await waitFor(() => {
        expect(supabase.auth.signUp).toHaveBeenCalledWith({
          email: 'dawit@lorely.ai',
          password: 'NewSecurePass2026!',
          options: {
            data: {
              full_name: 'Dawit Teklebrhan',
            },
          },
        });
        expect(screen.getByRole('status')).toHaveTextContent(/Account created/i);
      });
    });
  });

  describe('AdminLogin Page (Split-Screen Production Redesign)', () => {
    it('renders administrative title, restricted tag, inputs, and password toggle', () => {
      render(
        <BrowserRouter>
          <AdminLogin />
        </BrowserRouter>,
      );

      expect(screen.getByTestId('admin-login-page')).toBeInTheDocument();
      expect(screen.getByText('Restricted Access')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Administrative Console/i);
      expect(screen.getByLabelText(/Administrator Email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Security Password/i)).toBeInTheDocument();
      expect(screen.getByTestId('admin-login-btn')).toBeInTheDocument();

      // Quick fill button removed for production
      expect(screen.queryByRole('button', { name: /quick fill/i })).not.toBeInTheDocument();

      // Password toggle works
      const passwordInput = screen.getByLabelText(/Security Password/i);
      expect(passwordInput).toHaveAttribute('type', 'password');
      const toggleBtn = screen.getByRole('button', { name: /show password/i });
      fireEvent.click(toggleBtn);
      expect(passwordInput).toHaveAttribute('type', 'text');
    });

    it('authenticates admin successfully via lorelyApi with entered credentials', async () => {
      lorelyApi.adminLogin.mockResolvedValueOnce({
        token: 'admin-jwt-token',
        user: { role: 'admin' },
      });

      render(
        <BrowserRouter>
          <AdminLogin />
        </BrowserRouter>,
      );

      fireEvent.change(screen.getByLabelText(/Administrator Email/i), {
        target: { value: 'admin@lorely.app' },
      });
      fireEvent.change(screen.getByLabelText(/Security Password/i), {
        target: { value: 'LorelyAdmin2026!Secure' },
      });
      fireEvent.click(screen.getByTestId('admin-login-btn'));

      await waitFor(() => {
        expect(lorelyApi.adminLogin).toHaveBeenCalledWith({
          email: 'admin@lorely.app',
          password: 'LorelyAdmin2026!Secure',
        });
      });
    });
  });
});

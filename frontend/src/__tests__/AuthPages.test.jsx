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
    it('renders split-screen layout with email, password, OAuth options, and back button', () => {
      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>,
      );

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Welcome to Lorely/i);
      expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue with microsoft/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();

      // Right side metrics panel
      expect(screen.getByText('Improvement rate')).toBeInTheDocument();
      expect(screen.getAllByText('126.6%').length).toBeGreaterThan(0);
      expect(screen.getByText('A Unified Hub for Smarter Literary Cognition')).toBeInTheDocument();
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
      fireEvent.change(screen.getByLabelText(/Password/i), {
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
      fireEvent.change(screen.getByLabelText(/Password/i), {
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
    it('renders display name field and handles registration', async () => {
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

      fireEvent.change(screen.getByLabelText(/Display name/i), {
        target: { value: 'Dawit Teklebrhan' },
      });
      fireEvent.change(screen.getByLabelText(/Email address/i), {
        target: { value: 'dawit@lorely.ai' },
      });
      fireEvent.change(screen.getByLabelText(/Password/i), {
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

  describe('AdminLogin Page (Editorial Redesign)', () => {
    it('renders flower logo, administrative title, and inputs', () => {
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
    });

    it('populates fields when Quick Fill button is clicked', () => {
      render(
        <BrowserRouter>
          <AdminLogin />
        </BrowserRouter>,
      );

      const quickFillBtn = screen.getByRole('button', { name: /quick fill/i });
      fireEvent.click(quickFillBtn);

      expect(screen.getByLabelText(/Administrator Email/i)).toHaveValue('admin@lorely.app');
      expect(screen.getByLabelText(/Security Password/i)).toHaveValue('LorelyAdmin2026!Secure');
    });

    it('authenticates admin successfully via lorelyApi', async () => {
      lorelyApi.adminLogin.mockResolvedValueOnce({
        token: 'admin-jwt-token',
        user: { role: 'admin' },
      });

      render(
        <BrowserRouter>
          <AdminLogin />
        </BrowserRouter>,
      );

      fireEvent.click(screen.getByRole('button', { name: /quick fill/i }));
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

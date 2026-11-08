import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AuthScreen from '../components/AuthScreen';

describe('AuthScreen component', () => {
  it('renders sign in view by default', () => {
    render(<AuthScreen />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Character Studio keeps every book, character, and conversation together/i,
    );
    expect(screen.getByPlaceholderText(/teklebrahandawit309@gmail.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/\.{10}/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open the studio/i })).toBeInTheDocument();
  });

  it('switches between Sign in and Create account tabs', () => {
    render(<AuthScreen />);

    const createAccountTab = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(createAccountTab);

    // Display name field appears in sign up mode
    expect(screen.getByPlaceholderText(/Dawit Teklebrhan/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create your workspace/i })).toBeInTheDocument();

    const signInTab = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(signInTab);

    // Display name field is hidden in sign in mode
    expect(screen.queryByPlaceholderText(/Dawit Teklebrhan/i)).not.toBeInTheDocument();
  });

  it('renders setup banner when setupMode is true', () => {
    render(<AuthScreen setupMode={true} />);

    expect(
      screen.getByText(/Finish the client configuration first/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The frontend needs your Supabase project URL/i),
    ).toBeInTheDocument();
  });
});

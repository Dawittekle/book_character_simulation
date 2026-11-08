import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MyLibrary from '../pages/MyLibrary';
import CharacterGallery from '../pages/CharacterGallery';
import Settings from '../pages/Settings';
import Conversations from '../pages/Conversations';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useOutletContext: () => ({
      accessToken: 'test-token',
      openAddBookModal: vi.fn(),
      currentUser: { email: 'user@example.com', role: 'reader' },
    }),
  };
});

describe('Page Navigation and Back Buttons', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders a back button in MyLibrary and triggers navigation', () => {
    render(
      <MemoryRouter>
        <MyLibrary />
      </MemoryRouter>
    );

    const backBtn = screen.getByRole('button', { name: /go back/i });
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('renders a back button in CharacterGallery and triggers navigation', () => {
    render(
      <MemoryRouter>
        <CharacterGallery />
      </MemoryRouter>
    );

    const backBtn = screen.getByRole('button', { name: /go back/i });
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('renders a back button in Settings and triggers navigation', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    );

    const backBtn = screen.getByRole('button', { name: /go back/i });
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('renders a back button in Conversations and triggers navigation', () => {
    render(
      <MemoryRouter>
        <Conversations />
      </MemoryRouter>
    );

    const backBtn = screen.getByRole('button', { name: /go back/i });
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});

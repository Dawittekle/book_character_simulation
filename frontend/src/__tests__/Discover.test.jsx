import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import Discover from '../pages/Discover';

const mockOpenAddBookModal = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({
      accessToken: 'test-token',
      openAddBookModal: mockOpenAddBookModal,
    }),
  };
});

describe('Discover Page', () => {
  it('renders hero timeless classics banner and literary books', () => {
    render(
      <BrowserRouter>
        <Discover />
      </BrowserRouter>,
    );

    expect(screen.getByText('Timeless Classics')).toBeInTheDocument();
    expect(screen.getByText('White Nights')).toBeInTheDocument();
    expect(screen.getByText('The Dream of a Ridiculous Man')).toBeInTheDocument();
    expect(screen.getByText('An Honest Thief')).toBeInTheDocument();
  });

  it('triggers add book modal when "+ Add a Book" card is clicked', () => {
    render(
      <BrowserRouter>
        <Discover />
      </BrowserRouter>,
    );

    const addCard = screen.getByText('Add a Book');
    fireEvent.click(addCard);
    expect(mockOpenAddBookModal).toHaveBeenCalled();
  });

  it('displays bottom literary features strip', () => {
    render(
      <BrowserRouter>
        <Discover />
      </BrowserRouter>,
    );

    expect(screen.getByText('Bring Any Book')).toBeInTheDocument();
    expect(screen.getByText('Discover Characters')).toBeInTheDocument();
    expect(screen.getByText('Talk Naturally')).toBeInTheDocument();
    expect(screen.getByText('Watch Them Evolve')).toBeInTheDocument();
  });
});

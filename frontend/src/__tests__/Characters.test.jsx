import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharacterGallery from '../pages/CharacterGallery';
import CharacterDetailsDrawer from '../components/CharacterDetailsDrawer';
import EmotionStateWidget from '../components/EmotionStateWidget';
import { lorelyApi } from '../services/lorelyApi';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ bookId: 'book-dostoevsky-white-nights' }),
    useOutletContext: () => ({
      accessToken: 'test-token',
    }),
  };
});

vi.mock('../services/lorelyApi', () => ({
  lorelyApi: {
    getBookDetails: vi.fn().mockResolvedValue({
      id: 'book-dostoevsky-white-nights',
      title: 'White Nights',
      characters: [
        {
          id: 'char-the-dreamer',
          name: 'The Dreamer',
          role: 'Protagonist',
          book_title: 'White Nights',
          personality: 'A romantic dreamer wandering the canals of St. Petersburg.',
          avatar_asset_id: 'portrait-the-dreamer',
        },
        {
          id: 'char-nastenka',
          name: 'Nastenka',
          role: 'Heroine',
          book_title: 'White Nights',
          personality: 'A vibrant, tender young woman awaiting her beloved on the bridge.',
          avatar_asset_id: 'portrait-nastenka',
        },
      ],
    }),
    listCharacters: vi.fn().mockResolvedValue([]),
  },
}));

describe('Character Gallery & Dossier System (Phase 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CharacterGallery Page', () => {
    it('renders header, title, and back button', async () => {
      render(
        <BrowserRouter>
          <CharacterGallery />
        </BrowserRouter>
      );

      expect(screen.getByText('Meet the Characters')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Go back/i })).toBeInTheDocument();
    });

    it('renders loaded character portrait cards and triggers navigation', async () => {
      render(
        <BrowserRouter>
          <CharacterGallery />
        </BrowserRouter>
      );

      const dreamerName = await screen.findByText('The Dreamer');
      expect(dreamerName).toBeInTheDocument();
      expect(screen.getByText('Nastenka')).toBeInTheDocument();
      expect(screen.getByText('Protagonist')).toBeInTheDocument();

      const chatBtn = screen.getByText(/Talk to The/i);
      fireEvent.click(chatBtn);
      expect(mockNavigate).toHaveBeenCalledWith('/chat/char-the-dreamer');
    });

    it('navigates back when back button is clicked', () => {
      render(
        <BrowserRouter>
          <CharacterGallery />
        </BrowserRouter>
      );

      const backBtn = screen.getByRole('button', { name: /Go back/i });
      fireEvent.click(backBtn);
      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  describe('CharacterDetailsDrawer Component', () => {
    const sampleChar = {
      id: 'char-the-dreamer',
      name: 'The Dreamer',
      role: 'Protagonist',
      occupation: 'Civil Clerk & Dreamer',
      affiliation: 'St. Petersburg Nights',
      personality: 'A deeply sensitive narrator lost in dreams and longing.',
      relationships: [
        { name: 'Nastenka', role: 'Beloved confidante' },
      ],
      key_events: [
        'Meets Nastenka weeping by the canal railing.',
        'Spends four luminous nights listening to her story.',
      ],
      emotion_state: {
        hope: 0.85,
        sadness: 0.42,
        curiosity: 0.78,
      },
    };

    it('returns null if character is not provided', () => {
      const { container } = render(
        <CharacterDetailsDrawer character={null} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders character identity, attributes, relationships, and story facts', () => {
      render(
        <BrowserRouter>
          <CharacterDetailsDrawer
            character={sampleChar}
            bookTitle="White Nights"
            onClose={vi.fn()}
          />
        </BrowserRouter>
      );

      expect(screen.getByText('The Dreamer')).toBeInTheDocument();
      expect(screen.getByText('Civil Clerk & Dreamer')).toBeInTheDocument();
      expect(screen.getByText('St. Petersburg Nights')).toBeInTheDocument();
      expect(screen.getByText('Nastenka')).toBeInTheDocument();
      expect(screen.getByText('(Beloved confidante)')).toBeInTheDocument();
      expect(screen.getByText(/Meets Nastenka weeping/i)).toBeInTheDocument();
      expect(screen.getByTestId('emotion-state-widget')).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
      const handleClose = vi.fn();
      render(
        <BrowserRouter>
          <CharacterDetailsDrawer
            character={sampleChar}
            bookTitle="White Nights"
            onClose={handleClose}
          />
        </BrowserRouter>
      );

      const closeBtn = screen.getByRole('button', { name: /Close character details/i });
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalled();
    });

    it('navigates to character chat when action button is clicked', () => {
      render(
        <BrowserRouter>
          <CharacterDetailsDrawer
            character={sampleChar}
            bookTitle="White Nights"
            onClose={vi.fn()}
          />
        </BrowserRouter>
      );

      const chatBtn = screen.getByRole('button', { name: /Talk to The/i });
      fireEvent.click(chatBtn);
      expect(mockNavigate).toHaveBeenCalledWith('/chat/char-the-dreamer');
    });
  });

  describe('EmotionStateWidget Component', () => {
    it('renders Emotion State heading, telemetry score, and emotion breakdown', () => {
      const sampleEmotions = {
        hope: 0.88,
        joy: 0.72,
        curiosity: 0.65,
      };

      render(<EmotionStateWidget emotionState={sampleEmotions} />);

      expect(screen.getByText('Emotion State')).toBeInTheDocument();
      expect(screen.getByText('Dynamic Drift')).toBeInTheDocument();
      expect(screen.getAllByText('88%').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Hope')).toBeInTheDocument();
      expect(screen.getByText('Joy')).toBeInTheDocument();
      expect(screen.getByText('Curiosity')).toBeInTheDocument();
    });

    it('triggers onViewDetails when details link is clicked', () => {
      const handleViewDetails = vi.fn();
      render(
        <EmotionStateWidget
          emotionState={{ hope: 0.75 }}
          onViewDetails={handleViewDetails}
        />
      );

      const detailsBtn = screen.getByText('View details →');
      fireEvent.click(detailsBtn);
      expect(handleViewDetails).toHaveBeenCalled();
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  formatMetricLabel,
  getEmotionColor,
  getInitials,
  truncateText,
  deriveWorkspaceTitle,
  formatSourceType,
  countSavedConversations,
} from '../lib/formatters';

describe('formatters', () => {
  describe('formatMetricLabel', () => {
    it('converts snake_case to capitalized Title Case', () => {
      expect(formatMetricLabel('emotional_stability')).toBe('Emotional Stability');
      expect(formatMetricLabel('anger')).toBe('Anger');
      expect(formatMetricLabel('deep_story_lore')).toBe('Deep Story Lore');
    });
  });

  describe('getEmotionColor', () => {
    it('returns predefined palette color for known emotions', () => {
      expect(getEmotionColor('anger')).toBe('#d96c55');
      expect(getEmotionColor('sadness')).toBe('#6f7fcf');
      expect(getEmotionColor('joy')).toBe('#74a66c');
      expect(getEmotionColor('pride')).toBe('#d3a34d');
      expect(getEmotionColor('bliss')).toBe('#59a7a7');
    });

    it('returns default fallback color for unknown emotion', () => {
      expect(getEmotionColor('fear')).toBe('#9b8f82');
      expect(getEmotionColor('')).toBe('#9b8f82');
    });
  });

  describe('getInitials', () => {
    it('extracts up to 2 uppercase initials', () => {
      expect(getInitials('Elena Marlowe')).toBe('EM');
      expect(getInitials('Victor Kane Junior')).toBe('VK');
      expect(getInitials('Dante')).toBe('D');
    });

    it('handles extra whitespace gracefully', () => {
      expect(getInitials('  Sherlock   Holmes  ')).toBe('SH');
    });
  });

  describe('truncateText', () => {
    it('returns original string when length is within max', () => {
      expect(truncateText('Hello World', 20)).toBe('Hello World');
    });

    it('truncates and appends ellipsis when exceeding maxLength', () => {
      const text = 'The quick brown fox jumps over the lazy dog';
      const truncated = truncateText(text, 15);
      expect(truncated).toBe('The quick brown...');
      expect(truncated.endsWith('...')).toBe(true);
    });

    it('returns empty string for falsy input', () => {
      expect(truncateText('')).toBe('');
      expect(truncateText(null)).toBe('');
      expect(truncateText(undefined)).toBe('');
    });
  });

  describe('deriveWorkspaceTitle', () => {
    it('uses explicit title if provided', () => {
      expect(
        deriveWorkspaceTitle({ title: ' The Midnight Letters ', fileName: 'other.pdf' }),
      ).toBe('The Midnight Letters');
    });

    it('derives from fileName if title is missing', () => {
      expect(
        deriveWorkspaceTitle({ fileName: 'the_great_gatsby.pdf' }),
      ).toBe('the great gatsby');
      expect(
        deriveWorkspaceTitle({ fileName: 'pride-and-prejudice.pdf' }),
      ).toBe('pride and prejudice');
    });

    it('derives from text first meaningful line if no title or filename', () => {
      const text = '\n  \nChapter One: The Arrival\nMore story follows here...';
      expect(deriveWorkspaceTitle({ text })).toBe('Chapter One: The Arrival');
    });

    it('falls back to "Untitled Book" when no inputs are present', () => {
      expect(deriveWorkspaceTitle({})).toBe('Untitled Book');
      expect(deriveWorkspaceTitle({ title: '', fileName: '', text: '' })).toBe('Untitled Book');
    });
  });

  describe('formatSourceType', () => {
    it('returns human-readable label for source type', () => {
      expect(formatSourceType('pdf')).toBe('PDF upload');
      expect(formatSourceType('text')).toBe('Pasted text');
      expect(formatSourceType('anything_else')).toBe('Pasted text');
    });
  });

  describe('countSavedConversations', () => {
    it('counts number of saved character sessions', () => {
      expect(countSavedConversations({})).toBe(0);
      expect(
        countSavedConversations({
          characterSessions: {
            c1: [{ message: 'hi' }],
            c2: [{ message: 'hello' }],
          },
        }),
      ).toBe(2);
    });
  });
});

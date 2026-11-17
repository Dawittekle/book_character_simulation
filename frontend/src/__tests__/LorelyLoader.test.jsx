import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LorelyLoader from '../components/ui/LorelyLoader';

describe('LorelyLoader Component (V2 Brand Animated Loader)', () => {
  it('renders default loader with obsidian badge, left book spine, and right dialogue spine', () => {
    const { container } = render(<LorelyLoader />);

    const root = screen.getByRole('status');
    expect(root).toBeInTheDocument();
    expect(root).toHaveAttribute('aria-label', 'Loading');

    const svg = screen.getByTestId('lorely-loader-svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '56');
    expect(svg).toHaveAttribute('height', '56');
    expect(svg).toHaveAttribute('viewBox', '0 0 64 64');

    // Obsidian background badge
    const badge = screen.getByTestId('lorely-loader-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('fill', '#18181B');
    expect(badge).toHaveAttribute('rx', '16');

    // Left book spine
    const leftSpine = screen.getByTestId('lorely-spine-left');
    expect(leftSpine).toBeInTheDocument();
    expect(leftSpine).toHaveAttribute('fill', '#FAFAFA');
    expect(leftSpine).toHaveAttribute('width', '11');
    expect(leftSpine).toHaveAttribute('height', '40');
    expect(leftSpine).toHaveAttribute('rx', '5.5');

    // Right dialogue spine
    const rightSpine = screen.getByTestId('lorely-spine-right');
    expect(rightSpine).toBeInTheDocument();
    expect(rightSpine).toHaveAttribute('fill', '#2589FF');
  });

  it('omits background badge when transparent prop is true', () => {
    render(<LorelyLoader transparent />);

    expect(screen.queryByTestId('lorely-loader-badge')).toBeNull();
    expect(screen.getByTestId('lorely-spine-left')).toBeInTheDocument();
    expect(screen.getByTestId('lorely-spine-right')).toBeInTheDocument();
  });

  it('renders in a fullScreen frosted overlay when fullScreen is true', () => {
    render(<LorelyLoader fullScreen text="Entering the literary salon..." />);

    const fullscreenOverlay = screen.getByTestId('lorely-loader-fullscreen');
    expect(fullscreenOverlay).toBeInTheDocument();
    expect(screen.getByText('Entering the literary salon...')).toBeInTheDocument();
  });

  it('scales dimensions proportionally based on size prop', () => {
    render(<LorelyLoader size={96} />);

    const svg = screen.getByTestId('lorely-loader-svg');
    expect(svg).toHaveAttribute('width', '96');
    expect(svg).toHaveAttribute('height', '96');
  });

  it('displays status text with proper accessibility aria-label', () => {
    render(<LorelyLoader text="Restoring cognitive cast..." />);

    expect(screen.getByText('Restoring cognitive cast...')).toBeInTheDocument();
    const root = screen.getByRole('status');
    expect(root).toHaveAttribute('aria-label', 'Restoring cognitive cast...');
  });
});

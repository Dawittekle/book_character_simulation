import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  BrandLogo,
  PillButton,
  BadgePill,
  RadialGauge,
  StatSparkline,
} from '../components/brand';

describe('Brand Primitives Component Suite', () => {
  describe('BrandLogo', () => {
    it('renders the Literary Rosette SVG mark with 8 orbital nodes and open book folios', () => {
      const { container } = render(<BrandLogo size={32} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('viewBox', '0 0 32 32');
      // 8 orbital circles + 1 center nexus spark = 9 circles
      const circles = container.querySelectorAll('circle');
      expect(circles).toHaveLength(9);
      // Dual open book folio pages
      const paths = container.querySelectorAll('path');
      expect(paths).toHaveLength(2);
    });

    it('renders with brand name and tagline when enabled', () => {
      render(
        <BrandLogo
          withText
          text="Lorely Studio"
          tagline="Cognitive Simulation"
        />,
      );
      expect(screen.getByText('Lorely Studio')).toBeInTheDocument();
      expect(screen.getByText('Cognitive Simulation')).toBeInTheDocument();
    });

    it('applies variant fills correctly', () => {
      const { container } = render(<BrandLogo variant="white" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('fill', '#ffffff');
    });
  });

  describe('PillButton', () => {
    it('renders label and handles click events', () => {
      const handleClick = vi.fn();
      render(
        <PillButton variant="orange" onClick={handleClick}>
          Start Reading
        </PillButton>,
      );
      const button = screen.getByRole('button', { name: /start reading/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('variant-orange');

      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('renders trailing chevron when requested', () => {
      const { container } = render(
        <PillButton variant="dark" trailingChevron>
          Explore Classics
        </PillButton>,
      );
      expect(container.querySelector('.brand-pill-chevron-icon')).toBeInTheDocument();
    });

    it('disables button when disabled prop is passed', () => {
      const handleClick = vi.fn();
      render(
        <PillButton disabled onClick={handleClick}>
          Disabled Action
        </PillButton>,
      );
      const button = screen.getByRole('button', { name: /disabled action/i });
      expect(button).toBeDisabled();
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('BadgePill', () => {
    it('renders kicker badge with leading status dot and text', () => {
      const { container } = render(
        <BadgePill dotColor="#ef4d23">Living Classics</BadgePill>,
      );
      expect(screen.getByText('Living Classics')).toBeInTheDocument();
      const dot = container.querySelector('.brand-badge-dot');
      expect(dot).toBeInTheDocument();
    });

    it('supports pulsing animation dot', () => {
      const { container } = render(
        <BadgePill dotPulse>Live Stream</BadgePill>,
      );
      const dot = container.querySelector('.brand-badge-dot');
      expect(dot).toHaveClass('is-pulsing');
    });
  });

  describe('RadialGauge', () => {
    it('renders 40 arc tick marks and center percentage text', () => {
      const { container } = render(
        <RadialGauge value={92} showLabels minLabel="389K" maxLabel="425K" />,
      );
      const lines = container.querySelectorAll('line');
      expect(lines).toHaveLength(40);
      expect(screen.getByText('92%')).toBeInTheDocument();
      expect(screen.getByText('389K')).toBeInTheDocument();
      expect(screen.getByText('425K')).toBeInTheDocument();
    });

    it('clamps values between 0 and 100 correctly', () => {
      render(<RadialGauge value={150} centerText="Maxed" />);
      expect(screen.getByText('Maxed')).toBeInTheDocument();
    });
  });

  describe('StatSparkline', () => {
    it('renders SVG sparkline with area and line paths', () => {
      const { container } = render(
        <StatSparkline data={[10, 20, 15, 30, 25, 40]} width={200} height={60} />,
      );
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(container.querySelector('.brand-sparkline-line')).toBeInTheDocument();
      expect(container.querySelector('.brand-sparkline-area')).toBeInTheDocument();
      expect(container.querySelector('.brand-sparkline-endpoint circle')).toBeInTheDocument();
    });

    it('returns null safely if data has fewer than 2 points', () => {
      const { container } = render(<StatSparkline data={[10]} />);
      expect(container.firstChild).toBeNull();
    });
  });
});

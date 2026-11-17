import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Skeleton } from '../components/ui';

describe('Lorely Universal Skeleton Component', () => {
  it('renders base skeleton with custom width, height, and radius', () => {
    const { container } = render(
      <Skeleton width={120} height={24} borderRadius={8} data-testid="base-sk" />,
    );
    const el = screen.getByTestId('base-sk');
    expect(el).toHaveClass('lorely-skeleton');
    expect(el).toHaveStyle({ width: '120px', height: '24px', borderRadius: '8px' });
  });

  it('renders Skeleton.Line with length presets', () => {
    const { container } = render(
      <div>
        <Skeleton.Line length="short" data-testid="line-short" />
        <Skeleton.Line length="medium" data-testid="line-medium" />
        <Skeleton.Line length="long" data-testid="line-long" />
      </div>,
    );
    expect(screen.getByTestId('line-short')).toHaveClass('lorely-skeleton-line', 'short');
    expect(screen.getByTestId('line-medium')).toHaveClass('lorely-skeleton-line', 'medium');
    expect(screen.getByTestId('line-long')).toHaveClass('lorely-skeleton-line', 'long');
  });

  it('renders multiple lines when count > 1', () => {
    const { container } = render(<Skeleton.Line count={3} />);
    const lines = container.querySelectorAll('.lorely-skeleton-line');
    expect(lines.length).toBe(3);
  });

  it('renders Skeleton.Circle with size', () => {
    render(<Skeleton.Circle size={56} data-testid="circle-sk" />);
    const el = screen.getByTestId('circle-sk');
    expect(el).toHaveClass('lorely-skeleton-circle');
    expect(el).toHaveStyle({ width: '56px', height: '56px' });
  });

  it('renders Skeleton.Card with cover and info lines', () => {
    render(<Skeleton.Card data-testid="card-sk" />);
    const card = screen.getByTestId('card-sk');
    expect(card).toHaveClass('lorely-skeleton-card');
    expect(card.querySelector('.lorely-skeleton-cover')).toBeInTheDocument();
    expect(card.querySelector('.lorely-skeleton-card-info')).toBeInTheDocument();
  });

  it('renders Skeleton.Table with rows and columns', () => {
    render(<Skeleton.Table rows={4} columns={5} data-testid="table-sk" />);
    const tableWrap = screen.getByTestId('table-sk');
    const ths = tableWrap.querySelectorAll('th');
    const trs = tableWrap.querySelectorAll('tbody tr');
    expect(ths.length).toBe(5);
    expect(trs.length).toBe(4);
  });
});

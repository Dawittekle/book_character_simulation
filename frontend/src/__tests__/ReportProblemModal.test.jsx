import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ReportProblemModal from '../components/ReportProblemModal';

describe('ReportProblemModal Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(<ReportProblemModal isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders modal dialog when isOpen is true and submits report', async () => {
    const onClose = vi.fn();
    render(<ReportProblemModal isOpen={true} onClose={onClose} />);

    expect(screen.getByRole('dialog', { name: /report a problem/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/briefly explain what happened/i)).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/briefly explain what happened/i);
    const submitBtn = screen.getByRole('button', { name: /send report/i });

    // Initially submit button is disabled when empty
    expect(submitBtn).toBeDisabled();

    fireEvent.change(textarea, { target: { value: 'Dialogue stopped mid-sentence in chapter 2.' } });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    // Shows success state
    await waitFor(() => {
      expect(screen.getByText(/thank you for letting us know/i)).toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<ReportProblemModal isOpen={true} onClose={onClose} />);

    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

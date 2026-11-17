import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LorelyUploadProgress from '../components/ui/LorelyUploadProgress';

describe('LorelyUploadProgress Component (V2 Brand Ingestion Modal)', () => {
  it('returns null when isOpen is false', () => {
    const { container } = render(<LorelyUploadProgress isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders progress card with filename and percentage readout when open', () => {
    render(
      <LorelyUploadProgress
        isOpen={true}
        progress={45}
        fileName="Crime_and_Punishment.epub"
      />
    );

    const dialog = screen.getByRole('dialog', { name: /Upload Progress/i });
    expect(dialog).toBeInTheDocument();

    expect(screen.getByTestId('lorely-upload-filename')).toHaveTextContent('Crime_and_Punishment.epub');
    expect(screen.getByTestId('lorely-upload-percentage')).toHaveTextContent('45%');

    // Circular progress ring and horizontal bar
    expect(screen.getByTestId('lorely-upload-ring-wrap')).toBeInTheDocument();
    const barFill = screen.getByTestId('lorely-upload-bar-fill');
    expect(barFill).toHaveStyle({ width: '45%' });
  });

  it('highlights the corresponding stage in the checklist based on progress', () => {
    const { rerender } = render(
      <LorelyUploadProgress isOpen={true} progress={20} />
    );
    expect(screen.getByTestId('lorely-upload-stage-label')).toHaveTextContent('Uploading & reading manuscript...');

    // Progress 50% -> Stage 2
    rerender(<LorelyUploadProgress isOpen={true} progress={50} />);
    expect(screen.getByTestId('lorely-upload-stage-label')).toHaveTextContent('Indexing chapters & bookshelf metadata...');

    // Progress 80% -> Stage 3
    rerender(<LorelyUploadProgress isOpen={true} progress={80} />);
    expect(screen.getByTestId('lorely-upload-stage-label')).toHaveTextContent('Extracting characters & emotional profiles...');

    // Progress 100% -> Stage 4
    rerender(<LorelyUploadProgress isOpen={true} progress={100} />);
    expect(screen.getByTestId('lorely-upload-stage-label')).toHaveTextContent('Ready to read & converse');
  });

  it('displays custom statusText override when provided', () => {
    render(
      <LorelyUploadProgress
        isOpen={true}
        progress={72}
        statusText="Vectorizing 29 chunks into Qdrant Cloud..."
      />
    );

    expect(screen.getByTestId('lorely-upload-stage-label')).toHaveTextContent('Vectorizing 29 chunks into Qdrant Cloud...');
  });

  it('renders cancel button and triggers onCancel callback when clicked', () => {
    const handleCancel = vi.fn();
    render(
      <LorelyUploadProgress
        isOpen={true}
        progress={30}
        onCancel={handleCancel}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /Cancel upload/i });
    expect(cancelBtn).toBeInTheDocument();

    fireEvent.click(cancelBtn);
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });
});

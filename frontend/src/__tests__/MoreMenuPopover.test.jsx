import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MoreMenuPopover from '../components/MoreMenuPopover';
import * as themeManager from '../lib/themeManager';

describe('MoreMenuPopover Component (Instagram-Style Floating Menu)', () => {
  const mockClose = vi.fn();
  const mockSignOut = vi.fn();
  const mockOpenReport = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <BrowserRouter>
        <MoreMenuPopover isOpen={false} onClose={mockClose} onSignOut={mockSignOut} />
      </BrowserRouter>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders all 7 standard Instagram More options when isOpen is true', () => {
    render(
      <BrowserRouter>
        <MoreMenuPopover
          isOpen={true}
          onClose={mockClose}
          onSignOut={mockSignOut}
          onOpenReport={mockOpenReport}
        />
      </BrowserRouter>,
    );

    expect(screen.getByRole('menu', { name: /more options/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /your activity/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /saved/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /switch appearance/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /report a problem/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /switch accounts/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /log out/i })).toBeInTheDocument();
  });

  it('renders Admin Console button when isAdmin is true', () => {
    render(
      <BrowserRouter>
        <MoreMenuPopover
          isOpen={true}
          isAdmin={true}
          onClose={mockClose}
          onSignOut={mockSignOut}
        />
      </BrowserRouter>,
    );

    expect(screen.getByRole('menuitem', { name: /admin console/i })).toBeInTheDocument();
  });

  it('toggles appearance and calls applyAppTheme when Switch appearance is clicked', () => {
    const spy = vi.spyOn(themeManager, 'applyAppTheme');
    render(
      <BrowserRouter>
        <MoreMenuPopover
          isOpen={true}
          onClose={mockClose}
          onSignOut={mockSignOut}
        />
      </BrowserRouter>,
    );

    const appearanceBtn = screen.getByRole('menuitem', { name: /switch appearance/i });
    fireEvent.click(appearanceBtn);
    expect(spy).toHaveBeenCalled();
  });

  it('triggers onOpenReport callback when Report a problem is clicked', () => {
    render(
      <BrowserRouter>
        <MoreMenuPopover
          isOpen={true}
          onClose={mockClose}
          onSignOut={mockSignOut}
          onOpenReport={mockOpenReport}
        />
      </BrowserRouter>,
    );

    const reportBtn = screen.getByRole('menuitem', { name: /report a problem/i });
    fireEvent.click(reportBtn);
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockOpenReport).toHaveBeenCalledTimes(1);
  });

  it('triggers onSignOut callback when Log out is clicked', () => {
    render(
      <BrowserRouter>
        <MoreMenuPopover
          isOpen={true}
          onClose={mockClose}
          onSignOut={mockSignOut}
        />
      </BrowserRouter>,
    );

    const logoutBtn = screen.getByRole('menuitem', { name: /log out/i });
    fireEvent.click(logoutBtn);
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});

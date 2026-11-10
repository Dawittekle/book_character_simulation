import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AppearanceSection from '../pages/settings/components/AppearanceSection';

describe('Phase 5: Appearance & Theme Engine (Slack-Style)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-setting');
    document.documentElement.removeAttribute('data-accent');
    document.documentElement.removeAttribute('data-high-contrast');
    document.documentElement.removeAttribute('data-reduced-motion');
    document.documentElement.classList.remove('dark');
  });

  it('renders theme modes (Light, Dark, System) with initial active state', () => {
    const settings = {
      app_theme: 'light',
      accent_color: 'coral',
      high_contrast: false,
      reduced_motion: false,
    };

    render(<AppearanceSection settings={settings} onUpdateSettings={vi.fn()} />);

    expect(screen.getByText('Appearance & Themes')).toBeInTheDocument();
    expect(screen.getByText('Interface Theme')).toBeInTheDocument();

    const lightRadio = screen.getByRole('radio', { name: /Select Light theme/i });
    const darkRadio = screen.getByRole('radio', { name: /Select Dark theme/i });
    const systemRadio = screen.getByRole('radio', { name: /Select System theme/i });

    expect(lightRadio).toHaveAttribute('aria-checked', 'true');
    expect(darkRadio).toHaveAttribute('aria-checked', 'false');
    expect(systemRadio).toHaveAttribute('aria-checked', 'false');
  });

  it('switches theme to Dark immediately, updates DOM and calls onUpdateSettings', async () => {
    const handleUpdate = vi.fn().mockResolvedValue({ app_theme: 'dark' });
    const settings = {
      app_theme: 'light',
      accent_color: 'coral',
      high_contrast: false,
      reduced_motion: false,
    };

    render(<AppearanceSection settings={settings} onUpdateSettings={handleUpdate} />);

    const darkRadio = screen.getByRole('radio', { name: /Select Dark theme/i });
    fireEvent.click(darkRadio);

    // Verify immediate DOM updates
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('lorely_app_theme')).toBe('dark');

    // Verify callback
    expect(handleUpdate).toHaveBeenCalledWith({ app_theme: 'dark' });

    // Verify aria-checked updated
    expect(darkRadio).toHaveAttribute('aria-checked', 'true');
  });

  it('renders all 4 curated brand accents and switches to Emerald', async () => {
    const handleUpdate = vi.fn().mockResolvedValue({ accent_color: 'emerald' });
    const settings = {
      app_theme: 'light',
      accent_color: 'coral',
      high_contrast: false,
      reduced_motion: false,
    };

    render(<AppearanceSection settings={settings} onUpdateSettings={handleUpdate} />);

    expect(screen.getByText('Brand Accent Tint')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Select Coral accent/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Select Amber accent/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Select Emerald accent/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Select Indigo accent/i })).toBeInTheDocument();

    const emeraldRadio = screen.getByRole('radio', { name: /Select Emerald accent/i });
    fireEvent.click(emeraldRadio);

    expect(document.documentElement.getAttribute('data-accent')).toBe('emerald');
    expect(localStorage.getItem('lorely_accent_color')).toBe('emerald');
    expect(handleUpdate).toHaveBeenCalledWith({ accent_color: 'emerald' });
  });

  it('toggles High Contrast mode and updates accessibility attributes', async () => {
    const handleUpdate = vi.fn().mockResolvedValue({ high_contrast: true });
    const settings = {
      app_theme: 'light',
      accent_color: 'coral',
      high_contrast: false,
      reduced_motion: false,
    };

    render(<AppearanceSection settings={settings} onUpdateSettings={handleUpdate} />);

    const highContrastSwitch = screen.getByRole('switch', { name: /Toggle high contrast mode/i });
    expect(highContrastSwitch).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(highContrastSwitch);

    expect(document.documentElement.getAttribute('data-high-contrast')).toBe('true');
    expect(localStorage.getItem('lorely_high_contrast')).toBe('true');
    expect(handleUpdate).toHaveBeenCalledWith({ high_contrast: true });
    expect(highContrastSwitch).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles Reduced Motion and updates accessibility attributes', async () => {
    const handleUpdate = vi.fn().mockResolvedValue({ reduced_motion: true });
    const settings = {
      app_theme: 'light',
      accent_color: 'coral',
      high_contrast: false,
      reduced_motion: false,
    };

    render(<AppearanceSection settings={settings} onUpdateSettings={handleUpdate} />);

    const reducedMotionSwitch = screen.getByRole('switch', { name: /Toggle reduced motion/i });
    expect(reducedMotionSwitch).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(reducedMotionSwitch);

    expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('true');
    expect(localStorage.getItem('lorely_reduced_motion')).toBe('true');
    expect(handleUpdate).toHaveBeenCalledWith({ reduced_motion: true });
    expect(reducedMotionSwitch).toHaveAttribute('aria-checked', 'true');
  });

  it('renders clean segmented theme controls and compact accent pills', () => {
    const settings = {
      app_theme: 'dark',
      accent_color: 'amber',
      high_contrast: false,
      reduced_motion: false,
    };

    render(<AppearanceSection settings={settings} onUpdateSettings={vi.fn()} />);

    expect(screen.getByRole('radio', { name: /Select Dark theme/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Select Amber accent/i })).toHaveAttribute('aria-checked', 'true');
  });

  it('updates dashboard-wide theme variables and brand accent on the root document', async () => {
    const handleUpdate = vi.fn().mockResolvedValue({});
    const settings = {
      app_theme: 'light',
      accent_color: 'coral',
      high_contrast: false,
      reduced_motion: false,
    };

    render(<AppearanceSection settings={settings} onUpdateSettings={handleUpdate} />);

    // Select Emerald accent
    const emeraldRadio = screen.getByRole('radio', { name: /Select Emerald accent/i });
    fireEvent.click(emeraldRadio);

    // Verify root document has updated --brand-orange property for dashboard sync
    expect(document.documentElement.style.getPropertyValue('--brand-orange')).toBe('#059669');
    expect(document.documentElement.style.getPropertyValue('--lorely-settings-accent')).toBe('#059669');

    // Switch to dark theme
    const darkRadio = screen.getByRole('radio', { name: /Select Dark theme/i });
    fireEvent.click(darkRadio);

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Switch back to light theme
    const lightRadio = screen.getByRole('radio', { name: /Select Light theme/i });
    fireEvent.click(lightRadio);

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LandingPage from '../pages/LandingPage';

describe('LandingPage Component', () => {
  it('renders hero title with italic serif accent and kicker badge', () => {
    render(<LandingPage />);

    expect(screen.getByText('Lorely Studio')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Step into Minds of classic literature/i,
    );
    expect(screen.getByText(/The Cognitive Simulation & Voice Dialogue Platform/i)).toBeInTheDocument();
  });

  it('renders floating navbar with flower logo and NO shopping cart icon', () => {
    const { container } = render(<LandingPage />);

    // Brand title in nav
    expect(screen.getAllByText('Lorely').length).toBeGreaterThan(0);
    // Desktop navigation links
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.getByText('Pages')).toBeInTheDocument();

    // Verify STRICTLY NO cart icon exists in DOM
    expect(container.querySelector('[aria-label="cart"]')).toBeNull();
    expect(container.querySelector('.lucide-shopping-cart')).toBeNull();
    expect(container.querySelector('.lucide-shopping-bag')).toBeNull();
  });

  it('renders looping background video with required playback attributes', () => {
    const { container } = render(<LandingPage />);
    const video = container.querySelector('video');

    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('autoplay');
    expect(video).toHaveAttribute('loop');
    expect(video).toHaveAttribute('playsinline');
    expect(video).toHaveAttribute('poster');
  });

  it('triggers onGetStarted when primary CTA buttons are clicked', () => {
    const handleGetStarted = vi.fn();
    render(<LandingPage onGetStarted={handleGetStarted} />);

    // Nav CTA
    const navCta = screen.getByRole('button', { name: /start reading/i });
    fireEvent.click(navCta);
    expect(handleGetStarted).toHaveBeenCalledTimes(1);

    // Hero dark CTA
    const heroCta = screen.getByRole('button', { name: /start exploring/i });
    fireEvent.click(heroCta);
    expect(handleGetStarted).toHaveBeenCalledTimes(2);
  });

  it('triggers onSignIn when Sign In nav button is clicked', () => {
    const handleSignIn = vi.fn();
    render(<LandingPage onSignIn={handleSignIn} />);

    const signInBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(signInBtn);
    expect(handleSignIn).toHaveBeenCalledTimes(1);
  });

  it('toggles mobile menu dropdown when hamburger button is clicked', () => {
    render(<LandingPage />);

    const hamburger = screen.getByRole('button', { name: /toggle navigation menu/i });
    expect(screen.queryByRole('link', { name: /home/i, hidden: false })).toBeInTheDocument();

    fireEvent.click(hamburger);
    // Mobile dropdown opens
    const mobileLinks = screen.getAllByText('Features');
    expect(mobileLinks.length).toBeGreaterThan(1);
  });

  it('renders all three dashboard preview cards with interactive controls', () => {
    render(<LandingPage />);

    // Card 1: Resonance
    expect(screen.getByText('6,896')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('Persona Fidelity achieved')).toBeInTheDocument();

    // Toggle Card 1
    const turnsBtn = screen.getByRole('button', { name: /dialogue turns/i });
    fireEvent.click(turnsBtn);
    expect(turnsBtn).toHaveClass('is-active');

    // Card 2: Simulation controls
    expect(screen.getByText('Deep Analysis')).toBeInTheDocument();
    expect(screen.getByText('Chapter 12 (Mid-Book)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('25')).toBeInTheDocument();
    expect(screen.getByDisplayValue('8192')).toBeInTheDocument();

    // Submit form in Card 2
    const saveBtn = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);
    expect(screen.getByRole('button', { name: /saved!/i })).toBeInTheDocument();

    // Card 3: Voice Stream
    expect(screen.getByText('Voice Stream')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
    expect(screen.getByText('Acoustic Naturalness')).toBeInTheDocument();
  });

  it('renders the Use Cases section with 4 domain cards and framed badges', () => {
    render(<LandingPage />);

    expect(screen.getByTestId('landing-usecases-section')).toBeInTheDocument();
    expect(screen.getByText('living literature in practice')).toBeInTheDocument();
    expect(screen.getByText(/four ways readers, researchers, and creators converse/i)).toBeInTheDocument();

    // 4 framed tabs
    expect(screen.getByText('TEXTUAL-EXEGESIS.FRAME')).toBeInTheDocument();
    expect(screen.getByText('SALON-DIALOGUE.FRAME')).toBeInTheDocument();
    expect(screen.getByText('COGNITIVE-LAB.FRAME')).toBeInTheDocument();
    expect(screen.getByText('PRIVATE-ARCHIVES.FRAME')).toBeInTheDocument();

    // 4 use cases
    expect(screen.getByText('Ground-Truth Textual Exegesis')).toBeInTheDocument();
    expect(screen.getByText('Step Inside the Literary Salon')).toBeInTheDocument();
    expect(screen.getByText('Cognitive Voice & State Laboratory')).toBeInTheDocument();
    expect(screen.getByText('Bring Your Own Books to Life')).toBeInTheDocument();
  });

  it('renders the Pricing section with sky atmosphere, currency toggling, and tier switching', async () => {
    const handleGetStarted = vi.fn();
    render(<LandingPage onGetStarted={handleGetStarted} />);

    // Pricing section existence
    expect(screen.getByTestId('landing-pricing-section')).toBeInTheDocument();
    expect(screen.getByText('cheaper than hiring')).toBeInTheDocument();
    expect(screen.getByText(/one flat price. pause or cancel whenever./i)).toBeInTheDocument();
    expect(screen.getByText(/Compare All Available Membership Tiers/i)).toBeInTheDocument();

    // Default currency is ETB (Birr)
    expect(screen.getAllByText(/ETB/i).length).toBeGreaterThan(0);

    // Toggle currency to USD
    const usdButton = screen.getByRole('button', { name: /USD \(\$\)/i });
    fireEvent.click(usdButton);
    expect(usdButton).toHaveClass('is-active');

    // Toggle billing to Yearly
    const yearlyButton = screen.getByRole('button', { name: /Yearly/i });
    fireEvent.click(yearlyButton);
    expect(yearlyButton).toHaveClass('is-active');

    // Master CTA button triggers onGetStarted
    const masterCta = screen.getByTestId('pricing-master-action-btn');
    fireEvent.click(masterCta);
    expect(handleGetStarted).toHaveBeenCalled();
  });
});

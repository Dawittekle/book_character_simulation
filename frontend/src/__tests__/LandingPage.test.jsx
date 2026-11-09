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
    // Active Navigation Links
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Use Cases')).toBeInTheDocument();
    expect(screen.getByText('Pricing')).toBeInTheDocument();
    expect(screen.getByText('FAQ')).toBeInTheDocument();

    // Verify unused / section-less buttons are STRICTLY removed
    expect(screen.queryByText('Features')).toBeNull();
    expect(screen.queryByText('Library')).toBeNull();
    expect(screen.queryByText('Pages')).toBeNull();

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

    // Nav CTA: "Start Free" (updated per design)
    const navCta = screen.getByRole('button', { name: /start free/i });
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
    const mobileLinks = screen.getAllByText('Use Cases');
    expect(mobileLinks.length).toBeGreaterThan(1);
  });

  it('renders all three dashboard preview cards with interactive controls', () => {
    render(<LandingPage />);

    // Card 1: Character Dialogue Resonance
    expect(screen.getByText('96.8%')).toBeInTheDocument();
    expect(screen.getByText('Crime & Punishment')).toBeInTheDocument();
    expect(screen.getByText('Persona Fidelity achieved')).toBeInTheDocument();
    expect(screen.getByText('Grounded in Chapter Text & Dialogue')).toBeInTheDocument();

    // Toggle Card 1
    const turnsBtn = screen.getByRole('button', { name: /dialogue turns/i });
    fireEvent.click(turnsBtn);
    expect(turnsBtn).toHaveClass('is-active');
    expect(screen.getByText('1,420')).toBeInTheDocument();

    // Card 2: Literary simulation controls
    expect(screen.getByText('Rodion Raskolnikov (Mid-Book)')).toBeInTheDocument();
    expect(screen.getByText('Chapter 12 (Mid-Book)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('25')).toBeInTheDocument();
    expect(screen.getByDisplayValue('8192')).toBeInTheDocument();

    // Submit form in Card 2
    const saveBtn = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);
    expect(screen.getByRole('button', { name: /saved!/i })).toBeInTheDocument();

    // Card 3: Neural Voice Salon
    expect(screen.getByText('Voice Stream')).toBeInTheDocument();
    expect(screen.getByText('24ms')).toBeInTheDocument();
    expect(screen.getByText('Studio Neural TTS')).toBeInTheDocument();
    expect(screen.getByText('Acoustic Naturalness')).toBeInTheDocument();
    expect(screen.getByText('19th-Century Conversational Cadence')).toBeInTheDocument();
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

  it('renders the FAQ "THE NOSY SECTION" with framed tabs and expandable accordions', () => {
    render(<LandingPage />);

    expect(screen.getByTestId('landing-faq-section')).toBeInTheDocument();
    expect(screen.getByText('ask away')).toBeInTheDocument();
    expect(screen.getByText('THE NOSY SECTION')).toBeInTheDocument();
    expect(screen.getByText(/everything you'd grill us on a call, minus the call./i)).toBeInTheDocument();

    // 5 framed tab badges
    expect(screen.getByText('HOW-IT-WORKS.FRAME')).toBeInTheDocument();
    expect(screen.getByText('NEED-FOR-SPEED.FRAME')).toBeInTheDocument();
    expect(screen.getByText('THE-FIREHOSE.FRAME')).toBeInTheDocument();
    expect(screen.getByText('THE-WHOLE-THING.FRAME')).toBeInTheDocument();
    expect(screen.getByText('THE-DO-OVER.FRAME')).toBeInTheDocument();

    // Item 0 is expanded by default
    expect(screen.getByText(/Lorely ingests classical literature and segments the text/i)).toBeInTheDocument();

    // Click item 1 to expand spoiler boundary question
    const item1 = screen.getByTestId('faq-item-1');
    fireEvent.click(item1);

    expect(screen.getByText(/Lorely employs strict chapter-gated spoiler boundaries/i)).toBeInTheDocument();
  });

  it('renders the Parallax Footer with VIEW BELOW spacer, links, and social circles', () => {
    render(<LandingPage />);

    // Top spacer
    expect(screen.getByTestId('footer-top-spacer')).toBeInTheDocument();
    expect(screen.getByText('VIEW BELOW')).toBeInTheDocument();

    // Parallax footer section
    expect(screen.getByTestId('footer-parallax-section')).toBeInTheDocument();
    expect(screen.getByText(/Interactive Cognitive Casts\. Step into the stories\./i)).toBeInTheDocument();

    // 3 Link column headers
    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Ecosystem')).toBeInTheDocument();
    expect(screen.getByText('Governance')).toBeInTheDocument();

    // Copyright
    expect(screen.getByText(/© 2026 Lorely Studio\. All Rights Reserved/i)).toBeInTheDocument();

    // Social icons
    expect(screen.getByLabelText('Twitter')).toBeInTheDocument();
    expect(screen.getByLabelText('Facebook')).toBeInTheDocument();
    expect(screen.getByLabelText('Instagram')).toBeInTheDocument();
    expect(screen.getByLabelText('LinkedIn')).toBeInTheDocument();

    // Foreground image
    const foregroundImg = screen.getByAltText('Foreground layer');
    expect(foregroundImg).toBeInTheDocument();
  });
});

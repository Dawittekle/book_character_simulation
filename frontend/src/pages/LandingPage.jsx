import React, { useState, useEffect } from 'react';
import './LandingPage.css';
import { BrandLogo, RadialGauge } from '../components/brand';
import { lorelyApi } from '../services/lorelyApi';

export default function LandingPage({ onGetStarted, onSignIn }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeCard1Tab, setActiveCard1Tab] = useState('resonance'); // 'resonance' | 'turns'
  const [activeCard3Tab, setActiveCard3Tab] = useState('audio'); // 'audio' | 'text'

  // Backend Plans & Currency Data Foundation (Phase 1)
  const [plans, setPlans] = useState([]);
  const [paymentConfig, setPaymentConfig] = useState({ usd_to_etb_rate: 135 });
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState(null);
  const [currency, setCurrency] = useState('ETB'); // 'USD' | 'ETB'
  const [billingPeriod, setBillingPeriod] = useState('monthly'); // 'monthly' | 'yearly'
  const [selectedPlanId, setSelectedPlanId] = useState('scholar');

  // Load Real Backend Plans & Payment Configuration
  useEffect(() => {
    let mounted = true;
    async function loadLandingData() {
      try {
        setPlansLoading(true);
        const [plansRes, configRes] = await Promise.allSettled([
          lorelyApi.getPlans().catch(() => null),
          lorelyApi.getPaymentConfig().catch(() => null),
        ]);

        if (!mounted) return;

        if (plansRes.status === 'fulfilled' && plansRes.value?.plans && plansRes.value.plans.length > 0) {
          setPlans(plansRes.value.plans);
          const scholar = plansRes.value.plans.find(
            (p) => p.id === 'scholar' || p.badge?.includes('POPULAR')
          );
          setSelectedPlanId(scholar ? scholar.id : plansRes.value.plans[0]?.id || 'scholar');
        } else {
          // Graceful fallback structure matching database schema
          const fallbackPlans = [
            {
              id: 'free',
              name: 'Free Reader',
              price_monthly: 0,
              badge: 'STARTER',
              description: 'Introductory reading with classical dialogue limits.',
              features: ['Unlimited everyday text chats', 'Access to standard classics', 'Limited memory and storage'],
            },
            {
              id: 'scholar',
              name: 'Literary Scholar (Plus)',
              price_monthly: 20,
              badge: 'MOST POPULAR',
              description: 'Advanced cognitive simulations, unlimited shelf imports, HD speech synthesis.',
              features: [
                'Unlimited book shelf imports',
                'Unlimited daily dialogue turns',
                'HD Voice mode simulation',
                'Dynamic emotional drift telemetry',
              ],
            },
            {
              id: 'pro',
              name: 'Institutional Archive (Pro)',
              price_monthly: 100,
              badge: 'FRONTIER INTELLIGENCE',
              description: 'Dedicated vector search namespace, multi-seat classroom access.',
              features: [
                'Isolated Chroma vector namespace',
                'Multi-seat research access',
                'Custom persona prompt fine-tuning',
              ],
            },
          ];
          setPlans(fallbackPlans);
          setSelectedPlanId('scholar');
        }

        if (configRes.status === 'fulfilled' && configRes.value) {
          setPaymentConfig((prev) => ({ ...prev, ...configRes.value }));
        }
      } catch (err) {
        if (mounted) {
          setPlansError(err.message || 'Unable to load plans');
        }
      } finally {
        if (mounted) {
          setPlansLoading(false);
        }
      }
    }

    loadLandingData();
    return () => {
      mounted = false;
    };
  }, []);

  // Live Currency & Pricing Calculator
  const calculatePrice = (monthlyPrice) => {
    const rate = Number(paymentConfig.usd_to_etb_rate || 135);
    const isYearly = billingPeriod === 'yearly';
    const discountFactor = isYearly ? 0.8 : 1.0;
    const effectivePrice = Math.round(monthlyPrice * discountFactor);

    if (currency === 'ETB') {
      const etbVal = Math.round(effectivePrice * rate);
      return {
        amount: etbVal,
        currency: 'ETB',
        display: `${etbVal.toLocaleString()} ETB`,
        period: isYearly ? '/ month (billed yearly)' : '/ month',
      };
    }

    return {
      amount: effectivePrice,
      currency: 'USD',
      display: `$${effectivePrice}`,
      period: isYearly ? '/ month (billed yearly)' : '/ month',
    };
  };

  // Card 2 Form States
  const [cognitiveDepth, setCognitiveDepth] = useState('Deep Analysis');
  const [spoilerBoundary, setSpoilerBoundary] = useState('Chapter 12 (Mid-Book)');
  const [dailyTurnsTarget, setDailyTurnsTarget] = useState(25);
  const [contextTokensTarget, setContextTokensTarget] = useState(8192);
  const [formSaved, setFormSaved] = useState(false);

  const handleCtaClick = () => {
    if (typeof onGetStarted === 'function') {
      onGetStarted();
    } else {
      window.location.href = '/login';
    }
  };

  const handleSignInClick = () => {
    if (typeof onSignIn === 'function') {
      onSignIn();
    } else if (typeof onGetStarted === 'function') {
      onGetStarted();
    } else {
      window.location.href = '/login';
    }
  };

  const handleFormSave = (e) => {
    e.preventDefault();
    setFormSaved(true);
    setTimeout(() => setFormSaved(false), 2000);
  };

  const handleFormReset = () => {
    setCognitiveDepth('Deep Analysis');
    setSpoilerBoundary('Chapter 12 (Mid-Book)');
    setDailyTurnsTarget(25);
    setContextTokensTarget(8192);
  };

  return (
    <div className="landing-page-frame">
      {/* Clipped Full-Viewport Hero Container */}
      <section className="landing-hero-container">
        {/* Background Looping Video */}
        <video
          className="landing-bg-video"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          disableRemotePlayback
          poster="https://images.unsplash.com/photo-1557683316-973673baf926?w=1600&q=60"
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260424_064411_9e9d7f84-9277-41f4-ab10-59172d89e6be.mp4"
            type="video/mp4"
          />
        </video>

        {/* Video Overlay */}
        <div className="landing-video-overlay" />

        {/* Foreground Content Wrapper */}
        <div className="landing-foreground">
          {/* Floating Pill Navbar */}
          <header className="landing-nav-wrapper">
            <nav className="landing-nav-pill">
              {/* Logo Cluster */}
              <div className="landing-nav-logo-group">
                <BrandLogo size={30} variant="orange" />
                <span className="landing-nav-brand-title">Lorely</span>
              </div>

              {/* Desktop Links */}
              <div className="landing-nav-links">
                <a href="#home" className="landing-nav-link is-active">
                  <span className="landing-nav-dot" />
                  Home
                </a>
                <a href="#features" className="landing-nav-link">
                  Features
                </a>
                <a href="#library" className="landing-nav-link">
                  Library
                </a>
                <div className="landing-nav-link-dropdown">
                  <span className="landing-nav-link text-orange">Pages</span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ef4d23"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* Right Cluster: STRICTLY NO CART ICON as required */}
              <div className="landing-nav-right">
                <button
                  type="button"
                  className="landing-nav-signin-btn"
                  onClick={handleSignInClick}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className="landing-nav-cta-btn"
                  onClick={handleCtaClick}
                >
                  <span className="landing-nav-cta-desktop-text">Start Reading</span>
                  <span className="landing-nav-cta-mobile-text">Explore</span>
                  <span className="landing-nav-cta-icon-circle">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </span>
                </button>

                {/* Mobile Hamburger Button */}
                <button
                  type="button"
                  aria-label="Toggle navigation menu"
                  className="landing-nav-hamburger"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  {mobileMenuOpen ? (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  ) : (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Mobile Menu Dropdown */}
              {mobileMenuOpen && (
                <div className="landing-mobile-menu">
                  <a
                    href="#home"
                    className="landing-mobile-link is-active"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Home
                  </a>
                  <a
                    href="#features"
                    className="landing-mobile-link"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Features
                  </a>
                  <a
                    href="#library"
                    className="landing-mobile-link"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Library
                  </a>
                  <button
                    type="button"
                    className="landing-mobile-link text-left"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleSignInClick();
                    }}
                  >
                    Sign In
                  </button>
                </div>
              )}
            </nav>
          </header>

          {/* Centered Hero Content */}
          <div className="landing-hero-content">
            {/* Kicker Badge */}
            <div className="landing-kicker-badge">
              <span className="landing-kicker-dot" />
              <span>Lorely Studio</span>
            </div>

            {/* Fluid Hero Headline */}
            <h1 className="landing-hero-headline">
              Step into{' '}
              <span className="landing-headline-serif">Minds</span>
              <br />
              {' '}of classic literature
            </h1>

            {/* Subtitle */}
            <p className="landing-hero-subtitle">
              The Cognitive Simulation & Voice Dialogue Platform Bringing Literary Minds to Life
            </p>

            {/* Hero Dark Obsidian CTA Button */}
            <button
              type="button"
              className="landing-hero-cta"
              onClick={handleCtaClick}
            >
              <span>Start Exploring</span>
              <span className="landing-hero-cta-chevron-circle">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
            </button>
          </div>

          {/* Bottom Dashboard Preview Tray */}
          <div className="landing-dashboard-tray-wrapper">
            <div className="landing-dashboard-tray">
              <div className="landing-dashboard-grid">
                {/* Card 1: Character Dialogue Resonance */}
                <div className="landing-card landing-card-resonance">
                  <div className="landing-card-header">
                    <span className="landing-card-tag text-orange">Resonance</span>
                    <span className="landing-card-period">This Month</span>
                  </div>

                  <div className="landing-card-metric-row">
                    <span className="landing-card-big-number">6,896</span>
                    <span className="landing-card-badge-trend positive">
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                        <polyline points="17 6 23 6 23 12" />
                      </svg>
                      +3,382 (33%)
                    </span>
                  </div>

                  <span className="landing-card-caption">Compared to yesterday</span>

                  <div className="landing-card-gauge-section">
                    <span className="landing-card-gauge-label">
                      Persona Fidelity achieved
                    </span>
                    <RadialGauge
                      value={activeCard1Tab === 'resonance' ? 92 : 78}
                      color="#ef4d23"
                      showLabels
                      minLabel="389K"
                      maxLabel="425K"
                    />
                  </div>

                  <div className="landing-card-toggle-pill">
                    <button
                      type="button"
                      className={`landing-card-toggle-item ${
                        activeCard1Tab === 'resonance' ? 'is-active' : ''
                      }`}
                      onClick={() => setActiveCard1Tab('resonance')}
                    >
                      Resonance
                    </button>
                    <button
                      type="button"
                      className={`landing-card-toggle-item ${
                        activeCard1Tab === 'turns' ? 'is-active' : ''
                      }`}
                      onClick={() => setActiveCard1Tab('turns')}
                    >
                      Dialogue Turns
                    </button>
                  </div>
                </div>

                {/* Card 2: Cognitive Simulation Controls & Limits */}
                <form className="landing-card landing-card-form" onSubmit={handleFormSave}>
                  <div className="landing-form-group">
                    <label className="landing-form-label">Show figures for</label>
                    <div className="landing-form-select-btn">
                      <span>{cognitiveDepth}</span>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>

                  <div className="landing-form-group">
                    <label className="landing-form-label">Spoiler boundary by</label>
                    <div className="landing-form-select-btn">
                      <span>{spoilerBoundary}</span>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>

                  <div className="landing-form-group">
                    <label className="landing-form-label">Target turns (Daily)</label>
                    <div className="landing-form-input-container">
                      <span className="landing-form-input-prefix">#</span>
                      <input
                        type="number"
                        className="landing-form-input"
                        value={dailyTurnsTarget}
                        onChange={(e) => setDailyTurnsTarget(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="landing-form-group">
                    <label className="landing-form-label">Context memory (Tokens)</label>
                    <div className="landing-form-input-container">
                      <span className="landing-form-input-prefix">#</span>
                      <input
                        type="number"
                        className="landing-form-input"
                        value={contextTokensTarget}
                        onChange={(e) => setContextTokensTarget(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="landing-form-footer">
                    <button type="submit" className="landing-form-save-btn">
                      {formSaved ? 'Saved!' : 'Save'}
                    </button>
                    <button
                      type="button"
                      className="landing-form-reset-btn"
                      onClick={handleFormReset}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      className="landing-form-close-btn"
                      aria-label="Dismiss parameters"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </form>

                {/* Card 3: Speech Synthesis & Audio Stream */}
                <div className="landing-card landing-card-voice">
                  <div className="landing-card-header">
                    <span className="landing-card-tag text-orange">Voice Stream</span>
                    <span className="landing-card-period">today</span>
                  </div>

                  <div className="landing-card-metric-row">
                    <span className="landing-card-big-number">128</span>
                    <span className="landing-card-badge-trend neutral">
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                        <polyline points="17 6 23 6 23 12" />
                      </svg>
                      +12
                    </span>
                  </div>

                  <span className="landing-card-caption">Compared to yesterday</span>

                  <div className="landing-card-gauge-section">
                    <span className="landing-card-gauge-label">
                      Acoustic Naturalness
                    </span>
                    <RadialGauge
                      value={activeCard3Tab === 'audio' ? 68 : 84}
                      color="#9ca3af"
                      showLabels={false}
                    />
                  </div>

                  <div className="landing-card-toggle-pill">
                    <button
                      type="button"
                      className={`landing-card-toggle-item ${
                        activeCard3Tab === 'audio' ? 'is-active' : ''
                      }`}
                      onClick={() => setActiveCard3Tab('audio')}
                    >
                      HD Audio
                    </button>
                    <button
                      type="button"
                      className={`landing-card-toggle-item ${
                        activeCard3Tab === 'text' ? 'is-active' : ''
                      }`}
                      onClick={() => setActiveCard3Tab('text')}
                    >
                      Text Stream
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

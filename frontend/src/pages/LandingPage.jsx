import React, { useState, useEffect, useRef } from 'react';
import './LandingPage.css';
import { BrandLogo, RadialGauge } from '../components/brand';
import { lorelyApi } from '../services/lorelyApi';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Globe, Sparkles } from 'lucide-react';

function TwitterIcon({ className, size = 18 }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
    </svg>
  );
}

function FacebookIcon({ className, size = 18 }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function InstagramIcon({ className, size = 18 }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function LinkedinIcon({ className, size = 18 }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function BookParallaxGraphic() {
  return (
    <div className="footer-book-artwork-wrap" data-testid="footer-book-graphic" aria-label="Open literary folio graphic">
      <svg
        viewBox="0 0 640 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="footer-book-svg"
      >
        <defs>
          <linearGradient id="bookCoverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
          <linearGradient id="bookPageGradLeft" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f4ede2" />
            <stop offset="70%" stopColor="#fdfbf7" />
            <stop offset="100%" stopColor="#e2d6c3" />
          </linearGradient>
          <linearGradient id="bookPageGradRight" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ded1be" />
            <stop offset="30%" stopColor="#fdfbf7" />
            <stop offset="100%" stopColor="#f5efe6" />
          </linearGradient>
          <linearGradient id="goldEdgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#d4af37" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#c89d5c" />
          </linearGradient>
          <linearGradient id="ribbonGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ef4d23" />
            <stop offset="100%" stopColor="#b91c1c" />
          </linearGradient>
          <filter id="bookGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="16" stdDeviation="24" floodColor="#0f172a" floodOpacity="0.25" />
          </filter>
        </defs>

        <g filter="url(#bookGlow)">
          {/* Hardcover base spine & rim */}
          <path
            d="M 50 220 Q 320 260 590 220 L 590 232 Q 320 274 50 232 Z"
            fill="url(#bookCoverGrad)"
          />
          {/* Page block thickness / gilded edges */}
          <path
            d="M 56 216 Q 320 252 584 216 L 584 224 Q 320 262 56 224 Z"
            fill="url(#goldEdgeGrad)"
            opacity="0.85"
          />

          {/* Left open pages (curved folio) */}
          <path
            d="M 320 228 C 240 224 120 205 60 180 C 60 130 60 80 60 70 C 130 92 240 108 320 114 Z"
            fill="url(#bookPageGradLeft)"
          />
          {/* Subtle page lines left */}
          <path d="M 100 102 C 160 116 230 126 295 130" stroke="#d6c7b2" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          <path d="M 100 120 C 160 134 230 144 295 148" stroke="#d6c7b2" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          <path d="M 100 138 C 160 152 230 162 295 166" stroke="#d6c7b2" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          <path d="M 100 156 C 160 170 230 180 295 184" stroke="#d6c7b2" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <path d="M 100 174 C 160 188 230 198 295 202" stroke="#d6c7b2" strokeWidth="2" strokeLinecap="round" opacity="0.4" />

          {/* Right open pages (curved folio) */}
          <path
            d="M 320 228 C 400 224 520 205 580 180 C 580 130 580 80 580 70 C 510 92 400 108 320 114 Z"
            fill="url(#bookPageGradRight)"
          />
          {/* Subtle page lines right */}
          <path d="M 345 130 C 410 126 480 116 540 102" stroke="#d6c7b2" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          <path d="M 345 148 C 410 144 480 134 540 120" stroke="#d6c7b2" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          <path d="M 345 166 C 410 162 480 152 540 138" stroke="#d6c7b2" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          <path d="M 345 184 C 410 180 480 170 540 156" stroke="#d6c7b2" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <path d="M 345 202 C 410 198 480 188 540 174" stroke="#d6c7b2" strokeWidth="2" strokeLinecap="round" opacity="0.4" />

          {/* Center spine gutter shadow */}
          <path
            d="M 317 114 C 319 140 319 200 317 228 C 320 229 321 229 323 228 C 321 200 321 140 323 114 Z"
            fill="#b8a892"
            opacity="0.8"
          />

          {/* Terracotta silk bookmark ribbon draping down */}
          <path
            d="M 318 114 Q 315 170 305 210 Q 295 245 285 265 L 297 267 Q 307 245 317 210 Q 325 170 322 114 Z"
            fill="url(#ribbonGrad)"
          />
          {/* Ribbon tip swallowtail */}
          <path
            d="M 285 265 L 291 258 L 297 267 Z"
            fill="#7f1d1d"
          />
        </g>
      </svg>
    </div>
  );
}

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
  const [selectedPlanId, setSelectedPlanId] = useState('free');

  // Smart Sticky Floating Navbar (Hide on scroll down, show on scroll up)
  const [navVisible, setNavVisible] = useState(true);
  const [navScrolled, setNavScrolled] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY || 0;
          const prevY = lastScrollY.current;
          const diff = currentY - prevY;

          // Always visible near top of page
          if (currentY < 60) {
            setNavVisible(true);
            setNavScrolled(false);
          } else {
            setNavScrolled(true);
            if (diff > 8) {
              // Scrolling down -> hide navbar
              setNavVisible(false);
              setMobileMenuOpen(false);
            } else if (diff < -8) {
              // Scrolling up -> reveal navbar
              setNavVisible(true);
            }
          }
          lastScrollY.current = currentY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Parallax Footer Scroll Tracking (Phase 5)
  const parallaxRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: parallaxRef,
    offset: ['start end', 'end start'],
  });
  const yForeground = useTransform(scrollYProgress, [0, 1], [-50, 150]);

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
          const freePlan = plansRes.value.plans.find(
            (p) => p.id === 'free' || p.price_monthly === 0
          );
          setSelectedPlanId(freePlan ? freePlan.id : plansRes.value.plans[0]?.id || 'free');
        } else {
          // Graceful fallback structure matching database schema
          const fallbackPlans = [
            {
              id: 'free',
              name: 'Free Reader',
              price_monthly: 0,
              badge: 'YOUR CURRENT PLAN',
              description: 'Exploration tier with access to standard classics and introductory character dialogues.',
              features: [
                'Unlimited everyday text chats',
                'Access to standard classics',
                'Limited memory and storage',
                'Community support',
              ],
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
          setSelectedPlanId('free');
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

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0] || {
    id: 'free',
    name: 'Free Reader',
    price_monthly: 0,
    badge: 'YOUR CURRENT PLAN',
    description: 'Exploration tier with access to standard classics and introductory character dialogues.',
    features: [
      'Unlimited everyday text chats',
      'Access to standard classics',
      'Limited memory and storage',
      'Community support',
    ],
  };

  const currentPlanPrice = calculatePrice(selectedPlan.price_monthly || 0);

  // Card 2 Form States
  const [cognitiveDepth, setCognitiveDepth] = useState('Deep Analysis');
  const [spoilerBoundary, setSpoilerBoundary] = useState('Chapter 12 (Mid-Book)');
  const [dailyTurnsTarget, setDailyTurnsTarget] = useState(25);
  const [contextTokensTarget, setContextTokensTarget] = useState(8192);
  const [formSaved, setFormSaved] = useState(false);

  // FAQ Accordion States
  const [expandedFaq, setExpandedFaq] = useState(0);
  const toggleFaq = (index) => {
    setExpandedFaq((prev) => (prev === index ? null : index));
  };

  const faqItems = [
    {
      frame: 'HOW-IT-WORKS.FRAME',
      number: '01',
      question: 'Okay, how does this cognitive simulation thing work?',
      answer:
        'Lorely ingests classical literature and segments the text into semantic chapter chunks. Our cognitive engine maps psychological traits, interpersonal dynamics, moral baselines, and historical vernacular into persistent character dossiers. When you converse, every response balances grounding vector retrieval with real-time emotional drift to remain completely authentic to the author’s voice.',
    },
    {
      frame: 'NEED-FOR-SPEED.FRAME',
      number: '02',
      question: 'Will the character spoil the plot or ending for me?',
      hasUserTag: true,
      answer:
        'Never, unless you intentionally choose to unlock future chapters. Lorely employs strict chapter-gated spoiler boundaries. If you specify that you are reading Chapter 5, the character is cognitively quarantined from knowing any events, deaths, reconciliations, or revelations occurring in Chapter 6 and beyond.',
    },
    {
      frame: 'THE-FIREHOSE.FRAME',
      number: '03',
      question: 'Can I upload my own custom EPUBs, PDFs, and books?',
      answer:
        'Yes! Explorer, Scholar, and Archive members can ingest personal files (EPUB, PDF, TXT) into isolated vector namespaces. Our narrative classifier analyzes chapters, extracts characters, and constructs cognitive dossiers automatically in seconds.',
    },
    {
      frame: 'THE-WHOLE-THING.FRAME',
      number: '04',
      question: 'Is it just text, or can I speak with characters using voice?',
      answer:
        'Lorely provides full real-time HD Voice dialogue. Powered by neural speech synthesis and microphone transcription, you can listen to natural acoustic voice streams and verbally converse with literary minds with near-zero latency.',
    },
    {
      frame: 'THE-DO-OVER.FRAME',
      number: '05',
      question: 'What payment methods are supported for subscriptions?',
      answer:
        'We support international credit/debit cards (Visa, Mastercard, Amex), PayPal, and Ethiopian local payment methods including Telebirr and Commercial Bank of Ethiopia (CBE) with rapid admin verification.',
    },
  ];

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
      {/* Floating Smart Pill Navbar (Sticky with hide on scroll down / show on scroll up) */}
      <motion.header
        className={`landing-nav-wrapper ${navScrolled ? 'is-scrolled' : ''} ${navVisible ? 'nav-visible' : 'nav-hidden'}`}
        initial={{ y: 0 }}
        animate={{ y: navVisible ? 0 : -100 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      >
        <nav className="landing-nav-pill">
          {/* Logo Cluster */}
          <div className="landing-nav-logo-group">
            <BrandLogo size={30} variant="orange" />
            <span className="landing-nav-brand-title">Lorely</span>
          </div>

          {/* Desktop Links (Clean without dot before Home) */}
          <div className="landing-nav-links">
            <a href="#home" className="landing-nav-link is-active">
              Home
            </a>
            <a href="#use-cases" className="landing-nav-link">
              Use Cases
            </a>
            <a href="#pricing" className="landing-nav-link">
              Pricing
            </a>
            <a href="#faq" className="landing-nav-link">
              FAQ
            </a>
          </div>

          {/* Right Cluster: Sign In, Start Free, and Mobile Hamburger */}
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
              <span className="landing-nav-cta-desktop-text">Start Free</span>
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
                href="#use-cases"
                className="landing-mobile-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                Use Cases
              </a>
              <a
                href="#pricing"
                className="landing-mobile-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </a>
              <a
                href="#faq"
                className="landing-mobile-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                FAQ
              </a>
              <div className="landing-mobile-divider" />
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
              <button
                type="button"
                className="landing-mobile-cta-btn"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleCtaClick();
                }}
              >
                <span>Start Free</span>
                <span className="landing-mobile-cta-arrow">→</span>
              </button>
            </div>
          )}
        </nav>
      </motion.header>

      {/* Clipped Full-Viewport Hero Container */}
      <section className="landing-hero-container" id="home">
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
          {/* Centered Hero Content */}
          <div className="landing-hero-content">
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
          </div>

          {/* Bottom Dashboard Preview Tray */}
          <div className="landing-dashboard-tray-wrapper">
            <div className="landing-dashboard-tray">
              <div className="landing-dashboard-grid">
                {/* Card 1: Character Dialogue Resonance */}
                <div className="landing-card landing-card-resonance">
                  <div className="landing-card-header">
                    <span className="landing-card-tag text-orange">Resonance</span>
                    <span className="landing-card-period">Crime & Punishment</span>
                  </div>

                  <div className="landing-card-metric-row">
                    <span className="landing-card-big-number">
                      {activeCard1Tab === 'resonance' ? '96.8%' : '1,420'}
                    </span>
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
                      {activeCard1Tab === 'resonance' ? '✦ Canonical' : '+48 Turns'}
                    </span>
                  </div>

                  <span className="landing-card-caption">Grounded in Chapter Text & Dialogue</span>

                  <div className="landing-card-gauge-section">
                    <span className="landing-card-gauge-label">
                      Persona Fidelity achieved
                    </span>
                    <RadialGauge
                      value={activeCard1Tab === 'resonance' ? 96 : 82}
                      color="#ef4d23"
                      showLabels
                      minLabel="0%"
                      maxLabel="100%"
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
                    <label className="landing-form-label">Simulated Character</label>
                    <div className="landing-form-select-btn">
                      <span>Rodion Raskolnikov (Mid-Book)</span>
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
                    <label className="landing-form-label">Daily Dialogue Allowance (Turns)</label>
                    <div className="landing-form-input-container">
                      <span className="landing-form-input-prefix">✦</span>
                      <input
                        type="number"
                        className="landing-form-input"
                        value={dailyTurnsTarget}
                        onChange={(e) => setDailyTurnsTarget(Number(e.target.value))}
                        aria-label="Daily Dialogue Allowance"
                      />
                    </div>
                  </div>

                  <div className="landing-form-group">
                    <label className="landing-form-label">Context memory (Tokens)</label>
                    <div className="landing-form-input-container">
                      <span className="landing-form-input-prefix">✦</span>
                      <input
                        type="number"
                        className="landing-form-input"
                        value={contextTokensTarget}
                        onChange={(e) => setContextTokensTarget(Number(e.target.value))}
                        aria-label="Context memory (Tokens)"
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
                    <span className="landing-card-period">Studio Neural TTS</span>
                  </div>

                  <div className="landing-card-metric-row">
                    <span className="landing-card-big-number">
                      {activeCard3Tab === 'audio' ? '24ms' : '98.5%'}
                    </span>
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
                      {activeCard3Tab === 'audio' ? 'Low Latency' : 'Fidelity'}
                    </span>
                  </div>

                  <span className="landing-card-caption">19th-Century Conversational Cadence</span>

                  <div className="landing-card-gauge-section">
                    <span className="landing-card-gauge-label">
                      Acoustic Naturalness
                    </span>
                    <RadialGauge
                      value={activeCard3Tab === 'audio' ? 94 : 88}
                      color="#ef4d23"
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

      {/* =========================================================================
          USE CASES SECTION: "BUILT FOR LITERATURE."
          ========================================================================= */}
      <section className="landing-usecases-section" id="use-cases" data-testid="landing-usecases-section">
        <div className="landing-usecases-container">
          <div className="landing-section-header">
            <span className="landing-script-tag">living literature in practice</span>
            <h2 className="landing-section-title">
              BUILT FOR <span className="text-orange">LITERATURE.</span>
            </h2>
            <div className="landing-taped-pill">
              <span>four ways readers, researchers, and creators converse with the classics.</span>
            </div>
          </div>

          <div className="landing-usecases-grid">
            {/* Case 1: Scholars & Exegesis */}
            <article className="usecase-card">
              <div className="usecase-frame-tab">
                <span className="frame-bracket">[ ]</span>
                <span className="frame-text">TEXTUAL-EXEGESIS.FRAME</span>
              </div>
              <div className="usecase-card-inner">
                <div className="usecase-card-meta">
                  <span className="usecase-num">01</span>
                  <span className="usecase-kicker">ACADEMIC RESEARCH & CRITICISM</span>
                </div>
                <h3 className="usecase-title">Ground-Truth Textual Exegesis</h3>
                <p className="usecase-desc">
                  Interrogate philosophical convictions and moral dilemmas directly with Dostoevsky, Austen, or Tolstoy. Every conversational response is anchored in verified book chunks with chapter citations and match fidelity.
                </p>
                <div className="usecase-interactive-widget widget-citation">
                  <div className="citation-quote-pill">
                    <span className="citation-quote-mark">“</span>
                    <span className="citation-quote-body">I am a sick man... I am a wicked man. An unattractive man.</span>
                  </div>
                  <div className="citation-match-tag">
                    <span className="citation-spark">✦</span>
                    <span>Notes from Underground — Chapter 1</span>
                    <strong className="citation-pct">96% Match</strong>
                  </div>
                </div>
              </div>
            </article>

            {/* Case 2: Readers & Literary Salon */}
            <article className="usecase-card">
              <div className="usecase-frame-tab">
                <span className="frame-bracket">[ ]</span>
                <span className="frame-text">SALON-DIALOGUE.FRAME</span>
              </div>
              <div className="usecase-card-inner">
                <div className="usecase-card-meta">
                  <span className="usecase-num">02</span>
                  <span className="usecase-kicker">IMMERSIVE READING ROOM</span>
                </div>
                <h3 className="usecase-title">Step Inside the Literary Salon</h3>
                <p className="usecase-desc">
                  Read from the inside out. Speak with secondary characters beside the St. Petersburg canals, examine unspoken motivations, and build ongoing memories across reading sessions.
                </p>
                <div className="usecase-interactive-widget widget-resonance">
                  <div className="resonance-gauge-wrap">
                    <RadialGauge
                      value={94}
                      color="#ef4d23"
                      showLabels={false}
                    />
                    <div className="resonance-gauge-info">
                      <span className="resonance-label">Persona Bond Resonance</span>
                      <span className="resonance-status">● 4 Active Character Bonds</span>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            {/* Case 3: Creative Writers & Voice Lab */}
            <article className="usecase-card">
              <div className="usecase-frame-tab">
                <span className="frame-bracket">[ ]</span>
                <span className="frame-text">COGNITIVE-LAB.FRAME</span>
              </div>
              <div className="usecase-card-inner">
                <div className="usecase-card-meta">
                  <span className="usecase-num">03</span>
                  <span className="usecase-kicker">VOICE & PERSONA DRIFT</span>
                </div>
                <h3 className="usecase-title">Cognitive Voice & State Laboratory</h3>
                <p className="usecase-desc">
                  Study dialogical tension and psychological nuance. Observe how character emotional baselines drift across hope, curiosity, and melancholy without breaking canonical persona rules.
                </p>
                <div className="usecase-interactive-widget widget-emotions">
                  <div className="emotion-drift-row">
                    <span className="emotion-name">Curiosity</span>
                    <div className="emotion-bar-track">
                      <div className="emotion-bar-fill fill-curiosity" style={{ width: '88%' }} />
                    </div>
                    <span className="emotion-val">88%</span>
                  </div>
                  <div className="emotion-drift-row">
                    <span className="emotion-name">Hope</span>
                    <div className="emotion-bar-track">
                      <div className="emotion-bar-fill fill-hope" style={{ width: '65%' }} />
                    </div>
                    <span className="emotion-val">65%</span>
                  </div>
                  <div className="emotion-drift-row">
                    <span className="emotion-name">Melancholy</span>
                    <div className="emotion-bar-track">
                      <div className="emotion-bar-fill fill-melancholy" style={{ width: '42%' }} />
                    </div>
                    <span className="emotion-val">42%</span>
                  </div>
                </div>
              </div>
            </article>

            {/* Case 4: Curators & Custom Archives */}
            <article className="usecase-card">
              <div className="usecase-frame-tab">
                <span className="frame-bracket">[ ]</span>
                <span className="frame-text">PRIVATE-ARCHIVES.FRAME</span>
              </div>
              <div className="usecase-card-inner">
                <div className="usecase-card-meta">
                  <span className="usecase-num">04</span>
                  <span className="usecase-kicker">PERSONAL SHELF INGESTION</span>
                </div>
                <h3 className="usecase-title">Bring Your Own Books to Life</h3>
                <p className="usecase-desc">
                  Ingest personal EPUBs, PDFs, and manuscripts into isolated Chroma vector namespaces. Our narrative classifier extracts characters, identifies chapters, and constructs cognitive dossiers in seconds.
                </p>
                <div className="usecase-interactive-widget widget-formats">
                  <div className="format-chips-row">
                    <span className="format-chip">EPUB</span>
                    <span className="format-chip">PDF</span>
                    <span className="format-chip">TXT</span>
                  </div>
                  <div className="pipeline-steps-row">
                    <span className="pipeline-step done">✓ Cover Gate</span>
                    <span className="pipeline-arrow">→</span>
                    <span className="pipeline-step done">✓ Chunker</span>
                    <span className="pipeline-arrow">→</span>
                    <span className="pipeline-step active">✦ Cast Ready</span>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* =========================================================================
          PRICING SECTION: "PICK YOUR PLAN."
          ========================================================================= */}
      <section className="landing-pricing-section" id="pricing" data-testid="landing-pricing-section">
        {/* Soft Dreamy Floating Sky Clouds matching Image 2 */}
        <div className="sky-cloud sky-cloud-1" aria-hidden="true" />
        <div className="sky-cloud sky-cloud-2" aria-hidden="true" />
        <div className="sky-cloud sky-cloud-3" aria-hidden="true" />
        <div className="sky-cloud sky-cloud-4" aria-hidden="true" />

        <div className="landing-pricing-container">
          <div className="landing-section-header pricing-header">
            <span className="landing-script-tag">cheaper than hiring</span>
            <h2 className="landing-section-title">
              PICK YOUR <span className="text-orange">PLAN.</span>
            </h2>
            <div className="landing-taped-pill">
              <span>one flat price. pause or cancel whenever.</span>
            </div>
          </div>

          {/* Master White Rounded Container */}
          <div className="pricing-master-card">
            {/* Top Controls Bar: Currency + Billing Switchers */}
            <div className="pricing-controls-bar">
              <div className="pricing-toggle-wrap">
                <span className="pricing-toggle-label">Currency:</span>
                <div className="pricing-pill-toggle">
                  <button
                    type="button"
                    className={`pricing-pill-btn ${currency === 'ETB' ? 'is-active' : ''}`}
                    onClick={() => setCurrency('ETB')}
                  >
                    <span className="currency-flag-dot">🇪🇹</span> ETB (Birr)
                  </button>
                  <button
                    type="button"
                    className={`pricing-pill-btn ${currency === 'USD' ? 'is-active' : ''}`}
                    onClick={() => setCurrency('USD')}
                  >
                    <span className="currency-flag-dot">🇺🇸</span> USD ($)
                  </button>
                </div>
              </div>

              <div className="pricing-toggle-wrap">
                <span className="pricing-toggle-label">Billing:</span>
                <div className="pricing-pill-toggle">
                  <button
                    type="button"
                    className={`pricing-pill-btn ${billingPeriod === 'monthly' ? 'is-active' : ''}`}
                    onClick={() => setBillingPeriod('monthly')}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    className={`pricing-pill-btn ${billingPeriod === 'yearly' ? 'is-active' : ''}`}
                    onClick={() => setBillingPeriod('yearly')}
                  >
                    Yearly <span className="pricing-discount-tag">-20%</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Main Featured Showcase matching Image 2 */}
            <div className="pricing-featured-showcase">
              <div className="pricing-showcase-left">
                <div className="pricing-showcase-tier-badge">
                  <span className="showcase-badge-pill">{selectedPlan.badge || 'RECOMMENDED TIER'}</span>
                  <h3 className="pricing-showcase-name">{selectedPlan.name}</h3>
                </div>

                <div className="pricing-showcase-price-box">
                  <span className="pricing-showcase-symbol">{currency === 'USD' ? '$' : ''}</span>
                  <span className="pricing-showcase-amount">{currentPlanPrice.amount.toLocaleString()}</span>
                  {currency === 'ETB' && <span className="pricing-showcase-suffix"> ETB</span>}
                  <span className="pricing-showcase-period">{currentPlanPrice.period}</span>
                </div>

                <p className="pricing-showcase-description">
                  {selectedPlan.description || 'Full cognitive persona simulations, custom book ingestion, and neural speech synthesis.'}
                </p>
              </div>

              <div className="pricing-showcase-right">
                <div className="pricing-founding-badge">
                  <span className="founding-pulse-dot" />
                  <span>Founding rate, ends soon</span>
                </div>

                <ul className="pricing-checklist">
                  {(selectedPlan.features && selectedPlan.features.length > 0
                    ? selectedPlan.features
                    : [
                        'Unlimited book shelf imports',
                        'Unlimited daily dialogue turns',
                        'HD Voice mode simulation',
                        'Dynamic emotional drift telemetry',
                      ]
                  ).map((feature, idx) => (
                    <li key={idx} className="pricing-checklist-item">
                      <span className="pricing-check-icon">✓</span>
                      <span className="pricing-check-text">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className="pricing-master-action-btn"
                  onClick={handleCtaClick}
                  data-testid="pricing-master-action-btn"
                >
                  <span>
                    {selectedPlan.price_monthly === 0 || selectedPlan.id === 'free'
                      ? 'Start Free'
                      : `Upgrade to ${selectedPlan.name}`}
                  </span>
                  <span className="pricing-btn-arrow">→</span>
                </button>
              </div>
            </div>

            {/* Comparison Strip: All Real Backend Plans (Excluding Free Starter, showing paid upgrades) */}
            <div className="pricing-strip-section">
              <div className="pricing-strip-header">
                <div>
                  <span className="pricing-strip-title">Compare All Available Membership Tiers</span>
                  <span className="pricing-strip-subtitle">Select any tier to inspect its full allowance</span>
                </div>
                {selectedPlanId !== 'free' && (
                  <button
                    type="button"
                    className="pricing-reset-free-btn"
                    onClick={() => setSelectedPlanId('free')}
                  >
                    ← View Free Reader Plan
                  </button>
                )}
              </div>

              <div className="pricing-tiers-grid">
                {plans
                  .filter((p) => p.id !== 'free' && (p.price_monthly > 0 || p.price > 0))
                  .map((p) => {
                    const pPrice = calculatePrice(p.price_monthly || 0);
                    const isCurrent = p.id === selectedPlanId;
                    const displayBadge = p.badge && p.badge !== 'YOUR CURRENT PLAN' ? p.badge : null;
                    return (
                      <div
                        key={p.id}
                        className={`pricing-tier-card ${isCurrent ? 'is-current' : ''}`}
                        onClick={() => setSelectedPlanId(p.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setSelectedPlanId(p.id);
                          }
                        }}
                      >
                        {displayBadge && (
                          <div className="tier-pill-badge">
                            <span>{displayBadge}</span>
                          </div>
                        )}
                        <h4 className="tier-card-heading">{p.name}</h4>
                        <div className="tier-card-price-row">
                          <span className="tier-card-amount">{pPrice.display}</span>
                          <span className="tier-card-period">{billingPeriod === 'yearly' ? '/mo (yr)' : '/mo'}</span>
                        </div>
                        <p className="tier-card-desc">{p.description}</p>
                        <button
                          type="button"
                          className={`tier-card-select-btn ${isCurrent ? 'is-selected' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPlanId(p.id);
                          }}
                        >
                          {isCurrent ? 'Selected Tier' : 'Inspect Tier'}
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FAQ SECTION: "THE NOSY SECTION"
          ========================================================================= */}
      <section className="landing-faq-section" id="faq" data-testid="landing-faq-section">
        {/* Soft Dreamy Floating Sky Clouds matching Image 1 */}
        <div className="sky-cloud sky-cloud-faq-1" aria-hidden="true" />
        <div className="sky-cloud sky-cloud-faq-2" aria-hidden="true" />
        <div className="sky-cloud sky-cloud-faq-3" aria-hidden="true" />

        <div className="landing-faq-container">
          <div className="landing-section-header faq-header">
            <span className="landing-script-tag">ask away</span>
            <h2 className="landing-section-title">THE NOSY SECTION</h2>
            <div className="landing-taped-pill">
              <span>everything you'd grill us on a call, minus the call.</span>
            </div>
          </div>

          <div className="landing-faq-list">
            {faqItems.map((item, idx) => {
              const isExpanded = expandedFaq === idx;
              return (
                <div key={item.frame} className={`faq-card-group ${isExpanded ? 'is-expanded' : ''}`}>
                  <div className="faq-frame-tab">
                    <span className="frame-bracket">[ ]</span>
                    <span className="frame-text">{item.frame}</span>
                  </div>
                  <div
                    className="faq-card"
                    onClick={() => toggleFaq(idx)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleFaq(idx);
                      }
                    }}
                    aria-expanded={isExpanded}
                    data-testid={`faq-item-${idx}`}
                  >
                    <div className="faq-card-header">
                      <div className="faq-card-left">
                        <span className="faq-num">{item.number}</span>
                        <span className="faq-question">{item.question}</span>
                        {item.hasUserTag && (
                          <span className="faq-user-badge" title="Live interaction">
                            <span className="badge-arrow">↖</span> You
                          </span>
                        )}
                      </div>
                      <div className="faq-card-toggle">
                        <span className="faq-toggle-icon">{isExpanded ? '−' : '+'}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="faq-card-body">
                        <div className="faq-divider" />
                        <p className="faq-answer-text">{item.answer}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          FOOTER SECTION: MAIN PARALLAX CONTAINER WITH OPEN FOLIO GRAPHIC
          ========================================================================= */}
      <section
        ref={parallaxRef}
        className="footer-parallax-section"
        id="footer"
        data-testid="footer-parallax-section"
      >
        {/* Soft Sky Atmosphere Clouds */}
        <div className="sky-cloud sky-cloud-footer-1" />
        <div className="sky-cloud sky-cloud-footer-2" />

        {/* 4. The Top-Aligned Footer Card */}
        <div className="footer-card-container">
          <motion.div
            className="footer-card"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            {/* Top Half */}
            <div className="footer-top-half">
              {/* Logo Area */}
              <div className="footer-logo-block">
                <div className="footer-brand-square">
                  <BrandLogo size={28} variant="white" />
                </div>
                <div className="footer-brand-text-col">
                  <span className="footer-brand-title">Lorely</span>
                  <span className="footer-brand-tagline">
                    Interactive Cognitive Casts. Step into the stories.
                  </span>
                </div>
              </div>

              {/* Links Area: 3 Columns of Real App Links */}
              <div className="footer-links-grid">
                <div className="footer-links-column">
                  <h5 className="footer-column-heading">Navigation</h5>
                  <ul className="footer-column-list">
                    <li><a href="#home" className="footer-link">Home</a></li>
                    <li><a href="#use-cases" className="footer-link">Use Cases</a></li>
                    <li><a href="#pricing" className="footer-link">Pricing Plans</a></li>
                    <li><a href="#faq" className="footer-link">FAQ</a></li>
                  </ul>
                </div>

                <div className="footer-links-column">
                  <h5 className="footer-column-heading">Platform</h5>
                  <ul className="footer-column-list">
                    <li>
                      <a
                        href="/library"
                        className="footer-link"
                        onClick={(e) => {
                          e.preventDefault();
                          handleCtaClick();
                        }}
                      >
                        Classical Library
                      </a>
                    </li>
                    <li>
                      <a
                        href="/characters"
                        className="footer-link"
                        onClick={(e) => {
                          e.preventDefault();
                          handleCtaClick();
                        }}
                      >
                        Character Gallery
                      </a>
                    </li>
                    <li>
                      <a
                        href="/conversations"
                        className="footer-link"
                        onClick={(e) => {
                          e.preventDefault();
                          handleCtaClick();
                        }}
                      >
                        Reading Conversations
                      </a>
                    </li>
                    <li><a href="#use-cases" className="footer-link">Voice Simulation</a></li>
                  </ul>
                </div>

                <div className="footer-links-column">
                  <h5 className="footer-column-heading">Reader Access</h5>
                  <ul className="footer-column-list">
                    <li>
                      <button
                        type="button"
                        className="footer-link footer-link-btn"
                        onClick={handleCtaClick}
                      >
                        Start Free
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        className="footer-link footer-link-btn"
                        onClick={handleSignInClick}
                      >
                        Sign In
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="footer-bottom-bar">
              <span className="footer-copyright-text">
                © 2026 Lorely. All Rights Reserved
              </span>

              <div className="footer-social-icons">
                {[
                  { name: 'Twitter', Icon: TwitterIcon, href: 'https://twitter.com' },
                  { name: 'Facebook', Icon: FacebookIcon, href: 'https://facebook.com' },
                  { name: 'Instagram', Icon: InstagramIcon, href: 'https://instagram.com' },
                  { name: 'LinkedIn', Icon: LinkedinIcon, href: 'https://linkedin.com' },
                ].map(({ name, Icon, href }) => (
                  <a
                    key={name}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={name}
                    className="footer-social-circle"
                  >
                    <Icon className="w-5 h-5" size={18} />
                  </a>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* 5. Parallax Literary Folio Graphic Layer */}
        <motion.div
          className="footer-parallax-foreground"
          style={{ y: yForeground }}
          aria-hidden="true"
        >
          <BookParallaxGraphic />
        </motion.div>
      </section>
    </div>
  );
}

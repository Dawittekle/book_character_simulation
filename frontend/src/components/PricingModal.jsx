import React, { useState, useEffect } from 'react';
import { lorelyApi } from '../services/lorelyApi';
import './PricingModal.css';

const DEFAULT_TIERS = [
  {
    id: 'free',
    slug: 'free',
    name: 'Free Reader',
    category: 'personal',
    price_monthly: 0,
    headline: 'Try Lorely',
    sub: 'See what literary AI and character dialogue can do.',
    features: [
      'Unlimited everyday text chats',
      'Access to standard classics',
      'Limited memory and storage',
      'Community support',
    ],
    badge: 'Your current plan',
  },
  {
    id: 'go',
    slug: 'go',
    name: 'Explorer',
    category: 'personal',
    price_monthly: 5,
    headline: 'Expanded access',
    sub: 'Chat more with extended character memory and voice.',
    features: [
      '10 personal shelf imports',
      '100 daily dialogue turns',
      'Expanded character memory',
      'Standard voice interactions',
      'Priority classification',
    ],
    badge: null,
  },
  {
    id: 'scholar',
    slug: 'scholar',
    name: 'Literary Scholar',
    category: 'personal',
    price_monthly: 20,
    headline: 'Advanced capabilities',
    sub: 'Deep cognitive simulations for literature & life.',
    features: [
      'Unlimited book shelf imports',
      'Unlimited daily dialogue turns',
      'HD Voice mode simulation',
      'Dynamic emotional drift telemetry',
      'Spoiler-gated RAG indexing',
      'Character memory sync across devices',
    ],
    badge: '✦ Most Popular',
  },
  {
    id: 'institution',
    slug: 'institution',
    name: 'Institutional Archive',
    category: 'business',
    price_monthly: 100,
    headline: 'Frontier intelligence',
    sub: 'Our most powerful models, agents, and namespaces.',
    features: [
      'Isolated Chroma vector namespace',
      'Multi-seat classroom & research access',
      'Custom persona & directive fine-tuning',
      'LMS & export integration',
      '24/7 dedicated support & SLA',
    ],
    badge: 'Frontier Intelligence',
  },
];

export default function PricingModal({ isOpen, onClose, accessToken, userPlan = 'free', userEmail = '' }) {
  const [plans, setPlans] = useState(DEFAULT_TIERS);
  const [category, setCategory] = useState('personal'); // 'personal' | 'business'
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [step, setStep] = useState('tiers'); // 'tiers' | 'checkout' | 'success'

  // Payment form state
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [billingRef, setBillingRef] = useState('');
  const [chosenModel, setChosenModel] = useState('gemini-3.5-flash');
  const [submitting, setSubmitting] = useState(false);
  const [submittedPayment, setSubmittedPayment] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setStep('tiers');
      setSelectedPlan(null);
      setErrorMessage('');
      return;
    }

    let mounted = true;
    async function loadPlans() {
      try {
        const res = await lorelyApi.getPlans(accessToken);
        if (mounted && res?.plans?.length) {
          setPlans(
            res.plans.map((p) => ({
              ...p,
              headline: p.category === 'business' ? 'Frontier intelligence' : p.slug === 'scholar' ? 'Advanced capabilities' : p.slug === 'go' ? 'Expanded access' : 'Try Lorely',
              sub: p.description || 'Deep cognitive simulations for literature & life.',
            }))
          );
        }
      } catch (err) {
        // Fall back to default tiers
      }
    }
    loadPlans();
    return () => {
      mounted = false;
    };
  }, [isOpen, accessToken]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredPlans = plans.filter((p) => p.category === category);

  const handleSelectPlan = (plan) => {
    if (plan.slug === userPlan) return;
    setSelectedPlan(plan);
    setCardholderName(userEmail.split('@')[0] || 'Literary Reader');
    setStep('checkout');
  };

  const handleAutofillDemo = () => {
    setCardNumber('4242 •••• •••• 4242');
    setExpiry('12/28');
    setCvc('789');
    setBillingRef('Scholar Subscription Demo Checkout');
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!selectedPlan) return;

    setSubmitting(true);
    setErrorMessage('');

    try {
      const payload = {
        plan_slug: selectedPlan.slug,
        amount: selectedPlan.price_monthly,
        payment_method: 'credit_card',
        chosen_model: chosenModel,
        payment_details: {
          cardholder_name: cardholderName,
          card_number: cardNumber || '4242424242424242',
          expiry: expiry || '12/28',
          notes: billingRef,
        },
      };

      const result = await lorelyApi.submitPayment(payload, accessToken);
      setSubmittedPayment(result);
      setStep('success');
    } catch (err) {
      setErrorMessage(err.message || 'Payment submission failed. Please verify your details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="pricing-modal-overlay"
      data-testid="pricing-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pricing-modal-container" role="dialog" aria-modal="true">
        <button
          type="button"
          className="pricing-modal-close-btn"
          onClick={onClose}
          aria-label="Close pricing modal"
        >
          ✕
        </button>

        {step === 'tiers' && (
          <>
            <header className="pricing-modal-header">
              <div className="pricing-category-pill-wrapper" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={category === 'personal'}
                  className={`pricing-category-btn ${category === 'personal' ? 'active' : ''}`}
                  onClick={() => setCategory('personal')}
                >
                  Personal
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={category === 'business'}
                  className={`pricing-category-btn ${category === 'business' ? 'active' : ''}`}
                  onClick={() => setCategory('business')}
                >
                  Business
                </button>
              </div>
            </header>

            <div className="pricing-cards-grid">
              {filteredPlans.map((plan) => {
                const isCurrent = plan.slug === userPlan;
                const isScholar = plan.slug === 'scholar';

                return (
                  <article
                    key={plan.id || plan.slug}
                    className={`pricing-card ${isScholar ? 'featured-card' : ''}`}
                  >
                    {plan.badge && (
                      <span className="pricing-card-badge">{plan.badge}</span>
                    )}

                    <h3 className="pricing-card-title">{plan.name}</h3>
                    <h4 className="pricing-card-headline">{plan.headline}</h4>
                    <p className="pricing-card-sub">{plan.sub}</p>

                    <div className="pricing-card-price-row">
                      {isScholar && (
                        <span className="pricing-card-old-price">$20</span>
                      )}
                      <span className="pricing-card-price">
                        ${isScholar ? '0' : plan.price_monthly}
                      </span>
                      <span className="pricing-card-period">/ month</span>
                    </div>

                    <button
                      type="button"
                      className={`pricing-card-action-btn ${
                        isCurrent
                          ? 'btn-current'
                          : isScholar
                          ? 'btn-featured'
                          : 'btn-standard'
                      }`}
                      onClick={() => handleSelectPlan(plan)}
                      disabled={isCurrent}
                    >
                      {isCurrent
                        ? 'Your current plan'
                        : isScholar
                        ? '✦ Claim free offer'
                        : 'Get started'}
                    </button>

                    <ul className="pricing-feature-list">
                      {plan.features?.map((f, i) => (
                        <li key={i} className="pricing-feature-item">
                          <span className="pricing-feature-icon">✓</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {step === 'checkout' && selectedPlan && (
          <div className="checkout-view-container">
            <div className="checkout-header">
              <div>
                <button
                  type="button"
                  className="checkout-back-btn"
                  onClick={() => setStep('tiers')}
                >
                  ← Back to Plans
                </button>
                <h2 style={{ margin: '8px 0 0', fontSize: '20px', color: '#FFFFFF' }}>
                  Upgrade to {selectedPlan.name}
                </h2>
              </div>
              <button
                type="button"
                className="quick-autofill-btn"
                onClick={handleAutofillDemo}
              >
                ⚡ Autofill Demo Card
              </button>
            </div>

            {errorMessage && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #EF4444',
                  color: '#F87171',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
              >
                {errorMessage}
              </div>
            )}

            <div className="checkout-grid">
              {/* Left Column: Plan Summary */}
              <div className="checkout-summary-box">
                <h3 className="checkout-plan-title">{selectedPlan.name}</h3>
                <div className="checkout-price-callout">
                  ${selectedPlan.price_monthly}
                  <span style={{ fontSize: '13px', color: '#8B949E', fontWeight: 500 }}>
                    {' '}/ month
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: '#8B949E', margin: 0 }}>
                  {selectedPlan.description || selectedPlan.sub}
                </p>

                <div className="form-group-block">
                  <label className="form-group-label" htmlFor="model-select">
                    Chosen AI Reasoning Engine
                  </label>
                  <select
                    id="model-select"
                    className="form-input-field"
                    value={chosenModel}
                    onChange={(e) => setChosenModel(e.target.value)}
                  >
                    <option value="gemini-3.5-flash">Gemini 3.5 Flash (Balanced & Fast)</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep Literary Dialect)</option>
                  </select>
                </div>

                <ul className="checkout-features-checklist">
                  {selectedPlan.features?.map((f, i) => (
                    <li key={i}>✓ {f}</li>
                  ))}
                </ul>
              </div>

              {/* Right Column: Payment Form */}
              <form className="checkout-form-box" onSubmit={handleSubmitPayment}>
                <div className="form-group-block">
                  <label className="form-group-label" htmlFor="cardholder-name">
                    Cardholder Full Name
                  </label>
                  <input
                    id="cardholder-name"
                    type="text"
                    className="form-input-field"
                    value={cardholderName}
                    onChange={(e) => setCardholderName(e.target.value)}
                    placeholder="Jane Austen"
                    required
                  />
                </div>

                <div className="form-group-block">
                  <label className="form-group-label" htmlFor="card-number">
                    Card Number
                  </label>
                  <input
                    id="card-number"
                    type="text"
                    className="form-input-field"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="4242 •••• •••• 4242"
                    required
                  />
                </div>

                <div className="form-row-split">
                  <div className="form-group-block">
                    <label className="form-group-label" htmlFor="card-expiry">
                      Expiration Date
                    </label>
                    <input
                      id="card-expiry"
                      type="text"
                      className="form-input-field"
                      value={expiry}
                      onChange={(e) => setExpiry(e.target.value)}
                      placeholder="MM/YY"
                      required
                    />
                  </div>

                  <div className="form-group-block">
                    <label className="form-group-label" htmlFor="card-cvc">
                      Security Code (CVC)
                    </label>
                    <input
                      id="card-cvc"
                      type="password"
                      maxLength={4}
                      className="form-input-field"
                      value={cvc}
                      onChange={(e) => setCvc(e.target.value)}
                      placeholder="123"
                      required
                    />
                  </div>
                </div>

                <div className="form-group-block">
                  <label className="form-group-label" htmlFor="billing-ref">
                    Billing Notes / Institutional Reference (Optional)
                  </label>
                  <input
                    id="billing-ref"
                    type="text"
                    className="form-input-field"
                    value={billingRef}
                    onChange={(e) => setBillingRef(e.target.value)}
                    placeholder="e.g. Department of Literature Research Grant"
                  />
                </div>

                <button
                  type="submit"
                  className="checkout-submit-btn"
                  disabled={submitting}
                >
                  {submitting
                    ? 'Submitting to Administrator...'
                    : `Submit Payment ($${selectedPlan.price_monthly})`}
                </button>
              </form>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="checkout-success-view">
            <div className="success-badge-circle">✓</div>
            <h2 className="success-title">Payment Submitted for Verification</h2>
            <p className="success-desc">
              Your payment for <strong>{submittedPayment?.plan_name || selectedPlan?.name}</strong> has been safely recorded with reference ID{' '}
              <code>{submittedPayment?.id?.slice(0, 14)}...</code>.
              <br />
              An administrator will verify your transaction shortly in the Operations Console. You will receive an in-app notification upon activation.
            </p>
            <button
              type="button"
              className="success-done-btn"
              onClick={onClose}
            >
              Return to App
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

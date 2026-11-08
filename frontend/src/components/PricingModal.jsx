import React, { useState, useEffect } from 'react';
import { lorelyApi } from '../services/lorelyApi';
import './PricingModal.css';

// Card brand detection by IIN prefix
export function detectCardBrand(number) {
  const clean = number.replace(/\D/g, '');
  if (!clean) return { brand: 'generic', name: 'Card' };
  if (/^4/.test(clean)) return { brand: 'visa', name: 'Visa' };
  if (/^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[01]\d|2720)/.test(clean))
    return { brand: 'mastercard', name: 'Mastercard' };
  if (/^3[47]/.test(clean)) return { brand: 'amex', name: 'American Express' };
  if (/^(6011|65|64[4-9]|622)/.test(clean))
    return { brand: 'discover', name: 'Discover' };
  return { brand: 'generic', name: 'Card' };
}

// Luhn algorithm check (Mod 10)
export function isValidCardNumber(number) {
  const clean = number.replace(/\D/g, '');
  if (clean.length < 13 || clean.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = parseInt(clean.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export function formatCardNumber(value, brand) {
  const clean = value.replace(/\D/g, '');
  if (brand === 'amex') {
    const limited = clean.slice(0, 15);
    const parts = [limited.slice(0, 4), limited.slice(4, 10), limited.slice(10, 15)].filter(Boolean);
    return parts.join(' ');
  }
  const limited = clean.slice(0, 16);
  const parts = [];
  for (let i = 0; i < limited.length; i += 4) {
    parts.push(limited.slice(i, i + 4));
  }
  return parts.join(' ');
}

export function formatExpiry(value) {
  const clean = value.replace(/\D/g, '').slice(0, 4);
  if (clean.length >= 3) {
    return `${clean.slice(0, 2)}/${clean.slice(2, 4)}`;
  }
  return clean;
}

export default function PricingModal({
  isOpen,
  onClose,
  accessToken,
  userPlan = 'free',
  userEmail = '',
}) {
  const [plans, setPlans] = useState([]);
  const [paymentConfig, setPaymentConfig] = useState({
    telebirr_phone: '+251 91 123 4567',
    telebirr_number: '+251 91 123 4567',
    telebirr_name: 'Dawit (Lorely Admin)',
    cbe_account: '1000123456789',
    cbe_account_number: '1000123456789',
    cbe_name: 'Dawit (Lorely Admin)',
    cbe_account_name: 'Dawit (Lorely Admin)',
    etb_rate: 135.0,
    instructions: 'Transfer the exact amount via Telebirr or CBE and submit your Transaction Reference code below.',
  });

  const [currency, setCurrency] = useState('USD'); // 'USD' | 'ETB'
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [step, setStep] = useState('tiers'); // 'tiers' | 'checkout' | 'success'

  // USD payment states
  const [usdMethod, setUsdMethod] = useState('card'); // 'card' | 'paypal'
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [billingRef, setBillingRef] = useState('');

  // ETB payment states
  const [etbMethod, setEtbMethod] = useState('telebirr'); // 'telebirr' | 'cbe'
  const [payerName, setPayerName] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [receiptImage, setReceiptImage] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [submittedPayment, setSubmittedPayment] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const cardBrand = detectCardBrand(cardNumber);
  const isCardLuhnValid = isValidCardNumber(cardNumber);

  // Load database plans and payment settings
  useEffect(() => {
    if (!isOpen) {
      setStep('tiers');
      setSelectedPlan(null);
      setErrorMessage('');
      setReceiptImage(null);
      setReceiptPreview('');
      return;
    }

    let mounted = true;
    async function loadData() {
      try {
        const [plansRes, configRes] = await Promise.all([
          lorelyApi.getPlans(accessToken).catch(() => ({ plans: [] })),
          lorelyApi.getPaymentConfig(accessToken).catch(() => ({})),
        ]);

        if (mounted) {
          if (plansRes?.plans?.length) {
            setPlans(plansRes.plans);
          }
          if (configRes && Object.keys(configRes).length > 0) {
            setPaymentConfig((prev) => ({ ...prev, ...configRes }));
          }
        }
      } catch (err) {
        // Handled gracefully
      }
    }
    loadData();
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

  const handleSelectPlan = (plan) => {
    if (plan.slug === userPlan) return;
    setSelectedPlan(plan);
    setCardholderName(userEmail ? userEmail.split('@')[0] : 'Reader');
    setPayerName(userEmail ? userEmail.split('@')[0] : 'Reader');
    setStep('checkout');
    setErrorMessage('');
  };

  const handleCopy = (text, key) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleReceiptUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Receipt image must be under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setReceiptPreview(reader.result);
      setReceiptImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleAutofillDemo = () => {
    if (currency === 'USD') {
      if (usdMethod === 'card') {
        setCardNumber('4242 4242 4242 4242');
        setExpiry('12/28');
        setCvc('123');
        setBillingRef('Literary Scholar Membership');
      } else {
        setPaypalEmail(userEmail || 'reader@example.com');
        setBillingRef('PAYPAL-DEMO-LORELY');
      }
    } else {
      setPayerName(userEmail ? userEmail.split('@')[0] : 'Dawit Haile');
      setPayerPhone('0911002233');
      setReferenceNumber(
        etbMethod === 'telebirr' ? `TB-${Date.now().toString().slice(-8)}` : `FT-${Date.now().toString().slice(-8)}`
      );
    }
  };

  const calculatePrice = (priceMonthly) => {
    if (currency === 'USD') {
      return {
        amount: priceMonthly,
        display: `$${priceMonthly}`,
        unit: '/ month',
      };
    }
    const rate = paymentConfig.etb_rate || 135;
    const etbAmount = Math.round(priceMonthly * rate);
    return {
      amount: etbAmount,
      display: `${etbAmount.toLocaleString()} ETB`,
      unit: '/ month',
    };
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!selectedPlan) return;

    setSubmitting(true);
    setErrorMessage('');

    try {
      const priceInfo = calculatePrice(selectedPlan.price_monthly);
      let paymentDetails = {};
      let paymentMethod = 'credit_card';

      if (currency === 'USD') {
        if (usdMethod === 'card') {
          paymentMethod = 'credit_card';
          paymentDetails = {
            cardholder_name: cardholderName,
            card_number: cardNumber.replace(/\s/g, ''),
            card_brand: cardBrand.name,
            expiry,
            cvc,
            notes: billingRef,
          };
        } else {
          paymentMethod = 'paypal';
          paymentDetails = {
            paypal_email: paypalEmail || userEmail,
            billing_reference: billingRef || 'PayPal Transaction',
          };
        }
      } else {
        paymentMethod = etbMethod; // 'telebirr' | 'cbe'
        paymentDetails = {
          payer_name: payerName,
          payer_phone: payerPhone,
          reference_number: referenceNumber,
          account_used:
            etbMethod === 'telebirr'
              ? paymentConfig.telebirr_number
              : paymentConfig.cbe_account_number,
          receipt_image: receiptImage,
          etb_rate: paymentConfig.etb_rate,
        };
      }

      const payload = {
        plan_slug: selectedPlan.slug,
        amount: priceInfo.amount,
        currency,
        payment_method: paymentMethod,
        payment_details: paymentDetails,
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
      onClick={onClose}
      data-testid="pricing-modal"
    >
      <div
        className="pricing-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="pricing-modal-close-btn"
          onClick={onClose}
          aria-label="Close pricing modal"
        >
          ✕
        </button>

        {/* STEP 1: PLANS TIERS GRID */}
        {step === 'tiers' && (
          <>
            <header className="pricing-modal-header">
              <div className="pricing-modal-title-box">
                <span className="pricing-modal-kicker">MEMBERSHIP TIERS</span>
                <h2 className="pricing-modal-heading">Choose Your Literary Journey</h2>
                <p className="pricing-modal-sub">
                  Select a plan to unlock extended cognitive memory, dialogue allowances, and speech synthesis.
                </p>
              </div>

              {/* Currency Selector */}
              <div className="pricing-currency-toggle" role="group" aria-label="Select currency">
                <button
                  type="button"
                  className={`currency-pill-btn ${currency === 'USD' ? 'active' : ''}`}
                  onClick={() => setCurrency('USD')}
                >
                  💵 USD ($)
                </button>
                <button
                  type="button"
                  className={`currency-pill-btn ${currency === 'ETB' ? 'active' : ''}`}
                  onClick={() => setCurrency('ETB')}
                >
                  🇪🇹 ETB (Birr)
                </button>
              </div>
            </header>

            <div className="pricing-cards-grid">
              {plans.map((plan) => {
                const isCurrent = plan.slug === userPlan;
                const price = calculatePrice(plan.price_monthly);
                const isPaid = plan.price_monthly > 0;

                return (
                  <article
                    key={plan.id || plan.slug}
                    className={`pricing-card ${plan.slug === 'scholar' ? 'featured-card' : ''}`}
                  >
                    {plan.badge && (
                      <span className="pricing-card-badge">{plan.badge}</span>
                    )}

                    <h3 className="pricing-card-title">{plan.name}</h3>
                    <p className="pricing-card-desc">{plan.description}</p>

                    <div className="pricing-card-price-row">
                      <span className="pricing-card-price">{price.display}</span>
                      <span className="pricing-card-period">{price.unit}</span>
                    </div>

                    <div className="pricing-card-quotas">
                      <div className="quota-tag">
                        <span>Books:</span>
                        <strong>{plan.book_quota}</strong>
                      </div>
                      <div className="quota-tag">
                        <span>Daily Turns:</span>
                        <strong>{plan.daily_messages}</strong>
                      </div>
                      <div className="quota-tag">
                        <span>Voice HD:</span>
                        <strong>{plan.voice_access ? 'Yes' : 'No'}</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`pricing-card-action-btn ${
                        isCurrent
                          ? 'btn-current'
                          : plan.slug === 'scholar'
                          ? 'btn-featured'
                          : 'btn-standard'
                      }`}
                      onClick={() => handleSelectPlan(plan)}
                      disabled={isCurrent || !isPaid}
                    >
                      {isCurrent
                        ? 'Your current plan'
                        : isPaid
                        ? `Upgrade to ${plan.name}`
                        : 'Free Standard Access'}
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

        {/* STEP 2: CHECKOUT & PAYMENT FORM */}
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
                <h2 className="checkout-main-title">
                  Upgrade to {selectedPlan.name}
                </h2>
              </div>

              <div className="checkout-top-actions">
                <div className="currency-badge-pill">
                  Currency: <strong>{currency}</strong>
                </div>
                <button
                  type="button"
                  className="quick-autofill-btn"
                  onClick={handleAutofillDemo}
                >
                  ⚡ Autofill Demo Details
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="checkout-error-banner" role="alert">
                {errorMessage}
              </div>
            )}

            <div className="checkout-grid">
              {/* Left Column: Plan Summary */}
              <div className="checkout-summary-box">
                <h3 className="checkout-plan-title">{selectedPlan.name}</h3>
                <div className="checkout-price-callout">
                  {calculatePrice(selectedPlan.price_monthly).display}
                  <span className="price-unit-sub"> / month</span>
                </div>
                <p className="checkout-desc">{selectedPlan.description}</p>

                <div className="checkout-plan-metrics">
                  <div className="metric-row">
                    <span>Personal Books:</span>
                    <strong>{selectedPlan.book_quota}</strong>
                  </div>
                  <div className="metric-row">
                    <span>Daily Dialogue Turns:</span>
                    <strong>{selectedPlan.daily_messages}</strong>
                  </div>
                  <div className="metric-row">
                    <span>Speech Synthesis:</span>
                    <strong>{selectedPlan.voice_access ? 'HD Neural Audio' : 'Standard'}</strong>
                  </div>
                </div>

                <ul className="checkout-features-checklist">
                  {selectedPlan.features?.map((f, i) => (
                    <li key={i}>✓ {f}</li>
                  ))}
                </ul>
              </div>

              {/* Right Column: Payment Details Form */}
              <div className="checkout-form-container">
                {/* Currency Method Switchers */}
                {currency === 'USD' ? (
                  <div className="payment-method-tabs">
                    <button
                      type="button"
                      className={`method-tab-btn ${usdMethod === 'card' ? 'active' : ''}`}
                      onClick={() => setUsdMethod('card')}
                    >
                      💳 Credit / Debit Card
                    </button>
                    <button
                      type="button"
                      className={`method-tab-btn ${usdMethod === 'paypal' ? 'active' : ''}`}
                      onClick={() => setUsdMethod('paypal')}
                    >
                      🅿️ PayPal
                    </button>
                  </div>
                ) : (
                  <div className="payment-method-tabs etb-tabs">
                    <button
                      type="button"
                      className={`method-tab-btn ${etbMethod === 'telebirr' ? 'active' : ''}`}
                      onClick={() => setEtbMethod('telebirr')}
                    >
                      📱 Telebirr
                    </button>
                    <button
                      type="button"
                      className={`method-tab-btn ${etbMethod === 'cbe' ? 'active' : ''}`}
                      onClick={() => setEtbMethod('cbe')}
                    >
                      🏦 CBE (Commercial Bank)
                    </button>
                  </div>
                )}

                <form className="checkout-form-box" onSubmit={handleSubmitPayment}>
                  {/* USD CARD FLOW */}
                  {currency === 'USD' && usdMethod === 'card' && (
                    <>
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
                        <div className="label-with-brand">
                          <label className="form-group-label" htmlFor="card-number">
                            Card Number
                          </label>
                          <div className="brand-badges-row">
                            <span className={`brand-chip ${cardBrand.brand === 'visa' ? 'chip-active' : ''}`}>
                              Visa
                            </span>
                            <span className={`brand-chip ${cardBrand.brand === 'mastercard' ? 'chip-active' : ''}`}>
                              Mastercard
                            </span>
                            <span className={`brand-chip ${cardBrand.brand === 'amex' ? 'chip-active' : ''}`}>
                              Amex
                            </span>
                          </div>
                        </div>

                        <div className="card-input-wrapper">
                          <input
                            id="card-number"
                            type="text"
                            className={`form-input-field card-num-input ${
                              cardNumber && isCardLuhnValid ? 'input-valid' : ''
                            }`}
                            value={cardNumber}
                            onChange={(e) => {
                              const brand = detectCardBrand(e.target.value).brand;
                              setCardNumber(formatCardNumber(e.target.value, brand));
                            }}
                            placeholder="4242 •••• •••• 4242"
                            required
                          />
                          {cardNumber.length >= 15 && (
                            <span className={`luhn-indicator ${isCardLuhnValid ? 'valid' : 'invalid'}`}>
                              {isCardLuhnValid ? '✓ Valid' : '⚠️ Incomplete'}
                            </span>
                          )}
                        </div>
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
                            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                            placeholder="MM/YY"
                            maxLength={5}
                            required
                          />
                        </div>

                        <div className="form-group-block">
                          <label className="form-group-label" htmlFor="card-cvc">
                            Security Code ({cardBrand.brand === 'amex' ? '4 digits' : 'CVC'})
                          </label>
                          <input
                            id="card-cvc"
                            type="password"
                            className="form-input-field"
                            value={cvc}
                            onChange={(e) => setCvc(e.target.value.replace(/\D/g, ''))}
                            placeholder={cardBrand.brand === 'amex' ? '1234' : '123'}
                            maxLength={cardBrand.brand === 'amex' ? 4 : 3}
                            required
                          />
                        </div>
                      </div>

                      <div className="form-group-block">
                        <label className="form-group-label" htmlFor="billing-ref">
                          Billing Notes (Optional)
                        </label>
                        <input
                          id="billing-ref"
                          type="text"
                          className="form-input-field"
                          value={billingRef}
                          onChange={(e) => setBillingRef(e.target.value)}
                          placeholder="e.g. Personal Reader Subscription"
                        />
                      </div>
                    </>
                  )}

                  {/* USD PAYPAL FLOW */}
                  {currency === 'USD' && usdMethod === 'paypal' && (
                    <div className="paypal-checkout-block">
                      <div className="paypal-banner">
                        <span className="paypal-icon">🅿️</span>
                        <div>
                          <strong>PayPal Express Checkout</strong>
                          <p>Submit your PayPal account details to verify your recurring subscription.</p>
                        </div>
                      </div>

                      <div className="form-group-block">
                        <label className="form-group-label" htmlFor="paypal-email">
                          PayPal Account Email
                        </label>
                        <input
                          id="paypal-email"
                          type="email"
                          className="form-input-field"
                          value={paypalEmail}
                          onChange={(e) => setPaypalEmail(e.target.value)}
                          placeholder="reader@paypal.me"
                          required
                        />
                      </div>

                      <div className="form-group-block">
                        <label className="form-group-label" htmlFor="paypal-ref">
                          PayPal Transaction / Order Reference (Optional)
                        </label>
                        <input
                          id="paypal-ref"
                          type="text"
                          className="form-input-field"
                          value={billingRef}
                          onChange={(e) => setBillingRef(e.target.value)}
                          placeholder="e.g. PP-99882233"
                        />
                      </div>
                    </div>
                  )}

                  {/* ETB TELEBIRR & CBE FLOW */}
                  {currency === 'ETB' && (
                    <div className="etb-checkout-block">
                      {/* Admin Account Callout Box */}
                      <div className="etb-account-card">
                        <div className="etb-account-badge">
                          {etbMethod === 'telebirr' ? '📱 TELEBIRR ACCOUNT' : '🏦 CBE ACCOUNT'}
                        </div>

                        <div className="account-details-group">
                          <div className="account-detail-item">
                            <span className="account-label">
                              {etbMethod === 'telebirr' ? 'Telebirr Number:' : 'CBE Account Number:'}
                            </span>
                            <div className="account-number-copy-row">
                              <strong className="account-number-val">
                                {etbMethod === 'telebirr'
                                  ? (paymentConfig.telebirr_phone || paymentConfig.telebirr_number)
                                  : (paymentConfig.cbe_account || paymentConfig.cbe_account_number)}
                              </strong>
                              <button
                                type="button"
                                className="copy-num-btn"
                                onClick={() =>
                                  handleCopy(
                                    etbMethod === 'telebirr'
                                      ? (paymentConfig.telebirr_phone || paymentConfig.telebirr_number)
                                      : (paymentConfig.cbe_account || paymentConfig.cbe_account_number),
                                    'account'
                                  )
                                }
                              >
                                {copiedKey === 'account' ? '✓ Copied' : '📋 Copy'}
                              </button>
                            </div>
                          </div>

                          <div className="account-detail-item">
                            <span className="account-label">Account Holder:</span>
                            <span className="account-holder-name">
                              {etbMethod === 'telebirr'
                                ? paymentConfig.telebirr_name
                                : (paymentConfig.cbe_name || paymentConfig.cbe_account_name)}
                            </span>
                          </div>

                          <div className="account-detail-item">
                            <span className="account-label">Amount to Transfer:</span>
                            <strong className="amount-highlight">
                              {calculatePrice(selectedPlan.price_monthly).display}
                            </strong>
                          </div>
                        </div>

                        <p className="account-step-instructions">
                          {etbMethod === 'telebirr'
                            ? paymentConfig.telebirr_instructions ||
                              'Transfer the exact amount via Telebirr and submit your Transaction Reference code below.'
                            : paymentConfig.cbe_instructions ||
                              'Deposit or transfer to the CBE account and provide the transaction FT reference number.'}
                        </p>
                      </div>

                      {/* ETB Payer Details Form */}
                      <div className="form-group-block">
                        <label className="form-group-label" htmlFor="etb-payer-name">
                          Sender Full Name (Account Name)
                        </label>
                        <input
                          id="etb-payer-name"
                          type="text"
                          className="form-input-field"
                          value={payerName}
                          onChange={(e) => setPayerName(e.target.value)}
                          placeholder="e.g. Abebe Bikila"
                          required
                        />
                      </div>

                      <div className="form-row-split">
                        <div className="form-group-block">
                          <label className="form-group-label" htmlFor="etb-payer-phone">
                            Sender Phone Number (Optional)
                          </label>
                          <input
                            id="etb-payer-phone"
                            type="tel"
                            className="form-input-field"
                            value={payerPhone}
                            onChange={(e) => setPayerPhone(e.target.value)}
                            placeholder="0911..."
                          />
                        </div>

                        <div className="form-group-block">
                          <label className="form-group-label" htmlFor="etb-ref-number">
                            Transaction / Reference ID
                          </label>
                          <input
                            id="etb-ref-number"
                            type="text"
                            className="form-input-field"
                            value={referenceNumber}
                            onChange={(e) => setReferenceNumber(e.target.value)}
                            placeholder={etbMethod === 'telebirr' ? 'e.g. TB12345678' : 'e.g. FT230123...'}
                            required
                          />
                        </div>
                      </div>

                      {/* Optional Receipt Screenshot Upload */}
                      <div className="form-group-block">
                        <label className="form-group-label" htmlFor="receipt-screenshot">
                          Transfer Screenshot / Receipt Photo (Optional)
                        </label>
                        <input
                          id="receipt-screenshot"
                          type="file"
                          accept="image/*"
                          className="form-input-file"
                          onChange={handleReceiptUpload}
                        />

                        {receiptPreview && (
                          <div className="receipt-preview-box">
                            <img src={receiptPreview} alt="Receipt preview" className="receipt-img-thumb" />
                            <button
                              type="button"
                              className="remove-receipt-btn"
                              onClick={() => {
                                setReceiptImage(null);
                                setReceiptPreview('');
                              }}
                            >
                              ✕ Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="checkout-submit-btn"
                    disabled={submitting}
                  >
                    {submitting
                      ? 'Submitting Payment...'
                      : `Submit Payment (${calculatePrice(selectedPlan.price_monthly).display})`}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: SUBMISSION SUCCESS VIEW */}
        {step === 'success' && (
          <div className="checkout-success-view">
            <div className="success-badge-circle">✓</div>
            <h2 className="success-title">Payment Submitted for Verification</h2>
            <p className="success-desc">
              Your payment for <strong>{selectedPlan?.name}</strong> has been safely recorded with reference ID{' '}
              <code>{submittedPayment?.id?.slice(0, 16)}...</code>.
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

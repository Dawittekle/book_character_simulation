import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { lorelyApi } from '../../services/lorelyApi';
import './AdminSettings.css';

export default function AdminSettings() {
  const { accessToken } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  const [paymentConfig, setPaymentConfig] = useState({
    telebirr_phone: '+251 91 123 4567',
    telebirr_name: 'Dawit (Lorely Admin)',
    cbe_account: '1000123456789',
    cbe_name: 'Dawit (Lorely Admin)',
    etb_rate: 135.0,
    instructions: 'Transfer the exact amount via Telebirr or CBE and submit your Transaction Reference code below.',
  });

  const [platformHealth, setPlatformHealth] = useState({
    status: 'Operational',
    db_connected: true,
    llm_provider: 'gemini (gemini-3.5-flash / fallback ladder)',
    vector_store: 'ChromaDB semantic indexing active',
  });

  useEffect(() => {
    let mounted = true;
    async function fetchConfig() {
      try {
        const cfg = await lorelyApi.getPaymentConfig(accessToken);
        if (mounted && cfg && Object.keys(cfg).length > 0) {
          setPaymentConfig((prev) => ({
            ...prev,
            telebirr_phone: cfg.telebirr_phone || cfg.telebirr_number || prev.telebirr_phone,
            telebirr_name: cfg.telebirr_name || prev.telebirr_name,
            cbe_account: cfg.cbe_account || cfg.cbe_account_number || prev.cbe_account,
            cbe_name: cfg.cbe_name || cfg.cbe_account_name || prev.cbe_name,
            etb_rate: cfg.etb_rate ?? prev.etb_rate,
            instructions: cfg.instructions || cfg.telebirr_instructions || prev.instructions,
          }));
        }
      } catch (err) {
        console.warn('Could not load payment settings from API:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchConfig();
    return () => {
      mounted = false;
    };
  }, [accessToken]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage({ type: '', text: '' });

    try {
      const payload = {
        telebirr_phone: String(paymentConfig.telebirr_phone || '').trim(),
        telebirr_name: String(paymentConfig.telebirr_name || '').trim(),
        cbe_account: String(paymentConfig.cbe_account || '').trim(),
        cbe_name: String(paymentConfig.cbe_name || '').trim(),
        etb_rate: parseFloat(paymentConfig.etb_rate) || 135.0,
        instructions: String(paymentConfig.instructions || '').trim(),
      };

      const updated = await lorelyApi.adminUpdatePaymentConfig(payload, accessToken);
      setPaymentConfig((prev) => ({ ...prev, ...updated }));
      setStatusMessage({
        type: 'success',
        text: 'Bank accounts, Telebirr details, and ETB exchange rate updated successfully!',
      });
      setTimeout(() => setStatusMessage({ type: '', text: '' }), 5000);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: `Update failed: ${err.message || 'Server error'}`,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-settings-view" data-testid="admin-settings">
      <header className="settings-header-line">
        <div>
          <h1 className="settings-title">System & Payment Settings</h1>
          <p className="settings-sub">
            Manage administrative bank accounts, Telebirr reception numbers, CBE transfer accounts, and currency conversion parameters.
          </p>
        </div>
      </header>

      {statusMessage.text && (
        <div
          className={`settings-toast ${statusMessage.type === 'error' ? 'toast-error' : 'toast-success'}`}
          role="status"
        >
          {statusMessage.type === 'error' ? '⚠️ ' : '✓ '}
          {statusMessage.text}
        </div>
      )}

      <div className="settings-cards-grid">
        {/* Card 1: Bank & Telebirr Accounts */}
        <section className="settings-panel-card">
          <div className="card-section-head">
            <div className="card-icon-title">
              <span className="section-icon">🏦</span>
              <div>
                <h2 className="section-heading">Ethiopian Bank & Mobile Money</h2>
                <p className="section-desc">
                  These details are displayed to readers in Ethiopia when upgrading via ETB (Birr).
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="settings-accounts-form">
            <div className="form-group-cluster">
              <h3 className="cluster-title">📱 Telebirr Account</h3>
              <div className="settings-input-row">
                <div className="form-field-unit">
                  <label htmlFor="setting-tb-phone">Telebirr Mobile / Phone Number</label>
                  <input
                    id="setting-tb-phone"
                    type="text"
                    value={paymentConfig.telebirr_phone}
                    onChange={(e) =>
                      setPaymentConfig({ ...paymentConfig, telebirr_phone: e.target.value })
                    }
                    placeholder="+251 91 123 4567"
                    required
                  />
                  <span className="field-caption">Readers will send money directly to this number.</span>
                </div>
                <div className="form-field-unit">
                  <label htmlFor="setting-tb-name">Telebirr Account Holder Name</label>
                  <input
                    id="setting-tb-name"
                    type="text"
                    value={paymentConfig.telebirr_name}
                    onChange={(e) =>
                      setPaymentConfig({ ...paymentConfig, telebirr_name: e.target.value })
                    }
                    placeholder="Dawit (Lorely Admin)"
                    required
                  />
                  <span className="field-caption">Displayed so users can verify your recipient identity.</span>
                </div>
              </div>
            </div>

            <div className="form-group-cluster">
              <h3 className="cluster-title">🏛️ Commercial Bank of Ethiopia (CBE)</h3>
              <div className="settings-input-row">
                <div className="form-field-unit">
                  <label htmlFor="setting-cbe-acct">CBE Account Number</label>
                  <input
                    id="setting-cbe-acct"
                    type="text"
                    value={paymentConfig.cbe_account}
                    onChange={(e) =>
                      setPaymentConfig({ ...paymentConfig, cbe_account: e.target.value })
                    }
                    placeholder="1000123456789"
                    required
                  />
                  <span className="field-caption">Official 13-digit CBE bank account for direct deposits.</span>
                </div>
                <div className="form-field-unit">
                  <label htmlFor="setting-cbe-name">CBE Account Holder Name</label>
                  <input
                    id="setting-cbe-name"
                    type="text"
                    value={paymentConfig.cbe_name}
                    onChange={(e) =>
                      setPaymentConfig({ ...paymentConfig, cbe_name: e.target.value })
                    }
                    placeholder="Dawit (Lorely Admin)"
                    required
                  />
                  <span className="field-caption">Recipient name matching your bank statement.</span>
                </div>
              </div>
            </div>

            <div className="form-group-cluster">
              <h3 className="cluster-title">💱 Currency Conversion</h3>
              <div className="settings-input-row">
                <div className="form-field-unit">
                  <label htmlFor="setting-etb-rate">ETB Exchange Rate (1 USD = X ETB)</label>
                  <input
                    id="setting-etb-rate"
                    type="number"
                    step="0.5"
                    min="1"
                    value={paymentConfig.etb_rate}
                    onChange={(e) =>
                      setPaymentConfig({ ...paymentConfig, etb_rate: e.target.value })
                    }
                    placeholder="135.0"
                    required
                  />
                  <span className="field-caption">
                    Current rate: $20/mo Literary Scholar = {(20 * (paymentConfig.etb_rate || 135)).toLocaleString()} ETB.
                  </span>
                </div>
              </div>
            </div>

            <div className="form-group-cluster">
              <h3 className="cluster-title">📝 User Instructions</h3>
              <div className="form-field-unit">
                <label htmlFor="setting-instructions">Transfer Instructions Displayed to Readers</label>
                <textarea
                  id="setting-instructions"
                  rows="3"
                  value={paymentConfig.instructions}
                  onChange={(e) =>
                    setPaymentConfig({ ...paymentConfig, instructions: e.target.value })
                  }
                  placeholder="Transfer instructions..."
                />
              </div>
            </div>

            <div className="settings-form-actions">
              <button
                type="submit"
                className="btn-save-settings"
                disabled={saving}
              >
                {saving ? 'Updating Settings...' : '💾 Save & Publish Bank Details'}
              </button>
            </div>
          </form>
        </section>

        {/* Card 2: Platform Status & System Health */}
        <section className="settings-panel-card status-panel">
          <div className="card-section-head">
            <div className="card-icon-title">
              <span className="section-icon">🛡️</span>
              <div>
                <h2 className="section-heading">System Telemetry & Architecture</h2>
                <p className="section-desc">Live status of backend services, database connectors, and AI models.</p>
              </div>
            </div>
          </div>

          <div className="telemetry-item-list">
            <div className="telemetry-item">
              <span className="telemetry-label">Backend API Status</span>
              <span className="telemetry-badge badge-active">● Operational (Port 5000)</span>
            </div>
            <div className="telemetry-item">
              <span className="telemetry-label">Primary AI Model Engine</span>
              <span className="telemetry-val">Gemini 3.5 Flash (with automatic fallback)</span>
            </div>
            <div className="telemetry-item">
              <span className="telemetry-label">Relational Database Engine</span>
              <span className="telemetry-badge badge-active">● PostgreSQL Connected</span>
            </div>
            <div className="telemetry-item">
              <span className="telemetry-label">RAG Vector Index</span>
              <span className="telemetry-val">ChromaDB semantic memory namespace</span>
            </div>
            <div className="telemetry-item">
              <span className="telemetry-label">Payment Processing</span>
              <span className="telemetry-val">Manual Verification + Telebirr/CBE + Card</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

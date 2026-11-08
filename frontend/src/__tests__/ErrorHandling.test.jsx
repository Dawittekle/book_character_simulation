import { describe, it, expect } from 'vitest';
import { getFriendlyErrorMessage } from '../lib/errorUtils';

describe('Friendly Error Message Translation Layer', () => {
  it('translates network failures and Failed to fetch into plain English server connection advice', () => {
    const error1 = new Error('Failed to fetch');
    const msg1 = getFriendlyErrorMessage(error1);
    expect(msg1).toContain('Unable to reach the Lorely server');
    expect(msg1).not.toContain('Failed to fetch');

    const error2 = new TypeError('Load failed');
    expect(getFriendlyErrorMessage(error2)).toContain('Unable to reach the Lorely server');
  });

  it('translates non-narrative / resume rejections into friendly guidance mentioning Force extraction', () => {
    const err = new Error('This document appears to be a resume or cover letter rather than a literary work.');
    const msg = getFriendlyErrorMessage(err);
    expect(msg).toContain('resume or non-narrative');
    expect(msg).toContain('Force extraction');
  });

  it('translates unsupported file extensions into supported formats (.pdf, .epub, .txt)', () => {
    const err = new Error('Invalid file extension .exe');
    const msg = getFriendlyErrorMessage(err);
    expect(msg).toContain('.pdf, .epub, or .txt');
  });

  it('translates file size limit errors', () => {
    const err = new Error('File exceeds maximum size of 50MB');
    const msg = getFriendlyErrorMessage(err);
    expect(msg).toContain('50MB');
  });

  it('translates auth / session expiration into clear sign-in advice', () => {
    const err = new Error('Authentication required.');
    const msg = getFriendlyErrorMessage(err);
    expect(msg).toContain('session has expired');
  });

  it('translates rate limit or quota exceeded into high traffic notice', () => {
    const err = new Error('Gemini quota or rate limit reached 429');
    const msg = getFriendlyErrorMessage(err);
    expect(msg).toContain('high traffic');
  });
});

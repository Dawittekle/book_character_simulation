/**
 * Translates technical error messages (e.g. "Failed to fetch", CORS rejections,
 * classification blocks, rate limits) into clear, friendly guidance for non-technical readers.
 */
export function getFriendlyErrorMessage(err, context = {}) {
  if (!err) {
    return 'An unexpected issue occurred. Please try again.';
  }

  const raw = (typeof err === 'string' ? err : err.message || '').trim();
  const lower = raw.toLowerCase();

  // 1. Network / Server offline / CORS / Failed to fetch
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('connection refused') ||
    lower.includes('load failed') ||
    lower.includes('err_connection_refused')
  ) {
    return 'Unable to reach the Lorely server. Please check that your backend service is running or check your internet connection.';
  }

  // 2. Document classification: Resume / Cover letter / Non-narrative
  if (
    lower.includes('resume') ||
    lower.includes('cover letter') ||
    lower.includes('non_narrative') ||
    lower.includes('curriculum vitae') ||
    lower.includes('not a literary or narrative text') ||
    lower.includes('not a narrative') ||
    lower.includes('technical document')
  ) {
    return 'This document appears to be a resume or non-narrative document. Lorely is designed for stories and literary books so your characters have rich dialogue and storylines. You can check "Force extraction" below to proceed anyway.';
  }

  // 3. Document format / parsing issues
  if (
    lower.includes('unsupported') ||
    lower.includes('invalid file extension') ||
    lower.includes('corrupted') ||
    lower.includes('unreadable')
  ) {
    return 'This file format could not be read. Please upload a standard story file (.pdf, .epub, or .txt).';
  }

  // 4. File size limit
  if (lower.includes('too large') || lower.includes('maximum size') || lower.includes('50mb')) {
    return 'This file exceeds the 50MB size limit. Please choose a shorter manuscript or story extract.';
  }

  // 5. Auth / Session expiration
  if (
    lower.includes('authentication required') ||
    lower.includes('unauthorized') ||
    lower.includes('invalid token')
  ) {
    return 'Your reader session has expired. Please sign in to save private uploads to your personal library.';
  }

  // 6. Quota / Rate limit
  if (lower.includes('quota') || lower.includes('rate limit') || lower.includes('429')) {
    return 'The AI service is experiencing high traffic or reached a temporary limit. Please wait a few moments and try again.';
  }

  // 7. Fallback clean message
  return raw.replace(/^Error:\s*/i, '') || 'The request could not be completed. Please try again.';
}

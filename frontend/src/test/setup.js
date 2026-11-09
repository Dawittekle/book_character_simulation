import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

if (typeof window !== 'undefined' && window.HTMLElement) {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
}

if (typeof window !== 'undefined') {
  if (!window.IntersectionObserver) {
    window.IntersectionObserver = class {
      constructor() {}
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  if (!window.speechSynthesis) {
    window.speechSynthesis = {
      speak: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      getVoices: vi.fn().mockReturnValue([
        { name: 'Google US English', lang: 'en-US', default: true },
        { name: 'Google UK English Female', lang: 'en-GB' },
        { name: 'Google UK English Male', lang: 'en-GB' },
      ]),
      onvoiceschanged: null,
      speaking: false,
      paused: false,
      pending: false,
    };
  }
  if (!window.SpeechSynthesisUtterance) {
    window.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text || '';
        this.voice = null;
        this.pitch = 1;
        this.rate = 1;
        this.volume = 1;
        this.onstart = null;
        this.onend = null;
        this.onerror = null;
        this.onboundary = null;
      }
    };
  }
}

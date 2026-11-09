/**
 * Lorely Browser Speech Synthesis Service
 * Provides free, zero-cost, offline-capable natural character voice reading
 * using the browser's built-in Web Speech API (window.speechSynthesis).
 */

class SpeechSynthesisService {
  constructor() {
    this.voices = [];
    this.currentUtterance = null;
    this.isSpeaking = false;
    this.initVoices();
  }

  isSupported() {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof window.SpeechSynthesisUtterance !== 'undefined'
    );
  }

  initVoices() {
    if (!this.isSupported()) return;
    try {
      this.voices = window.speechSynthesis.getVoices() || [];
      if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
        window.speechSynthesis.onvoiceschanged = () => {
          this.voices = window.speechSynthesis.getVoices() || [];
        };
      }
    } catch {
      this.voices = [];
    }
  }

  getVoices() {
    if (!this.isSupported()) return [];
    if (!this.voices || this.voices.length === 0) {
      this.voices = window.speechSynthesis.getVoices() || [];
    }
    return this.voices;
  }

  selectVoice({ characterName = '', gender = '', voiceId = '', language = 'en' } = {}) {
    const voices = this.getVoices();
    if (!voices || voices.length === 0) return null;

    const langPrefix = (language || 'en').toLowerCase().slice(0, 2);
    const langVoices = voices.filter(
      (v) => v.lang && v.lang.toLowerCase().startsWith(langPrefix)
    );
    const pool = langVoices.length > 0 ? langVoices : voices;

    const lowerName = (characterName || '').toLowerCase();
    const isFemale =
      (gender || '').toLowerCase() === 'female' ||
      ['nastenka', 'nástyenka', 'elizabeth', 'elena', 'jane', 'mary', 'catherine', 'lydia'].some((n) =>
        lowerName.includes(n)
      ) ||
      ['nova', 'shimmer'].includes((voiceId || '').toLowerCase());

    const isMale =
      (gender || '').toLowerCase() === 'male' ||
      ['astafy', 'dreamer', 'darcy', 'raskolnikov', 'emelyan', 'bingley', 'wickham', 'collins'].some((n) =>
        lowerName.includes(n)
      ) ||
      ['onyx', 'echo', 'fable'].includes((voiceId || '').toLowerCase());

    if (isFemale) {
      const femaleVoice = pool.find((v) => {
        const n = (v.name || '').toLowerCase();
        return (
          n.includes('female') ||
          n.includes('woman') ||
          n.includes('samantha') ||
          n.includes('victoria') ||
          n.includes('zira') ||
          n.includes('karen') ||
          n.includes('fiona')
        );
      });
      if (femaleVoice) return femaleVoice;
    }

    if (isMale) {
      const maleVoice = pool.find((v) => {
        const n = (v.name || '').toLowerCase();
        return (
          n.includes('male') ||
          n.includes('man') ||
          n.includes('david') ||
          n.includes('george') ||
          n.includes('alex') ||
          n.includes('daniel') ||
          n.includes('oliver')
        );
      });
      if (maleVoice) return maleVoice;
    }

    return pool.find((v) => v.default) || pool[0];
  }

  getCharacterVoiceTuning(characterName = '') {
    const name = (characterName || '').toLowerCase();
    if (name.includes('nastenka') || name.includes('nástyenka')) {
      return { pitch: 1.12, rate: 0.98 }; // Young, emotional, lyrical
    }
    if (name.includes('dreamer')) {
      return { pitch: 0.96, rate: 0.92 }; // Poetic, contemplative
    }
    if (name.includes('astafy')) {
      return { pitch: 0.88, rate: 0.90 }; // Older, weathered, measured
    }
    if (name.includes('raskolnikov')) {
      return { pitch: 0.92, rate: 0.96 }; // Intense, nervous
    }
    if (name.includes('elizabeth')) {
      return { pitch: 1.06, rate: 1.0 }; // Sharp, articulate, warm
    }
    return { pitch: 1.0, rate: 1.0 };
  }

  cleanSpeechText(rawText) {
    if (!rawText) return '';
    return rawText
      .replace(/\[Chapter \d+[^\]]*\]/gi, '') // Strip chapter citations
      .replace(/\[[^\]]*\]/g, '') // Strip generic brackets
      .replace(/https?:\/\/\S+/g, '') // Strip URLs
      .replace(/[*_#`~]/g, '') // Strip markdown
      .replace(/\s+/g, ' ')
      .trim();
  }

  speak(
    text,
    {
      characterName = '',
      gender = '',
      voiceId = '',
      language = 'en',
      onStart,
      onEnd,
      onError,
      onBoundary,
    } = {}
  ) {
    if (!this.isSupported()) {
      if (onError) onError(new Error('Speech synthesis not supported in this browser.'));
      return null;
    }

    this.stop();

    const clean = this.cleanSpeechText(text);
    if (!clean) {
      if (onEnd) onEnd();
      return null;
    }

    try {
      const utterance = new window.SpeechSynthesisUtterance(clean);
      const selectedVoice = this.selectVoice({ characterName, gender, voiceId, language });
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      if (language) {
        utterance.lang = language.toLowerCase().startsWith('am') ? 'am-ET' : 'en-US';
      }

      const tuning = this.getCharacterVoiceTuning(characterName);
      utterance.pitch = tuning.pitch;
      utterance.rate = tuning.rate;

      utterance.onstart = () => {
        this.isSpeaking = true;
        if (onStart) onStart();
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        this.currentUtterance = null;
        if (onEnd) onEnd();
      };

      utterance.onerror = (event) => {
        this.isSpeaking = false;
        this.currentUtterance = null;
        if (onError) onError(event);
      };

      if (onBoundary) {
        utterance.onboundary = onBoundary;
      }

      this.isSpeaking = true;
      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);

      return {
        stop: () => this.stop(),
        pause: () => this.pause(),
        resume: () => this.resume(),
      };
    } catch (err) {
      this.isSpeaking = false;
      this.currentUtterance = null;
      if (onError) onError(err);
      return null;
    }
  }

  stop() {
    if (!this.isSupported()) return;
    try {
      window.speechSynthesis.cancel();
    } catch {}
    this.isSpeaking = false;
    this.currentUtterance = null;
  }

  pause() {
    if (!this.isSupported()) return;
    try {
      window.speechSynthesis.pause();
    } catch {}
  }

  resume() {
    if (!this.isSupported()) return;
    try {
      window.speechSynthesis.resume();
    } catch {}
  }
}

export const speechSynthesisService = new SpeechSynthesisService();
export default speechSynthesisService;

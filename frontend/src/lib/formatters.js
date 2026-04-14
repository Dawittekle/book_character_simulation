export function formatMetricLabel(name) {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getEmotionColor(emotion) {
  const palette = {
    anger: '#d96c55',
    sadness: '#6f7fcf',
    pride: '#d3a34d',
    joy: '#74a66c',
    bliss: '#59a7a7',
  };

  return palette[emotion] || '#9b8f82';
}

export function getInitials(value) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function truncateText(value, maxLength = 180) {
  if (!value) {
    return '';
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trimEnd()}...`;
}

export function deriveWorkspaceTitle({ title, text, fileName }) {
  if (title?.trim()) {
    return title.trim();
  }

  if (fileName?.trim()) {
    return fileName.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').trim();
  }

  const firstMeaningfulLine = (text || '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  if (firstMeaningfulLine) {
    return truncateText(firstMeaningfulLine, 56);
  }

  return 'Untitled Book';
}

export function formatRelativeDate(value) {
  if (!value) {
    return 'Just now';
  }

  const date = new Date(value);
  const differenceInMilliseconds = date.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  const units = [
    ['year', 1000 * 60 * 60 * 24 * 365],
    ['month', 1000 * 60 * 60 * 24 * 30],
    ['week', 1000 * 60 * 60 * 24 * 7],
    ['day', 1000 * 60 * 60 * 24],
    ['hour', 1000 * 60 * 60],
    ['minute', 1000 * 60],
  ];

  for (const [unit, milliseconds] of units) {
    const delta = differenceInMilliseconds / milliseconds;
    if (Math.abs(delta) >= 1) {
      return rtf.format(Math.round(delta), unit);
    }
  }

  return 'Just now';
}

export function formatSourceType(sourceType) {
  return sourceType === 'pdf' ? 'PDF upload' : 'Pasted text';
}

export function countSavedConversations(book) {
  return Object.keys(book.characterSessions || {}).length;
}

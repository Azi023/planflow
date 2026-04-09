/** Metronic v9.4.7 design tokens — JS-side reference for components */

export const colors = {
  primary: { DEFAULT: '#1B84FF', light: '#EEF6FF', dark: '#056EE9', active: '#1565C0' },
  success: { DEFAULT: '#17C653', light: '#EAFFF1', dark: '#04B440' },
  warning: { DEFAULT: '#F6C000', light: '#FFF8DD', dark: '#E5AD00' },
  danger:  { DEFAULT: '#F8285A', light: '#FFEEF3', dark: '#E0103F' },
  info:    { DEFAULT: '#7239EA', light: '#F1EDFF', dark: '#5B21D1' },
  gray: {
    50: '#FAFAFA', 100: '#F9F9F9', 200: '#F1F1F4', 300: '#DBDFE9',
    400: '#B5B5C3', 500: '#99A1B7', 600: '#78829D', 700: '#4B5675',
    800: '#252F4A', 900: '#071437',
  },
  sidebar: { bg: '#1C2135', hover: '#242B41' },
  page: '#F6F6F9',
} as const;

export const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  draft:          { bg: '#F9F9F9', text: '#78829D', border: '#DBDFE9' },
  pending_review: { bg: '#FFF8DD', text: '#E5AD00', border: '#F6C000' },
  approved:       { bg: '#EAFFF1', text: '#04B440', border: '#17C653' },
  sent:           { bg: '#EEF6FF', text: '#1B84FF', border: '#1B84FF' },
  saved:          { bg: '#EEF6FF', text: '#1B84FF', border: '#1B84FF' },
} as const;

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  approved: 'Approved',
  sent: 'Sent',
  saved: 'Saved',
} as const;

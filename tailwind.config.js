/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // --- Surfaces (dark) ---
        canvas: 'var(--bg-canvas)',
        surface: 'var(--bg-surface)',
        'surface-elevated': 'var(--bg-surface-elevated)',
        input: 'var(--bg-input)',

        // --- Borders ---
        'border-subtle': 'var(--border-subtle)',
        'border-default': 'var(--border-default)',

        // --- Text ---
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        'text-muted': 'var(--text-muted)',
        'text-disabled': 'var(--text-disabled)',

        // --- Semantic states ---
        success: 'var(--state-success)',
        'success-text': 'var(--state-success-text)',
        'success-bg': 'var(--state-success-bg)',
        warning: 'var(--state-warning)',
        'warning-text': 'var(--state-warning-text)',
        'warning-bg': 'var(--state-warning-bg)',
        error: 'var(--state-error)',
        'error-text': 'var(--state-error-text)',
        'error-bg': 'var(--state-error-bg)',
        neutral: 'var(--state-neutral)',
        'neutral-bg': 'var(--state-neutral-bg)',

        // --- Action ---
        primary: 'var(--action-primary)',
        'primary-hover': 'var(--action-primary-hover)',
        'action-text': 'var(--action-text)',
        'action-subtle': 'var(--action-bg-subtle)',

        // --- Node / attribute type colors ---
        'type-user-task': '#60A5FA',
        'type-system-task': '#A78BFA',
        'type-decision': '#FBBF24',
        'type-pk': '#C4B5FD',
        'type-fk': '#F2B055',
        'type-required': '#93C5FD',
        'type-uuid': '#93C5FD',
        'type-string': '#FBBF24',
        'type-number': '#A78BFA',
        'type-date': '#34D399',
        'type-boolean': '#FB923C',
        'type-json': '#F472B6',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        display: ['20px', { fontWeight: '600', lineHeight: '1.2' }],
        h1: ['18px', { fontWeight: '600', lineHeight: '1.3' }],
        h2: ['15px', { fontWeight: '600', lineHeight: '1.3' }],
        body: ['13px', { fontWeight: '400', lineHeight: '1.5' }],
        'body-sm': ['12px', { fontWeight: '400', lineHeight: '1.5' }],
        caption: ['11px', { fontWeight: '400', lineHeight: '1.4' }],
        label: ['10px', { fontWeight: '600', letterSpacing: '0.05em', lineHeight: '1.2' }],
        mono: ['12px', { lineHeight: '1.5' }],
        tiny: ['10px', { fontWeight: '600', letterSpacing: '0.04em', lineHeight: '1.2' }],
      },
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px',
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
      },
    },
  },
  plugins: [],
}

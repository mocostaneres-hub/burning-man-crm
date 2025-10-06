/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        'custom-bg': '#FAFAFA',
        'custom-primary': '#2ECC71',
        'custom-secondary': '#F39C12',
        'custom-accent': '#3498DB',
        'custom-text': '#2D3436',
        'custom-primary-hover': '#27AE60',
        'custom-secondary-hover': '#E67E22',
        'custom-accent-hover': '#2980B9',
      },
      fontFamily: {
        'lato': ['Lato', 'sans-serif'],
        'work': ['Work Sans', 'sans-serif'],
      },
      fontSize: {
        'h1': ['2rem', { lineHeight: '1.4', fontWeight: '700' }], // 32px
        'h1-sm': ['1.75rem', { lineHeight: '1.4', fontWeight: '700' }], // 28px
        'h2': ['1.625rem', { lineHeight: '1.4', fontWeight: '700' }], // 26px
        'h2-sm': ['1.375rem', { lineHeight: '1.4', fontWeight: '700' }], // 22px
        'body': ['1rem', { lineHeight: '1.6', fontWeight: '400' }], // 16px
        'body-sm': ['0.875rem', { lineHeight: '1.6', fontWeight: '400' }], // 14px
        'label': ['0.875rem', { lineHeight: '1.4', fontWeight: '500' }], // 14px
        'label-sm': ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }], // 12px
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        'soft': '0 2px 8px 0 rgba(0, 0, 0, 0.08)',
        'medium': '0 4px 16px 0 rgba(0, 0, 0, 0.12)',
        'strong': '0 8px 32px 0 rgba(0, 0, 0, 0.16)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

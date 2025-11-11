// Utility functions for theme-aware styling

export const getThemeStyles = colors => ({
  // Main container styles
  background: {
    backgroundColor: colors.background,
  },

  // Card styles
  card: {
    backgroundColor: colors.cardBackground,
    border: `1px solid ${colors.border}`,
    color: colors.text,
  },

  cardWithAccent: (accentColor = colors.borderAccent) => ({
    backgroundColor: colors.cardBackground,
    border: `1px solid ${colors.border}`,
    borderLeft: `3px solid ${accentColor}`,
    color: colors.text,
  }),

  // Text styles
  text: {
    color: colors.text,
  },

  textSecondary: {
    color: colors.textSecondary,
  },

  textMuted: {
    color: colors.textMuted,
  },

  // Link styles
  link: {
    color: colors.link,
  },

  linkHover: {
    color: colors.linkHover,
  },

  // Button styles
  button: {
    backgroundColor: colors.cardBackground,
    color: colors.textSecondary,
    borderColor: colors.border,
  },

  buttonHover: {
    color: colors.link,
    borderColor: colors.link,
  },

  // Input styles
  input: {
    backgroundColor: colors.cardBackground,
    color: colors.text,
    borderColor: colors.border,
  },

  inputFocus: {
    boxShadow: `0 0 0 1px ${colors.link}`,
  },

  // Status styles
  success: {
    color: colors.success,
  },

  error: {
    color: colors.error,
  },

  warning: {
    color: colors.warning,
  },

  info: {
    color: colors.info,
  },

  // Loading spinner
  spinner: {
    borderColor: colors.link,
    borderTopColor: 'transparent',
  },
});

// Hover effect handlers
export const createHoverHandlers = (colors, normalStyle, hoverStyle) => ({
  onMouseEnter: e => {
    Object.assign(e.target.style, hoverStyle);
  },
  onMouseLeave: e => {
    Object.assign(e.target.style, normalStyle);
  },
});

/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#17202A',
    tint: '#C9894B',

    // Core surfaces
    background: '#F7F3ED',
    foreground: '#17202A',

    // Cards / elevated surfaces
    card: '#FFFCF7',
    cardForeground: '#17202A',

    // Primary action color (buttons, links, active states)
    primary: '#C9894B',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#EDE5DA',
    secondaryForeground: '#31404B',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#EFE9E0',
    mutedForeground: '#7B817F',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#DCE4DD',
    accentForeground: '#31404B',

    // Destructive actions (delete, error states)
    destructive: '#B95645',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#E1D8CC',
    input: '#D7CCBE',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 18,
};

export default colors;

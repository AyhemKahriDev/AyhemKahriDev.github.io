const shared = {
  categories: {
    Arcade: "#e56b4d",
    Puzzle: "#7b6ee8",
    Card: "#2f9d83",
    Word: "#c08a32",
    Reflex: "#3f8fbd",
    Strategy: "#c87543",
  },
  font: {
    display: "'Space Grotesk', sans-serif",
    mono: "'JetBrains Mono', monospace",
    body: "'Inter', sans-serif",
  },
  radius: { sm: "8px", md: "12px", lg: "20px" },
  space: [0, 4, 8, 16, 24, 32, 48, 64],
};

export const lightTheme = {
  ...shared,
  colors: {
    bg: "#f7f8fc",
    surface: "#ffffff",
    surfaceAlt: "#f0f2f8",
    border: "#dfe3ee",
    accent: "#6558d3",
    accentAlt: "#df5f79",
    text: "#202334",
    textMuted: "#697087",
    success: "#278c70",
    warning: "#ad7a22",
    danger: "#c94d55",
  },
  shadows: {
    card: "0 8px 24px rgba(35, 42, 68, 0.07)",
    cardHover: "0 14px 34px rgba(35, 42, 68, 0.12)",
    floating: "0 10px 30px rgba(35, 42, 68, 0.1)",
  },
};

export const darkTheme = {
  ...shared,
  colors: {
    bg: "#10121a",
    surface: "#181b25",
    surfaceAlt: "#222634",
    border: "#303649",
    accent: "#8b7ff0",
    accentAlt: "#f07b93",
    text: "#eef0f7",
    textMuted: "#a1a8ba",
    success: "#4fc29f",
    warning: "#d5a34a",
    danger: "#ef7078",
  },
  shadows: {
    card: "0 8px 24px rgba(0, 0, 0, 0.2)",
    cardHover: "0 14px 34px rgba(0, 0, 0, 0.3)",
    floating: "0 10px 30px rgba(0, 0, 0, 0.25)",
  },
};

export const theme = lightTheme;

import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        display: ['Cinzel', 'Times New Roman', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Ability tree colors
        hunter: {
          DEFAULT: "hsl(var(--hunter))",
          glow: "hsl(var(--hunter-glow))",
          dim: "hsl(var(--hunter-dim))",
          foreground: "hsl(var(--hunter-foreground))",
        },
        warrior: {
          DEFAULT: "hsl(var(--warrior))",
          glow: "hsl(var(--warrior-glow))",
          dim: "hsl(var(--warrior-dim))",
          foreground: "hsl(var(--warrior-foreground))",
        },
        assassin: {
          DEFAULT: "hsl(var(--assassin))",
          glow: "hsl(var(--assassin-glow))",
          dim: "hsl(var(--assassin-dim))",
          foreground: "hsl(var(--assassin-foreground))",
        },
        // Tier colors
        tier: {
          maxed: "hsl(var(--tier-maxed))",
          "maxed-glow": "hsl(var(--tier-maxed-glow))",
          active: "hsl(var(--tier-active))",
          locked: "hsl(var(--tier-locked))",
        },
        parchment: {
          DEFAULT: "hsl(var(--parchment))",
          dark: "hsl(var(--parchment-dark))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        "tier-unlock": {
          "0%": { transform: "scale(0)", opacity: "0" },
          "50%": { transform: "scale(1.3)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        // Ability tree animations - Desktop (full effects)
        "ability-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 currentColor" },
          "50%": { boxShadow: "0 0 20px 4px currentColor" },
        },
        "ability-unlock": {
          "0%": { transform: "scale(1)", filter: "brightness(1)" },
          "50%": { transform: "scale(1.2)", filter: "brightness(1.5)" },
          "100%": { transform: "scale(1)", filter: "brightness(1)" },
        },
        "tier-glow": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        "connection-flow": {
          "0%": { strokeDashoffset: "20" },
          "100%": { strokeDashoffset: "0" },
        },
        // Ability tree animations - Mobile (simpler, better performance)
        "ability-pulse-mobile": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.8" },
        },
        "ability-unlock-mobile": {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.1)" },
          "100%": { transform: "scale(1)" },
        },
        // Tab icon animations
        "tab-crosshair": {
          "0%, 100%": { transform: "rotate(0deg) scale(1)" },
          "25%": { transform: "rotate(15deg) scale(1.1)" },
          "75%": { transform: "rotate(-15deg) scale(1.1)" },
        },
        "tab-swords": {
          "0%, 100%": { transform: "translateX(0) rotate(0deg)" },
          "25%": { transform: "translateX(2px) rotate(5deg)" },
          "75%": { transform: "translateX(-2px) rotate(-5deg)" },
        },
        "tab-backpack": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-2px)" },
        },
        "tab-trophy": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.15)" },
        },
        "tab-sparkles": {
          "0%, 100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
          "50%": { transform: "scale(1.2) rotate(180deg)", opacity: "0.8" },
        },
        "tab-book": {
          "0%, 100%": { transform: "rotateY(0deg)" },
          "50%": { transform: "rotateY(20deg)" },
        },
        "tab-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 currentColor" },
          "50%": { boxShadow: "0 0 8px 2px currentColor" },
        },
        "tab-shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "badge-pulse": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.8", transform: "scale(1.1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "tier-unlock": "tier-unlock 0.4s ease-out",
        // Tab animations
        "tab-crosshair": "tab-crosshair 2s ease-in-out infinite",
        "tab-swords": "tab-swords 1.5s ease-in-out infinite",
        "tab-backpack": "tab-backpack 2s ease-in-out infinite",
        "tab-trophy": "tab-trophy 1.8s ease-in-out infinite",
        "tab-sparkles": "tab-sparkles 3s ease-in-out infinite",
        "tab-book": "tab-book 2.5s ease-in-out infinite",
        "tab-glow": "tab-glow 2s ease-in-out infinite",
        "tab-shimmer": "tab-shimmer 3s linear infinite",
        // Ability tree animations
        "ability-pulse": "ability-pulse 2s ease-in-out infinite",
        "ability-unlock": "ability-unlock 0.4s ease-out",
        "tier-glow": "tier-glow 1.5s ease-in-out infinite",
        "connection-flow": "connection-flow 1s linear infinite",
        "ability-pulse-mobile": "ability-pulse-mobile 3s ease-in-out infinite",
        "ability-unlock-mobile": "ability-unlock-mobile 0.3s ease-out",
        "badge-pulse": "badge-pulse 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

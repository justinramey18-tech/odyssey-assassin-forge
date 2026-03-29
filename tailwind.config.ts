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
        cinzel: ['Cinzel', 'Times New Roman', 'serif'],
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
        // Glassmorphism design tokens
        glass: {
          DEFAULT: "rgba(0, 0, 0, 0.30)",
          subtle: "rgba(0, 0, 0, 0.20)",
          strong: "rgba(0, 0, 0, 0.40)",
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
        homebrew: {
          DEFAULT: "hsl(var(--homebrew))",
          glow: "hsl(var(--homebrew-glow))",
          dim: "hsl(var(--homebrew-dim))",
          foreground: "hsl(var(--homebrew-foreground))",
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
      borderColor: {
        glass: "rgba(255, 255, 255, 0.10)",
      },
      boxShadow: {
        "glass-glow": "inset 0 1px 0 rgba(255,255,255,0.1)",
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
        // Enhanced unlock flash animation for AC Odyssey style
        "ability-unlock-flash": {
          "0%": { 
            transform: "scale(1)", 
            boxShadow: "0 0 0 0 currentColor",
            filter: "brightness(1)"
          },
          "25%": { 
            transform: "scale(1.25)", 
            boxShadow: "0 0 40px 10px currentColor",
            filter: "brightness(2)"
          },
          "50%": { 
            transform: "scale(1.15)", 
            boxShadow: "0 0 30px 6px currentColor",
            filter: "brightness(1.5)"
          },
          "100%": { 
            transform: "scale(1)", 
            boxShadow: "0 0 15px 3px currentColor",
            filter: "brightness(1)"
          },
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
        "flame-flicker": {
          "0%": { opacity: "0.85", transform: "scaleY(1) translateY(0)" },
          "25%": { opacity: "1", transform: "scaleY(1.08) translateY(-1px)" },
          "50%": { opacity: "0.75", transform: "scaleY(0.95) translateY(1px)" },
          "75%": { opacity: "0.95", transform: "scaleY(1.05) translateY(-0.5px)" },
          "100%": { opacity: "0.85", transform: "scaleY(1) translateY(0)" },
        },
        "flame-sway": {
          "0%": { opacity: "0.8", transform: "scaleX(1) translateX(0)" },
          "33%": { opacity: "1", transform: "scaleX(1.06) translateX(-1px)" },
          "66%": { opacity: "0.75", transform: "scaleX(0.96) translateX(1px)" },
          "100%": { opacity: "0.8", transform: "scaleX(1) translateX(0)" },
        },
        "text-waver": {
          "0%": { transform: "translateX(0) skewX(0deg)", filter: "blur(0px)" },
          "15%": { transform: "translateX(0.3px) skewX(0.15deg)", filter: "blur(0px)" },
          "30%": { transform: "translateX(-0.2px) skewX(-0.1deg)", filter: "blur(0.2px)" },
          "50%": { transform: "translateX(0.4px) skewX(0.2deg)", filter: "blur(0px)" },
          "65%": { transform: "translateX(-0.3px) skewX(-0.15deg)", filter: "blur(0.3px)" },
          "80%": { transform: "translateX(0.2px) skewX(0.1deg)", filter: "blur(0px)" },
          "100%": { transform: "translateX(0) skewX(0deg)", filter: "blur(0px)" },
        },
        "text-waver-intense": {
          "0%": { transform: "translateX(0) skewX(0deg)", filter: "blur(0px)" },
          "12%": { transform: "translateX(1.2px) skewX(0.4deg)", filter: "blur(0.2px)" },
          "28%": { transform: "translateX(-1px) skewX(-0.35deg)", filter: "blur(0.5px)" },
          "45%": { transform: "translateX(1.5px) skewX(0.5deg)", filter: "blur(0.1px)" },
          "60%": { transform: "translateX(-1.3px) skewX(-0.45deg)", filter: "blur(0.6px)" },
          "78%": { transform: "translateX(0.8px) skewX(0.3deg)", filter: "blur(0.2px)" },
          "100%": { transform: "translateX(0) skewX(0deg)", filter: "blur(0px)" },
        },
        "text-waver-critical": {
          "0%": { transform: "translateX(0) translateY(0) skewX(0deg)", filter: "blur(0px)" },
          "10%": { transform: "translateX(2px) translateY(-0.5px) skewX(0.6deg)", filter: "blur(0.3px)" },
          "25%": { transform: "translateX(-2.5px) translateY(0.8px) skewX(-0.8deg)", filter: "blur(0.8px)" },
          "40%": { transform: "translateX(1.8px) translateY(-0.3px) skewX(0.7deg)", filter: "blur(0.2px)" },
          "55%": { transform: "translateX(-1.5px) translateY(0.5px) skewX(-0.6deg)", filter: "blur(1px)" },
          "70%": { transform: "translateX(2.2px) translateY(-0.7px) skewX(0.8deg)", filter: "blur(0.4px)" },
          "85%": { transform: "translateX(-1px) translateY(0.3px) skewX(-0.4deg)", filter: "blur(0.6px)" },
          "100%": { transform: "translateX(0) translateY(0) skewX(0deg)", filter: "blur(0px)" },
        },
        "flame-dance": {
          "0%": { backgroundPosition: "0% 0%" },
          "25%": { backgroundPosition: "50% 10%" },
          "50%": { backgroundPosition: "100% 5%" },
          "75%": { backgroundPosition: "50% -10%" },
          "100%": { backgroundPosition: "0% 0%" },
        },
        "flame-dance-vertical": {
          "0%": { backgroundPosition: "0% 0%" },
          "25%": { backgroundPosition: "10% 50%" },
          "50%": { backgroundPosition: "5% 100%" },
          "75%": { backgroundPosition: "-10% 50%" },
          "100%": { backgroundPosition: "0% 0%" },
        },
        "screen-shake": {
          "0%, 100%": { transform: "translate(0, 0) rotate(0deg)" },
          "10%": { transform: "translate(-2px, 1px) rotate(-0.3deg)" },
          "20%": { transform: "translate(2px, -1px) rotate(0.3deg)" },
          "30%": { transform: "translate(-1px, 2px) rotate(-0.2deg)" },
          "40%": { transform: "translate(1px, -2px) rotate(0.2deg)" },
          "50%": { transform: "translate(-2px, 0px) rotate(-0.3deg)" },
          "60%": { transform: "translate(2px, 1px) rotate(0.2deg)" },
          "70%": { transform: "translate(-1px, -1px) rotate(-0.2deg)" },
          "80%": { transform: "translate(1px, 2px) rotate(0.3deg)" },
          "90%": { transform: "translate(-1px, -2px) rotate(-0.1deg)" },
        },
        "breathe-happy": {
          "0%, 100%": { transform: "scale(1)", boxShadow: "0 0 10px rgba(245,158,11,0.3)" },
          "50%": { transform: "scale(1.08)", boxShadow: "0 0 25px rgba(245,158,11,0.6)" },
        },
        "breathe-angry": {
          "0%, 100%": { transform: "scale(1)", boxShadow: "0 0 10px rgba(249,115,22,0.3)" },
          "50%": { transform: "scale(1.08)", boxShadow: "0 0 25px rgba(249,115,22,0.6)" },
        },
        "breathe-injured": {
          "0%, 100%": { transform: "scale(1)", boxShadow: "0 0 10px rgba(239,68,68,0.3)" },
          "50%": { transform: "scale(1.08)", boxShadow: "0 0 25px rgba(239,68,68,0.6)" },
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
        "ability-unlock-flash": "ability-unlock-flash 0.6s ease-out",
        "badge-pulse": "badge-pulse 2s ease-in-out infinite",
        "breathe-slow": "breathe-happy 20s ease-in-out infinite",
        "breathe-medium": "breathe-angry 10s ease-in-out infinite",
        "breathe-fast": "breathe-injured 6s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

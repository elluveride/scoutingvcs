import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      fontFamily: {
        sans: [
          'Roboto',
          'ui-sans-serif',
          'system-ui',
          'sans-serif'
        ],
        display: [
          '"Google Sans"',
          'Roboto',
          'ui-sans-serif',
          'system-ui',
          'sans-serif'
        ],
        mono: [
          '"Roboto Mono"',
          'ui-monospace',
          'monospace'
        ]
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))'
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        alliance: {
          red: 'hsl(var(--alliance-red))',
          blue: 'hsl(var(--alliance-blue))'
        },
        surface: {
          dim: 'hsl(var(--surface-dim))',
          container: 'hsl(var(--surface-container))',
          'container-high': 'hsl(var(--surface-container-high))',
          'container-highest': 'hsl(var(--surface-container-highest))'
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
        '2xl': '1rem',
        '3xl': '1.5rem'
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
            opacity: '0'
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
            opacity: '1'
          }
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
            opacity: '1'
          },
          to: {
            height: '0',
            opacity: '0'
          }
        },
        'fade-in': {
          from: {
            opacity: '0',
            transform: 'scale(0.95)'
          },
          to: {
            opacity: '1',
            transform: 'scale(1)'
          }
        },
        'slide-up': {
          from: {
            opacity: '0',
            transform: 'translateY(16px)'
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)'
          }
        },
        'slide-in-right': {
          from: {
            transform: 'translateX(100%)'
          },
          to: {
            transform: 'translateX(0)'
          }
        },
        'slide-out-right': {
          from: {
            transform: 'translateX(0)'
          },
          to: {
            transform: 'translateX(100%)'
          }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.3s cubic-bezier(0.05, 0.7, 0.1, 1)',
        'accordion-up': 'accordion-up 0.3s cubic-bezier(0.3, 0, 0.8, 0.15)',
        'fade-in': 'fade-in 0.3s cubic-bezier(0.05, 0.7, 0.1, 1)',
        'slide-up': 'slide-up 0.4s cubic-bezier(0.05, 0.7, 0.1, 1)',
        'slide-in-right': 'slide-in-right 0.3s cubic-bezier(0.05, 0.7, 0.1, 1)',
        'slide-out-right': 'slide-out-right 0.3s cubic-bezier(0.3, 0, 0.8, 0.15)'
      },
      transitionTimingFunction: {
        'material': 'cubic-bezier(0.2, 0, 0, 1)',
        'material-decelerate': 'cubic-bezier(0.05, 0.7, 0.1, 1)',
        'material-accelerate': 'cubic-bezier(0.3, 0, 0.8, 0.15)'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

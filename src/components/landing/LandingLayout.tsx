import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode, useState } from 'react';
import { Menu, X } from 'lucide-react';
import cipherIcon from '@/assets/cipher-icon.png';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/features', label: 'Features' },
  { to: '/about', label: 'About' },
  { to: '/docs', label: 'Docs' },
];

function LandingNav() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 backdrop-blur-xl"
      style={{ background: 'hsla(220, 20%, 7%, 0.85)' }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <img src={cipherIcon} alt="Cipher" className="w-8 h-8 rounded-lg" />
          <span className="font-display font-bold text-lg text-foreground group-hover:text-primary transition-colors">
            Cipher Scout
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                location.pathname === link.to
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/auth"
            className="ml-4 px-5 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-[0_0_15px_hsl(210_100%_50%/0.3)] hover:shadow-[0_0_25px_hsl(210_100%_50%/0.5)]"
          >
            Sign In
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded-xl text-foreground hover:bg-muted/50 transition-colors min-h-0"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
            className="md:hidden overflow-hidden border-t border-border/20"
            style={{ background: 'hsla(220, 20%, 7%, 0.95)' }}
          >
            <div className="px-6 py-4 flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all min-h-[44px] flex items-center ${
                    location.pathname === link.to
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to="/auth"
                onClick={() => setMobileOpen(false)}
                className="mt-2 px-4 py-3 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-center min-h-[44px] flex items-center justify-center shadow-[0_0_15px_hsl(210_100%_50%/0.3)]"
              >
                Sign In
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-border/30 bg-surface-dim">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src={cipherIcon} alt="Cipher" className="w-8 h-8 rounded-lg" />
              <span className="font-display font-bold text-lg text-foreground">Cipher Scout</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The ultimate FTC scouting platform built by teams, for teams. Gain the competitive edge your alliance needs.
            </p>
          </div>

          <div>
            <h4 className="font-display font-bold text-sm uppercase tracking-wider text-foreground mb-4">Navigation</h4>
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link key={link.to} to={link.to} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {link.label}
                </Link>
              ))}
              <Link to="/auth" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Sign In
              </Link>
            </div>
          </div>

          <div>
            <h4 className="font-display font-bold text-sm uppercase tracking-wider text-foreground mb-4">Created By</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              FTC Team 12841 & FTC Team 2844
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground/60">
              <span>Made with</span>
              <span className="text-alliance-red">♥</span>
              <span>by</span>
              <a
                href="https://lovable.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary/70 hover:text-primary transition-colors font-medium"
              >
                Lovable
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border/20 flex items-center justify-between text-xs text-muted-foreground/50">
          <span>© {new Date().getFullYear()} Cipher Scout. All rights reserved.</span>
          <span>FTC Teams 12841 × 2844</span>
        </div>
      </div>
    </footer>
  );
}

export function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <main className="pt-16">{children}</main>
      <LandingFooter />
    </div>
  );
}

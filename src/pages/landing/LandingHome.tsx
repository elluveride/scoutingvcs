import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LandingLayout } from '@/components/landing/LandingLayout';
import { SEOHead } from '@/components/landing/SEOHead';
import { ClipboardList, BarChart3, Users, QrCode, Wifi, Shield, ArrowRight } from 'lucide-react';
import heroBg from '@/assets/landing/hero-bg.jpg';
import featureMatchScout from '@/assets/landing/feature-match-scout-real.png';
import featureDashboard from '@/assets/landing/feature-dashboard-real.png';
import featureLiveStats from '@/assets/landing/feature-live-stats-real.png';
import cipherIcon from '@/assets/cipher-icon.png';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.2, 0, 0, 1] as const },
  }),
};

const highlights = [
  { icon: ClipboardList, title: 'Match Scouting', desc: 'Track scoring, defense, and penalties in real-time during matches.' },
  { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Weighted ranking lists with configurable scoring algorithms.' },
  { icon: Users, title: 'Team Compare', desc: 'Side-by-side analysis with radar charts and stat breakdowns.' },
  { icon: QrCode, title: 'QR Transfer', desc: 'Share scouting data instantly between devices, no internet needed.' },
  { icon: Wifi, title: 'Offline First', desc: 'Full functionality even without Wi-Fi — built for competition venues.' },
  { icon: Shield, title: 'Team Security', desc: 'Role-based access keeps your data private to your team only.' },
];

export default function LandingHome() {
  return (
    <LandingLayout>
      <SEOHead
        title="Cipher Scout — FTC Scouting Platform"
        description="The competitive edge your alliance needs. Real-time match scouting, analytics, team comparison, and offline QR transfer for FTC competitions."
        path="/"
      />
      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBg} alt="" className="w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
            <img src={cipherIcon} alt="Cipher" className="w-20 h-20 mx-auto mb-6 rounded-2xl shadow-[0_0_40px_hsl(210_100%_50%/0.4)]" />
          </motion.div>

          <motion.h1
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="text-5xl md:text-7xl font-display font-bold text-foreground mb-4 tracking-tight"
          >
            <span className="text-glow-red">Cipher</span>{' '}
            <span className="text-glow-blue">Scout</span>
          </motion.h1>

          <motion.p
            custom={2}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-4"
          >
            The competitive edge your alliance needs.
          </motion.p>

          <motion.p
            custom={3}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="text-sm text-muted-foreground/60 mb-10"
          >
            Built by FTC Teams 12841 & 2844
          </motion.p>

          <motion.div
            custom={4}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="flex gap-4 justify-center flex-wrap"
          >
            <Link
              to="/auth"
              className="px-8 py-3.5 rounded-xl font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-[0_0_25px_hsl(210_100%_50%/0.4)] hover:shadow-[0_0_35px_hsl(210_100%_50%/0.6)] text-base"
            >
              Get Started
            </Link>
            <Link
              to="/features"
              className="px-8 py-3.5 rounded-xl font-medium border border-border/60 text-foreground hover:bg-muted/50 transition-all text-base"
            >
              Explore Features
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Highlights Grid */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Everything You Need to Win
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              A complete scouting suite designed for FTC competitions. Collect data, analyze teams, and plan your strategy.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {highlights.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="group relative rounded-2xl border border-border/40 bg-card/50 p-6 hover:border-primary/30 hover:bg-card transition-all duration-300"
              >
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ boxShadow: '0 0 30px hsl(210 100% 50% / 0.08), inset 0 1px 0 hsl(0 0% 100% / 0.03)' }}
                />
                <item.icon className="w-10 h-10 text-primary mb-4" strokeWidth={1.5} />
                <h3 className="font-display font-bold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase Section */}
      <section className="py-24 px-6 bg-surface-dim/50">
        <div className="max-w-6xl mx-auto space-y-32">
          {/* Match Scouting */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
          >
            <div>
              <span className="text-xs uppercase tracking-widest text-alliance-red font-bold mb-3 block">Real-Time Data</span>
              <h3 className="text-3xl font-display font-bold text-foreground mb-4">Match Scouting</h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Track every detail during matches — autonomous scoring, teleop performance, defense ratings, penalties, and endgame status. The intuitive mobile-first interface lets scouts record data without missing a beat.
              </p>
              <Link to="/features" className="inline-flex items-center gap-2 text-primary font-medium text-sm hover:gap-3 transition-all">
                Learn more <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="rounded-2xl overflow-hidden border border-border/30 shadow-[0_0_40px_hsl(0_85%_55%/0.1)]">
              <img src={featureMatchScout} alt="Match scouting form with autonomous scoring, TeleOp counters, defense rating, and endgame tracking" className="w-full" />
            </div>
          </motion.div>

          {/* Dashboard */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
          >
            <div className="order-2 lg:order-1 rounded-2xl overflow-hidden border border-border/30 shadow-[0_0_40px_hsl(210_100%_50%/0.1)]">
              <img src={featureDashboard} alt="Dual ranking lists with configurable weights showing team scores and stats" className="w-full" />
            </div>
            <div className="order-1 lg:order-2">
              <span className="text-xs uppercase tracking-widest text-alliance-blue font-bold mb-3 block">Intelligent Analytics</span>
              <h3 className="text-3xl font-display font-bold text-foreground mb-4">Team Dashboard</h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Dual ranking lists with fully configurable weighted scoring. Adjust importance of autonomous, teleop, defense, and endgame to match your alliance strategy. Search, filter, and rank teams instantly.
              </p>
              <Link to="/features" className="inline-flex items-center gap-2 text-primary font-medium text-sm hover:gap-3 transition-all">
                Learn more <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>

          {/* Compare */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
          >
            <div>
              <span className="text-xs uppercase tracking-widest text-foreground/60 font-bold mb-3 block">Live Data</span>
              <h3 className="text-3xl font-display font-bold text-foreground mb-4">Live Stats</h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Official FTC competition rankings pulled in real time. Win/loss records, ranking points, and tiebreaker scores — all updated live so you always know where teams stand.
              </p>
              <Link to="/features" className="inline-flex items-center gap-2 text-primary font-medium text-sm hover:gap-3 transition-all">
                Learn more <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="rounded-2xl overflow-hidden border border-border/30 shadow-[0_0_40px_hsl(210_100%_50%/0.08)]">
              <img src={featureLiveStats} alt="Live Stats showing official FTC rankings with RP and TBP scores" className="w-full" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Made with Lovable */}
      <section className="py-16 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-sm text-muted-foreground/50 flex items-center justify-center gap-2">
            Made with <span className="text-alliance-red text-base">♥</span> by{' '}
            <a
              href="https://lovable.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary/60 hover:text-primary transition-colors font-medium"
            >
              Lovable
            </a>
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-alliance-red/5 via-transparent to-alliance-blue/5" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative max-w-3xl mx-auto text-center"
        >
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
            Ready to Dominate the Field?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Join teams already using Cipher Scout to gain the competitive advantage at every event.
          </p>
          <Link
            to="/auth"
            className="inline-block px-10 py-4 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-[0_0_30px_hsl(210_100%_50%/0.4)] hover:shadow-[0_0_45px_hsl(210_100%_50%/0.6)] text-lg"
          >
            Start Scouting Now
          </Link>
        </motion.div>
      </section>
    </LandingLayout>
  );
}

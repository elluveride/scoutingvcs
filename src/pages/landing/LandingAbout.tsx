import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LandingLayout } from '@/components/landing/LandingLayout';
import { Bot, Rocket, Heart, Code2, Trophy, Users } from 'lucide-react';
import cipherIcon from '@/assets/cipher-icon.png';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.2, 0, 0, 1] as const },
  }),
};

const stats = [
  { value: '2', label: 'FTC Teams', icon: Users },
  { value: '10+', label: 'Features', icon: Rocket },
  { value: '∞', label: 'Matches Tracked', icon: Trophy },
  { value: '100%', label: 'Offline Capable', icon: Code2 },
];

export default function LandingAbout() {
  return (
    <LandingLayout>
      {/* Header */}
      <section className="pt-20 pb-8 px-6 text-center">
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
          <img src={cipherIcon} alt="Cipher" className="w-16 h-16 mx-auto mb-6 rounded-2xl shadow-[0_0_30px_hsl(210_100%_50%/0.3)]" />
        </motion.div>
        <motion.h1 custom={1} variants={fadeUp} initial="hidden" animate="visible"
          className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4"
        >
          About Cipher Scout
        </motion.h1>
        <motion.p custom={2} variants={fadeUp} initial="hidden" animate="visible"
          className="text-lg text-muted-foreground max-w-2xl mx-auto"
        >
          Born from the competition field, built for teams who refuse to leave strategy to chance.
        </motion.p>
      </section>

      {/* Stats */}
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center rounded-2xl border border-border/40 bg-card/50 p-6"
            >
              <s.icon className="w-8 h-8 text-primary mx-auto mb-3" strokeWidth={1.5} />
              <div className="text-3xl font-display font-bold text-foreground mb-1">{s.value}</div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Story */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <div className="rounded-2xl border border-border/40 bg-card/50 p-8">
              <div className="flex items-center gap-3 mb-4">
                <Bot className="w-6 h-6 text-alliance-red" />
                <h2 className="text-xl font-display font-bold text-foreground">Our Story</h2>
              </div>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  Cipher Scout was born from a simple problem: FTC scouting is hard. Paper sheets get lost, spreadsheets are slow, and most apps don't work without Wi-Fi — which competition venues notoriously lack.
                </p>
                <p>
                  FTC Teams <strong className="text-foreground">12841</strong> and <strong className="text-foreground">2844</strong> decided to build something better. A scouting platform that works offline first, syncs via QR codes, and turns raw match data into actionable strategy.
                </p>
                <p>
                  The result is Cipher Scout — a comprehensive, real-time scouting application designed specifically for the demands of FTC competitions. From pit scouting to match analytics to alliance selection, every feature was built with the field in mind.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-alliance-red/20 bg-card/50 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-alliance-red to-alliance-red/30" />
                <h3 className="font-display font-bold text-foreground mb-2 ml-3">FTC Team 12841</h3>
                <p className="text-sm text-muted-foreground ml-3 leading-relaxed">
                  Driving innovation in FTC scouting technology. Team 12841 brings the vision and competitive experience that shaped Cipher Scout's core design philosophy.
                </p>
              </div>

              <div className="rounded-2xl border border-alliance-blue/20 bg-card/50 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-alliance-blue to-alliance-blue/30" />
                <h3 className="font-display font-bold text-foreground mb-2 ml-3">FTC Team 2844</h3>
                <p className="text-sm text-muted-foreground ml-3 leading-relaxed">
                  Engineering excellence meets data-driven strategy. Team 2844 contributes the technical expertise and analytical mindset behind every feature.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-border/40 bg-card/50 p-8">
              <div className="flex items-center gap-3 mb-4">
                <Rocket className="w-6 h-6 text-alliance-blue" />
                <h2 className="text-xl font-display font-bold text-foreground">Our Mission</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                To give every FTC team access to professional-grade scouting tools. We believe data-driven decision making shouldn't be reserved for teams with dedicated developers — it should be available to everyone competing on the field.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Made with Lovable */}
      <section className="py-16 px-6 bg-surface-dim/50">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center"
        >
          <Heart className="w-10 h-10 text-alliance-red mx-auto mb-4" />
          <h2 className="text-2xl font-display font-bold text-foreground mb-3">Made with Love</h2>
          <p className="text-muted-foreground mb-6">
            Cipher Scout is proudly built with{' '}
            <a href="https://lovable.dev" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 transition-colors font-medium">
              Lovable
            </a>
            , the AI-powered app builder that turns ideas into production applications.
          </p>
          <div className="text-xs text-muted-foreground/40">
            Created by FTC Teams 12841 × 2844 · Powered by Lovable
          </div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center">
        <h2 className="text-3xl font-display font-bold text-foreground mb-4">
          Join the Alliance
        </h2>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Ready to take your scouting to the next level?
        </p>
        <Link
          to="/auth"
          className="inline-block px-10 py-4 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-[0_0_30px_hsl(210_100%_50%/0.4)] hover:shadow-[0_0_45px_hsl(210_100%_50%/0.6)] text-lg"
        >
          Get Started
        </Link>
      </section>
    </LandingLayout>
  );
}

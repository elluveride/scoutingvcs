import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LandingLayout } from '@/components/landing/LandingLayout';
import {
  ClipboardList, Wrench, BarChart3, Users, Radio, CalendarDays,
  UserCheck, QrCode, Share2, Shield, Wifi, Database
} from 'lucide-react';
import featureMatchScout from '@/assets/landing/feature-match-scout.jpg';
import featurePitScout from '@/assets/landing/feature-pit-scout.jpg';
import featureDashboard from '@/assets/landing/feature-dashboard.jpg';
import featureCompare from '@/assets/landing/feature-compare.jpg';
import featureQr from '@/assets/landing/feature-qr.jpg';

interface FeatureBlockProps {
  tag: string;
  tagColor: string;
  title: string;
  description: string;
  bullets: string[];
  image: string;
  imageAlt: string;
  reverse?: boolean;
  glowColor: string;
}

function FeatureBlock({ tag, tagColor, title, description, bullets, image, imageAlt, reverse, glowColor }: FeatureBlockProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
      className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${reverse ? 'lg:flex-row-reverse' : ''}`}
    >
      <div className={reverse ? 'lg:order-2' : ''}>
        <span className={`text-xs uppercase tracking-widest font-bold mb-3 block ${tagColor}`}>{tag}</span>
        <h3 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-4">{title}</h3>
        <p className="text-muted-foreground leading-relaxed mb-6">{description}</p>
        <ul className="space-y-3">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              {b}
            </li>
          ))}
        </ul>
      </div>
      <div className={`${reverse ? 'lg:order-1' : ''} rounded-2xl overflow-hidden border border-border/30`}
        style={{ boxShadow: `0 0 50px ${glowColor}` }}
      >
        <img src={image} alt={imageAlt} className="w-full" loading="lazy" />
      </div>
    </motion.div>
  );
}

const additionalFeatures = [
  { icon: Radio, title: 'Live Stats', desc: 'Real-time FTC API integration with live rankings and match results.' },
  { icon: CalendarDays, title: 'Match Planner', desc: 'Plan your upcoming matches with strategic team selection and notes.' },
  { icon: UserCheck, title: 'Scouter Assignments', desc: 'Assign scouts to specific matches and positions automatically.' },
  { icon: Share2, title: 'Data Sharing', desc: 'Export and import scouting data across your entire team.' },
  { icon: Database, title: 'Spreadsheet View', desc: 'Raw data access with sorting, filtering, and CSV export.' },
  { icon: Shield, title: 'Admin Controls', desc: 'Manage team members, approve users, and control data access.' },
];

export default function LandingFeatures() {
  return (
    <LandingLayout>
      {/* Header */}
      <section className="pt-20 pb-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4"
          >
            Features
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Every tool you need to scout, analyze, and strategize — all in one platform built for the competition field.
          </motion.p>
        </div>
      </section>

      {/* Feature Blocks */}
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto space-y-32">
          <FeatureBlock
            tag="Core Scouting"
            tagColor="text-alliance-red"
            title="Match Scouting"
            description="Record every detail as it happens. Our mobile-first interface is designed for speed and accuracy during fast-paced FTC matches."
            bullets={[
              'Autonomous and TeleOp scoring with close/far tracking',
              'Defense rating with 4-level scale',
              'Foul and penalty tracking (minor/major)',
              'Endgame return status — partial, full, or lift',
              'Free-form notes for qualitative observations',
              'Auto-fill from scouter assignments',
            ]}
            image={featureMatchScout}
            imageAlt="Match Scouting Interface"
            glowColor="hsl(0 85% 55% / 0.08)"
          />

          <FeatureBlock
            tag="Robot Intel"
            tagColor="text-alliance-blue"
            title="Pit Scouting"
            description="Document robot capabilities before matches start. Know every team's strengths and weaknesses before you face them."
            bullets={[
              'Drive type classification (Tank, Mecanum, Swerve, Other)',
              'Scoring capability tracking — motifs and artifacts',
              'Autonomous consistency and path recording',
              'Endgame consistency rating',
              'Robot photo upload for visual reference',
              'Preferred start position tracking',
            ]}
            image={featurePitScout}
            imageAlt="Pit Scouting Interface"
            glowColor="hsl(210 100% 50% / 0.08)"
            reverse
          />

          <FeatureBlock
            tag="Analytics"
            tagColor="text-alliance-red"
            title="Team Dashboard & Rankings"
            description="Transform raw data into actionable intelligence. Dual ranking lists with fully customizable weighted scoring let you prioritize what matters most."
            bullets={[
              'Configurable weight sliders for every scoring category',
              'Dual ranking lists for comparing strategies',
              'Quick search by team number',
              'Historical match performance trends',
              'One-click access to detailed team profiles',
            ]}
            image={featureDashboard}
            imageAlt="Analytics Dashboard"
            glowColor="hsl(0 85% 55% / 0.08)"
          />

          <FeatureBlock
            tag="Strategy"
            tagColor="text-alliance-blue"
            title="Team Comparison"
            description="Make data-driven alliance selection decisions. Compare any two teams side-by-side with comprehensive visual breakdowns."
            bullets={[
              'Radar chart overlays for at-a-glance comparison',
              'Stat-by-stat scoring breakdowns',
              'Match history comparison',
              'Consistency and reliability metrics',
              'Export comparison reports',
            ]}
            image={featureCompare}
            imageAlt="Team Compare"
            glowColor="hsl(210 100% 50% / 0.08)"
            reverse
          />

          <FeatureBlock
            tag="Connectivity"
            tagColor="text-foreground/60"
            title="QR Code Transfer & Offline Mode"
            description="Competition venues have terrible Wi-Fi. Cipher Scout works fully offline and syncs data between devices via QR codes — no internet required."
            bullets={[
              'Full offline functionality with IndexedDB storage',
              'QR code generation for instant data transfer',
              'Camera-based QR scanning between devices',
              'Automatic cloud sync when connection returns',
              'PWA installation for native app experience',
            ]}
            image={featureQr}
            imageAlt="QR Transfer"
            glowColor="hsl(210 100% 50% / 0.06)"
          />
        </div>
      </section>

      {/* Additional Features Grid */}
      <section className="py-24 px-6 bg-surface-dim/50">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-2xl md:text-3xl font-display font-bold text-foreground text-center mb-12"
          >
            And Much More
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {additionalFeatures.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="rounded-2xl border border-border/40 bg-card/50 p-6 hover:border-primary/20 transition-all duration-300"
              >
                <f.icon className="w-8 h-8 text-primary mb-3" strokeWidth={1.5} />
                <h3 className="font-display font-bold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Lovable + CTA */}
      <section className="py-16 px-6 text-center">
        <p className="text-sm text-muted-foreground/50 flex items-center justify-center gap-2 mb-12">
          Made with <span className="text-alliance-red text-base">♥</span> by{' '}
          <a href="https://lovable.dev" target="_blank" rel="noopener noreferrer" className="text-primary/60 hover:text-primary transition-colors font-medium">Lovable</a>
        </p>
        <Link
          to="/auth"
          className="inline-block px-10 py-4 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-[0_0_30px_hsl(210_100%_50%/0.4)] hover:shadow-[0_0_45px_hsl(210_100%_50%/0.6)] text-lg"
        >
          Start Scouting Now
        </Link>
      </section>
    </LandingLayout>
  );
}

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LandingLayout } from '@/components/landing/LandingLayout';
import { SEOHead } from '@/components/landing/SEOHead';
import {
  ClipboardList, Wrench, BarChart3, Users, Radio, CalendarDays,
  UserCheck, QrCode, Share2, Shield, Wifi, Database
} from 'lucide-react';
import featureMatchScout from '@/assets/landing/feature-match-scout-real.png';
import featurePitScout from '@/assets/landing/feature-pit-scout-real.png';
import featureTeamDetail from '@/assets/landing/feature-team-detail-real.png';
import featureQR from '@/assets/landing/feature-qr-real.png';
import featureLiveStats from '@/assets/landing/feature-live-stats-real.png';
import featureDashboard from '@/assets/landing/feature-dashboard-real.png';

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
      <SEOHead
        title="Features — Cipher Scout"
        description="Match scouting, pit scouting, analytics dashboard, team comparison, QR transfer, and more. Every tool you need for FTC competition strategy."
        path="/features"
      />
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
            description="Record every detail as it happens. Qualification or playoff, the interface auto-fills team numbers from the official schedule and tracks autonomous scoring, TeleOp, defense, endgame, fouls, and notes — all in one scroll."
            bullets={[
              'Autonomous and TeleOp scoring with close/far counters',
              'Defense rating on a 0–3 scale (None → Good)',
              'Endgame return status — None, Partial, Full, or Lift',
              'Penalty and robot status tracking (Dead, Yellow, Red)',
              'Free-form notes for qualitative match observations',
              'One-tap reset and save for fast turnarounds between matches',
            ]}
            image={featureMatchScout}
            imageAlt="Match scouting form showing autonomous scoring, TeleOp counters, defense rating, endgame status, and notes fields"
            glowColor="hsl(0 85% 55% / 0.08)"
          />

          <FeatureBlock
            tag="Robot Intel"
            tagColor="text-alliance-blue"
            title="Pit Scouting"
            description="Catalog every robot before matches begin. Record drive type, scoring capabilities, autonomous consistency, endgame strategy, and snap a photo — building your team's intel database for alliance selection."
            bullets={[
              'Drive type selection — Tank, Mecanum, Swerve, or Other',
              'Capability toggles for Motifs, Artifacts, and Autonomous',
              'Autonomous consistency and reliable auto-leave ratings',
              'Preferred start position and endgame consistency',
              'Robot photo capture with secure cloud storage',
              'Load existing data to update entries throughout the event',
            ]}
            image={featurePitScout}
            imageAlt="Pit scouting form with team info, drive type selector, capability toggles, and robot photo upload"
            glowColor="hsl(210 100% 50% / 0.08)"
            reverse
          />

          <FeatureBlock
            tag="Deep Dive"
            tagColor="text-alliance-red"
            title="Team Analytics & Detail"
            description="Dive deep into any team's performance history. Scoring trends, radar profiles, endgame breakdowns, close vs far analysis, and a full match log with per-match notes give you the complete picture."
            bullets={[
              'Scoring trend line charts across all matches (Auto, TeleOp, Total)',
              'Radar profile showing strengths at a glance',
              'Endgame breakdown — Lift, Full, Partial, None distribution',
              'Close vs Far scoring comparison per match',
              'Full match log table with raw stats and scouter notes',
              'Scouting Comments section with qualitative observations per match',
            ]}
            image={featureTeamDetail}
            imageAlt="Team detail page showing scoring trends, radar chart, endgame breakdown, match log, and scouting comments"
            glowColor="hsl(0 85% 55% / 0.08)"
          />

          <FeatureBlock
            tag="Analytics"
            tagColor="text-alliance-blue"
            title="Team Dashboard & Rankings"
            description="Dual configurable ranking lists let you weigh what matters most. Each list scores teams independently — compare offensive powerhouses against defensive specialists side by side."
            bullets={[
              'Two independent ranking lists with separate weight configurations',
              'Adjustable weight sliders for every scoring category',
              'Composite scores calculated from your custom weights',
              'Official FTC rank badges pulled from the API',
              'Quick search by team number across both lists',
              'One-click drill-down to full team analytics',
            ]}
            image={featureDashboard}
            imageAlt="Dashboard with dual ranking lists showing team cards with auto, teleop, and endgame stats"
            glowColor="hsl(210 100% 50% / 0.08)"
            reverse
          />

          <FeatureBlock
            tag="Live Data"
            tagColor="text-alliance-red"
            title="Live Stats & Rankings"
            description="Pull official FTC competition rankings in real time. See every team's wins, losses, ties, ranking points, and tiebreaker scores — updated live from the FTC Events API."
            bullets={[
              'Official FTC rankings with gold, silver, and bronze badges',
              'Win/Loss/Tie records and matches played',
              'Ranking Points (RP) and Tiebreaker Points (TBP/TB2)',
              'One-tap refresh for instant updates during events',
              'Sorted by official competition ranking order',
            ]}
            image={featureLiveStats}
            imageAlt="Live Stats page showing official FTC rankings with RP, TBP scores and win/loss records"
            glowColor="hsl(0 85% 55% / 0.08)"
          />

          <FeatureBlock
            tag="Connectivity"
            tagColor="text-alliance-blue"
            title="QR Transfer"
            description="Share scouting data between devices without any internet connection. Entries are encoded into paginated QR codes that the receiving device scans to import — perfect for competition venues with unreliable Wi-Fi."
            bullets={[
              'Paginated QR codes for large data payloads',
              'Send and receive modes with simple tab switching',
              'Works completely offline — no Wi-Fi or cell signal needed',
              'Visual progress indicator showing current code and total',
              'Automatic data validation on import',
            ]}
            image={featureQR}
            imageAlt="QR Transfer page showing a paginated QR code with Send Data and Receive Data tabs"
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

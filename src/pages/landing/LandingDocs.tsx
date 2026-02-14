import { useState } from 'react';
import { motion } from 'framer-motion';
import { LandingLayout } from '@/components/landing/LandingLayout';
import { SEOHead } from '@/components/landing/SEOHead';
import {
  ClipboardList, Wrench, BarChart3, Users, QrCode, Radio, CalendarDays,
  UserCheck, Share2, Shield, Database, Settings, LogIn, ChevronDown, ChevronRight,
  Smartphone, Wifi, WifiOff, Search, SlidersHorizontal, Download, Upload,
  Eye, Edit, Trash2, Plus, CheckCircle2, AlertTriangle, BookOpen
} from 'lucide-react';

interface DocSection {
  id: string;
  icon: React.ElementType;
  title: string;
  tagColor: string;
  content: DocItem[];
}

interface DocItem {
  title: string;
  body: string;
  steps?: string[];
  tips?: string[];
}

const docSections: DocSection[] = [
  {
    id: 'getting-started',
    icon: LogIn,
    title: 'Getting Started',
    tagColor: 'text-primary',
    content: [
      {
        title: 'Creating an Account',
        body: 'Navigate to the Sign In page and click "Sign Up." Enter your name, email address, team number, and a secure password. You will receive a verification email — click the link to confirm your account.',
        steps: [
          'Go to the Sign In page (/auth)',
          'Click "Sign Up" to switch to registration mode',
          'Enter your full name, email, team number, and password',
          'Check your email for a verification link and click it',
          'Wait for an admin on your team to approve your account',
        ],
        tips: [
          'Your team number determines which team\'s data you can access',
          'You can only change your team number by requesting approval from an admin',
        ],
      },
      {
        title: 'Account Approval',
        body: 'After signing up, your account will be in a "Pending" state. A team admin must approve your account before you can access scouting features. This ensures only authorized team members can view and contribute data.',
        tips: [
          'Contact your team admin if your account stays pending',
          'Admins can approve or reject users from the Admin page',
        ],
      },
      {
        title: 'Selecting an Event',
        body: 'Once approved, you\'ll be taken to the Event Select page. Choose your current competition event from the list. All scouting data is scoped to the selected event — you can switch events at any time.',
        steps: [
          'After login, navigate to Event Select',
          'Browse available events or search by name/code',
          'Click on an event to set it as your active event',
          'All scouting and analytics will now use this event\'s data',
        ],
      },
    ],
  },
  {
    id: 'match-scouting',
    icon: ClipboardList,
    title: 'Match Scouting',
    tagColor: 'text-alliance-red',
    content: [
      {
        title: 'Recording a Match',
        body: 'Match scouting is the core of Cipher Scout. The mobile-first interface lets you record every detail during a match — autonomous scoring, teleop performance, defense, penalties, and endgame status.',
        steps: [
          'Navigate to the Scout page',
          'Enter the match number and team number (or use auto-fill from assignments)',
          'Record autonomous phase: close/far scoring, launch line status',
          'Record teleop phase: close/far scoring, defense rating (0–3)',
          'Record endgame: return status (None, Partial, Full, Lift)',
          'Note any penalties (None, Dead, Yellow Card, Red Card)',
          'Track fouls (minor and major counts)',
          'Add free-form notes for qualitative observations',
          'Submit the entry',
        ],
        tips: [
          'Use the integer steppers (+ / −) for quick scoring — they\'re optimized for touch',
          'The defense rating scale: 0 = no defense, 1 = light, 2 = moderate, 3 = heavy/effective',
          'Notes are searchable later — include specific observations like "struggled with intake" or "fast cycle times"',
          'You can submit multiple entries for the same team in the same match if needed',
        ],
      },
      {
        title: 'Autonomous Phase',
        body: 'Track scoring during the autonomous period. Record close and far scores separately and whether the robot successfully started on or reached the launch line.',
        tips: [
          'Close = scored in the closer target area, Far = scored in the farther target area',
          'Launch line toggle tracks whether the robot was on the line at the start of autonomous',
        ],
      },
      {
        title: 'TeleOp, Defense & Endgame',
        body: 'During teleop, track close and far scoring plus the robot\'s defensive effort. At the end of the match, record the endgame return status and any penalty cards received.',
        tips: [
          'Endgame statuses: Not Returned, Partial, Full, Lift (lift is the highest achievement)',
          'Penalty statuses: None, Dead (robot disabled), Yellow Card, Red Card',
        ],
      },
    ],
  },
  {
    id: 'pit-scouting',
    icon: Wrench,
    title: 'Pit Scouting',
    tagColor: 'text-alliance-blue',
    content: [
      {
        title: 'Recording Pit Data',
        body: 'Visit team pits between matches to gather robot specifications and capabilities. This data helps evaluate teams beyond their match performance.',
        steps: [
          'Navigate to the Pit Scout page',
          'Enter or select the team number and team name',
          'Record drive type (Tank, Mecanum, Swerve, Other)',
          'Set preferred start position (Close or Far)',
          'Toggle capabilities: Has Autonomous, Scores Artifacts, Scores Motifs',
          'Rate auto consistency and endgame consistency (Low, Medium, High)',
          'Set reliable auto leave status (Yes, Sometimes, No)',
          'Optionally upload a robot photo',
          'Add autonomous paths if applicable',
          'Submit the pit entry',
        ],
        tips: [
          'Pit data can be edited later — it tracks who last edited and when',
          'Robot photos help identify teams during alliance selection',
          'Be thorough — pit data provides context that match scores alone can\'t',
        ],
      },
    ],
  },
  {
    id: 'dashboard',
    icon: BarChart3,
    title: 'Analytics Dashboard',
    tagColor: 'text-alliance-red',
    content: [
      {
        title: 'Weighted Rankings',
        body: 'The Dashboard displays all scouted teams ranked by a configurable weighted score. Adjust slider weights to prioritize different categories — autonomous, teleop, defense, endgame — based on your alliance strategy.',
        steps: [
          'Navigate to the Dashboard page',
          'View the ranked team list with composite scores',
          'Click the weight configuration sliders to customize scoring',
          'Adjust weights for: Auto Close, Auto Far, Teleop Close, Teleop Far, Defense Rating, Endgame',
          'Rankings update in real-time as you adjust weights',
          'Use the search bar to find specific teams',
          'Click any team to view their detailed profile',
        ],
        tips: [
          'You can save multiple weight configurations for different strategies',
          'The dual ranking list lets you compare two different weighting strategies side by side',
          'Search by team number for quick access',
        ],
      },
      {
        title: 'Understanding Scores',
        body: 'The composite score is calculated by multiplying each team\'s average in each category by the corresponding weight, then summing the results. Higher weights mean that category has more influence on the final ranking.',
      },
    ],
  },
  {
    id: 'team-detail',
    icon: Eye,
    title: 'Team Detail',
    tagColor: 'text-primary',
    content: [
      {
        title: 'Viewing Team Profiles',
        body: 'Click on any team from the Dashboard or search to view their complete profile. Team Detail shows scoring trends, radar charts, endgame breakdowns, and full match history.',
        steps: [
          'Click a team from the Dashboard ranked list',
          'View stat cards showing averages for all scoring categories',
          'Check the scoring trend chart for performance across matches',
          'Review the radar profile for strengths at a glance',
          'See endgame breakdown with lift/full/partial/none percentages',
          'Scroll down to view the full match log table with per-match raw data',
          'Pit scouting data (if available) is shown alongside match data',
        ],
        tips: [
          'The radar chart normalizes values so you can see relative strengths',
          'Match log entries include the scouter\'s notes — hover/tap for full text',
          'Compare any team from here using the Compare button',
        ],
      },
    ],
  },
  {
    id: 'team-compare',
    icon: Users,
    title: 'Team Compare',
    tagColor: 'text-alliance-blue',
    content: [
      {
        title: 'Comparing Two Teams',
        body: 'Put any two teams head-to-head with detailed statistical comparisons. Radar chart overlays, scoring breakdowns, and match history help with data-driven alliance selection.',
        steps: [
          'Navigate to the Compare page',
          'Select Team A and Team B from the dropdowns',
          'View the radar chart overlay comparing all categories',
          'Review stat-by-stat scoring breakdown with color-coded winners',
          'Check match history for both teams',
          'Use this data to inform alliance selection decisions',
        ],
        tips: [
          'The radar chart shows normalized values — taller means better in that category',
          'Green highlighting indicates which team is stronger in each stat',
          'You can quickly swap teams or select new ones from the dropdowns',
        ],
      },
    ],
  },
  {
    id: 'live-stats',
    icon: Radio,
    title: 'Live Stats',
    tagColor: 'text-alliance-red',
    content: [
      {
        title: 'FTC API Integration',
        body: 'Live Stats pulls real-time data from the official FTC API — rankings, match results, and schedule. This supplements your scouting data with official scores.',
        steps: [
          'Navigate to Live Stats',
          'View current event rankings from the FTC API',
          'Check match results and upcoming schedule',
          'Data refreshes periodically during active events',
        ],
        tips: [
          'Live Stats requires an internet connection',
          'This data is separate from your scouting entries — it comes from FTC official sources',
          'Use alongside your own scouting data for the most complete picture',
        ],
      },
    ],
  },
  {
    id: 'match-planner',
    icon: CalendarDays,
    title: 'Match Planner',
    tagColor: 'text-primary',
    content: [
      {
        title: 'Planning Matches',
        body: 'Use the Match Planner to prepare for upcoming matches. View which teams you\'ll face, review their scouting data, and make strategic notes before stepping onto the field.',
        steps: [
          'Navigate to the Match Planner',
          'View your upcoming match schedule',
          'Click on a match to see alliance details',
          'Review scouting data for opponent teams',
          'Add strategic notes for your drive team',
        ],
      },
    ],
  },
  {
    id: 'scouter-assignments',
    icon: UserCheck,
    title: 'Scouter Assignments',
    tagColor: 'text-alliance-blue',
    content: [
      {
        title: 'Managing Scout Duties',
        body: 'Admins can assign team members to specific matches and positions. Scouts will see their assignments and can auto-fill match/team info when scouting.',
        steps: [
          'Admin navigates to the Assignments page',
          'Select a match number',
          'Assign scouters to specific team/position combinations',
          'Scouters see their assignments on their dashboard',
          'When scouting, assigned matches auto-fill the team and match number',
        ],
        tips: [
          'Spread assignments evenly to avoid burnout',
          'Assign your most experienced scouts to critical matches',
          'Scouts can still manually scout any match — assignments are just helpers',
        ],
      },
    ],
  },
  {
    id: 'qr-transfer',
    icon: QrCode,
    title: 'QR Code Transfer',
    tagColor: 'text-alliance-red',
    content: [
      {
        title: 'Sharing Data via QR Codes',
        body: 'Competition venues often have unreliable Wi-Fi. QR Transfer lets you share scouting data between devices by generating and scanning QR codes — no internet required.',
        steps: [
          'Navigate to QR Transfer',
          'Select the data you want to share (match entries, pit entries)',
          'A QR code is generated containing the encoded data',
          'The receiving device opens QR Transfer and uses the camera to scan',
          'Data is decoded and imported into the receiving device\'s local database',
          'Sync to the cloud when Wi-Fi becomes available',
        ],
        tips: [
          'QR codes can only hold limited data — large datasets may be split across multiple codes',
          'Ensure good lighting when scanning QR codes',
          'This is the primary offline data sharing method at competitions',
        ],
      },
    ],
  },
  {
    id: 'data-sharing',
    icon: Share2,
    title: 'Data Sharing & Export',
    tagColor: 'text-primary',
    content: [
      {
        title: 'Exporting Data',
        body: 'Export your scouting data in various formats for external analysis. CSV exports are available from the Spreadsheet view, and data can be shared between team members.',
        steps: [
          'Navigate to Data Sharing or the Spreadsheet page',
          'Use the export buttons to download CSV files',
          'Share exported files with teammates or analysts',
          'Import data from other team members using the import function',
        ],
        tips: [
          'CSV exports can be opened in Excel, Google Sheets, or any spreadsheet app',
          'Use the Spreadsheet view for raw data access with sorting and filtering',
        ],
      },
    ],
  },
  {
    id: 'spreadsheet',
    icon: Database,
    title: 'Spreadsheet View',
    tagColor: 'text-alliance-blue',
    content: [
      {
        title: 'Raw Data Access',
        body: 'The Spreadsheet view shows all scouting entries in a tabular format. Sort by any column, filter by team or match, and export to CSV for external analysis.',
        steps: [
          'Navigate to the Spreadsheet page',
          'View all match entries in a sortable table',
          'Click column headers to sort ascending/descending',
          'Use filters to narrow down by team number, match number, or scouter',
          'Click Export CSV to download the data',
        ],
        tips: [
          'Use filters to focus on specific teams before alliance selection',
          'The data quality indicators help identify potential entry errors',
        ],
      },
    ],
  },
  {
    id: 'admin',
    icon: Shield,
    title: 'Admin Panel',
    tagColor: 'text-alliance-red',
    content: [
      {
        title: 'Managing Your Team',
        body: 'Team admins have access to the Admin panel for user management, data oversight, and team configuration. Only admins can approve new users and manage team settings.',
        steps: [
          'Navigate to the Admin page (admin-only)',
          'View all team members and their approval status',
          'Approve or reject pending user accounts',
          'View team-wide scouting statistics',
          'Manage scouter assignments',
          'Review and moderate submitted data',
        ],
        tips: [
          'Approve new scouts promptly so they can contribute at events',
          'The admin panel shows data quality metrics to identify issues',
          'Only users with the "admin" role can access this page',
        ],
      },
      {
        title: 'Team Change Requests',
        body: 'If a user needs to switch teams (e.g., they entered the wrong team number), they can submit a team change request. Admins review and approve or deny these requests.',
      },
    ],
  },
  {
    id: 'profile',
    icon: Settings,
    title: 'Profile & Settings',
    tagColor: 'text-primary',
    content: [
      {
        title: 'Profile Settings',
        body: 'Manage your account settings, display name, and app preferences from the Profile page.',
        steps: [
          'Navigate to Profile Settings from the sidebar',
          'Update your display name',
          'Toggle between Light and Dark mode',
          'View your team number and role',
          'Request a team number change if needed',
        ],
        tips: [
          'Dark mode is the default and recommended for competition venues (easier on the eyes)',
          'Your role (scout or admin) is set by team admins',
        ],
      },
    ],
  },
  {
    id: 'offline',
    icon: WifiOff,
    title: 'Offline Mode',
    tagColor: 'text-alliance-blue',
    content: [
      {
        title: 'Working Without Internet',
        body: 'Cipher Scout is designed to work offline. All scouting data is stored locally on your device and syncs to the cloud when connectivity is restored. The app is installable as a PWA for native-like performance.',
        steps: [
          'Install the app as a PWA from your browser (Add to Home Screen)',
          'Scout matches normally even without Wi-Fi',
          'Data is stored in your browser\'s local database',
          'When internet is available, data automatically syncs to the cloud',
          'Use QR Transfer to share data between devices without internet',
        ],
        tips: [
          'The offline indicator in the bottom corner shows your connection status',
          'Always sync before clearing browser data to avoid losing entries',
          'PWA installation gives the best offline experience',
        ],
      },
    ],
  },
];

function DocSectionCard({ section }: { section: DocSection }) {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set([0]));

  const toggleItem = (index: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <motion.div
      id={section.id}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4 }}
      className="scroll-mt-24"
    >
      <div className="rounded-2xl border border-border/40 bg-card/50 overflow-hidden">
        <div className="px-6 py-5 border-b border-border/30 flex items-center gap-3">
          <section.icon className={`w-6 h-6 ${section.tagColor} shrink-0`} strokeWidth={1.5} />
          <h2 className="text-xl font-display font-bold text-foreground">{section.title}</h2>
        </div>

        <div className="divide-y divide-border/20">
          {section.content.map((item, idx) => {
            const isOpen = expandedItems.has(idx);
            return (
              <div key={idx}>
                <button
                  onClick={() => toggleItem(idx)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-muted/30 transition-colors min-h-0"
                >
                  <span className="font-medium text-foreground text-sm">{item.title}</span>
                  {isOpen
                    ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  }
                </button>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="px-6 pb-6 space-y-4"
                  >
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>

                    {item.steps && (
                      <div>
                        <h4 className="text-xs uppercase tracking-wider text-foreground/70 font-bold mb-3">Steps</h4>
                        <ol className="space-y-2">
                          {item.steps.map((step, si) => (
                            <li key={si} className="flex items-start gap-3 text-sm text-muted-foreground">
                              <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                                {si + 1}
                              </span>
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {item.tips && (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                        <h4 className="text-xs uppercase tracking-wider text-primary font-bold mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Tips
                        </h4>
                        <ul className="space-y-1.5">
                          {item.tips.map((tip, ti) => (
                            <li key={ti} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

export default function LandingDocs() {
  return (
    <LandingLayout>
      <SEOHead
        title="Documentation — Cipher Scout"
        description="Complete guide to using Cipher Scout for FTC competition scouting. Match scouting, pit scouting, analytics, team compare, QR transfer, and more."
        path="/docs"
      />

      {/* Header */}
      <section className="pt-20 pb-8 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-3 mb-4"
          >
            <BookOpen className="w-8 h-8 text-primary" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4"
          >
            Documentation
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Everything you need to know to master Cipher Scout at your next FTC competition.
          </motion.p>
        </div>
      </section>

      {/* Navigation pills */}
      <section className="px-6 pb-8">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="flex flex-wrap gap-2 justify-center"
          >
            {docSections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all border border-border/30 min-h-0"
              >
                {s.title}
              </a>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Doc sections */}
      <section className="px-6 pb-24">
        <div className="max-w-3xl mx-auto space-y-8">
          {docSections.map((section) => (
            <DocSectionCard key={section.id} section={section} />
          ))}
        </div>
      </section>
    </LandingLayout>
  );
}

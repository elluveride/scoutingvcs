import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LandingLayout } from '@/components/landing/LandingLayout';
import { SEOHead } from '@/components/landing/SEOHead';
import {
  ClipboardList, Wrench, BarChart3, Users, QrCode, Radio, CalendarDays,
  UserCheck, Share2, Shield, Database, Settings, LogIn, ChevronDown, ChevronRight,
  Smartphone, Wifi, WifiOff, Search, SlidersHorizontal, Download, Upload,
  Eye, Edit, Trash2, Plus, CheckCircle2, AlertTriangle, BookOpen, Keyboard,
  HelpCircle, Server, Cable, Bluetooth, Monitor, FileDown, RefreshCw
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
  warnings?: string[];
  code?: string;
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
        body: 'Navigate to the Sign In page and click "Sign Up." Enter your name, email address, team number, and a secure password. You will receive a verification email — click the link to confirm your account. Your team number is critical: it determines which data you can see and which team you belong to. You cannot change it without admin approval.',
        steps: [
          'Go to the Sign In page (/auth)',
          'Click "Sign Up" to switch to registration mode',
          'Enter your full name, email, team number, and password (min 6 characters)',
          'Check your email for a verification link and click it — check spam if you don\'t see it within 2 minutes',
          'Return to the app and sign in with your email and password',
          'You will see a "Pending Approval" screen — wait for your team admin to approve you',
        ],
        tips: [
          'Your team number determines which team\'s data you can access — double-check before submitting',
          'You can only change your team number later by submitting a request that an admin must approve',
          'Use a real email you can access — password resets go there',
          'If you enter the wrong team number, ask your admin to approve a team change request from the Admin panel',
        ],
        warnings: [
          'Do NOT share your password with teammates — each person needs their own account',
          'If you sign up with the wrong team number, you will NOT see your team\'s data until an admin approves a change',
        ],
      },
      {
        title: 'Account Approval & Roles',
        body: 'After signing up, your account is in "Pending" state. A team admin must approve your account before you can access any scouting features. This ensures only authorized team members can view and contribute data. There are two roles: "scout" (default) and "admin". Admins can approve users, manage assignments, and access all team settings. The first user on a team is automatically made admin.',
        steps: [
          'Sign up and verify your email',
          'Wait for an admin to approve your account on the Admin page',
          'Once approved, you\'ll be redirected to Event Select on next login',
          'Your role (scout or admin) appears on your Profile page',
        ],
        tips: [
          'Contact your team admin directly (in person or via text) if your account stays pending',
          'Admins can approve, reject, or leave accounts pending from the Admin page',
          'If your team has no admin yet, the first approved user becomes admin automatically',
        ],
      },
      {
        title: 'Selecting an Event',
        body: 'Once approved, you\'ll land on the Event Select page. Choose your current competition event from the list. ALL scouting data — match entries, pit entries, analytics, assignments — is scoped to the selected event. You can switch events at any time, and all views update instantly. Events are identified by their FTC event code (e.g., "GBEDQ" for Scotland Qualifier).',
        steps: [
          'After login, navigate to Event Select (sidebar or automatic redirect)',
          'Browse available events — they show the event name and code',
          'Click on an event to set it as your active event',
          'All pages (Dashboard, Scout, Spreadsheet, etc.) now display data for this event only',
          'To switch events later, click the event name in the sidebar or navigate back to Event Select',
        ],
        tips: [
          'Events can be created by admins — if you don\'t see yours, ask your admin to add it',
          'Switching events does NOT delete any data — each event\'s data is stored independently',
          'The event code is used in the FTC API integration for live stats',
        ],
      },
      {
        title: 'Installing as a PWA',
        body: 'Cipher Scout is a Progressive Web App (PWA). Installing it on your phone gives you an app icon, full-screen experience, and better offline support. This is strongly recommended for competition day — the installed app works without internet and feels like a native app.',
        steps: [
          'Open Cipher Scout in Chrome (Android) or Safari (iOS)',
          'Android: tap the three-dot menu → "Add to Home Screen" → "Install"',
          'iOS: tap the Share button (box with arrow) → "Add to Home Screen"',
          'The app icon appears on your home screen — tap it to launch in full-screen mode',
          'The app will cache itself for offline use automatically',
        ],
        tips: [
          'PWA installation is the single most important step for competition readiness',
          'Once installed, the app loads even without internet — cached data is available',
          'Chrome on Android gives the best PWA experience; Safari on iOS has some limitations',
          'If the "Add to Home Screen" option doesn\'t appear, make sure you\'re using Chrome or Safari (not an in-app browser)',
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
        body: 'Match scouting is the core of Cipher Scout. The mobile-first interface lets you record every detail during a match — autonomous scoring, teleop performance, defense, penalties, and endgame status. Each entry is tied to a specific event, match number, team number, and scouter. You can submit multiple entries for the same team/match if different scouters observe the same robot.',
        steps: [
          'Navigate to the Scout page from the sidebar',
          'Enter the match number and team number you\'re scouting (or tap your assignment to auto-fill)',
          'Autonomous section: use the + / − steppers for close and far scoring, toggle the launch line checkbox',
          'Track autonomous fouls: minor fouls and major fouls have separate counters',
          'Teleop section: use steppers for close and far scoring',
          'Set the defense rating slider: 0 = no defense played, 1 = light, 2 = moderate, 3 = heavy/effective',
          'Endgame section: select return status — Not Returned, Partial, Full, or Lift',
          'Penalty section: select any penalty cards — None, Dead (robot disabled), Yellow Card, or Red Card',
          'Add free-form notes in the text area — be specific about robot behavior, mechanisms, driver skill',
          'Hit "Submit Entry" — you\'ll see a success confirmation',
        ],
        tips: [
          'Integer steppers have 48px touch targets — designed for tapping during matches without looking',
          'Defense rating scale: 0 = no defense, 1 = occasional blocking, 2 = consistent defense, 3 = dominant defender that disrupted opponents',
          'Notes are searchable in the Spreadsheet view — write things like "intake jammed twice", "very fast cycles", "struggled with alignment"',
          'Duplicate entries (same team/match/scouter) are flagged with a "DUP" badge but NOT blocked — useful for re-scouting',
          'Entries save to local storage first, then sync to cloud — you won\'t lose data if you lose internet mid-match',
        ],
        warnings: [
          'Make sure you have the correct team number — scouting the wrong team corrupts your data',
          'Double-check match number before submitting — it cannot be edited after submission',
        ],
      },
      {
        title: 'Autonomous Phase Details',
        body: 'Track scoring during the 30-second autonomous period. Record close and far scores separately. Close scoring means the robot scored in the closer target area (near the alliance station). Far scoring is the target area farther away. The launch line toggle tracks whether the robot successfully started on (or reached) the designated launch line position.',
        tips: [
          'Close = scored in the closer target area relative to the alliance station',
          'Far = scored in the farther target area',
          'Launch line is a binary yes/no — did the robot end autonomous on the launch line?',
          'Minor fouls = minor rule violations (e.g., minor contact), Major fouls = significant violations (e.g., pinning, damage)',
        ],
      },
      {
        title: 'TeleOp, Defense & Endgame',
        body: 'During the teleop period (2 minutes), track close and far scoring plus the robot\'s defensive effort. Defense rating reflects how effectively the robot prevented opponents from scoring, not whether the team tried to play defense. At the end of the match, record the endgame return status — this tracks how well the robot returned to the designated endgame area.',
        tips: [
          'Endgame statuses: Not Returned (didn\'t attempt), Partial (attempted but incomplete), Full (successfully returned), Lift (highest achievement — lifted another robot)',
          'Penalty statuses: None, Dead (robot disabled during match), Yellow Card (warning), Red Card (disqualified)',
          'Defense rating is about effectiveness, not intent — a robot that tried defense but was easily bypassed gets a 1, not a 3',
          'If a robot is disabled (Dead), still record what they did before going offline',
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
        body: 'Visit team pits between matches to gather robot specifications and capabilities. Pit data provides context that match scores alone can\'t — knowing a robot has mecanum drive or a reliable autonomous routine helps predict performance and informs alliance selection. Pit entries are per-team (not per-match) and can be edited later by any team member.',
        steps: [
          'Navigate to the Pit Scout page from the sidebar',
          'Enter the team number and team name of the robot you\'re evaluating',
          'Select the drive type: Tank (skid-steer), Mecanum (omnidirectional), Swerve (independently steered modules), or Other',
          'Set preferred start position: Close (near alliance station) or Far (far side)',
          'Toggle capability flags: Has Autonomous, Scores Artifacts, Scores Motifs',
          'Rate auto consistency: Low (rarely works), Medium (works ~50%), High (works reliably)',
          'Rate endgame consistency: Low, Medium, or High',
          'Set reliable auto leave: Yes (always leaves), Sometimes, or No',
          'Optionally upload a robot photo — tap the photo area to use your camera or select an image',
          'Add autonomous paths if the team shared their planned routes',
          'Tap "Save Pit Entry" to submit',
        ],
        tips: [
          'Pit data can be edited later — each edit records who changed it and when',
          'Robot photos are extremely helpful during alliance selection — seeing the robot helps you remember it',
          'Ask teams about their best match and what went wrong in bad matches — this gives context beyond numbers',
          'Be respectful in pits — introduce yourself and your team before asking questions',
          'If a team isn\'t at their pit, come back later rather than skipping them',
        ],
        warnings: [
          'Pit data is shared across your entire team — be accurate and professional',
          'Robot photos are stored in cloud storage — they require internet to upload (but the rest of the entry saves offline)',
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
        body: 'The Dashboard is your strategic command center. It displays all scouted teams ranked by a configurable weighted composite score. You control the weight sliders to emphasize what matters most for your alliance strategy. For example, if you need a strong autonomous partner, increase the auto weights and decrease teleop weights. Rankings update in real-time as you drag sliders.',
        steps: [
          'Navigate to the Dashboard page from the sidebar',
          'View the ranked team list — each team shows their composite score and match count',
          'Click the weight configuration area (gear icon or sliders) to open the weight editor',
          'Adjust sliders for: Auto Close, Auto Far, Teleop Close, Teleop Far, Defense Rating, Endgame',
          'Each slider ranges from 0 (ignore this stat) to a maximum weight',
          'Rankings update instantly as you adjust — watch teams move up and down',
          'Use the search bar at the top to find a specific team by number',
          'Click any team row to navigate to their detailed Team Detail page',
        ],
        tips: [
          'You can save multiple weight configurations — useful for comparing "offense-heavy" vs "defense-heavy" strategies',
          'The dual ranking list lets you display two different weight configurations side by side for comparison',
          'Zero out a weight to completely ignore that category in rankings',
          'Match count shows how many times each team was scouted — more matches = more reliable averages',
          'Teams with very few matches should be evaluated cautiously — their averages may not be representative',
        ],
      },
      {
        title: 'Understanding Composite Scores',
        body: 'The composite score is calculated as: Σ(team_average_in_category × category_weight). Each team\'s average is computed across all match entries for that team in the current event. For example, if Team 12841 averaged 3.5 auto close scores across 5 matches, and the auto close weight is 2, that contributes 7.0 to their composite score. The total composite score determines the ranking order. Higher weights = more influence on the final position.',
        tips: [
          'Averages are more stable with more data — encourage your team to scout every match',
          'Outlier matches (one very good or very bad match) can skew averages — check the match log for context',
          'Defense rating averages tend to be low (most robots don\'t play defense) — weight it carefully',
        ],
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
        body: 'Click any team from the Dashboard or search to view their complete profile. Team Detail is the most comprehensive view of a single team — it combines stat cards, scoring trend charts, radar profiles, endgame breakdowns, and full match history into one page. Use this during alliance selection to make informed decisions.',
        steps: [
          'Click a team from the Dashboard ranked list, or navigate to Team Detail and enter a team number',
          'Stat cards at the top show averages for all scoring categories with trend indicators',
          'The scoring trend chart plots performance across matches — look for improvement or decline',
          'The radar profile normalizes all stats to show relative strengths at a glance',
          'Endgame breakdown shows the percentage distribution of lift/full/partial/none',
          'The match log table at the bottom lists every scouted match with raw data',
          'If pit scouting data exists for this team, it\'s displayed alongside match data',
          'Use the "Compare" button to jump to Team Compare with this team pre-selected',
        ],
        tips: [
          'The radar chart normalizes values so you can see relative strengths — a tall spike in "Defense" means they\'re good at defense relative to their other stats',
          'Match log entries include the scouter\'s notes — hover (desktop) or tap (mobile) for full text',
          'Look at the scoring trend to see if a team is improving throughout the event (upward slope) or degrading (downward)',
          'Stat cards show match count — verify the team has enough data for reliable conclusions',
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
        title: 'Head-to-Head Comparison',
        body: 'Put any two teams side-by-side with detailed statistical comparisons. The radar chart overlay shows both teams\' strengths simultaneously — areas where one team extends beyond the other are clear advantages. Stat-by-stat breakdowns with color-coded winners help during time-pressured alliance selection decisions.',
        steps: [
          'Navigate to the Compare page from the sidebar',
          'Select Team A from the first dropdown (search by number or scroll)',
          'Select Team B from the second dropdown',
          'The radar chart overlay shows both teams\' normalized stats superimposed',
          'Below the radar, each stat category shows raw averages with the winner highlighted in green',
          'Review match history for both teams at the bottom',
          'Swap teams using the swap button, or select different teams anytime',
        ],
        tips: [
          'The radar chart normalizes values — "taller" in a direction means better in that category',
          'Green highlighting on stat rows shows which team is stronger in each specific area',
          'Compare your top alliance picks against each other to find the best complement to your robot',
          'Consider comparing a team against themselves at different events to evaluate consistency',
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
        body: 'Live Stats pulls real-time data from the official FTC API — rankings, OPR (Offensive Power Rating), match results, and schedule. This supplements your scouting data with official scores. The data refreshes periodically during active events so you always have current standings.',
        steps: [
          'Navigate to Live Stats from the sidebar',
          'View current event rankings pulled from the FTC API',
          'Rankings show official rank, W-L-T record, and OPR',
          'Check match results for completed matches',
          'View the upcoming match schedule',
          'Data auto-refreshes — pull down or click refresh for manual update',
        ],
        tips: [
          'Live Stats requires an active internet connection — it won\'t work offline',
          'This data comes from FTC official sources, NOT your scouting entries — use both together for the best picture',
          'OPR (Offensive Power Rating) is calculated by FTC and estimates a team\'s scoring contribution',
          'Compare FTC official rankings with your scouting-based dashboard rankings to identify discrepancies',
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
        body: 'The Match Planner helps your drive team prepare for upcoming matches. View which teams you\'ll be allied with and against, review their scouting data at a glance, and identify strategic opportunities or threats. Use this before each match to brief your driver on what to expect.',
        steps: [
          'Navigate to the Match Planner from the sidebar',
          'View your upcoming match schedule with alliance compositions',
          'Click on a match to expand alliance details',
          'Review scouting summary data for each team in the match',
          'Identify opponent strengths (what to defend against) and weaknesses (what to exploit)',
          'Discuss strategy with your alliance partner based on the data',
        ],
        tips: [
          'Brief your drive team 2-3 matches ahead so they have time to adjust strategy',
          'Focus on opponent weaknesses — if their endgame is unreliable, prioritize your own endgame over defense',
          'Alliance partner data helps coordinate — if your partner is a strong scorer, you can play more defense',
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
        body: 'Admins assign team members to specific matches and positions (which team/robot to watch). Assignments persist in the database so they survive app restarts and device switches. When a scout opens the Match Scout page, they see their next assignment and can tap to auto-fill the match and team number.',
        steps: [
          'Admin navigates to the Assignments page from the sidebar',
          'Select a match number from the dropdown or enter it manually',
          'For each position in the match, select a scouter from your team\'s approved members',
          'Assignments save automatically — scouters see them immediately',
          'Scouters: on the Scout page, your current assignment appears at the top',
          'Tap the assignment to auto-fill match number and team number — then scout normally',
        ],
        tips: [
          'Spread assignments evenly — no one should scout more than 3-4 matches in a row without a break',
          'Assign experienced scouts to critical matches (e.g., finals, tiebreakers)',
          'Scouts can still manually scout any match — assignments are suggestions, not restrictions',
          'Assignments persist across device restarts — stored in the database, not local storage',
          'Plan assignments before the event starts based on the published match schedule',
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
        body: 'Competition venues often have unreliable Wi-Fi. QR Transfer lets you share scouting data between devices by generating and scanning QR codes — no internet required. Large datasets are automatically split into multiple chunked QR codes that are scanned in sequence. Each chunk is validated with a Zod schema on import to ensure data integrity.',
        steps: [
          'Navigate to QR Transfer from the sidebar',
          'Select the data type to share: Match Entries or Pit Entries',
          'Tap "Generate QR Code" — the app encodes your data into one or more QR chunks',
          'If data is large, you\'ll see "Chunk 1 of N" — show each chunk in sequence',
          'The receiving device opens QR Transfer and taps "Scan QR Code"',
          'Point the camera at the QR code — it auto-detects and reads the code',
          'For multi-chunk transfers, scan each chunk in order — the progress indicator shows which chunks are received',
          'Once all chunks are scanned, tap "Import" to add the data to the local database',
          'Sync to the cloud later when Wi-Fi becomes available',
        ],
        tips: [
          'Hold the phone steady and ensure good lighting when scanning — QR reading is sensitive to blur',
          'QR Transfer is the primary way to share data when there\'s no internet at a venue',
          'Each chunk is validated against a strict schema — corrupted scans are rejected, not silently imported',
          'You can re-generate QR codes as many times as needed — the source data isn\'t modified',
          'The receiving device deduplicates entries based on event code, team number, match number, and scouter ID',
        ],
        warnings: [
          'QR codes have a data capacity limit — very large datasets may produce many chunks (10+). This is normal.',
          'Scanning in bright sunlight can cause glare — move to shade if the scanner struggles',
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
        title: 'Exporting & Importing Data',
        body: 'Export your scouting data in CSV or JSON format for external analysis in Excel, Google Sheets, Tableau, or custom scripts. Data can also be imported from files — all imports are validated against Zod schemas to prevent corrupt data from entering the system.',
        steps: [
          'Navigate to Data Sharing or the Spreadsheet page',
          'Click "Export CSV" to download match entries as a comma-separated file',
          'Click "Export JSON" for a structured JSON file (better for programmatic use)',
          'To import: click the import button and select a CSV or JSON file from another team member',
          'The import validates every row/entry against the expected schema',
          'Valid entries are added to the local database; invalid rows are reported with error details',
        ],
        tips: [
          'CSV exports open directly in Excel and Google Sheets — great for coaches who prefer spreadsheets',
          'JSON exports preserve data types (numbers, booleans) more reliably than CSV',
          'Share exported files via USB drive or messaging apps when Wi-Fi isn\'t available',
          'Imports check for duplicates — entries with matching event/team/match/scouter are flagged with a DUP badge',
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
        body: 'The Spreadsheet view shows all scouting entries for the current event in a sortable, filterable table. Every column is sortable. Three filter types are available: team number, match number range, and scouter name. This is the go-to view for spotting outliers, checking data quality, and exporting data.',
        steps: [
          'Navigate to the Spreadsheet page from the sidebar',
          'View all match entries in a full-width table with horizontal scrolling on mobile',
          'Click any column header to sort ascending — click again for descending',
          'Open the filter panel to narrow results by team number, match range (min-max), or scouter',
          'Entries flagged as duplicates show a "DUP" badge — these have matching team/match/scouter',
          'Click "Export CSV" at the top to download the currently filtered data',
          'Data quality alerts appear at the top if issues are detected (e.g., unusually high scores, missing entries)',
        ],
        tips: [
          'Use the team filter before alliance selection to review all data for your top picks',
          'Sort by notes column to find entries with observations — blank notes may indicate rushed scouting',
          'Data quality indicators help catch typos (e.g., a "25" in auto close scoring is probably an error)',
          'The scouter filter helps identify if one scout\'s entries seem inconsistent with others',
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
        title: 'User Management',
        body: 'The Admin panel is restricted to users with the "admin" role. Admins manage the team roster — approving or rejecting pending signups, reviewing team members, and handling team change requests. Only admins can see the full list of all team members and their statuses.',
        steps: [
          'Navigate to the Admin page from the sidebar (admin-only — scouts won\'t see this link)',
          'View all team members organized by status: Pending, Approved, Rejected',
          'For pending users: click "Approve" to grant access or "Reject" to deny',
          'Review team change requests — users who want to switch teams must submit a request',
          'Approve or deny team change requests — approved changes take effect immediately',
          'View team-wide scouting statistics and data quality summaries',
        ],
        tips: [
          'Approve new scouts promptly — especially at events, delays mean missed matches',
          'Rejecting a user doesn\'t delete their account — they can contact you to re-request',
          'The first user to sign up on a team number is automatically made admin',
          'Admins can see data from all scouters on their team — useful for quality control',
        ],
        warnings: [
          'Only admins can see ALL user accounts for their team — this is by design for privacy',
          'Users from other teams cannot see your team\'s data (enforced at the database level with row-level security)',
        ],
      },
      {
        title: 'Team Change Requests',
        body: 'If a user signed up with the wrong team number (common mistake), they can submit a team change request from their Profile page. The request includes the current team number, requested team number, and a reason. Admins on the user\'s CURRENT team review and approve or deny the request. After approval, the user\'s team number updates and they\'ll appear under the new team.',
        tips: [
          'Team changes have a cooldown period to prevent abuse',
          'The user must explain why they need the change — this helps admins verify legitimacy',
          'After a team change, the user\'s scouting data remains associated with their original team',
        ],
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
        body: 'Manage your account display name, view your team number and role, toggle dark/light mode, and configure server mode for offline competition use. The Profile page also shows your sync status and pending offline entries.',
        steps: [
          'Navigate to Profile Settings from the sidebar',
          'Update your display name — this appears on scouting entries so teammates know who scouted what',
          'View your team number, role (scout/admin), and account status',
          'Toggle between Dark and Light mode — dark mode is default and recommended for competition venues',
          'Request a team number change if needed (requires admin approval)',
          'Configure Server Mode settings if using the local offline server (see Offline Mode section)',
        ],
        tips: [
          'Use your real name as your display name — it makes it easier for admins to identify scouters',
          'Dark mode is easier on the eyes in dim venue environments',
          'Your role is set by team admins — contact your admin if you need admin access',
        ],
      },
    ],
  },
  {
    id: 'offline',
    icon: WifiOff,
    title: 'Offline & QR Transfer',
    tagColor: 'text-alliance-blue',
    content: [
      {
        title: 'Overview: Offline Strategy',
        body: 'Cipher Scout is built for FTC events where Wi-Fi is unreliable or banned. As a PWA, it automatically queues scouting submissions in IndexedDB when offline and syncs to the cloud when internet returns. For fully offline events, scouters collect data on their phones and transfer it to a central device via QR codes.',
        tips: [
          'PWA offline mode works automatically — no setup needed beyond installing the app',
          'QR Transfer lets scouters beam data to a central "hub" device (laptop or tablet) that has internet',
          'The hub device checks for duplicate data when scanning QR codes to prevent double-counting',
          'At most events, PWA offline mode is sufficient. QR Transfer is for events with zero connectivity.',
        ],
      },
      {
        title: 'PWA Offline Mode (Automatic)',
        body: 'When installed as a PWA, the app automatically queues scouting submissions in IndexedDB when there\'s no internet. Entries sync to the cloud when connectivity is restored. The offline indicator (bottom of screen) shows your connection status and pending entry count.',
        steps: [
          'Install the app as a PWA (see Getting Started → Installing as a PWA)',
          'Scout matches normally — the app works identically online or offline',
          'When offline, entries save to your browser\'s IndexedDB (local database)',
          'The offline indicator shows "Offline Mode" and the number of pending entries',
          'When internet returns, entries auto-sync every 30 seconds',
          'You can also tap "Sync Now" on the offline indicator to force immediate sync',
          'Once synced, entries appear in the cloud for all team members to see',
        ],
        tips: [
          'The offline indicator appears at the bottom of the screen — green dot = online, red = offline',
          'Always verify your pending count is 0 before clearing browser data or switching devices',
          'Synced entries older than 7 days are automatically cleaned from local storage',
          'If sync fails for specific entries, the app retries automatically — check the indicator for error counts',
        ],
        warnings: [
          'Clearing browser data / cache WILL DELETE unsynced entries — always sync first!',
          'If you uninstall the PWA without syncing, local data is lost permanently',
          'Robot photo uploads (pit scouting) require internet — they cannot be queued offline',
        ],
      },
      {
        title: 'QR Transfer: How It Works',
        body: 'QR Transfer is the primary way to move data between devices at offline events. Scouter phones generate QR codes containing compressed match data, and a central hub device scans them. The hub checks each scanned entry against existing cloud data and flags duplicates with a DUP badge so you never double-count.',
        steps: [
          'Scouters collect match data on their phones (saved to IndexedDB when offline)',
          'After scouting, go to QR Transfer → Send Data to display QR codes of your entries',
          'On the hub device (laptop/tablet with internet), go to QR Transfer → Receive Data',
          'Tap "Start Camera" and scan each scouter\'s QR codes',
          'The scanner shows new entries in green and duplicate entries with a DUP badge',
          'Tap "Import" to save new entries to the cloud — duplicates are automatically skipped',
          'If there are multiple QR codes (large datasets), cycle through each one on the sender',
        ],
        tips: [
          'Each QR code holds ~5-8 match entries depending on data density',
          'Good lighting and a clean camera lens help the scanner read codes quickly',
          'The hub device needs internet access to check for duplicates and import data',
          'You can re-scan the same QR code safely — duplicates are detected and skipped',
        ],
      },
      {
        title: 'Event Day Workflow (Fully Offline)',
        body: 'For events with zero internet, here\'s the recommended workflow. One device (the "hub") should have mobile data or be able to connect to internet periodically.',
        steps: [
          '✅ All scouters install the PWA and log in before arriving at the event',
          '✅ At the event, scouters use Match Scout normally — data saves offline automatically',
          '✅ Between matches, scouters visit the hub and display their QR codes',
          '✅ The hub operator scans QR codes and imports new entries',
          '✅ If the hub has internet, data syncs to the cloud immediately',
          '✅ If the hub is also offline, it queues entries and syncs later (hotel, car, etc.)',
          '✅ After all matches, verify all scouter phones show 0 pending entries',
        ],
        tips: [
          'Designate one person as the "hub operator" — they stay near the pit with the laptop',
          'Have scouters show QR codes after every 2-3 matches to avoid large backlogs',
          'The hub can be any device with a camera and the app installed',
        ],
      },
    ],
  },
  {
    id: 'keyboard-shortcuts',
    icon: Keyboard,
    title: 'Keyboard Shortcuts',
    tagColor: 'text-primary',
    content: [
      {
        title: 'Navigation Shortcuts',
        body: 'These keyboard shortcuts work on desktop/laptop browsers to speed up navigation and common actions. They are disabled when a text input or textarea is focused.',
        tips: [
          'Ctrl/⌘ + K — Open the search/command palette (if available)',
          'Escape — Close any open dialog, modal, or dropdown',
          'Tab — Move focus to the next interactive element',
          'Shift + Tab — Move focus to the previous interactive element',
          'Enter — Activate the focused button or link',
          'Space — Toggle checkboxes and switches',
        ],
      },
      {
        title: 'Scouting Shortcuts',
        body: 'When on the Match Scout page, you can use keyboard shortcuts to quickly adjust values without clicking the + / − buttons.',
        tips: [
          'Arrow Up / Arrow Down — Increment or decrement the focused stepper value',
          'Tab through fields to move between scoring categories quickly',
          'Enter — Submit the scouting entry (when the Submit button is focused)',
        ],
      },
      {
        title: 'Data & Analytics Shortcuts',
        body: 'Shortcuts for the Spreadsheet, Dashboard, and Compare pages.',
        tips: [
          'Click column headers to toggle sort direction (ascending/descending)',
          'Ctrl/⌘ + F — Use browser find to search within the Spreadsheet view',
          'Escape — Close filter panels and dropdowns',
        ],
      },
    ],
  },
  {
    id: 'faq',
    icon: HelpCircle,
    title: 'FAQ & Troubleshooting',
    tagColor: 'text-alliance-red',
    content: [
      {
        title: 'I can\'t log in / my password doesn\'t work',
        body: 'First, make sure you verified your email — check your inbox and spam folder for the verification link. If you verified but still can\'t log in, try the "Forgot Password" link on the sign-in page to reset your password. If your account is pending approval, you\'ll see a message saying "Pending" — contact your team admin.',
      },
      {
        title: 'My account says "Pending" — what do I do?',
        body: 'New accounts must be approved by a team admin before they can access scouting features. This is a security measure to prevent unauthorized access. Contact your team admin in person or via text and ask them to go to the Admin page and approve your account.',
      },
      {
        title: 'I signed up with the wrong team number',
        body: 'Go to Profile Settings and submit a "Team Change Request" with your correct team number and a reason (e.g., "typo during signup"). An admin on your current team must approve the change. If your current team has no admin yet, contact the app developers for assistance.',
      },
      {
        title: 'I lost scouting data / entries are missing',
        body: 'Check the offline indicator at the bottom of the screen — if you have pending entries, they haven\'t synced yet. Tap "Sync Now" or wait for auto-sync. If you cleared your browser cache or uninstalled the app before syncing, local data is lost. Always verify the pending count is 0 before clearing data.',
        tips: [
          'Entries save to IndexedDB first, then sync to cloud — they\'re not lost unless you clear browser data',
          'The Spreadsheet view shows all synced entries — if an entry isn\'t there, it may still be pending on someone\'s phone',
          'Duplicate entries are flagged, not deleted — you won\'t accidentally lose data from re-scanning QR codes',
        ],
      },
      {
        title: 'QR code scanner isn\'t reading codes',
        body: 'Ensure good lighting — dim venues cause scanner failures. Hold the phone steady (no shaking). Make sure the QR code is fully visible in the camera frame with some margin. If the screen displaying the QR code is too dim, increase brightness. Try moving closer or further from the screen. Clean your camera lens.',
      },
      {
        title: 'QR scanner isn\'t reading codes / data not importing',
        body: 'Ensure good lighting — dim venues cause scanner failures. Hold the phone steady. Make sure the QR code is fully visible in the camera frame. If the screen displaying the QR code is too dim, increase brightness. The "Receive" side checks for duplicates — if all entries show DUP badges, the data is already in the cloud.',
      },
      {
        title: 'Data looks wrong / scores seem too high or low',
        body: 'Check the Spreadsheet view for the specific entries. Look for outliers that may be data entry errors (e.g., "25" auto close instead of "2"). Duplicate entries (DUP badge) can skew averages — review them and determine which entry is correct. If a scouter consistently enters incorrect data, an admin should discuss it with them.',
        tips: [
          'Data quality alerts at the top of the Spreadsheet page flag potential issues',
          'Sort by specific columns to find outliers quickly',
          'The scouter filter helps identify if one person\'s entries are inconsistent',
        ],
      },
      {
        title: 'The app is slow or not loading',
        body: 'Try these in order: (1) Close and reopen the app. (2) Clear the browser cache (but sync pending entries first!). (3) Check your internet connection. (4) Try a different browser (Chrome recommended). (5) If using the PWA, uninstall and reinstall it. The app is optimized for modern browsers — Chrome 90+, Safari 15+, Firefox 100+.',
      },
      {
        title: 'Can other teams see our data?',
        body: 'No. All data is protected by row-level security (RLS) at the database level. Users can only see data from their own team. Admins can see all data for their team but NOT other teams. There is no way to view another team\'s scouting entries, even with direct database access. The only way to share data with other teams is via QR Transfer or file export.',
      },
      {
        title: 'How do I become an admin?',
        body: 'The first user to sign up for a team number is automatically made admin. After that, existing admins can promote other users to admin from the Admin page. If your team has no admin (everyone was rejected or the admin left), contact the app developers for assistance.',
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
        <div className="px-4 sm:px-6 py-5 border-b border-border/30 flex items-center gap-3">
          <section.icon className={`w-6 h-6 ${section.tagColor} shrink-0`} strokeWidth={1.5} />
          <h2 className="text-lg sm:text-xl font-display font-bold text-foreground">{section.title}</h2>
        </div>

        <div className="divide-y divide-border/20">
          {section.content.map((item, idx) => {
            const isOpen = expandedItems.has(idx);
            return (
              <div key={idx}>
                <button
                  onClick={() => toggleItem(idx)}
                  className="w-full px-4 sm:px-6 py-4 flex items-center justify-between text-left hover:bg-muted/30 transition-colors min-h-[48px]"
                >
                  <span className="font-medium text-foreground text-sm pr-2">{item.title}</span>
                  {isOpen
                    ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  }
                </button>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="px-4 sm:px-6 pb-6 space-y-4"
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
                              <span className="min-w-0">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {item.code && (
                      <div className="rounded-xl bg-muted/50 border border-border/30 p-4 overflow-x-auto">
                        <pre className="text-xs text-foreground font-mono whitespace-pre-wrap break-all sm:break-normal sm:whitespace-pre">{item.code}</pre>
                      </div>
                    )}

                    {item.warnings && (
                      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                        <h4 className="text-xs uppercase tracking-wider text-destructive font-bold mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Warning
                        </h4>
                        <ul className="space-y-1.5">
                          {item.warnings.map((w, wi) => (
                            <li key={wi} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                              <span className="min-w-0">{w}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {item.tips && (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                        <h4 className="text-xs uppercase tracking-wider text-primary font-bold mb-2 flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Tips
                        </h4>
                        <ul className="space-y-1.5">
                          {item.tips.map((tip, ti) => (
                            <li key={ti} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                              <span className="min-w-0">{tip}</span>
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
  const [searchQuery, setSearchQuery] = useState('');

  // Scroll to hash on mount
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, []);

  const normalizedQuery = searchQuery.toLowerCase().trim();

  const filteredSections = normalizedQuery
    ? docSections
        .map((section) => {
          const titleMatch = section.title.toLowerCase().includes(normalizedQuery);
          const matchingContent = section.content.filter(
            (item) =>
              item.title.toLowerCase().includes(normalizedQuery) ||
              item.body.toLowerCase().includes(normalizedQuery) ||
              item.steps?.some((s) => s.toLowerCase().includes(normalizedQuery)) ||
              item.tips?.some((t) => t.toLowerCase().includes(normalizedQuery)) ||
              item.warnings?.some((w) => w.toLowerCase().includes(normalizedQuery)) ||
              (item.code && item.code.toLowerCase().includes(normalizedQuery))
          );
          if (titleMatch) return section; // show all content if section title matches
          if (matchingContent.length > 0) return { ...section, content: matchingContent };
          return null;
        })
        .filter(Boolean) as DocSection[]
    : docSections;

  return (
    <LandingLayout>
      <SEOHead
        title="Documentation — Cipher Scout"
        description="Complete guide to using Cipher Scout for FTC competition scouting. Match scouting, pit scouting, analytics, offline mode, local server setup, and more."
        path="/docs"
      />

      {/* Header */}
      <section className="pt-16 sm:pt-20 pb-6 sm:pb-8 px-4 sm:px-6">
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
            className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-foreground mb-4"
          >
            Documentation
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Everything you need to know to master Cipher Scout at your next FTC competition. No question left unanswered.
          </motion.p>
        </div>
      </section>

      {/* Search bar */}
      <section className="px-4 sm:px-6 pb-4 sm:pb-6">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="relative"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search docs — e.g. 'bluetooth', 'QR code', 'offline'..."
              className="w-full h-12 pl-12 pr-4 rounded-xl border border-border/40 bg-card/50 text-foreground placeholder:text-muted-foreground/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                aria-label="Clear search"
              >
                <span className="text-xs font-medium">✕</span>
              </button>
            )}
          </motion.div>
          {normalizedQuery && (
            <p className="mt-2 text-xs text-muted-foreground/60 text-center">
              {filteredSections.length === 0
                ? 'No results found — try different keywords'
                : `${filteredSections.length} section${filteredSections.length !== 1 ? 's' : ''} matching "${searchQuery}"`}
            </p>
          )}
        </div>
      </section>

      {/* Navigation pills */}
      {!normalizedQuery && (
        <section className="px-4 sm:px-6 pb-6 sm:pb-8">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="flex flex-wrap gap-1.5 sm:gap-2 justify-center"
            >
              {docSections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all border border-border/30 min-h-[36px] flex items-center"
                >
                  {s.title}
                </a>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* Doc sections */}
      <section className="px-4 sm:px-6 pb-24">
        <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
          {filteredSections.map((section) => (
            <DocSectionCard key={section.id} section={section} />
          ))}
        </div>
      </section>
    </LandingLayout>
  );
}

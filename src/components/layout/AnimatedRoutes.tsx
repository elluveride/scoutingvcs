import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { PageTransition } from './PageTransition';
import { ApprovalGate } from '@/components/auth/ApprovalGate';

import Auth from '@/pages/Auth';
import ResetPassword from '@/pages/ResetPassword';
import EventSelect from '@/pages/EventSelect';
import MatchScout from '@/pages/MatchScout';
import PitScout from '@/pages/PitScout';
import Spreadsheet from '@/pages/Spreadsheet';
import Dashboard from '@/pages/Dashboard';
import TeamDetail from '@/pages/TeamDetail';
import LiveStats from '@/pages/LiveStats';
import MatchPlanner from '@/pages/MatchPlanner';
import QRTransfer from '@/pages/QRTransfer';
import ScouterAssignments from '@/pages/ScouterAssignments';
import DataSharing from '@/pages/DataSharing';
import Admin from '@/pages/Admin';
import ProfileSettings from '@/pages/ProfileSettings';
import NotFound from '@/pages/NotFound';

export function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Auth /></PageTransition>} />
        <Route path="/auth" element={<PageTransition><Auth /></PageTransition>} />
        <Route path="/reset-password" element={<PageTransition><ResetPassword /></PageTransition>} />
        <Route path="/event-select" element={<ApprovalGate><PageTransition><EventSelect /></PageTransition></ApprovalGate>} />
        <Route path="/scout" element={<ApprovalGate><PageTransition><MatchScout /></PageTransition></ApprovalGate>} />
        <Route path="/pit" element={<ApprovalGate><PageTransition><PitScout /></PageTransition></ApprovalGate>} />
        <Route path="/spreadsheet" element={<ApprovalGate><PageTransition><Spreadsheet /></PageTransition></ApprovalGate>} />
        <Route path="/dashboard" element={<ApprovalGate><PageTransition><Dashboard /></PageTransition></ApprovalGate>} />
        <Route path="/team" element={<ApprovalGate><PageTransition><TeamDetail /></PageTransition></ApprovalGate>} />
        <Route path="/live-stats" element={<ApprovalGate><PageTransition><LiveStats /></PageTransition></ApprovalGate>} />
        <Route path="/planner" element={<ApprovalGate><PageTransition><MatchPlanner /></PageTransition></ApprovalGate>} />
        <Route path="/qr-transfer" element={<ApprovalGate><PageTransition><QRTransfer /></PageTransition></ApprovalGate>} />
        <Route path="/assignments" element={<ApprovalGate><PageTransition><ScouterAssignments /></PageTransition></ApprovalGate>} />
        <Route path="/sharing" element={<ApprovalGate><PageTransition><DataSharing /></PageTransition></ApprovalGate>} />
        <Route path="/admin" element={<ApprovalGate><PageTransition><Admin /></PageTransition></ApprovalGate>} />
        <Route path="/profile" element={<ApprovalGate><PageTransition><ProfileSettings /></PageTransition></ApprovalGate>} />
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
}

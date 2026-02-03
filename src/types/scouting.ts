// FTC DECODE Scouting App Types

export type UserRole = 'admin' | 'scout';
export type UserStatus = 'pending' | 'approved' | 'rejected';

export type DriveType = 'tank' | 'mecanum' | 'swerve' | 'other';
export type ConsistencyLevel = 'low' | 'medium' | 'high';
export type AutoLeaveStatus = 'yes' | 'sometimes' | 'no';
export type EndgameReturnStatus = 'not_returned' | 'partial' | 'full' | 'lift';
export type PenaltyStatus = 'none' | 'dead' | 'yellow_card' | 'red_card';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  eventCode: string | null;
  createdAt: string;
}

export interface Event {
  id: string;
  code: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

export interface MatchEntry {
  id: string;
  eventCode: string;
  teamNumber: number;
  matchNumber: number;
  scouterId: string;
  
  // Autonomous
  autoScoredClose: number;
  autoScoredFar: number;
  autoFoulsMinor: number;
  autoFoulsMajor: number;
  onLaunchLine: boolean;
  
  // TeleOp
  teleopScoredClose: number;
  teleopScoredFar: number;
  defenseRating: number; // 0-3
  
  // Endgame
  endgameReturn: EndgameReturnStatus;
  penaltyStatus: PenaltyStatus;
  
  timestamp: string;
}

export interface PitEntry {
  id: string;
  eventCode: string;
  teamNumber: number;
  teamName: string;
  
  // Robot Info
  driveType: DriveType;
  
  // Capabilities
  scoresMotifs: boolean;
  scoresArtifacts: boolean;
  hasAutonomous: boolean;
  autoConsistency: ConsistencyLevel;
  reliableAutoLeave: AutoLeaveStatus;
  
  // Endgame
  partialParkCapable: boolean;
  fullParkCapable: boolean;
  endgameConsistency: ConsistencyLevel;
  
  // Autonomous paths (stored as JSON)
  autoPaths: AutoPath[];
  
  lastEditedBy: string;
  lastEditedAt: string;
}

export interface AutoPath {
  id: string;
  side: 'red' | 'blue';
  label: string;
  points: PathPoint[];
  markers: PathMarker[];
}

export interface PathPoint {
  x: number;
  y: number;
}

export interface PathMarker {
  x: number;
  y: number;
  type: 'motif' | 'artifact' | 'park';
}

export interface TeamStats {
  teamNumber: number;
  matchesPlayed: number;
  avgAutoClose: number;
  avgAutoFar: number;
  autoTotalAvg: number;
  avgTeleopClose: number;
  avgTeleopFar: number;
  teleopTotalAvg: number;
  avgFoulsMinor: number;
  avgFoulsMajor: number;
  onLaunchLinePercent: number;
  avgDefense: number;
  liftPercent: number;
  fullReturnPercent: number;
  partialReturnPercent: number;
  penaltyRate: number;
  varianceScore: number;
  selectionScore: number;
}

// For configurable dashboard sorting
export interface SortWeight {
  id: string;
  label: string;
  weight: number;
  enabled: boolean;
}

export interface SortConfig {
  name: string;
  weights: SortWeight[];
}

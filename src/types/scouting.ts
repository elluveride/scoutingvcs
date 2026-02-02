// FTC DECODE Scouting App Types

export type UserRole = 'admin' | 'scout';
export type UserStatus = 'pending' | 'approved' | 'rejected';

export type ParkStatus = 'none' | 'partial' | 'full';
export type AllianceType = 'PPG' | 'PGP' | 'GPP';
export type DriveType = 'tank' | 'mecanum' | 'swerve' | 'other';
export type ConsistencyLevel = 'low' | 'medium' | 'high';
export type AutoLeaveStatus = 'yes' | 'sometimes' | 'no';

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
  autoMotifs: number; // max 3
  autoArtifacts: number;
  autoLeave: boolean;
  
  // TeleOp
  teleopMotifs: number;
  teleopArtifacts: number;
  
  // Endgame
  parkStatus: ParkStatus;
  
  // Alliance
  allianceType: AllianceType;
  
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
  avgAutoMotifs: number;
  avgAutoArtifacts: number;
  autoLeavePercent: number;
  avgTeleopMotifs: number;
  avgTeleopArtifacts: number;
  fullParkPercent: number;
  partialParkPercent: number;
  varianceScore: number;
  failureRate: number;
  selectionScore: number;
}

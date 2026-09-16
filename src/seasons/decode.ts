import type { SeasonConfig } from './types';
import { DECODE_POINTS as POINTS } from '@/lib/prediction';

/**
 * DECODE — official FTC game for the 2025-26 season.
 * Mirrors the existing match_entries schema; this config exists so future
 * seasons can be added without rewriting MatchScout / PitScout.
 */
export const decode: SeasonConfig = {
  id: 'decode',
  name: 'DECODE (2025-26)',
  seasonYear: 2025,
  summary:
    'Close/far classified scoring in both phases, pattern-match and depot bonuses, ' +
    'and a partial/full/lift base return at endgame.',
  points: {
    LEAVE: POINTS.LEAVE,
    CLASSIFIED_AUTO: POINTS.CLASSIFIED_AUTO,
    CLASSIFIED_TELEOP: POINTS.CLASSIFIED_TELEOP,
    OVERFLOW_AUTO: POINTS.OVERFLOW_AUTO,
    OVERFLOW_TELEOP: POINTS.OVERFLOW_TELEOP,
    EXTRAS: {
      DEPOT: POINTS.DEPOT,
      PATTERN_MATCH: POINTS.PATTERN_MATCH,
      BASE_BOTH_FULL_BONUS: POINTS.BASE_BOTH_FULL_BONUS,
    },
    ENDGAME: {
      partial: POINTS.BASE_PARTIAL,
      full: POINTS.BASE_FULL,
      lift: POINTS.BASE_FULL,
      not_returned: 0,
    },
    MINOR_FOUL: POINTS.MINOR_FOUL,
    MAJOR_FOUL: POINTS.MAJOR_FOUL,
  },
  counters: [
    { key: 'auto_scored_close', short: 'Close', label: 'Auto Close', phase: 'auto', min: 0,
      pointsEach: POINTS.CLASSIFIED_AUTO },
    { key: 'auto_scored_far', short: 'Far', label: 'Auto Far', phase: 'auto', min: 0,
      pointsEach: POINTS.OVERFLOW_AUTO },
    { key: 'auto_pattern_matches', short: 'Pattern', label: 'Auto Pattern Matches', phase: 'auto', min: 0,
      pointsEach: POINTS.PATTERN_MATCH },
    { key: 'auto_fouls_minor', short: 'Minor', label: 'Minor Fouls', phase: 'auto', min: 0,
      pointsEach: POINTS.MINOR_FOUL, role: 'foul_minor' },
    { key: 'auto_fouls_major', short: 'Major', label: 'Major Fouls', phase: 'auto', min: 0,
      pointsEach: POINTS.MAJOR_FOUL, role: 'foul_major' },
    { key: 'teleop_scored_close', short: 'Close', label: 'TeleOp Close', phase: 'teleop', min: 0,
      pointsEach: POINTS.CLASSIFIED_TELEOP },
    { key: 'teleop_scored_far', short: 'Far', label: 'TeleOp Far', phase: 'teleop', min: 0,
      pointsEach: POINTS.OVERFLOW_TELEOP },
    { key: 'teleop_pattern_matches', short: 'Pattern', label: 'TeleOp Pattern Matches', phase: 'teleop', min: 0,
      pointsEach: POINTS.PATTERN_MATCH },
    { key: 'teleop_depot', short: 'Depot', label: 'TeleOp Depot', phase: 'teleop', min: 0,
      pointsEach: POINTS.DEPOT },
  ],
  toggles: [
    { key: 'on_launch_line', short: 'Line', label: 'On Launch Line', phase: 'auto', destructive: true,
      hint: 'Turning ON penalizes — only set if robot violated launch-line rule',
      role: 'rating' },
  ],
  enums: [
    {
      key: 'endgame_return', label: 'Return Status', phase: 'endgame',
      options: [
        { value: 'not_returned', label: 'None' },
        { value: 'partial', label: 'Partial' },
        { value: 'full', label: 'Full' },
        { value: 'lift', label: 'Lift' },
      ],
    },
    {
      key: 'penalty_status', label: 'Penalty / Robot Status', phase: 'endgame',
      options: [
        { value: 'none', label: 'None' },
        { value: 'dead', label: 'Dead' },
        { value: 'yellow_card', label: 'Yellow', color: '#eab308' },
        { value: 'red_card', label: 'Red', color: '#ef4444' },
      ],
    },
    {
      key: 'defense_rating', label: 'Defense Rating', phase: 'teleop',
      options: [
        { value: '0', label: '0', sublabel: 'None' },
        { value: '1', label: '1', sublabel: 'Partial' },
        { value: '2', label: '2', sublabel: 'Bad' },
        { value: '3', label: '3', sublabel: 'Good' },
      ],
    },
  ],
  pit: {
    driveOptions: [
      { value: 'tank', label: 'Tank' },
      { value: 'mecanum', label: 'Mecanum' },
      { value: 'swerve', label: 'Swerve' },
      { value: 'other', label: 'Other' },
    ],
    consistencyOptions: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
    ],
    autoLeaveOptions: [
      { value: 'yes', label: 'Yes' },
      { value: 'sometimes', label: 'Sometimes' },
      { value: 'no', label: 'No' },
    ],
    preferredStartOptions: [
      { value: 'close', label: 'Close' },
      { value: 'far', label: 'Far' },
    ],
    capabilities: [
      { key: 'scores_motifs', label: 'Scores Motifs' },
      { key: 'scores_artifacts', label: 'Scores Artifacts' },
      { key: 'scores_depot', label: 'Scores Depot' },
      { key: 'has_autonomous', label: 'Has Autonomous' },
    ],
  },
};

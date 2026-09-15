import type { SeasonConfig } from './types';
import { BIOBUZZ_POINTS } from '@/lib/prediction';

/**
 * BIOBUZZ — official FTC game for the 2026-27 season.
 * Point values from the BIOBUZZ Competition Manual V1.
 */
export const biobuzz: SeasonConfig = {
  id: 'biobuzz',
  name: 'BIOBUZZ (2026-27)',
  seasonYear: 2026,
  points: {
    LEAVE: BIOBUZZ_POINTS.LEAVE,
    CLASSIFIED_AUTO: 0,
    CLASSIFIED_TELEOP: 0,
    OVERFLOW_AUTO: 0,
    OVERFLOW_TELEOP: 0,
    EXTRAS: {
      AUTO_PARK: BIOBUZZ_POINTS.AUTO_PARK,
      HIVE_TIP: BIOBUZZ_POINTS.HIVE_TIP,
      CELL_REMAINING: BIOBUZZ_POINTS.CELL_REMAINING,
      BOTTOM_NECTAR_BONUS: BIOBUZZ_POINTS.BOTTOM_NECTAR_BONUS,
      FLOWER: BIOBUZZ_POINTS.FLOWER,
      GARDEN: BIOBUZZ_POINTS.GARDEN,
    },
    ENDGAME: {
      teleop_park: BIOBUZZ_POINTS.TELEOP_PARK,
      none: 0,
    },
    MINOR_FOUL: BIOBUZZ_POINTS.MINOR_FOUL,
    MAJOR_FOUL: BIOBUZZ_POINTS.MAJOR_FOUL,
  },
  counters: [
    { key: 'auto_hive_tips', label: 'Auto Hive Tips', phase: 'auto', min: 0, hint: '20 pts each' },
    { key: 'auto_fouls_minor', label: 'Auto Minor Fouls', phase: 'auto', min: 0 },
    { key: 'auto_fouls_major', label: 'Auto Major Fouls', phase: 'auto', min: 0 },
    { key: 'teleop_hive_tips', label: 'TeleOp Hive Tips', phase: 'teleop', min: 0, hint: '20 pts each' },
    { key: 'teleop_cell_remaining', label: 'Cell Elements Remaining', phase: 'teleop', min: 0, hint: '2 pts each' },
    { key: 'teleop_flower_scored', label: 'Flower Elements', phase: 'teleop', min: 0, hint: '2 pts each' },
    { key: 'teleop_bottom_nectar', label: 'Bottom Nectar Bonuses', phase: 'teleop', min: 0, hint: '5 pts each' },
    { key: 'teleop_garden', label: 'Garden Elements', phase: 'teleop', min: 0, hint: '1 pt each' },
    { key: 'defense_rating', label: 'Defense', phase: 'teleop', min: 0, max: 3 },
  ],
  toggles: [
    { key: 'auto_leave', label: 'Auto Leave', phase: 'auto', hint: '3 pts for leaving the start zone' },
    { key: 'auto_park', label: 'Auto Park', phase: 'auto', hint: '5 pts' },
    { key: 'teleop_park', label: 'Endgame Park', phase: 'endgame', hint: '5 pts' },
  ],
  enums: [
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
      { key: 'can_tip_hive', label: 'Can Tip Hive' },
      { key: 'scores_pollen', label: 'Scores Pollen' },
      { key: 'scores_nectar', label: 'Scores Nectar' },
      { key: 'scores_flower', label: 'Scores Flower' },
      { key: 'scores_garden', label: 'Scores Garden' },
      { key: 'has_autonomous', label: 'Has Autonomous' },
    ],
  },
};

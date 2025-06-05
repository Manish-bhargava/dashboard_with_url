/**
 * Configuration file for competency mapping data
 * This serves as a fallback in case the API is not available
 */

export const competencyMapFallback = {
  // Situation Management
  14: ['Situational Awareness', 'Situation Management'],
  15: ['Swiftness/Timeliness of Response', 'Situation Management'],
  16: ['Emotional Balance', 'Situation Management'],
  17: ['Stress Handling Capacity', 'Situation Management'],

  // Relationship Building
  3: ['Effective Communication', 'Relationship Building'],
  4: ['Teamwork/Collaboration', 'Relationship Building'],
  7: ['People Handling', 'Relationship Building'],
  8: ['Openness to Change', 'Relationship Building'],
  9: ['Accepting Suggestions/Criticism', 'Relationship Building'],
  10: ['High Tolerance Levels', 'Relationship Building'],

  // Quality in Healthcare Delivery
  5: ['Work Ethic', 'Quality in Healthcare Delivery'],
  6: ['Empathy', 'Quality in Healthcare Delivery'],
  11: ['Assertiveness', 'Quality in Healthcare Delivery'],
  12: ['Critical Thinking', 'Quality in Healthcare Delivery'],
  13: ['Willingness to Learn', 'Quality in Healthcare Delivery'],

  // Leadership
  18: ['Mentoring', 'Leadership'],
  19: ['Taking Initiative', 'Leadership'],
  20: ['Conflict Management', 'Leadership'],
  21: ['Ambition', 'Leadership'],
};

// API endpoint for fetching competency data
export const competencyApiEndpoint = 'https://mhbodhi.medtalent.co/api/reportanalytics/getSubCompetency';

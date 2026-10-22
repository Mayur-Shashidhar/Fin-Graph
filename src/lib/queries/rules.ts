import 'server-only';
import { query } from '@/lib/db';
import { DetectionRule } from '@/types';

/**
 * Fetches configured detection rules.
 * Parameterized to prevent SQL injection.
 */
export async function getDetectionRules(onlyEnabled = false): Promise<DetectionRule[]> {
  if (onlyEnabled) {
    const result = await query<DetectionRule>(
      `
      SELECT id, name, description, enabled, thresholds, created_at, updated_at
      FROM detection_rules
      WHERE enabled = true
      ORDER BY name ASC;
      `
    );
    return result.rows;
  }

  const result = await query<DetectionRule>(
    `
    SELECT id, name, description, enabled, thresholds, created_at, updated_at
    FROM detection_rules
    ORDER BY name ASC;
    `
  );

  return result.rows;
}

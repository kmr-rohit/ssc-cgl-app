// Hand-off between views (not persisted).
import type { Level } from '../core/types';

export interface PracticeConfig {
  topic: string;
  level: Level | 0;
  type?: string;
  mode: 'learn' | 'test';
  n: number;
  questionIds?: string[]; // explicit list (retry wrong, saved…)
  title?: string;
}

export const session: { practice: PracticeConfig | null } = { practice: null };

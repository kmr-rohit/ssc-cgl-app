// "Report a mistake": a student flags a question; the owner reviews them on the admin page.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Question } from '../core/types';
import { supabase } from './supabase';

export const REPORT_REASONS = [
  ['wrong-answer', 'The marked answer is wrong'],
  ['wrong-question', 'The question or an option is wrong'],
  ['solution', 'The solution is wrong or hard to follow'],
  ['figure', 'A figure is missing or wrong'],
  ['typo', 'Spelling or formatting'],
  ['other', 'Something else'],
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number][0];

let client: SupabaseClient | null = supabase;
/** Tests inject a client for the local stack. */
export const setReportsClient = (c: SupabaseClient) => { client = c; };
export const reportsEnabled = () => !!client;

/** File a report. 'duplicate' when this person already reported this version of the question. */
export async function reportMistake(q: Pick<Question, 'id' | 'rev'>, reason: ReportReason, note: string): Promise<'sent' | 'duplicate'> {
  if (!client) throw new Error('Reporting needs an account. This build has no account service.');
  const { data } = await client.auth.getSession();
  if (!data.session) throw new Error('Sign in to report a mistake.');
  const { error } = await client.from('content_reports').insert({ question_id: q.id, rev: q.rev ?? 1, reason, note: note.trim().slice(0, 500) });
  if (!error) return 'sent';
  if (error.code === '23505') return 'duplicate';
  throw new Error('Could not send the report. Check your connection and try again.');
}

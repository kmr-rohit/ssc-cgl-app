// Admin dashboard data. Every call is checked on the server (non-admins get "admins only"); nothing here returns
// emails or names, only counts and question ids.
import { supabase } from './supabase';

export interface DayRow { day: string; signups: number; active: number; answers: number; mocks: number }
export interface Overview {
  users: number; signedInOnce: number; new7d: number; active1d: number; active7d: number; active30d: number; returning7d: number;
  answers7d: number; accuracy7d: number | null; mocksSubmitted7d: number; mocksSubmitted: number; challenges: number; challengeScores: number;
  reportsOpen: number; reportsOpenQuestions: number; daily: DayRow[];
}
export interface HealthRow { question_id: string; rev: number; topic: string; answers: number; accuracy: number; top_wrong: number | null; top_wrong_share: number; reports: number }
export interface TopicRow { topic: string; answers: number; users: number; accuracy: number; avg_seconds: number }
export interface ReportRow { id: number; question_id: string; rev: number; reason: string; note: string; status: 'open' | 'fixed' | 'rejected'; created_at: string }

const sb = () => { if (!supabase) throw new Error('This build has no account service.'); return supabase; };
async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await sb().rpc(fn, args);
  if (error) throw new Error(error.code === '42501' ? 'This page is for admins only.' : `Could not load ${fn.replace('admin_', '').replace(/_/g, ' ')}. Check your connection.`);
  return data as T;
}

export async function amIAdmin(): Promise<boolean> {
  if (!supabase) return false;
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return false;
  const { data, error } = await supabase.rpc('am_i_admin');
  return !error && data === true;
}
export const getOverview = (days = 30) => rpc<Overview>('admin_overview', { days });
export const getQuestionHealth = (minAttempts = 5) => rpc<HealthRow[]>('admin_question_health', { min_attempts: minAttempts, max_rows: 60 });
export const getTopicStats = (days = 30) => rpc<TopicRow[]>('admin_topics', { days });
export const getReports = (status: ReportRow['status'] = 'open') => rpc<ReportRow[]>('admin_reports', { want_status: status, max_rows: 300 });
export const resolveQuestion = (qid: string, status: ReportRow['status']) => rpc<number>('admin_resolve_question', { qid, new_status: status });

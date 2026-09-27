export interface UserRow {
  id: string;
  telegram_user_id: number;
  language: string;
  status: string;
  balance_points: number;
  daily_points_granted: number;
  daily_points_remaining: number;
  daily_points_reset_at: string;
  subscription_status: string;
  active_mode: 'chat' | 'search';
  pending_task_type: 'image' | 'document' | 'audio' | 'voice' | null;
  created_at: string;
  updated_at: string;
}

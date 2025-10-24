export interface Session {
  session_id: number;
  question_id: number;
  user1_email: string;
  user2_email: string;
  is_completed: boolean;
  users_solution: string;
  created_at: Date;
}

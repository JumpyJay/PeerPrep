export interface Session {
  session_id: number;
  question_id: number;
  user1_email: string;
  user2_email: string;
  is_completed: boolean;
  created_at: Date;
}

export interface Submission {
  submission_id: number;
  session_id: number;
  question_id: number;
  user1_email: string;
  user2_email: string;
  users_solution: string;
  created_at: Date;
}

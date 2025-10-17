export interface Question {
  question_id: number;
  question_title: string;
  question_body: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string[];
  code_solution: string;
}

export type Difficulty = Question["difficulty"];

export interface QuestionSelectionParams {
  difficulty?: Difficulty;
  tags?: string[]; // topics/tags to match
  user?: string; // user identifier (e.g., email or user id)
  windowDays?: number; // repeat-avoidance window in days
}

export interface QuestionWithSolution extends Question {}

export interface QuestionSolution {
  question_id: number;
  code_solution: string;
}

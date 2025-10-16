export interface Question {
  question_id: number;
  question_title: string;
  question_body: string;
  difficulty: string;
  tags: string[];
  code_solution: string;
}

export interface Question {
  question_id: number;
  question_title: string;
  question_body: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string[];
  code_solution: string;
}

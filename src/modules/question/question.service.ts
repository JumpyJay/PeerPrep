import { questionRepository, QuestionRepository } from "./question.repository";
import { Question } from "./question.types";

/**
 * The service layer contains the core business logic for the User module.
 * It uses the repository to interact with data but is not directly aware
 * of the database itself.
 */
export class QuestionService {
  private repository: QuestionRepository;

  constructor(repository: QuestionRepository) {
    this.repository = repository;
  }

  // retrieves all question
  // for more complex function, there could be more logic inside
  async getAllQuestions(): Promise<Question[]> {
    return this.repository.findAll();
  }
}

export const questionService = new QuestionService(questionRepository);

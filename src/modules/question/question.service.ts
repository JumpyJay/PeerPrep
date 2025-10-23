import { questionRepository, QuestionRepository } from "./question.repository";
import { Question, QuestionSelectionParams } from "./question.types";

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

  async getQuestionById(id: number): Promise<Question | null> {
    return this.repository.findById(id);
  }

  async getReferenceSolution(id: number): Promise<{ question_id: number; code_solution: string } | null> {
    return this.repository.getSolutionById(id);
  }

  /**
   * Select a suitable question based on criteria and avoid recently served repeats.
   * If no question remains after exclusion, fallback to ignoring history.
   */
  async selectQuestion(params: QuestionSelectionParams): Promise<Question | null> {
    const windowDays = params.windowDays ?? Number(process.env.QUESTION_REPEAT_WINDOW_DAYS ?? 7);

    // Collect recent served IDs if user provided
    let excludeIds: number[] = [];
    if (params.user) {
      try {
        excludeIds = await this.repository.findRecentlyServedQuestionIds(params.user, windowDays);
      } catch {
        // Log and continue without exclusion if history table not ready
        console.warn("selectQuestion: could not fetch recent history; proceeding without exclusion.");
      }
    }

    // Attempt selection with exclusion first
    let selected = await this.repository.findRandomByCriteria({
      difficulty: params.difficulty,
      tags: params.tags,
      excludeIds,
    });

    // Fallback if none found
    if (!selected) {
      selected = await this.repository.findRandomByCriteria({
        difficulty: params.difficulty,
        tags: params.tags,
      });
    }

    // Record served if possible
    if (selected && params.user) {
      try {
        await this.repository.recordServed(params.user, selected.question_id);
      } catch {
        console.warn("selectQuestion: could not record served question.");
      }
    }

    return selected ?? null;
  }
}

export const questionService = new QuestionService(questionRepository);

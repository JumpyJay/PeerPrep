import { instrument } from "../../lib/monitoring/instrumentation";
import { withRetry } from "../../lib/resilience/retry";
import { TtlCache } from "../../lib/cache/ttl-cache";
import { questionRepository, QuestionRepository } from "./question.repository";
import { Question, QuestionSelectionParams } from "./question.types";

/**
 * The service layer contains the core business logic for the User module.
 * It uses the repository to interact with data but is not directly aware
 * of the database itself.
 */
export class QuestionService {
  private repository: QuestionRepository;
  private allQuestionsCache = new TtlCache<"all", Question[]>({ ttlMs: 30_000, maxEntries: 1 });
  private questionByIdCache = new TtlCache<number, Question>({ ttlMs: 60_000, maxEntries: 256 });
  private referenceSolutionCache = new TtlCache<number, { question_id: number; code_solution: string }>({
    ttlMs: 60_000,
    maxEntries: 256,
  });
  private selectionCache = new TtlCache<string, Question | null>({ ttlMs: 15_000, maxEntries: 512 });

  constructor(repository: QuestionRepository) {
    this.repository = repository;
  }

  // retrieves all question
  // for more complex function, there could be more logic inside
  async getAllQuestions(): Promise<Question[]> {
    try {
      const questions = await instrument("question.getAll", () =>
        withRetry(() => this.repository.findAll(), { retries: 2 })
      );
      const sanitized = this.sanitizeQuestionList(questions);
      this.allQuestionsCache.set("all", sanitized);
      return sanitized;
    } catch (error) {
      const fallback = this.allQuestionsCache.get("all");
      if (fallback) {
        console.warn("getAllQuestions: served data from cache due to upstream failure.");
        return fallback;
      }

      throw error;
    }
  }

  async getQuestionById(id: number): Promise<Question | null> {
    try {
      const question = await instrument("question.getById", () =>
        withRetry(() => this.repository.findById(id), { retries: 2 })
      );
      if (question) {
        this.questionByIdCache.set(id, question);
      }
      return question;
    } catch (error) {
      const fallback = this.questionByIdCache.get(id);
      if (fallback) {
        console.warn(`getQuestionById(${id}): fallback to cached response after failure.`);
        return fallback;
      }

      throw error;
    }
  }

  async getReferenceSolution(id: number): Promise<{ question_id: number; code_solution: string } | null> {
    try {
      const solution = await instrument("question.getSolution", () =>
        withRetry(() => this.repository.getSolutionById(id), { retries: 2 })
      );
      if (solution) {
        this.referenceSolutionCache.set(id, solution);
      }
      return solution;
    } catch (error) {
      const fallback = this.referenceSolutionCache.get(id);
      if (fallback) {
        console.warn(`getReferenceSolution(${id}): served cached solution due to upstream failure.`);
        return fallback;
      }

      throw error;
    }
  }

  /**
   * Select a suitable question based on criteria and avoid recently served repeats.
   * If no question remains after exclusion, fallback to ignoring history.
   */
  async selectQuestion(params: QuestionSelectionParams): Promise<Question | null> {
    const windowDays = params.windowDays ?? Number(process.env.QUESTION_REPEAT_WINDOW_DAYS ?? 7);
    const cacheKey = JSON.stringify({
      difficulty: params.difficulty,
      tags: params.tags?.slice().sort(),
      user: params.user,
    });

    // Collect recent served IDs if user provided
    let excludeIds: number[] = [];
    if (params.user) {
      try {
        excludeIds = await instrument("question.findRecentlyServed", () =>
          withRetry(() => this.repository.findRecentlyServedQuestionIds(params.user as string, windowDays), {
            retries: 1,
          })
        );
      } catch {
        // Log and continue without exclusion if history table not ready
        console.warn("selectQuestion: could not fetch recent history; proceeding without exclusion.");
      }
    }

    try {
      // Attempt selection with exclusion first
      let selected = await instrument("question.selectQuestion", () =>
        withRetry(
          () =>
            this.repository.findRandomByCriteria({
              difficulty: params.difficulty,
              tags: params.tags,
              excludeIds,
            }),
          { retries: 1 }
        )
      );

      // Fallback if none found
      if (!selected) {
        selected = await instrument("question.selectQuestion.fallback", () =>
          withRetry(
            () =>
              this.repository.findRandomByCriteria({
                difficulty: params.difficulty,
                tags: params.tags,
              }),
            { retries: 1 }
          )
        );
      }

      // Record served if possible
      if (selected && params.user) {
        try {
          await instrument("question.recordServed", () =>
            withRetry(() => this.repository.recordServed(params.user as string, selected!.question_id), {
              retries: 1,
            })
          );
        } catch {
          console.warn("selectQuestion: could not record served question.");
        }
      }

      this.selectionCache.set(cacheKey, selected ?? null);
      if (selected) {
        this.questionByIdCache.set(selected.question_id, selected);
      }

      return selected ?? null;
    } catch (error) {
      const cached = this.selectionCache.get(cacheKey);
      if (cached !== undefined) {
        console.warn(`selectQuestion: returning cached result for key=${cacheKey} after failure.`);
        return cached;
      }

      throw error;
    }
  }

  /**
   * Remove duplicate questions (by id or normalized title) before caching.
   * Prevents accidental leakage of duplicate rows while surfacing a log entry
   * for follow-up remediation.
   */
  private sanitizeQuestionList(questions: Question[]): Question[] {
    const seenIds = new Set<number>();
    const seenTitles = new Set<string>();
    const deduped: Question[] = [];

    for (const question of questions) {
      const normalizedTitle = question.question_title.trim().toLowerCase();
      if (seenIds.has(question.question_id) || seenTitles.has(normalizedTitle)) {
        console.error(
          `sanitizeQuestionList: filtered duplicate question (id=${question.question_id}, title=${question.question_title}).`
        );
        continue;
      }
      seenIds.add(question.question_id);
      seenTitles.add(normalizedTitle);
      deduped.push(question);
    }

    return deduped;
  }
}

export const questionService = new QuestionService(questionRepository);

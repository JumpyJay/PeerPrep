import { sessionRepository, SessionRepository } from "./session.repository";
import { Session } from "./session.types";

/**
 * The service layer contains the core business logic for the User module.
 * It uses the repository to interact with data but is not directly aware
 * of the database itself.
 */
export class SessionService {
  private repository: SessionRepository;

  // dependency injection: pass in the repository instance.
  constructor(repository: SessionRepository) {
    this.repository = repository;
  }

  /**
   * retrieves all session
   * for more complex function, there could be more logic inside
   */
  public async getAllSessions(): Promise<Session[]> {
    console.log("UserService: Fetching all sessions.");
    return this.repository.findAll();
  }

  // function for creating a session
  public async createSession(
    question_id: string,
    user1_email: string,
    user2_email: string
  ): Promise<Session> {
    console.log("CollabService: Creating a session.");
    return this.repository.createSession(question_id, user1_email, user2_email);
  }

  public async findSession(session_id: number): Promise<Session> {
    console.log("CollabService: Finding a session.");
    return this.repository.findSessionById(session_id);
  }

  // function for terminating a session
  // create row in submissions table
  public async terminateSession(
    session_id: string,
    code_solution: string
  ): Promise<Session> {
    console.log("CollabService: Terminating a session.");
    this.repository.createSubmission(session_id, code_solution);
    return this.repository.finishSession(session_id);
  }

  // create function to submit session
  // return value -> null ?
  public async submitSession(session_id: string, code_solution: string) {
    console.log("CollabService: Submitting a session.");
    // call finish session function in repository
    this.repository.finishSession(session_id);
    this.repository.createSubmission(session_id, code_solution);
  }
}

// Export a singleton instance of the service, injecting the repository instance.
export const sessionService = new SessionService(sessionRepository);
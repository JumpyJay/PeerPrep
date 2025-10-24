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
}

// Export a singleton instance of the service, injecting the repository instance.
export const sessionService = new SessionService(sessionRepository);

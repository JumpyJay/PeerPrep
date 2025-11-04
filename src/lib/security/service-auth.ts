type ServiceRole = "read" | "write" | "admin";

interface TokenRecord {
  token: string;
  role: ServiceRole;
}

const roleOrder: Record<ServiceRole, number> = {
  read: 0,
  write: 1,
  admin: 2,
};

function parseConfiguredTokens(): TokenRecord[] {
  const raw = process.env.SERVICE_API_TOKENS;
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const [token, role = "read"] = segment.split(":").map((value) => value.trim());
      const normalizedRole = (["read", "write", "admin"].includes(role) ? role : "read") as ServiceRole;
      return { token, role: normalizedRole };
    });
}

const configuredTokens = parseConfiguredTokens();

function extractToken(request: Request): string | null {
  const headerAuth = request.headers.get("authorization");
  if (headerAuth?.startsWith("Bearer ")) {
    return headerAuth.slice("Bearer ".length).trim();
  }
  const headerToken = request.headers.get("x-service-token");
  return headerToken ? headerToken.trim() : null;
}

function hasRequiredRole(required: ServiceRole, actual: ServiceRole): boolean {
  return roleOrder[actual] >= roleOrder[required];
}

export function assertServiceAuthorized(request: Request, requiredRole: ServiceRole = "read"): void {
  if (configuredTokens.length === 0) {
    console.warn("service-auth: SERVICE_API_TOKENS not set; allowing request but audit strongly recommended.");
    return;
  }

  const token = extractToken(request);
  if (!token) {
    throw Object.assign(new Error("Missing service token"), { status: 401 });
  }

  const record = configuredTokens.find((candidate) => candidate.token === token);
  if (!record) {
    throw Object.assign(new Error("Unauthorized service token"), { status: 403 });
  }

  if (!hasRequiredRole(requiredRole, record.role)) {
    throw Object.assign(new Error("Insufficient scope"), { status: 403 });
  }
}

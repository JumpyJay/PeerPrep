export function decodeJwtPayload(token: unknown): Record<string, unknown> | null {
  if (typeof token !== "string" || token.trim().length === 0) {
    return null;
  }

  try {
    const base64Url = token.split(".")[1]; // Get the payload part
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );

    const parsed = JSON.parse(jsonPayload);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch (e) {
    console.error("Failed to decode token", e);
    return null;
  }
}

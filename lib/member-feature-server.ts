import "server-only";
import { StudioError } from "./studio-server";
export function featureFailure(
  error: unknown,
  message = "That page stumbled. Try again.",
) {
  return Response.json(
    { error: error instanceof StudioError ? error.message : message },
    { status: error instanceof StudioError ? error.status : 503 },
  );
}

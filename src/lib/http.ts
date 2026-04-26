import { ZodError } from "zod";

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export function unauthorized() {
  return json({ error: "Authentication required." }, { status: 401 });
}

export function forbidden(message = "You do not have access to this resource.") {
  return json({ error: message }, { status: 403 });
}

export function notFound(message = "Not found.") {
  return json({ error: message }, { status: 404 });
}

export function badRequest(error: unknown) {
  if (error instanceof ZodError) {
    return json(
      {
        details: error.issues,
        error: "Invalid request body.",
      },
      { status: 400 },
    );
  }

  if (error instanceof Error) {
    return json({ error: error.message }, { status: 400 });
  }

  return json({ error: "Invalid request body." }, { status: 400 });
}

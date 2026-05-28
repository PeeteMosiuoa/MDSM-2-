import { corsError } from "./cors.js";

export async function parseBody(request) {
  try {
    const body = await request.json();
    return { data: body, error: null };
  } catch {
    return { data: null, error: "Invalid JSON body" };
  }
}

export function validateSchema(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    return { data: null, errors };
  }
  return { data: result.data, errors: null };
}

export async function validateRequest(request, schema) {
  const { data: body, error: parseError } = await parseBody(request);
  if (parseError) {
    return { data: null, response: corsError(parseError, 400) };
  }

  const { data, errors } = validateSchema(schema, body);
  if (errors) {
    return { data: null, response: corsError({ message: "Validation failed", errors }, 400) };
  }

  return { data, response: null };
}

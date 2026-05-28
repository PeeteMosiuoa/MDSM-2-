import { requireAuth } from "@/lib/auth";
import { corsResponse, handleOptions } from "@/lib/cors";

export async function GET(request) {
  const { user, response } = await requireAuth(request);
  if (response) return response;

  return corsResponse({ user });
}

export async function OPTIONS() {
  return handleOptions();
}

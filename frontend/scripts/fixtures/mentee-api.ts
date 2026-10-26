// Keep the browser fixture isolated from authentication, APIs, and the database.
export async function backendGet() {
  return { ok: false as const, error: "API calls are disabled in this fixture", status: 503 }
}

export const backendPut = backendGet

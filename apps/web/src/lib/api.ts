const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  public readonly status: number;
  public readonly data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  token?: string | null;
  body?: unknown;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });
  } catch (_error) {
    throw new ApiError(
      `API baglantisi kurulamadi (${API_BASE_URL}). Proje kokunde 'npm run dev' komutunu calistirin.`,
      0
    );
  }

  const responseText = await response.text();
  const data = responseText ? tryParseJson(responseText) : undefined;

  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "message" in data
        ? String((data as Record<string, unknown>).message)
        : "Istek basarisiz.";
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return value;
  }
}

export class JsonResponseError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "JsonResponseError";
    this.status = status;
  }
}

export async function readJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const bodyText = await response.text();

  if (!contentType.includes("application/json")) {
    throw new JsonResponseError(
      response.status >= 500
        ? "Server error. Please try again in a few minutes."
        : `Unexpected server response (${response.status}).`,
      response.status
    );
  }

  try {
    return JSON.parse(bodyText) as T;
  } catch {
    throw new JsonResponseError("Invalid server response.", response.status);
  }
}

// Uniform error envelope returned by every API error response.
// Using interface so consumers can extend it (e.g. add a requestId field).

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

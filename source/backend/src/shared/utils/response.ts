export type ApiErrors = Record<string, string> | null;

export interface ApiResponse<T = unknown> {
  status: 'SUCCESS' | 'FAIL';
  message: string;
  data: T | null;
  errors: ApiErrors;
}

export function success<T>(message: string, data: T | null = null): ApiResponse<T> {
  return { status: 'SUCCESS', message, data, errors: null };
}

export function fail(message: string, errors: ApiErrors = null): ApiResponse<null> {
  return { status: 'FAIL', message, data: null, errors };
}

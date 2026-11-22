export function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const errObj = error as {
      response?: { data?: { message?: unknown } };
      message?: unknown;
    };
    if (typeof errObj.response?.data?.message === 'string' && errObj.response.data.message.trim()) {
      return errObj.response.data.message;
    }
    if (typeof errObj.message === 'string' && errObj.message.trim()) {
      return errObj.message;
    }
  }
  return fallback;
}

export type ChatError = Error & { status?: number; code?: string; silent?: boolean };

/** Keep HTTP meaning so permissions and deployment errors are not called network failures. */
export function toChatError(error: any, fallback: string): ChatError {
  if (error?.silent || error?.code === 'ERR_CANCELED') return error;
  const detail = error?.response?.data;
  const result: ChatError = new Error(
    (typeof detail?.message === 'string' && detail.message) ||
    (typeof detail?.error === 'string' && detail.error) ||
    (typeof error?.message === 'string' && error.message) || fallback,
  );
  result.status = error?.response?.status ?? error?.status;
  result.code = detail?.code ?? error?.code;
  return result;
}

export function getChatErrorState(error: unknown) {
  const detail = error as ChatError | null;
  const status = detail?.status;
  if (status === 401 || status === 403 || status === 404) {
    return {
      title: status === 401 ? 'Please sign in again' : 'Conversation unavailable',
      message: status === 401 ? 'Your session has expired.' : status === 404
        ? 'This conversation is no longer available.'
        : 'Your account does not have access to this shop conversation.',
      retryable: false, accessDenied: true,
    };
  }
  if (detail?.code === 'CHAT_SCHEMA_NOT_READY') {
    return { title: 'Chat is being updated', message: 'Your shop’s chat setup needs to finish updating. Please try again shortly.', retryable: true, accessDenied: false };
  }
  if (status === 429) {
    return { title: 'Please try again shortly', message: 'Too many requests. Wait a moment before trying again.', retryable: true, accessDenied: false };
  }
  if (status && status >= 500) {
    return { title: 'Chat is temporarily unavailable', message: 'We could not reach the chat service. Your saved messages are still here.', retryable: true, accessDenied: false };
  }
  if (status && status >= 400) {
    return { title: 'Could not complete this request', message: detail?.message || 'Please check the request and try again.', retryable: false, accessDenied: false };
  }
  if (detail?.code === 'CHAT_INVALID_RESPONSE') {
    return { title: 'Could not load chat', message: 'The chat service returned an incomplete response. Please try again.', retryable: true, accessDenied: false };
  }
  return { title: 'Connection interrupted', message: 'Check your connection and try again. Saved conversations remain available.', retryable: true, accessDenied: false };
}

/** Only bounded retries for reads; writes may already have committed. */
export function retryChatQuery(failureCount: number, error: unknown) {
  const detail = error as ChatError | null;
  return failureCount < 2 && !detail?.silent && detail?.code !== 'ERR_CANCELED' &&
    detail?.code !== 'CHAT_SCHEMA_NOT_READY' && getChatErrorState(error).retryable;
}

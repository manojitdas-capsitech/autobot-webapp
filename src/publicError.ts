import axios from 'axios';

export function publicError(error: unknown): string {
  let message = 'Request failed';
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const githubMessage = error.response?.data?.message;
    if (typeof githubMessage === 'string' && githubMessage.length > 0) {
      message = `GitHub ${status ?? ''}: ${githubMessage}`.trim();
    } else if (status) {
      message = `Request failed (${status})`;
    } else {
      message = 'Network request failed';
    }
  } else if (error instanceof Error && error.message) {
    message = error.message;
  }

  return message
    .replace(/https:\/\/hooks\.slack\.com\/\S+/gi, 'https://hooks.slack.com/***')
    .replace(/mongodb(\+srv)?:\/\/\S+/gi, 'mongodb://***')
    .replace(/gh[pousr]_[A-Za-z0-9_]+/g, '***')
    .slice(0, 300);
}

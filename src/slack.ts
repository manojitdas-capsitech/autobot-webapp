import axios from 'axios';

export async function sendSlackMessage(text: string): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    throw new Error('SLACK_WEBHOOK_URL is not set');
  }
  await axios.post(url, { text }, { timeout: 8000, headers: { 'Content-Type': 'application/json' } });
}

import crypto from 'crypto';

export function verifyGithubSignature(rawBody: Buffer | undefined, signature: string | undefined, secret: string): boolean {
  if (!rawBody || !signature || !secret) {
    return false;
  }
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const expected = Buffer.from(`sha256=${digest}`);
  const received = Buffer.from(signature);
  if (expected.length !== received.length) {
    return false;
  }
  return crypto.timingSafeEqual(expected, received);
}

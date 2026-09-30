export function appBaseUrl(): string {
  const configured = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  return configured.replace(/\/$/, '');
}

export function webhookUrl(): string {
  return `${appBaseUrl()}/webhook`;
}

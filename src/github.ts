import axios from 'axios';
import { publicError } from './publicError';

const API = 'https://api.github.com';

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'github-automation-bot',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export interface OwnedRepo {
  fullName: string;
  private: boolean;
}

export async function exchangeOAuthCode(code: string, redirectUri: string): Promise<string> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GitHub OAuth is not configured');
  }

  const response = await axios.post(
    'https://github.com/login/oauth/access_token',
    {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    },
    { headers: { Accept: 'application/json', 'User-Agent': 'github-automation-bot' }, timeout: 10000 },
  );

  const token = response.data?.access_token;
  if (typeof token !== 'string' || token.length === 0) {
    const reason = typeof response.data?.error_description === 'string' ? response.data.error_description : 'GitHub did not return a token';
    throw new Error(reason.slice(0, 180));
  }
  return token;
}

export async function fetchGithubUser(token: string): Promise<{ id: number; login: string; name: string; avatarUrl: string }> {
  const response = await axios.get(`${API}/user`, { headers: headers(token), timeout: 10000 });
  return {
    id: response.data.id,
    login: response.data.login,
    name: response.data.name || '',
    avatarUrl: response.data.avatar_url || '',
  };
}

export async function listOwnedRepos(token: string): Promise<OwnedRepo[]> {
  const response = await axios.get(`${API}/user/repos`, {
    headers: headers(token),
    timeout: 10000,
    params: { affiliation: 'owner', per_page: 100, sort: 'updated', direction: 'desc' },
  });
  if (!Array.isArray(response.data)) {
    return [];
  }
  return response.data
    .filter((repo) => repo && typeof repo.full_name === 'string' && repo.permissions?.admin === true)
    .map((repo) => ({ fullName: repo.full_name as string, private: Boolean(repo.private) }));
}

export async function assertRepoAdmin(token: string, owner: string, repo: string): Promise<void> {
  const response = await axios.get(`${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
    headers: headers(token),
    timeout: 10000,
  });
  if (response.data?.permissions?.admin !== true) {
    throw new Error('Admin access is required to connect that repository');
  }
}

export async function createRepoWebhook(token: string, owner: string, repo: string, url: string, secret: string): Promise<number> {
  const existing = await axios.get(`${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks`, {
    headers: headers(token),
    timeout: 10000,
  });
  const hooks = Array.isArray(existing.data) ? existing.data : [];
  const current = hooks.find((hook) => hook?.config?.url === url);
  const body = {
    name: 'web',
    active: true,
    events: ['issues', 'pull_request'],
    config: {
      url,
      content_type: 'json',
      secret,
      insecure_ssl: '0',
    },
  };

  if (current?.id) {
    await axios.patch(
      `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks/${current.id}`,
      body,
      { headers: headers(token), timeout: 10000 },
    );
    return current.id as number;
  }

  const created = await axios.post(
    `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks`,
    body,
    { headers: headers(token), timeout: 10000 },
  );
  return created.data.id as number;
}

export async function deleteRepoWebhook(token: string, owner: string, repo: string, webhookId: number): Promise<void> {
  try {
    await axios.delete(
      `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks/${webhookId}`,
      { headers: headers(token), timeout: 10000 },
    );
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return;
    }
    throw new Error(publicError(error));
  }
}

export async function applyLabels(token: string, owner: string, repo: string, issueNumber: number, labels: string[]): Promise<void> {
  for (const name of labels) {
    try {
      await axios.post(
        `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/labels`,
        { name, color: 'ededed' },
        { headers: headers(token), timeout: 10000 },
      );
    } catch (error) {
      if (!(axios.isAxiosError(error) && error.response?.status === 422)) {
        throw error;
      }
    }
  }

  await axios.post(
    `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issueNumber}/labels`,
    { labels },
    { headers: headers(token), timeout: 10000 },
  );
}

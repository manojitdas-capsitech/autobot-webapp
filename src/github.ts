import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
//console.log("GitHub token inside github.ts:", GITHUB_TOKEN);

export async function applyLabels(owner: string, repo: string, issue_number: number, labels: string[]) {
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issue_number}/labels`;
  console.log(`Labeled issue/PR #${issue_number} with: [${labels.join(', ')}]`);

  await axios.post(
    url,
    { labels },
    {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'labeler-bot',
        Accept: 'application/vnd.github+json',
      },
    }
  );
}

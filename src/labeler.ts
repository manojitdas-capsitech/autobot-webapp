import { applyLabels } from './github';
import { LabelEvent } from './models/LabelEvent'; 

const labelRules: { [key: string]: string[] } = {
  bug: ['error', 'fail', 'bug'],
  frontend: ['.js', '.ts', '.tsx', '.css'],
  backend: ['api', '.go', '.py', '.ts'],
  docs: ['readme', '.md', 'doc'],
};

function getLabelsFromText(text: string): string[] {
  const matched: Set<string> = new Set();
  for (const [label, keywords] of Object.entries(labelRules)) {
    for (const keyword of keywords) {
      if (text.toLowerCase().includes(keyword)) {
        matched.add(label);
      }
    }
  }
  return [...matched];
}

export async function handleEvent(payload: any) {
  const isIssue = payload.issue;
  const isPR = payload.pull_request;

  console.log('handleEvent called');

  if (payload.action !== 'opened' && payload.action !== 'edited') {
    console.log('Skipping: action is not opened or edited');
    return;
  }

  if (!isIssue && !isPR) {
    console.log('Skipping: not an issue or PR');
    return;
  }

  const title = isIssue ? payload.issue.title : payload.pull_request.title;
  const body = isIssue ? payload.issue.body : payload.pull_request.body;
  const fullText = `${title} ${body || ''}`;
  console.log('Full text:', fullText);

  const labels = getLabelsFromText(fullText);
  if (labels.length === 0) {
    console.log('No matching labels found.');
    return;
  }

  const issueNumber = isIssue ? payload.issue.number : payload.pull_request.number;
  const repo = payload.repository.name;
  const owner = payload.repository.owner.login;

  console.log('Applying labels...:', labels);
  await applyLabels(owner, repo, issueNumber, labels);

  const doc = await LabelEvent.create({
    type: isIssue ? 'Issue' : 'PR',
    number: issueNumber,
    repo,
    labels,
    time: new Date(),
  });

  console.log('Saved event to DB:', doc);
}

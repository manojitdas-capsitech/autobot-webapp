import { applyLabels } from './github';
import { LabelEvent } from './models/LabelEvent'; 

const labelRules: { [key: string]: string[] } = {
  bug: [
    'error', 'fail', 'bug', 'broken', 'crash', 'issue',
    'unexpected', 'problem', 'stacktrace', 'trace', 'wrong', 'incorrect',
    'hang', 'freeze', 'infinite loop', 'timeout', 'exception', 'debug'
  ],
  frontend: [
    '.js', '.ts', '.tsx', '.css', 'html', 'react', 'component', 'ui', 'style',
    'button', 'layout', 'form', 'input', 'modal', 'navbar', 'dropdown', 'tooltip',
    'render', 'viewport', 'responsive', 'animation', 'tailwind', 'frontend'
  ],
  backend: [
    'api', '.go', '.py', '.ts', 'express', 'server', 'auth', 'middleware',
    'controller', 'route', 'logic', 'database', 'query', 'model', 'mongoose', 'backend',
    'cache', 'cron', 'job', 'webhook', 'rpc', 'rest', 'graphql', 'sql', 'nosql'
  ],
  docs: [
    'readme', '.md', 'doc', 'guide', 'documentation', 'manual', 'how-to',
    'tutorial', 'wiki', 'comment', 'instruction', 'spec', 'overview', 'changelog'
  ],
  devops: [
    'docker', 'kubernetes', 'deploy', 'pipeline', 'ci', 'cd', 'github actions',
    'workflow', 'build', 'release', 'infrastructure', 'container', 'yaml', 'helm'
  ],
  test: [
    'test', 'unit test', 'e2e', 'integration test', 'jest', 'mocha', 'chai',
    'cypress', 'coverage', 'mock', 'assert', 'expect', 'snapshot', 'testing'
  ],
  performance: [
    'optimize', 'slow', 'latency', 'throughput', 'memory', 'cpu', 'leak',
    'profiling', 'benchmark', 'load', 'response time', 'performance'
  ],
  security: [
    'vulnerability', 'xss', 'csrf', 'sqli', 'injection', 'encrypt', 'hash',
    'auth', 'token', 'secret', 'permission', 'secure', 'access', 'authorization'
  ],
  refactor: [
    'refactor', 'clean', 'restructure', 'rename', 'move', 'organize',
    'simplify', 'modularize', 'split', 'merge', 'deduplicate', 'tidy'
  ]
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

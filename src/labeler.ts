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

export function getLabelsFromText(text: string): string[] {
  const matched: Set<string> = new Set();
  const haystack = text.toLowerCase();
  for (const [label, keywords] of Object.entries(labelRules)) {
    for (const keyword of keywords) {
      if (haystack.includes(keyword)) {
        matched.add(label);
      }
    }
  }
  return [...matched];
}

export function titleAsksForBugAlert(title: string): boolean {
  return title.toLowerCase().includes('bug');
}

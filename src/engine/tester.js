import { execute } from '../utils/sandbox.js';

function indent(code, spaces) {
  if (!code || !code.includes('\n')) return code;
  const pad = ' '.repeat(spaces);
  return code.split('\n').map((line, i) => i === 0 ? line : pad + line).join('\n');
}

function buildTestCode(challenge, solutionCode) {
  const { language, tests } = challenge;

  if (language === 'python') {
    let testCode = solutionCode + '\n\nimport json, time, sys\n_results = []\n';
    for (const test of tests) {
      testCode += `
try:
    ${indent(test.setup, 4)}
    ${indent(test.run, 4)}
    _passed = bool(${test.assert})
    _results.append({"name": ${JSON.stringify(test.name)}, "passed": _passed, "error": None})
except Exception as _e:
    _results.append({"name": ${JSON.stringify(test.name)}, "passed": False, "error": str(_e)})
`;
    }
    testCode += '\nprint(json.dumps(_results))';
    return testCode;
  }

  if (language === 'javascript') {
    let testCode = solutionCode + '\n\nconst _results = [];\n';
    for (const test of tests) {
      testCode += `
try {
  ${indent(test.setup, 2)}
  ${indent(test.run, 2)}
  const _passed = !!(${test.assert});
  _results.push({ name: ${JSON.stringify(test.name)}, passed: _passed, error: null });
} catch (_e) {
  _results.push({ name: ${JSON.stringify(test.name)}, passed: false, error: _e.message });
}
`;
    }
    testCode += '\nconsole.log(JSON.stringify(_results));';
    return testCode;
  }

  throw new Error(`Test generation not supported for language: ${language}`);
}

export async function runTests(challenge, solutionCode, timeout = 30000) {
  const testCode = buildTestCode(challenge, solutionCode);
  const result = await execute(testCode, challenge.language, timeout);

  if (result.timedOut) {
    return {
      tests_passed: 0,
      tests_total: challenge.tests.length,
      details: challenge.tests.map(t => ({ name: t.name, passed: false, error: 'Execution timed out' })),
      execution_time_ms: timeout
    };
  }

  try {
    const lines = result.stdout.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    const details = JSON.parse(lastLine);
    return {
      tests_passed: details.filter(t => t.passed).length,
      tests_total: challenge.tests.length,
      details,
      execution_time_ms: 0
    };
  } catch {
    return {
      tests_passed: 0,
      tests_total: challenge.tests.length,
      details: challenge.tests.map(t => ({ name: t.name, passed: false, error: result.stderr || 'Failed to parse test output' })),
      execution_time_ms: 0
    };
  }
}

export function runQualitativeChecks(code, checks = []) {
  const results = {};
  for (const check of checks) {
    results[check.id] = check.patterns.some(pattern => new RegExp(pattern).test(code));
  }
  return results;
}

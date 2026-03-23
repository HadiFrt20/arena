/**
 * Custom Jest reporter — arena-style grouped test output.
 */
class ArenaReporter {
  constructor(globalConfig) {
    this._globalConfig = globalConfig;
    this._suiteResults = [];
  }

  onRunStart() {
    process.stderr.write('\n');
    process.stderr.write('  \x1b[36m╔════════════════════════════════════════════════════════╗\x1b[0m\n');
    process.stderr.write('  \x1b[36m║\x1b[0m  \x1b[1m\x1b[36m🧪  Arena Test Suite\x1b[0m\n');
    process.stderr.write('  \x1b[36m╚════════════════════════════════════════════════════════╝\x1b[0m\n');
    process.stderr.write('\n');
  }

  onTestResult(test, testResult) {
    const { testFilePath, numPassingTests, numFailingTests, testResults } = testResult;

    const parts = testFilePath.split('/tests/');
    const shortPath = parts.length > 1 ? parts[1] : testFilePath;

    const category = shortPath.startsWith('unit/') ? 'unit'
      : shortPath.startsWith('integration/') ? 'intg'
      : shortPath.startsWith('uat/') ? 'uat '
      : '    ';

    const categoryColors = { unit: '\x1b[34m', intg: '\x1b[33m', 'uat ': '\x1b[35m' };
    const cc = categoryColors[category] || '\x1b[37m';

    const total = numPassingTests + numFailingTests;
    const allPassed = numFailingTests === 0;
    const icon = allPassed ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    const countStr = allPassed
      ? `\x1b[32m${numPassingTests}/${total}\x1b[0m`
      : `\x1b[31m${numPassingTests}/${total}\x1b[0m`;

    // File name without extension
    const fileName = shortPath.replace(/\.test\.js$/, '').replace(/\//g, ' › ');

    process.stderr.write(`  ${icon}  ${cc}${category}\x1b[0m \x1b[2m│\x1b[0m ${fileName.padEnd(45)} ${countStr}\n`);

    if (numFailingTests > 0) {
      for (const tr of testResults) {
        if (tr.status === 'failed') {
          process.stderr.write(`      \x1b[31m✗ ${tr.title}\x1b[0m\n`);
        }
      }
    }

    this._suiteResults.push({ shortPath, category, numPassingTests, numFailingTests, total });
  }

  onRunComplete(contexts, results) {
    const { numPassedTests, numFailedTests, numTotalTests, numPassedTestSuites, numFailedTestSuites, numTotalTestSuites, startTime } = results;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // Group counts
    const groups = {};
    for (const sr of this._suiteResults) {
      const g = sr.category.trim();
      if (!groups[g]) groups[g] = { pass: 0, fail: 0, suites: 0 };
      groups[g].pass += sr.numPassingTests;
      groups[g].fail += sr.numFailingTests;
      groups[g].suites++;
    }

    process.stderr.write('\n');
    process.stderr.write('  \x1b[2m' + '─'.repeat(56) + '\x1b[0m\n');
    process.stderr.write('\n');

    // Per-level summary
    const levelColors = { unit: '\x1b[34m', intg: '\x1b[33m', uat: '\x1b[35m' };
    for (const [level, data] of Object.entries(groups)) {
      const lc = levelColors[level] || '\x1b[37m';
      const total = data.pass + data.fail;
      const bar = Math.round((data.pass / total) * 20);
      const icon = data.fail === 0 ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
      process.stderr.write(`  ${icon}  ${lc}${level.padEnd(6)}\x1b[0m  \x1b[32m${'█'.repeat(bar)}\x1b[31m${'█'.repeat(20 - bar)}\x1b[0m  \x1b[32m${data.pass}\x1b[0m/\x1b[2m${total}\x1b[0m  \x1b[2m(${data.suites} suites)\x1b[0m\n`);
    }

    process.stderr.write('\n');

    // Total bar
    const totalBar = Math.round((numPassedTests / numTotalTests) * 30);
    process.stderr.write(`  \x1b[32m${'█'.repeat(totalBar)}\x1b[31m${'█'.repeat(30 - totalBar)}\x1b[0m  \x1b[1m${numPassedTests}/${numTotalTests}\x1b[0m tests  \x1b[2m${elapsed}s\x1b[0m\n`);
    process.stderr.write('\n');

    if (numFailedTests === 0) {
      process.stderr.write('  \x1b[32m\x1b[1m✓ All tests passed!\x1b[0m\n');
    } else {
      process.stderr.write(`  \x1b[31m\x1b[1m✗ ${numFailedTests} test(s) failed.\x1b[0m\n`);
    }
    process.stderr.write('\n');
  }
}

export default ArenaReporter;

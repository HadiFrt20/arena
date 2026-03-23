import { spawn } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const DEFAULT_TIMEOUT = 30000;

export function execute(code, language, timeout = DEFAULT_TIMEOUT) {
  return new Promise((resolve) => {
    const tempDir = mkdtempSync(join(tmpdir(), 'arena-'));
    let cmd, args, filePath;

    if (language === 'python') {
      filePath = join(tempDir, 'solution.py');
      writeFileSync(filePath, code);
      cmd = 'python3';
      args = [filePath];
    } else if (language === 'javascript') {
      filePath = join(tempDir, 'solution.js');
      writeFileSync(filePath, code);
      cmd = 'node';
      args = ['--max-old-space-size=256', filePath];
    } else if (language === 'go') {
      filePath = join(tempDir, 'solution.go');
      writeFileSync(filePath, code);
      cmd = 'go';
      args = ['run', filePath];
    } else {
      resolve({ stdout: '', stderr: `Unsupported language: ${language}`, exitCode: 1, timedOut: false });
      return;
    }

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const proc = spawn(cmd, args, {
      cwd: tempDir,
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
    }, timeout);

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    function finish(exitCode) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
      resolve({ stdout, stderr, exitCode: exitCode ?? 1, timedOut });
    }

    proc.on('close', finish);
    proc.on('error', (err) => {
      stderr = err.message;
      finish(1);
    });
  });
}

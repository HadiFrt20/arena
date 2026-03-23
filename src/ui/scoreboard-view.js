import React from 'react';
import { render, Box, Text } from 'ink';

const h = React.createElement;

function ScoreBar({ score, width = 20, color = 'green' }) {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  return h(Text, null,
    h(Text, { color }, '█'.repeat(filled)),
    h(Text, { color: 'gray', dimColor: true }, '░'.repeat(empty)),
    h(Text, { bold: true, color }, ` ${score.toFixed(1)}`)
  );
}

function TestResult({ name, passed }) {
  return h(Text, null,
    passed
      ? h(Text, { color: 'green' }, '    ✓ ')
      : h(Text, { color: 'red' }, '    ✗ '),
    h(Text, { color: passed ? 'white' : 'gray' }, name)
  );
}

function RoundDot({ tests, total }) {
  if (tests === total) return h(Text, { color: 'green' }, '●');
  if (tests > 0) return h(Text, { color: 'yellow' }, '◐');
  return h(Text, { color: 'red' }, '○');
}

function ModelResult({ alias, result, score, isWinner, isDraw, eloDelta, passAtK, roundDetails, side }) {
  const color = isWinner ? 'green' : 'white';
  const hasRounds = roundDetails && roundDetails.length > 1;

  return h(Box, { flexDirection: 'column', width: '50%', paddingRight: 2 },
    h(Box, { marginBottom: 1 },
      h(Text, { bold: true, color, underline: isWinner }, ` ${alias} `),
      isWinner ? h(Text, { color: 'green', bold: true }, ' ★ WINNER') : null,
      isDraw ? h(Text, { color: 'yellow', bold: true }, ' ═ DRAW') : null
    ),

    h(Text, { bold: true, dimColor: true }, '  Score'),
    h(Box, { marginLeft: 2 },
      h(ScoreBar, { score, width: 20, color: isWinner ? 'green' : score >= 50 ? 'yellow' : 'red' })
    ),

    h(Box, { flexDirection: 'column', marginTop: 1 },
      h(Text, null,
        h(Text, { color: 'gray' }, '  Tests    '),
        h(Text, { bold: true, color: result.tests_passed === result.tests_total ? 'green' : result.tests_passed > 0 ? 'yellow' : 'red' },
          `${result.tests_passed}/${result.tests_total}`),
        hasRounds ? h(Text, { color: 'gray', dimColor: true }, ' (best)') : null
      ),
      h(Text, null,
        h(Text, { color: 'gray' }, '  Lines    '),
        h(Text, null, `${result.lines_of_code}`)
      ),
      h(Text, null,
        h(Text, { color: 'gray' }, '  Speed    '),
        h(Text, null, `${(result.generation_time_ms / 1000).toFixed(1)}s`)
      ),
      h(Text, null,
        h(Text, { color: 'gray' }, '  ELO      '),
        h(Text, { color: eloDelta > 0 ? 'green' : eloDelta < 0 ? 'red' : 'gray', bold: true },
          `${eloDelta > 0 ? '+' : ''}${eloDelta}`)
      )
    ),

    passAtK && Object.keys(passAtK).length > 0
      ? h(Box, { flexDirection: 'column', marginTop: 1 },
          h(Text, { bold: true, dimColor: true }, '  pass@k'),
          ...Object.entries(passAtK).map(([k, v]) =>
            h(Text, { key: k },
              h(Text, { color: 'gray' }, `    ${k}  `),
              h(Text, { bold: true, color: v >= 0.8 ? 'green' : v >= 0.5 ? 'yellow' : v > 0 ? 'red' : 'gray' },
                `${(v * 100).toFixed(0)}%`)
            )
          )
        )
      : null,

    hasRounds
      ? h(Box, { flexDirection: 'column', marginTop: 1 },
          h(Text, { bold: true, dimColor: true }, '  Rounds'),
          h(Box, { marginLeft: 2 },
            ...roundDetails.map((rd, i) => {
              const tests = side === 'left' ? rd.left_tests : rd.right_tests;
              const total = result.tests_total;
              return h(Box, { key: i, marginRight: 1 },
                h(RoundDot, { tests, total })
              );
            })
          ),
          ...roundDetails.map((rd, i) => {
            const tests = side === 'left' ? rd.left_tests : rd.right_tests;
            const sc = side === 'left' ? rd.scores.left : rd.scores.right;
            const total = result.tests_total;
            return h(Text, { key: `d${i}`, color: 'gray', dimColor: true },
              `    R${String(i + 1).padStart(2)}: `,
              h(Text, { color: tests === total ? 'green' : tests > 0 ? 'yellow' : 'red' },
                `${tests}/${total}`),
              ` (${sc.toFixed(1)})`
            );
          })
        )
      : null,

    h(Box, { flexDirection: 'column', marginTop: 1 },
      h(Text, { bold: true, dimColor: true }, hasRounds ? '  Tests (best)' : '  Tests'),
      ...(result.test_details || []).map((t, i) =>
        h(TestResult, { key: i, name: t.name, passed: t.passed })
      )
    ),

    result.qualitative && Object.keys(result.qualitative).length > 0
      ? h(Box, { flexDirection: 'column', marginTop: 1 },
          h(Text, { bold: true, dimColor: true }, '  Quality'),
          ...Object.entries(result.qualitative).map(([k, v]) =>
            h(Text, { key: k },
              v ? h(Text, { color: 'green' }, '    ✓ ') : h(Text, { color: 'red', dimColor: true }, '    ✗ '),
              h(Text, { color: v ? 'white' : 'gray', dimColor: !v }, k)
            )
          )
        )
      : null
  );
}

function Scoreboard({ battle }) {
  const { results, scores, winner, elo_delta, models, challenge, rounds, round_details, pass_at_k } = battle;
  const hasRounds = rounds && rounds > 1;
  const isDraw = winner === 'draw';

  return h(Box, { flexDirection: 'column' },
    h(Box, { marginBottom: 1 },
      h(Text, { bold: true, color: 'cyan' }, '━'.repeat(60))
    ),
    h(Box, { marginBottom: 1 },
      h(Text, { bold: true, color: 'cyan' }, '⚔  RESULTS  '),
      h(Text, null, challenge),
      hasRounds ? h(Text, { color: 'gray' }, ` (${rounds} rounds)`) : null,
      isDraw ? h(Text, { color: 'yellow', bold: true }, '  ═ DRAW') : null
    ),
    h(Text, { bold: true, color: 'cyan' }, '━'.repeat(60)),

    h(Box, { marginTop: 1 },
      h(ModelResult, {
        alias: models.left.alias,
        result: results.left,
        score: scores.left,
        isWinner: winner === 'left',
        isDraw,
        eloDelta: elo_delta,
        passAtK: pass_at_k?.left,
        roundDetails: round_details,
        side: 'left'
      }),
      h(Box, { flexDirection: 'column', alignItems: 'center', width: 3 },
        h(Text, { color: 'gray', dimColor: true }, '│')
      ),
      h(ModelResult, {
        alias: models.right.alias,
        result: results.right,
        score: scores.right,
        isWinner: winner === 'right',
        isDraw,
        eloDelta: -elo_delta,
        passAtK: pass_at_k?.right,
        roundDetails: round_details,
        side: 'right'
      })
    ),

    h(Box, { marginTop: 1 },
      h(Text, { bold: true, color: 'cyan' }, '━'.repeat(60))
    )
  );
}

export function renderScoreboard(battle) {
  const instance = render(h(Scoreboard, { battle }));
  return instance;
}

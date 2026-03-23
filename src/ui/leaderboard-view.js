import React from 'react';
import { render, Box, Text } from 'ink';

const h = React.createElement;

function EloBar({ elo, maxElo = 1600, width = 15 }) {
  const clamped = Math.max(800, Math.min(elo, maxElo));
  const filled = Math.round(((clamped - 800) / (maxElo - 800)) * width);
  const empty = width - filled;
  const color = elo >= 1300 ? 'green' : elo >= 1100 ? 'yellow' : 'red';
  return h(Text, null,
    h(Text, { color }, '█'.repeat(filled)),
    h(Text, { color: 'gray', dimColor: true }, '░'.repeat(empty))
  );
}

function MedalIcon({ rank }) {
  if (rank === 0) return h(Text, { color: 'yellow' }, '🥇');
  if (rank === 1) return h(Text, null, '🥈');
  if (rank === 2) return h(Text, { color: 'red' }, '🥉');
  return h(Text, { color: 'gray' }, '  ');
}

function LeaderboardTable({ ratings, title, totalBattles }) {
  const sorted = Object.entries(ratings)
    .map(([model, data]) => ({ model, ...data, total: data.wins + data.losses + data.draws }))
    .sort((a, b) => b.elo - a.elo);

  const maxElo = sorted.length > 0 ? Math.max(1400, sorted[0].elo + 100) : 1600;

  return h(Box, { flexDirection: 'column' },
    // Header
    h(Text, { color: 'cyan' }, '\n  ╔' + '═'.repeat(72) + '╗'),
    h(Box, null,
      h(Text, { color: 'cyan' }, '  ║'),
      h(Text, { bold: true, color: 'cyan' }, '  🏆  '),
      h(Text, { bold: true, color: 'white' }, title),
      totalBattles != null ? h(Text, { color: 'gray' }, `  (${totalBattles} battles)`) : null
    ),
    h(Text, { color: 'cyan' }, '  ╚' + '═'.repeat(72) + '╝'),
    h(Text, null, ''),

    // Column headers
    h(Box, { marginLeft: 2 },
      h(Text, { bold: true, color: 'gray' }, '  # '),
      h(Text, { bold: true, color: 'gray' }, '  Model'.padEnd(32)),
      h(Text, { bold: true, color: 'gray' }, 'ELO'.padEnd(7)),
      h(Text, { bold: true, color: 'gray' }, '  Rating'.padEnd(19)),
      h(Text, { bold: true, color: 'gray' }, 'W'.padEnd(5)),
      h(Text, { bold: true, color: 'gray' }, 'L'.padEnd(5)),
      h(Text, { bold: true, color: 'gray' }, 'D'.padEnd(5)),
      h(Text, { bold: true, color: 'gray' }, 'Win%')
    ),
    h(Text, { color: 'gray', dimColor: true }, '  ' + '─'.repeat(72)),

    // Rows
    ...sorted.map((entry, i) => {
      const winRate = entry.total > 0 ? ((entry.wins / entry.total) * 100).toFixed(0) : '—';
      const nameColor = i === 0 ? 'yellow' : i === 1 ? 'white' : i === 2 ? 'white' : 'gray';

      return h(Box, { key: entry.model, marginLeft: 2 },
        h(MedalIcon, { rank: i }),
        h(Text, { color: 'gray' }, `${String(i + 1).padStart(1)} `),
        h(Text, { color: nameColor, bold: i < 3 }, `  ${entry.model}`.padEnd(32)),
        h(Text, { bold: true, color: entry.elo >= 1200 ? 'green' : 'red' }, String(entry.elo).padEnd(7)),
        h(Text, null, '  '),
        h(EloBar, { elo: entry.elo, maxElo, width: 15 }),
        h(Text, null, '  '),
        h(Text, { color: 'green' }, String(entry.wins).padEnd(5)),
        h(Text, { color: 'red' }, String(entry.losses).padEnd(5)),
        h(Text, { color: 'gray' }, String(entry.draws).padEnd(5)),
        h(Text, { bold: true, color: parseInt(winRate) >= 50 ? 'green' : parseInt(winRate) > 0 ? 'yellow' : 'gray' },
          winRate === '—' ? '  —' : `${winRate}%`)
      );
    }),

    sorted.length === 0
      ? h(Box, { marginLeft: 2, marginTop: 1 },
          h(Text, { color: 'gray' }, '  No battles yet. Run '),
          h(Text, { color: 'cyan' }, 'arena battle'),
          h(Text, { color: 'gray' }, ' to get started.')
        )
      : null,

    h(Text, { color: 'gray', dimColor: true }, '\n  ' + '─'.repeat(72) + '\n')
  );
}

export function renderLeaderboard(ratings, title = 'Local Leaderboard', totalBattles) {
  const instance = render(h(LeaderboardTable, { ratings, title, totalBattles }));
  return instance;
}

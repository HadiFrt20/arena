import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';
import Spinner from 'ink-spinner';

const h = React.createElement;

function Header({ challenge, leftAlias, rightAlias, round, totalRounds }) {
  const title = challenge.title || '';
  const diff = challenge.difficulty || '';
  const diffColor = diff === 'easy' ? 'green' : diff === 'medium' ? 'yellow' : diff === 'hard' ? 'red' : 'white';
  const roundLabel = totalRounds > 1 ? ` Round ${round}/${totalRounds}` : '';

  return h(Box, { flexDirection: 'column', marginBottom: 1 },
    h(Box, null,
      h(Text, { color: 'cyan' }, '  '),
      h(Text, { bold: true, color: 'cyan' }, ' ARENA '),
      h(Text, { color: 'white' }, ' '),
      h(Text, { bold: true }, title),
      h(Text, null, ' '),
      h(Text, { color: diffColor }, `[${diff}]`),
      roundLabel ? h(Text, { color: 'gray' }, roundLabel) : null
    ),
    h(Box, null,
      h(Text, { color: 'cyan', dimColor: true }, '  ─────────────────────────────────────────────────────────────────────')
    ),
    h(Box, null,
      h(Text, { color: 'blue', bold: true }, `  ${leftAlias || '?'}`),
      h(Text, { color: 'gray' }, '  vs  '),
      h(Text, { color: 'magenta', bold: true }, rightAlias || '?')
    )
  );
}

function CodePane({ title, code, isStreaming, color }) {
  const lines = code.split('\n');
  const displayLines = lines.slice(-24);
  const lineCount = lines.length;
  const hiddenCount = lines.length - displayLines.length;

  return h(Box, { flexDirection: 'column', width: '50%', paddingRight: 1 },
    h(Box, null,
      h(Text, { bold: true, color }, ` ${title} `),
      h(Text, { color: 'gray' }, '│ '),
      isStreaming
        ? h(Text, { color: 'yellow' }, h(Spinner, { type: 'dots' }), ' streaming')
        : h(Text, { color: 'green' }, '● done'),
      h(Text, { color: 'gray' }, ` │ ${lineCount} lines`)
    ),
    h(Text, { color: 'gray', dimColor: true }, '  ' + '─'.repeat(36)),
    hiddenCount > 0
      ? h(Text, { color: 'gray', dimColor: true }, `  ... ${hiddenCount} lines above ...`)
      : null,
    h(Box, { flexDirection: 'column' },
      ...displayLines.map((line, i) => {
        const lineNum = hiddenCount + i + 1;
        const isRecent = i >= displayLines.length - 3;
        return h(Text, { key: i, dimColor: !isRecent },
          h(Text, { color: 'gray', dimColor: true }, `  ${String(lineNum).padStart(3)} `),
          h(Text, { color: 'gray', dimColor: true }, '│ '),
          line
        );
      })
    )
  );
}

function BattleView({ challenge, leftAlias, rightAlias, leftCode, rightCode, leftStreaming, rightStreaming, status, round, totalRounds }) {
  return h(Box, { flexDirection: 'column' },
    h(Header, { challenge, leftAlias, rightAlias, round: round || 1, totalRounds: totalRounds || 1 }),
    h(Box, { marginTop: 1 },
      h(CodePane, { title: leftAlias, code: leftCode, isStreaming: leftStreaming, color: 'blue' }),
      h(Box, { flexDirection: 'column', width: 3, alignItems: 'center' },
        h(Text, { color: 'gray', dimColor: true }, '│'),
        h(Text, { color: 'gray', dimColor: true }, '│'),
        h(Text, { color: 'gray', dimColor: true }, '│')
      ),
      h(CodePane, { title: rightAlias, code: rightCode, isStreaming: rightStreaming, color: 'magenta' })
    ),
    status ? h(Box, { marginTop: 1 },
      h(Text, { color: 'yellow' }, `  ${status}`)
    ) : null
  );
}

export function createBattleUI() {
  let _update = null;
  let state = {
    challenge: { title: '', difficulty: '' },
    leftAlias: '',
    rightAlias: '',
    leftCode: '',
    rightCode: '',
    leftStreaming: true,
    rightStreaming: true,
    status: '',
    round: 1,
    totalRounds: 1
  };

  function App() {
    const [s, setS] = useState(state);
    useEffect(() => {
      _update = (newState) => {
        state = { ...state, ...newState };
        setS({ ...state });
      };
      setS({ ...state });
    }, []);

    return h(BattleView, s);
  }

  const instance = render(h(App));

  return {
    update(newState) {
      state = { ...state, ...newState };
      if (_update) _update(newState);
    },
    unmount() {
      instance.unmount();
    }
  };
}

import type { TournamentBracket, TournamentBracketMatch } from '../types/competitions';

export interface BracketLayoutOptions {
  matchWidth?: number;
  matchHeight?: number;
  roundGap?: number;
  matchGap?: number;
  padding?: number;
}

export interface BracketMatchNode {
  match: TournamentBracketMatch;
  roundIndex: number;
  matchIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BracketConnector {
  fromMatchId: number;
  toMatchId: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  midX: number;
}

export interface BracketLayout {
  width: number;
  height: number;
  nodes: BracketMatchNode[];
  connectors: BracketConnector[];
}

const DEFAULTS: Required<BracketLayoutOptions> = {
  matchWidth: 220,
  matchHeight: 84,
  roundGap: 70,
  matchGap: 22,
  padding: 24,
};

function getSortedRounds(bracket: TournamentBracket) {
  return [...(bracket.rounds || [])].sort((a, b) => a.round_number - b.round_number);
}

export function buildBracketLayout(bracket: TournamentBracket, options?: BracketLayoutOptions): BracketLayout {
  const opts = { ...DEFAULTS, ...(options || {}) };
  const rounds = getSortedRounds(bracket);

  const nodes: BracketMatchNode[] = [];

  const roundCount = rounds.length;
  for (let roundIndex = 0; roundIndex < roundCount; roundIndex++) {
    const round = rounds[roundIndex];
    const matches = [...(round.matches || [])].sort((a, b) => a.match_number - b.match_number);

    const x = opts.padding + roundIndex * (opts.matchWidth + opts.roundGap);

    // Standard bracket spacing: each next round match is centered between two previous matches.
    // Base spacing for round 0 (first round) is matchHeight + matchGap.
    const baseSpacing = opts.matchHeight + opts.matchGap;
    const spacing = baseSpacing * Math.pow(2, roundIndex);

    for (let matchIndex = 0; matchIndex < matches.length; matchIndex++) {
      // Center each match within its spacing bucket.
      const y = opts.padding + matchIndex * spacing + (spacing - opts.matchHeight) / 2;
      nodes.push({
        match: matches[matchIndex],
        roundIndex,
        matchIndex,
        x,
        y,
        width: opts.matchWidth,
        height: opts.matchHeight,
      });
    }
  }

  const nodeByRoundAndIndex = new Map<string, BracketMatchNode>();
  for (const node of nodes) {
    nodeByRoundAndIndex.set(`${node.roundIndex}:${node.matchIndex}`, node);
  }

  const connectors: BracketConnector[] = [];
  // In single elimination with match ordering, match (r,i) feeds into match (r+1, floor(i/2)).
  for (const node of nodes) {
    const nextRoundIndex = node.roundIndex + 1;
    if (nextRoundIndex >= roundCount) continue;

    const targetIndex = Math.floor(node.matchIndex / 2);
    const nextNode = nodeByRoundAndIndex.get(`${nextRoundIndex}:${targetIndex}`);
    if (!nextNode) continue;

    const x1 = node.x + node.width;
    const y1 = node.y + node.height / 2;

    const x2 = nextNode.x;
    const y2 = nextNode.y + nextNode.height / 2;

    const midX = x1 + opts.roundGap / 2;

    connectors.push({
      fromMatchId: node.match.id,
      toMatchId: nextNode.match.id,
      x1,
      y1,
      x2,
      y2,
      midX,
    });
  }

  const width = opts.padding * 2 + roundCount * opts.matchWidth + Math.max(0, roundCount - 1) * opts.roundGap;
  const maxY = nodes.reduce((acc, n) => Math.max(acc, n.y + n.height), opts.padding);
  const height = maxY + opts.padding;

  return { width, height, nodes, connectors };
}

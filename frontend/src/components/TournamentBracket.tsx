import React, { useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { CompetitionTeam, TournamentBracket as TournamentBracketType } from '../types/competitions';
import { buildBracketLayout } from '../utils/bracketGenerator';
import { BracketMatch } from './BracketMatch';
import '../styles/TournamentBracket.css';

export interface TournamentBracketProps {
  bracket: TournamentBracketType;
  teams: CompetitionTeam[];
  onAssignTeam: (matchId: number, side: 'home' | 'away', teamId: number | null) => Promise<void> | void;
  onSetWinner: (matchId: number, winnerTeamId: number) => Promise<void> | void;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const TournamentBracket: React.FC<TournamentBracketProps> = ({ bracket, teams, onAssignTeam, onSetWinner }) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [lastWinnerMatchId, setLastWinnerMatchId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const teamSlotById = useMemo(() => {
    const map = new Map<
      number,
      { matchId: number; side: 'home' | 'away'; roundNumber: number; matchNumber: number }
    >();

    for (const r of bracket.rounds || []) {
      for (const m of r.matches || []) {
        if (m.home_team_id) {
          map.set(m.home_team_id, {
            matchId: m.id,
            side: 'home',
            roundNumber: m.round_number,
            matchNumber: m.match_number,
          });
        }
        if (m.away_team_id) {
          map.set(m.away_team_id, {
            matchId: m.id,
            side: 'away',
            roundNumber: m.round_number,
            matchNumber: m.match_number,
          });
        }
      }
    }
    return map;
  }, [bracket.rounds]);

  const sortedTeams = useMemo(() => {
    return [...(teams || [])].sort((a, b) => {
      const sa = a.seed ?? Number.POSITIVE_INFINITY;
      const sb = b.seed ?? Number.POSITIVE_INFINITY;
      if (sa !== sb) return sa - sb;
      return a.team_name.localeCompare(b.team_name);
    });
  }, [teams]);

  const layout = useMemo(() => buildBracketLayout(bracket), [bracket]);

  const handleExportPng = async () => {
    if (!wrapperRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(wrapperRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve));
      if (!blob) return;
      downloadBlob(blob, `tournament-bracket-${bracket.competition_id}.png`);
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!wrapperRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(wrapperRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait',
        unit: 'pt',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Fit image into page while preserving aspect ratio.
      const imgAspect = canvas.width / canvas.height;
      const pageAspect = pageWidth / pageHeight;

      let renderWidth = pageWidth;
      let renderHeight = pageHeight;
      if (imgAspect > pageAspect) {
        renderHeight = pageWidth / imgAspect;
      } else {
        renderWidth = pageHeight * imgAspect;
      }

      const x = (pageWidth - renderWidth) / 2;
      const y = (pageHeight - renderHeight) / 2;

      pdf.addImage(imgData, 'PNG', x, y, renderWidth, renderHeight);
      const blob = pdf.output('blob');
      downloadBlob(blob, `tournament-bracket-${bracket.competition_id}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="tournament-bracket">
      <aside className="tournament-bracket__sidebar">
        <h4>Teams</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {sortedTeams.map((t) => {
            const slot = teamSlotById.get(t.team_id);
            return (
              <div
                key={t.team_id}
                className="tournament-bracket__team"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', String(t.team_id));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                title={slot ? `Assigned: round ${slot.roundNumber}, match ${slot.matchNumber} (${slot.side})` : 'Unassigned'}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.team_name}</span>
                <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                  {slot ? `R${slot.roundNumber}` : t.seed ?? ''}
                </span>
              </div>
            );
          })}
        </div>
      </aside>

      <section>
        <div className="tournament-bracket__toolbar">
          <button type="button" className="secondary-button" onClick={handleExportPng} disabled={exporting}>
            Export PNG
          </button>
          <button type="button" className="secondary-button" onClick={handleExportPdf} disabled={exporting}>
            Export PDF
          </button>
        </div>

        <div className="tournament-bracket__canvas" ref={wrapperRef}>
          <svg
            className="tournament-bracket__svg"
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            role="img"
            aria-label="Tournament bracket"
          >
            {layout.connectors.map((c) => (
              <path
                key={`${c.fromMatchId}-${c.toMatchId}`}
                className="bracket-connector"
                d={`M ${c.x1} ${c.y1} L ${c.midX} ${c.y1} L ${c.midX} ${c.y2} L ${c.x2} ${c.y2}`}
              />
            ))}

            {layout.nodes.map((n) => (
              <BracketMatch
                key={n.match.id}
                match={n.match}
                x={n.x}
                y={n.y}
                width={n.width}
                height={n.height}
                animate={lastWinnerMatchId === n.match.id}
                onAssignTeam={async (matchId, side, teamId) => {
                  if (teamId == null) {
                    await onAssignTeam(matchId, side, null);
                    return;
                  }

                  const existing = teamSlotById.get(teamId);
                  const isSameSlot = existing?.matchId === matchId && existing?.side === side;

                  // Move: clear old slot first if the team is already placed elsewhere.
                  if (existing && !isSameSlot) {
                    await onAssignTeam(existing.matchId, existing.side, null);
                  }

                  await onAssignTeam(matchId, side, teamId);
                }}
                onSetWinner={async (matchId, winnerTeamId) => {
                  setLastWinnerMatchId(matchId);
                  await onSetWinner(matchId, winnerTeamId);
                }}
              />
            ))}
          </svg>
        </div>
      </section>
    </div>
  );
};

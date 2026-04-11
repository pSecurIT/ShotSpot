import React, { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import api from '../utils/api';
import { seasonsApi } from '../services/seasonsApi';
import { teamAnalyticsApi } from '../services/teamAnalyticsApi';
import SeasonOverview from './SeasonOverview';
import MomentumChart from './MomentumChart';
import type { Season } from '../types/seasons';
import type {
  TeamAnalyticsOverviewResponse,
  TeamAnalyticsTeamOption,
  TeamMomentumResponse,
  TeamStrengthsWeaknessesResponse,
} from '../types/team-analytics';
import '../styles/TeamAnalytics.css';

const selectDefaultSeason = (team: TeamAnalyticsTeamOption | undefined, seasons: Season[]): string => {
  if (team?.season_id) {
    return String(team.season_id);
  }

  const activeSeason = seasons.find((season) => season.is_active);
  if (activeSeason) {
    return String(activeSeason.id);
  }

  return seasons[0] ? String(seasons[0].id) : '';
};

const sortTeams = (teams: TeamAnalyticsTeamOption[]): TeamAnalyticsTeamOption[] => {
  return [...teams].sort((left, right) => {
    const leftLabel = `${left.club_name || ''} ${left.name}`.trim().toLowerCase();
    const rightLabel = `${right.club_name || ''} ${right.name}`.trim().toLowerCase();
    return leftLabel.localeCompare(rightLabel);
  });
};

const TeamAnalytics: React.FC = () => {
  const exportRef = useRef<HTMLDivElement>(null);
  const [teams, setTeams] = useState<TeamAnalyticsTeamOption[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [overview, setOverview] = useState<TeamAnalyticsOverviewResponse | null>(null);
  const [momentum, setMomentum] = useState<TeamMomentumResponse | null>(null);
  const [strengthsWeaknesses, setStrengthsWeaknesses] = useState<TeamStrengthsWeaknessesResponse | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadOptions = async () => {
      setLoadingOptions(true);
      setError(null);

      try {
        const [teamsResponse, seasonOptions] = await Promise.all([
          api.get<TeamAnalyticsTeamOption[]>('/teams'),
          seasonsApi.list(),
        ]);

        if (cancelled) {
          return;
        }

        const sortedTeams = sortTeams(teamsResponse.data || []);
        setTeams(sortedTeams);
        setSeasons(seasonOptions);

        const defaultTeam = sortedTeams[0];
        setSelectedTeamId(defaultTeam ? String(defaultTeam.id) : '');
        setSelectedSeasonId(selectDefaultSeason(defaultTeam, seasonOptions));
      } catch (err) {
        if (cancelled) {
          return;
        }

        const nextError = err as Error;
        setError(nextError.message || 'Failed to load team analytics options');
      } finally {
        if (!cancelled) {
          setLoadingOptions(false);
        }
      }
    };

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTeam = useMemo(() => {
    return teams.find((team) => String(team.id) === selectedTeamId);
  }, [selectedTeamId, teams]);

  useEffect(() => {
    if (!selectedTeamId) {
      return;
    }

    if (!selectedSeasonId) {
      setSelectedSeasonId(selectDefaultSeason(selectedTeam, seasons));
    }
  }, [selectedSeasonId, selectedTeam, selectedTeamId, seasons]);

  useEffect(() => {
    if (!selectedTeamId) {
      return;
    }

    let cancelled = false;

    const loadAnalytics = async () => {
      setLoadingData(true);
      setError(null);

      try {
        const teamId = Number(selectedTeamId);
        const seasonId = selectedSeasonId ? Number(selectedSeasonId) : undefined;
        const [overviewData, momentumData, strengthsData] = await Promise.all([
          teamAnalyticsApi.seasonOverview(teamId, seasonId),
          teamAnalyticsApi.momentum(teamId, seasonId),
          teamAnalyticsApi.strengthsWeaknesses(teamId, seasonId),
        ]);

        if (cancelled) {
          return;
        }

        setOverview(overviewData);
        setMomentum(momentumData);
        setStrengthsWeaknesses(strengthsData);
      } catch (err) {
        if (cancelled) {
          return;
        }

        const nextError = err as Error;
        setError(nextError.message || 'Failed to load team analytics');
      } finally {
        if (!cancelled) {
          setLoadingData(false);
        }
      }
    };

    void loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [selectedSeasonId, selectedTeamId]);

  const handleExportPdf = async () => {
    if (!exportRef.current || !selectedTeam) {
      return;
    }

    setExporting(true);

    try {
      const canvas = await html2canvas(exportRef.current, {
        backgroundColor: '#f8fafc',
        scale: 2,
      });

      const image = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(image, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`team-analytics-${selectedTeam.name.toLowerCase().replace(/\s+/g, '-')}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  const scopeNotice = overview?.scope_mode === 'club_fallback'
    ? 'Some results are calculated at club scope because older matches are not linked to team IDs.'
    : null;

  return (
    <div className="team-analytics">
      <div className="team-analytics__hero">
        <div>
          <h1>Team Analytics Dashboard</h1>
          <p>Season form, momentum, scorer output, and comparative team diagnostics.</p>
        </div>
        <button
          type="button"
          className="team-analytics__export-button"
          onClick={handleExportPdf}
          disabled={exporting || loadingData || !overview}
        >
          {exporting ? 'Exporting PDF…' : 'Export PDF'}
        </button>
      </div>

      <section className="team-analytics__toolbar" aria-label="Team analytics filters">
        <label className="team-analytics__field">
          <span>Team</span>
          <select
            aria-label="Team"
            value={selectedTeamId}
            onChange={(event) => setSelectedTeamId(event.target.value)}
            disabled={loadingOptions || teams.length === 0}
          >
            {teams.length === 0 ? (
              <option value="">No teams available</option>
            ) : (
              teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.club_name ? `${team.club_name} • ` : ''}{team.name}
                </option>
              ))
            )}
          </select>
        </label>

        <label className="team-analytics__field">
          <span>Season</span>
          <select
            aria-label="Season"
            value={selectedSeasonId}
            onChange={(event) => setSelectedSeasonId(event.target.value)}
            disabled={loadingOptions || seasons.length === 0}
          >
            {seasons.length === 0 ? (
              <option value="">All seasons</option>
            ) : (
              seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}{season.is_active ? ' (active)' : ''}
                </option>
              ))
            )}
          </select>
        </label>
      </section>

      {error && (
        <div className="team-analytics__alert team-analytics__alert--error" role="alert">
          {error}
        </div>
      )}

      {scopeNotice && (
        <div className="team-analytics__alert team-analytics__alert--info" role="status" aria-live="polite">
          {scopeNotice}
        </div>
      )}

      {loadingOptions || loadingData ? (
        <div className="team-analytics__loading" role="status" aria-live="polite">Loading team analytics…</div>
      ) : !overview || !momentum || !strengthsWeaknesses ? (
        <div className="team-analytics__empty" role="status" aria-live="polite">Choose a team to load analytics.</div>
      ) : (
        <div ref={exportRef} className="team-analytics__content" data-testid="team-analytics-export-surface">
          <SeasonOverview overview={overview} />
          <MomentumChart momentum={momentum} />

          <section className="team-analytics__section" aria-labelledby="team-analytics-strengths">
            <div className="team-analytics__section-heading">
              <div>
                <h2 id="team-analytics-strengths">Strengths and Weaknesses</h2>
                <p>Compared against the current season benchmark.</p>
              </div>
            </div>

            <div className="team-analytics__grid team-analytics__grid--two-column">
              <article className="team-analytics__panel">
                <h3>Strengths</h3>
                {strengthsWeaknesses.strengths.length === 0 ? (
                  <p className="team-analytics__empty" role="status" aria-live="polite">No strengths identified yet.</p>
                ) : (
                  <ul className="team-analytics__insight-list">
                    {strengthsWeaknesses.strengths.map((insight) => (
                      <li key={`${insight.metric}-${insight.title}`} className="team-analytics__insight team-analytics__insight--strength">
                        <strong>{insight.title}</strong>
                        <p>{insight.description}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </article>

              <article className="team-analytics__panel">
                <h3>Weaknesses</h3>
                {strengthsWeaknesses.weaknesses.length === 0 ? (
                  <p className="team-analytics__empty" role="status" aria-live="polite">No weaknesses identified yet.</p>
                ) : (
                  <ul className="team-analytics__insight-list">
                    {strengthsWeaknesses.weaknesses.map((insight) => (
                      <li key={`${insight.metric}-${insight.title}`} className="team-analytics__insight team-analytics__insight--weakness">
                        <strong>{insight.title}</strong>
                        <p>{insight.description}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </div>

            <article className="team-analytics__panel">
              <h3>Benchmark Snapshot</h3>
              <div className="team-analytics__comparison-grid">
                <div>
                  <span className="team-analytics__muted">Win rate benchmark</span>
                  <strong>{strengthsWeaknesses.benchmarks.win_percentage.toFixed(1)}%</strong>
                </div>
                <div>
                  <span className="team-analytics__muted">Goals for / game</span>
                  <strong>{strengthsWeaknesses.benchmarks.goals_for_per_game.toFixed(2)}</strong>
                </div>
                <div>
                  <span className="team-analytics__muted">Goals against / game</span>
                  <strong>{strengthsWeaknesses.benchmarks.goals_against_per_game.toFixed(2)}</strong>
                </div>
                <div>
                  <span className="team-analytics__muted">FG% benchmark</span>
                  <strong>{strengthsWeaknesses.benchmarks.fg_percentage.toFixed(1)}%</strong>
                </div>
                <div>
                  <span className="team-analytics__muted">Goal diff / game</span>
                  <strong>{strengthsWeaknesses.benchmarks.goal_difference_per_game.toFixed(2)}</strong>
                </div>
              </div>
            </article>
          </section>
        </div>
      )}
    </div>
  );
};

export default TeamAnalytics;
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AchievementGallery from './AchievementGallery';
import Leaderboard from './Leaderboard';
import type { Achievement, LeaderboardPlayer } from '../types/achievements';
import api from '../utils/api';
import '../styles/AchievementsPage.css';

interface PlayerOption {
  id: number;
  first_name: string;
  last_name: string;
  jersey_number: number;
  team_id?: number;
  team_name?: string;
}

interface TeamOption {
  id: number;
  name: string;
}

type AchievementCategoryFilter = Achievement['category'] | 'all';
type LeaderboardType = 'global' | 'team';

const CATEGORY_OPTIONS: Array<{ value: AchievementCategoryFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'shooting', label: 'Shooting' },
  { value: 'consistency', label: 'Consistency' },
  { value: 'improvement', label: 'Improvement' },
  { value: 'milestone', label: 'Milestone' },
];

const AchievementsPage: React.FC = () => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [playerAchievements, setPlayerAchievements] = useState<Achievement[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>('global');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategoryFilter>('all');
  const [pageLoading, setPageLoading] = useState(true);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPage = async () => {
      setPageLoading(true);
      setError(null);

      try {
        const [achievementsResponse, playersResponse, teamsResponse, leaderboardResponse] = await Promise.all([
          api.get<Achievement[]>('/achievements/list'),
          api.get<PlayerOption[]>('/players'),
          api.get<TeamOption[]>('/teams'),
          api.get<{ season: string; leaderboard: LeaderboardPlayer[] }>('/achievements/leaderboard'),
        ]);

        if (!isMounted) return;

        const loadedPlayers = playersResponse.data || [];
        const loadedTeams = teamsResponse.data || [];

        setAchievements(achievementsResponse.data || []);
        setPlayers(loadedPlayers);
        setTeams(loadedTeams);
        setLeaderboard(leaderboardResponse.data.leaderboard || []);
        setSelectedPlayerId((current) => current ?? (loadedPlayers[0]?.id ?? null));
        setSelectedTeamId((current) => current ?? (loadedTeams[0]?.id ?? null));
      } catch (err) {
        const requestError = err as { response?: { data?: { error?: string } }; message?: string };
        if (isMounted) {
          setError(requestError.response?.data?.error || 'Failed to load achievements hub.');
        }
      } finally {
        if (isMounted) {
          setPageLoading(false);
        }
      }
    };

    void loadPage();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedPlayerId) {
      setPlayerAchievements([]);
      setTotalPoints(0);
      return;
    }

    let isMounted = true;

    const loadPlayerAchievements = async () => {
      setPlayerLoading(true);

      try {
        const response = await api.get<{ achievements: Achievement[]; total_points: number }>(`/achievements/player/${selectedPlayerId}`);
        if (!isMounted) return;
        setPlayerAchievements(response.data.achievements || []);
        setTotalPoints(response.data.total_points || 0);
      } catch (err) {
        const requestError = err as { response?: { data?: { error?: string } }; message?: string };
        if (isMounted) {
          setError(requestError.response?.data?.error || 'Failed to load player achievements.');
          setPlayerAchievements([]);
          setTotalPoints(0);
        }
      } finally {
        if (isMounted) {
          setPlayerLoading(false);
        }
      }
    };

    void loadPlayerAchievements();

    return () => {
      isMounted = false;
    };
  }, [selectedPlayerId]);

  useEffect(() => {
    let isMounted = true;

    const loadLeaderboard = async () => {
      setLeaderboardLoading(true);

      try {
        if (leaderboardType === 'team') {
          if (!selectedTeamId) {
            if (isMounted) {
              setLeaderboard([]);
            }
            return;
          }

          const response = await api.get<{ team_id: number; leaderboard: LeaderboardPlayer[] }>(`/achievements/team/${selectedTeamId}/leaderboard`);
          if (!isMounted) return;
          setLeaderboard(response.data.leaderboard || []);
        } else {
          const response = await api.get<{ season: string; leaderboard: LeaderboardPlayer[] }>('/achievements/leaderboard');
          if (!isMounted) return;
          setLeaderboard(response.data.leaderboard || []);
        }
      } catch (err) {
        const requestError = err as { response?: { data?: { error?: string } }; message?: string };
        if (isMounted) {
          setError(requestError.response?.data?.error || 'Failed to load leaderboard.');
          setLeaderboard([]);
        }
      } finally {
        if (isMounted) {
          setLeaderboardLoading(false);
        }
      }
    };

    void loadLeaderboard();

    return () => {
      isMounted = false;
    };
  }, [leaderboardType, selectedTeamId]);

  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) || null;
  const earnedAchievements = achievements.filter((achievement) =>
    playerAchievements.some((item) => item.name === achievement.name)
  );
  const filteredAchievements = achievements.filter((achievement) => {
    const matchesCategory = selectedCategory === 'all' || achievement.category === selectedCategory;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      query.length === 0 ||
      achievement.name.toLowerCase().includes(query) ||
      achievement.description.toLowerCase().includes(query);

    return matchesCategory && matchesSearch;
  });
  const completionPercent = achievements.length === 0
    ? 0
    : Math.round((earnedAchievements.length / achievements.length) * 100);

  const progressByCategory = CATEGORY_OPTIONS.filter((option) => option.value !== 'all').map((option) => {
    const total = achievements.filter((achievement) => achievement.category === option.value).length;
    const earned = earnedAchievements.filter((achievement) => achievement.category === option.value).length;
    const percent = total === 0 ? 0 : Math.round((earned / total) * 100);

    return {
      label: option.label,
      earned,
      total,
      percent,
    };
  });

  const shareText = selectedPlayer
    ? `${selectedPlayer.first_name} ${selectedPlayer.last_name} has unlocked ${earnedAchievements.length} of ${achievements.length} ShotSpot achievements and earned ${totalPoints} points.`
    : 'Track your ShotSpot achievements, leaderboards, and badge progress.';

  const handleCopyShare = async () => {
    if (!navigator.clipboard) {
      setShareStatus('Copy sharing is not available in this browser.');
      return;
    }

    await navigator.clipboard.writeText(shareText);
    setShareStatus('Achievement summary copied.');
  };

  const handleExternalShare = (baseUrl: string) => {
    window.open(`${baseUrl}${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="achievements-page">
      <header className="achievements-page__hero">
        <div>
          <p className="achievements-page__eyebrow">Achievements Hub</p>
          <h2>Track badges, player milestones, and leaderboard momentum</h2>
          <p className="achievements-page__intro">
            Explore every badge, spotlight a player collection, and compare club performance without opening a match analytics view.
          </p>
        </div>
        <div className="achievements-page__hero-actions">
          <Link className="btn btn-secondary" to="/games">
            Browse Games
          </Link>
          <Link className="btn btn-primary" to="/dashboard">
            Back to Dashboard
          </Link>
        </div>
      </header>

      {error && <div className="achievements-page__error">{error}</div>}
      {shareStatus && <div className="achievements-page__status">{shareStatus}</div>}

      <section className="achievements-page__controls">
        <div className="achievements-page__field">
          <label htmlFor="achievements-search">Search achievements</label>
          <input
            id="achievements-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by badge or description"
          />
        </div>

        <div className="achievements-page__field">
          <label htmlFor="achievements-player">Player showcase</label>
          <select
            id="achievements-player"
            value={selectedPlayerId ?? ''}
            onChange={(event) => setSelectedPlayerId(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">Select a player</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.first_name} {player.last_name} #{player.jersey_number}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="achievements-page__filters" aria-label="Achievement categories">
        {CATEGORY_OPTIONS.map((option) => (
          <button
            key={option.value}
            className={`achievements-page__chip ${selectedCategory === option.value ? 'achievements-page__chip--active' : ''}`}
            onClick={() => setSelectedCategory(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </section>

      <section className="achievements-page__layout">
        <article className="achievements-page__panel achievements-page__panel--showcase">
          <div className="achievements-page__panel-header">
            <div>
              <h3>Player achievement showcase</h3>
              <p>Progress tracking and earned badge collection for the selected player.</p>
            </div>
            {playerLoading && <span className="achievements-page__loading">Refreshing player data…</span>}
          </div>

          {selectedPlayer ? (
            <>
              <div className="achievements-page__stats-grid">
                <div className="achievements-page__stat-card">
                  <span className="achievements-page__stat-label">Selected player</span>
                  <strong>{selectedPlayer.first_name} {selectedPlayer.last_name}</strong>
                  <span>#{selectedPlayer.jersey_number} {selectedPlayer.team_name ? `· ${selectedPlayer.team_name}` : ''}</span>
                </div>
                <div className="achievements-page__stat-card">
                  <span className="achievements-page__stat-label">Badge completion</span>
                  <strong>{completionPercent}%</strong>
                  <span>{earnedAchievements.length} of {achievements.length} unlocked</span>
                </div>
                <div className="achievements-page__stat-card">
                  <span className="achievements-page__stat-label">Achievement points</span>
                  <strong>{totalPoints}</strong>
                  <span>Career points from unlocked badges</span>
                </div>
              </div>

              <div className="achievements-page__progress-list">
                {progressByCategory.map((item) => (
                  <div key={item.label} className="achievements-page__progress-row">
                    <div className="achievements-page__progress-copy">
                      <span>{item.label}</span>
                      <span>{item.earned}/{item.total}</span>
                    </div>
                    <div className="achievements-page__progress-track" aria-hidden="true">
                      <span className="achievements-page__progress-bar" style={{ width: `${item.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="achievements-page__subsection">
                <div className="achievements-page__subsection-header">
                  <h4>Badge collection display</h4>
                  <span>{earnedAchievements.length} unlocked</span>
                </div>
                {earnedAchievements.length > 0 ? (
                  <div className="achievements-page__collection">
                    {earnedAchievements.map((achievement) => {
                      const earned = playerAchievements.find((item) => item.name === achievement.name);
                      return (
                        <AchievementGallery
                          key={achievement.id}
                          achievements={[achievement]}
                          earnedAchievements={earned ? [earned] : []}
                          size="small"
                          showDetails={false}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <p className="achievements-page__empty">No badges unlocked yet.</p>
                )}
              </div>

              <div className="achievements-page__share-actions">
                <button className="btn btn-secondary" type="button" onClick={() => void handleCopyShare()}>
                  Copy summary
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => handleExternalShare('https://twitter.com/intent/tweet?text=')}>
                  Share on X
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => handleExternalShare('https://wa.me/?text=')}>
                  Share on WhatsApp
                </button>
              </div>
            </>
          ) : (
            <p className="achievements-page__empty">Select a player to see progress tracking and collection details.</p>
          )}
        </article>

        <article className="achievements-page__panel">
          <div className="achievements-page__panel-header">
            <div>
              <h3>Achievement gallery</h3>
              <p>Browse all achievement types with category filters and search.</p>
            </div>
            <span>{filteredAchievements.length} shown</span>
          </div>

          {pageLoading ? (
            <p className="achievements-page__loading">Loading achievements…</p>
          ) : (
            <AchievementGallery
              achievements={filteredAchievements}
              earnedAchievements={playerAchievements}
              emptyMessage="No achievements match your search and category filters."
            />
          )}
        </article>
      </section>

      <section className="achievements-page__panel">
        <div className="achievements-page__panel-header">
          <div>
            <h3>Leaderboards</h3>
            <p>Switch between global rankings and a team-specific table.</p>
          </div>
          <div className="achievements-page__toggle-group">
            <button
              className={`achievements-page__toggle ${leaderboardType === 'global' ? 'achievements-page__toggle--active' : ''}`}
              type="button"
              onClick={() => setLeaderboardType('global')}
            >
              Global leaderboard
            </button>
            <button
              className={`achievements-page__toggle ${leaderboardType === 'team' ? 'achievements-page__toggle--active' : ''}`}
              type="button"
              onClick={() => setLeaderboardType('team')}
            >
              Team leaderboard
            </button>
          </div>
        </div>

        {leaderboardType === 'team' && (
          <div className="achievements-page__field achievements-page__field--compact">
            <label htmlFor="achievement-team">Team</label>
            <select
              id="achievement-team"
              value={selectedTeamId ?? ''}
              onChange={(event) => setSelectedTeamId(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">Select a team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>
        )}

        <Leaderboard
          players={leaderboard}
          type={leaderboardType}
          loading={leaderboardLoading}
          season="Current Season"
          teamName={leaderboardType === 'team' ? teams.find((team) => team.id === selectedTeamId)?.name : undefined}
        />
      </section>
    </div>
  );
};

export default AchievementsPage;
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { clubsApi } from '../services/clubsApi';
import type { Club, ClubPlayer, ClubTeam } from '../types/clubs';
import ClubCard from './ClubCard';
import ClubDialog from './ClubDialog';
import '../styles/ClubManagement.css';

type DetailView =
  | { mode: 'teams'; club: Club }
  | { mode: 'players'; club: Club }
  | null;

const PAGE_SIZE = 12;

const ClubManagement: React.FC = () => {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClub, setSelectedClub] = useState<Club | undefined>(undefined);

  const [page, setPage] = useState(1);

  const [detailView, setDetailView] = useState<DetailView>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [clubTeams, setClubTeams] = useState<ClubTeam[]>([]);
  const [clubPlayers, setClubPlayers] = useState<ClubPlayer[]>([]);

  const fetchClubs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await clubsApi.getAll();
      setClubs(data);
    } catch (err) {
      const errorObj = err as { response?: { data?: { error?: string; details?: string } }; message?: string };
      setError(errorObj.response?.data?.error || errorObj.response?.data?.details || 'Failed to load clubs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClubs();
  }, [fetchClubs]);

  const filteredClubs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return clubs;
    return clubs.filter((c) => c.name.toLowerCase().includes(term));
  }, [clubs, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredClubs.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const paginatedClubs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredClubs.slice(start, start + PAGE_SIZE);
  }, [filteredClubs, currentPage]);

  useEffect(() => {
    // Clamp page when search results shrink
    if (page !== currentPage) setPage(currentPage);
  }, [page, currentPage]);

  const openCreate = () => {
    setSelectedClub(undefined);
    setDialogOpen(true);
    setSuccess(null);
    setError(null);
  };

  const openEdit = (club: Club) => {
    setSelectedClub(club);
    setDialogOpen(true);
    setSuccess(null);
    setError(null);
  };

  const handleDelete = async (id: number) => {
    setError(null);
    setSuccess(null);

    const ok = window.confirm('Are you sure you want to delete this club?');
    if (!ok) return;

    try {
      await clubsApi.delete(id);
      setClubs((prev) => prev.filter((c) => c.id !== id));
      setSuccess('Club deleted successfully');
    } catch (err) {
      const errorObj = err as { response?: { data?: { error?: string; details?: string } }; message?: string };
      setError(errorObj.response?.data?.error || errorObj.response?.data?.details || 'Failed to delete club');
    }
  };

  const loadTeamsForClub = async (club: Club) => {
    setDetailView({ mode: 'teams', club });
    setDetailError(null);
    setClubTeams([]);

    try {
      setDetailLoading(true);
      const teams = await clubsApi.getTeams(club.id);
      setClubTeams(teams);
    } catch (err) {
      const errorObj = err as { response?: { data?: { error?: string; details?: string } }; message?: string };
      setDetailError(errorObj.response?.data?.error || errorObj.response?.data?.details || 'Failed to load teams');
    } finally {
      setDetailLoading(false);
    }
  };

  const loadPlayersForClub = async (club: Club) => {
    setDetailView({ mode: 'players', club });
    setDetailError(null);
    setClubPlayers([]);

    try {
      setDetailLoading(true);
      const players = await clubsApi.getPlayers(club.id);
      setClubPlayers(players);
    } catch (err) {
      const errorObj = err as { response?: { data?: { error?: string; details?: string } }; message?: string };
      setDetailError(errorObj.response?.data?.error || errorObj.response?.data?.details || 'Failed to load players');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetails = () => {
    setDetailView(null);
    setDetailError(null);
    setClubTeams([]);
    setClubPlayers([]);
  };

  return (
    <div className="club-management">
      <div className="club-management__header">
        <h2>Clubs Management</h2>
        <button type="button" className="primary-button" onClick={openCreate}>
          Add Club
        </button>
      </div>

      <div className="club-management__controls">
        <input
          type="text"
          placeholder="Search clubs…"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
          aria-label="Search clubs"
        />
      </div>

      {loading && <div className="club-management__loading">Loading clubs…</div>}
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {!loading && !error && filteredClubs.length === 0 && (
        <div className="empty-state">No clubs found</div>
      )}

      <div className="club-grid" aria-busy={loading ? 'true' : 'false'}>
        {paginatedClubs.map((club) => (
          <ClubCard
            key={club.id}
            club={club}
            onEdit={openEdit}
            onDelete={handleDelete}
            onViewTeams={() => loadTeamsForClub(club)}
            onViewPlayers={() => loadPlayersForClub(club)}
          />
        ))}
      </div>

      {filteredClubs.length > PAGE_SIZE && (
        <div className="club-pagination" aria-label="Pagination">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            Prev
          </button>
          <span className="club-pagination__status">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            Next
          </button>
        </div>
      )}

      <ClubDialog
        isOpen={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedClub(undefined);
        }}
        onSuccess={async () => {
          await fetchClubs();
          setDialogOpen(false);
          setSelectedClub(undefined);
          setSuccess(selectedClub ? 'Club updated successfully' : 'Club created successfully');
        }}
        club={selectedClub}
      />

      {detailView && (
        <div
          className="club-details__overlay"
          role="dialog"
          aria-modal="true"
          aria-label={detailView.mode === 'teams' ? 'Club Teams' : 'Club Players'}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDetails();
          }}
        >
          <div className="club-details__content">
            <div className="club-details__header">
              <h3>
                {detailView.mode === 'teams' ? 'Teams' : 'Players'} — {detailView.club.name}
              </h3>
              <button type="button" className="secondary-button" onClick={closeDetails} aria-label="Close">
                ✕
              </button>
            </div>

            {detailLoading && <div>Loading…</div>}
            {detailError && <div className="alert alert-error">{detailError}</div>}

            {!detailLoading && !detailError && detailView.mode === 'teams' && (
              <div className="club-details__list">
                {clubTeams.length === 0 ? (
                  <div className="empty-state">No teams found for this club</div>
                ) : (
                  <ul className="list" aria-label="Club teams list">
                    {clubTeams.map((t) => (
                      <li key={t.id} className="list-item">
                        <span>{t.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {!detailLoading && !detailError && detailView.mode === 'players' && (
              <div className="club-details__list">
                {clubPlayers.length === 0 ? (
                  <div className="empty-state">No players found for this club</div>
                ) : (
                  <ul className="list" aria-label="Club players list">
                    {clubPlayers.map((p) => (
                      <li key={p.id} className="list-item">
                        <span>
                          {p.first_name} {p.last_name} #{p.jersey_number}
                        </span>
                        <span className="club-details__muted">{p.team_name ?? 'No team'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClubManagement;

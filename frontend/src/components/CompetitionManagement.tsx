import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Competition, CompetitionStatus, CompetitionType } from '../types/competitions';
import { competitionsApi } from '../services/competitionsApi';
import CompetitionCard from './CompetitionCard';
import CompetitionDialog from './CompetitionDialog';
import TeamRegistrationDialog from './TeamRegistrationDialog';
import '../styles/CompetitionManagement.css';

type Filters = {
  type: '' | CompetitionType;
  status: '' | CompetitionStatus;
  search: string;
};

const PAGE_SIZE = 12;

const CompetitionManagement: React.FC = () => {
  const navigate = useNavigate();

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>({ type: '', status: '', search: '' });
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | undefined>(undefined);

  const [teamsDialogOpen, setTeamsDialogOpen] = useState(false);
  const [teamsCompetition, setTeamsCompetition] = useState<Competition | undefined>(undefined);

  const fetchCompetitions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await competitionsApi.list();
      setCompetitions(data);
    } catch (err) {
      const errorObj = err as { response?: { data?: { error?: string; details?: string } }; message?: string };
      setError(errorObj.response?.data?.error || errorObj.response?.data?.details || 'Failed to load competitions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompetitions();
  }, [fetchCompetitions]);

  const filteredCompetitions = useMemo(() => {
    const term = filters.search.trim().toLowerCase();

    return competitions.filter((c) => {
      if (filters.type && c.type !== filters.type) return false;
      if (filters.status && c.status !== filters.status) return false;
      if (term && !c.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [competitions, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredCompetitions.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredCompetitions.slice(start, start + PAGE_SIZE);
  }, [filteredCompetitions, currentPage]);

  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [page, currentPage]);

  const openCreate = () => {
    setSelectedCompetition(undefined);
    setDialogOpen(true);
    setError(null);
    setSuccess(null);
  };

  const openEdit = (competition: Competition) => {
    setSelectedCompetition(competition);
    setDialogOpen(true);
    setError(null);
    setSuccess(null);
  };

  const openTeams = (competition: Competition) => {
    setTeamsCompetition(competition);
    setTeamsDialogOpen(true);
    setError(null);
    setSuccess(null);
  };

  const handleDelete = async (competitionId: number) => {
    setError(null);
    setSuccess(null);

    const ok = window.confirm('Are you sure you want to delete this competition?');
    if (!ok) return;

    try {
      await competitionsApi.delete(competitionId);
      setCompetitions((prev) => prev.filter((c) => c.id !== competitionId));
      setSuccess('Competition deleted successfully');
    } catch (err) {
      const errorObj = err as { response?: { data?: { error?: string; details?: string } }; message?: string };
      setError(errorObj.response?.data?.error || errorObj.response?.data?.details || 'Failed to delete competition');
    }
  };

  return (
    <div className="competition-management">
      <div className="competition-management__header">
        <h2>Competitions Management</h2>
        <button type="button" className="primary-button" onClick={openCreate}>
          Create Competition
        </button>
      </div>

      <div className="competition-management__filters">
        <select
          aria-label="Filter by type"
          value={filters.type}
          onChange={(e) => {
            setFilters((prev) => ({ ...prev, type: e.target.value as Filters['type'] }));
            setPage(1);
          }}
        >
          <option value="">All Types</option>
          <option value="tournament">Tournaments</option>
          <option value="league">Leagues</option>
        </select>

        <select
          aria-label="Filter by status"
          value={filters.status}
          onChange={(e) => {
            setFilters((prev) => ({ ...prev, status: e.target.value as Filters['status'] }));
            setPage(1);
          }}
        >
          <option value="">All Statuses</option>
          <option value="upcoming">Upcoming</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <input
          type="text"
          placeholder="Search competitions…"
          value={filters.search}
          onChange={(e) => {
            setFilters((prev) => ({ ...prev, search: e.target.value }));
            setPage(1);
          }}
          aria-label="Search competitions"
        />
      </div>

      {loading && <div className="competition-management__loading">Loading competitions…</div>}
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {!loading && !error && filteredCompetitions.length === 0 && (
        <div className="empty-state">No competitions found</div>
      )}

      <div className="competition-grid" aria-busy={loading ? 'true' : 'false'}>
        {paginated.map((competition) => (
          <CompetitionCard
            key={competition.id}
            competition={competition}
            onEdit={openEdit}
            onDelete={handleDelete}
            onManageTeams={openTeams}
          />
        ))}
      </div>

      {filteredCompetitions.length > PAGE_SIZE && (
        <div className="competition-pagination" aria-label="Pagination">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            Prev
          </button>
          <span className="competition-pagination__status">
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

      <CompetitionDialog
        isOpen={dialogOpen}
        competition={selectedCompetition}
        onClose={() => {
          setDialogOpen(false);
          setSelectedCompetition(undefined);
        }}
        onSuccess={async () => {
          await fetchCompetitions();
          setDialogOpen(false);
          setSelectedCompetition(undefined);
          setSuccess(selectedCompetition ? 'Competition updated successfully' : 'Competition created successfully');
        }}
      />

      {teamsCompetition && (
        <TeamRegistrationDialog
          competition={teamsCompetition}
          isOpen={teamsDialogOpen}
          onClose={() => {
            setTeamsDialogOpen(false);
            setTeamsCompetition(undefined);
          }}
          onNavigateToBracket={(id) => {
            setTeamsDialogOpen(false);
            setTeamsCompetition(undefined);
            navigate(`/competitions/${id}/bracket`);
          }}
        />
      )}

      <div className="competition-management__footer-links">
        <button type="button" className="link-button" onClick={() => navigate('/series')}>
          Manage series/divisions
        </button>
      </div>
    </div>
  );
};

export default CompetitionManagement;

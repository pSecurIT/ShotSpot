--
-- PostgreSQL database dump
--

\restrict iLe3bX54Frr855O6hiogtiGG25tDzB4bYiNuA9JEPt4ugonFEwhK2ejafWBzObw

-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: sync_player_twizzit_registration(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_player_twizzit_registration() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- When a mapping is created, mark player as registered
    IF TG_OP = 'INSERT' THEN
        UPDATE players 
        SET is_twizzit_registered = true, 
            twizzit_verified_at = CURRENT_TIMESTAMP
        WHERE id = NEW.local_player_id;
    END IF;
    
    -- When a mapping is deleted, mark player as unregistered
    IF TG_OP = 'DELETE' THEN
        UPDATE players 
        SET is_twizzit_registered = false, 
            twizzit_verified_at = NULL
        WHERE id = OLD.local_player_id
        AND NOT EXISTS (
            SELECT 1 FROM twizzit_player_mappings 
            WHERE local_player_id = OLD.local_player_id
        );
    END IF;
    
    RETURN NULL;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.achievements (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text NOT NULL,
    badge_icon character varying(50) NOT NULL,
    category character varying(50) NOT NULL,
    criteria jsonb NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT achievements_category_check CHECK (((category)::text = ANY ((ARRAY['shooting'::character varying, 'consistency'::character varying, 'improvement'::character varying, 'milestone'::character varying])::text[])))
);


--
-- Name: achievements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.achievements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: achievements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.achievements_id_seq OWNED BY public.achievements.id;


--
-- Name: ball_possessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ball_possessions (
    id integer NOT NULL,
    game_id integer NOT NULL,
    club_id integer NOT NULL,
    period integer NOT NULL,
    started_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ended_at timestamp with time zone,
    duration_seconds integer,
    shots_taken integer DEFAULT 0,
    result character varying(20),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE ball_possessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ball_possessions IS 'Tracks ball possessions to measure attack duration and shots per attack. A possession starts when ball crosses center line and ends on goal, turnover, or stoppage.';


--
-- Name: ball_possessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ball_possessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ball_possessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ball_possessions_id_seq OWNED BY public.ball_possessions.id;


--
-- Name: clubs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clubs (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: clubs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clubs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clubs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clubs_id_seq OWNED BY public.clubs.id;


--
-- Name: competition_benchmarks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competition_benchmarks (
    id integer NOT NULL,
    competition_name character varying(100) NOT NULL,
    season character varying(20),
    "position" character varying(20),
    benchmark_type character varying(50) NOT NULL,
    benchmark_value numeric(10,2) NOT NULL,
    sample_size integer,
    calculation_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE competition_benchmarks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.competition_benchmarks IS 'Stores league and competition average statistics for benchmarking';


--
-- Name: COLUMN competition_benchmarks."position"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.competition_benchmarks."position" IS 'Player position: offense, defense, or all';


--
-- Name: COLUMN competition_benchmarks.benchmark_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.competition_benchmarks.benchmark_type IS 'Type of benchmark metric';


--
-- Name: COLUMN competition_benchmarks.sample_size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.competition_benchmarks.sample_size IS 'Number of data points in calculation';


--
-- Name: COLUMN competition_benchmarks.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.competition_benchmarks.metadata IS 'Additional context like age group, skill level, etc.';


--
-- Name: competition_benchmarks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.competition_benchmarks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: competition_benchmarks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.competition_benchmarks_id_seq OWNED BY public.competition_benchmarks.id;


--
-- Name: competition_standings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competition_standings (
    id integer NOT NULL,
    competition_id integer NOT NULL,
    team_id integer NOT NULL,
    games_played integer DEFAULT 0,
    wins integer DEFAULT 0,
    losses integer DEFAULT 0,
    draws integer DEFAULT 0,
    goals_for integer DEFAULT 0,
    goals_against integer DEFAULT 0,
    goal_difference integer GENERATED ALWAYS AS ((goals_for - goals_against)) STORED,
    points integer DEFAULT 0,
    rank integer,
    form character varying(20),
    home_wins integer DEFAULT 0,
    home_losses integer DEFAULT 0,
    home_draws integer DEFAULT 0,
    away_wins integer DEFAULT 0,
    away_losses integer DEFAULT 0,
    away_draws integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE competition_standings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.competition_standings IS 'League standings with comprehensive team statistics';


--
-- Name: COLUMN competition_standings.form; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.competition_standings.form IS 'Recent form showing last 5 results (W=Win, L=Loss, D=Draw)';


--
-- Name: competition_standings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.competition_standings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: competition_standings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.competition_standings_id_seq OWNED BY public.competition_standings.id;


--
-- Name: competition_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competition_teams (
    id integer NOT NULL,
    competition_id integer NOT NULL,
    team_id integer NOT NULL,
    seed integer,
    group_name character varying(50),
    is_eliminated boolean DEFAULT false,
    elimination_round integer,
    final_rank integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE competition_teams; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.competition_teams IS 'Teams registered in a competition with their seeding and status';


--
-- Name: COLUMN competition_teams.seed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.competition_teams.seed IS 'Initial seeding/ranking of the team in the competition';


--
-- Name: COLUMN competition_teams.group_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.competition_teams.group_name IS 'Group name for group stage tournaments (e.g., Group A, Group B)';


--
-- Name: competition_teams_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.competition_teams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: competition_teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.competition_teams_id_seq OWNED BY public.competition_teams.id;


--
-- Name: competitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competitions (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    competition_type character varying(20) NOT NULL,
    season_id integer,
    start_date date NOT NULL,
    end_date date,
    description text,
    status character varying(20) DEFAULT 'upcoming'::character varying,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_official boolean DEFAULT true,
    series_id integer,
    CONSTRAINT competitions_competition_type_check CHECK (((competition_type)::text = ANY ((ARRAY['tournament'::character varying, 'league'::character varying])::text[]))),
    CONSTRAINT competitions_status_check CHECK (((status)::text = ANY ((ARRAY['upcoming'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: TABLE competitions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.competitions IS 'Competitions including tournaments and leagues for organizing multi-game events';


--
-- Name: COLUMN competitions.competition_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.competitions.competition_type IS 'Type of competition: tournament (knockout/bracket) or league (round-robin/season)';


--
-- Name: COLUMN competitions.settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.competitions.settings IS 'JSON settings for competition rules, format, etc.';


--
-- Name: COLUMN competitions.is_official; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.competitions.is_official IS 'Whether this is an official KBKB competition requiring Twizzit-registered players only.';


--
-- Name: COLUMN competitions.series_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.competitions.series_id IS 'Links competition to a division level (e.g., Eerste Klasse, Tweede Klasse) for Belgian korfball league structure';


--
-- Name: competitions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.competitions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: competitions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.competitions_id_seq OWNED BY public.competitions.id;


--
-- Name: free_shots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.free_shots (
    id integer NOT NULL,
    game_id integer NOT NULL,
    player_id integer NOT NULL,
    club_id integer NOT NULL,
    period integer NOT NULL,
    time_remaining interval,
    free_shot_type character varying(50) NOT NULL,
    reason character varying(100),
    x_coord numeric,
    y_coord numeric,
    result character varying(20) NOT NULL,
    distance numeric,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT free_shots_free_shot_type_check CHECK (((free_shot_type)::text = ANY ((ARRAY['free_shot'::character varying, 'penalty'::character varying])::text[]))),
    CONSTRAINT free_shots_result_check CHECK (((result)::text = ANY ((ARRAY['goal'::character varying, 'miss'::character varying, 'blocked'::character varying])::text[])))
);


--
-- Name: TABLE free_shots; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.free_shots IS 'Detailed tracking of free shots and penalty shots in korfball';


--
-- Name: COLUMN free_shots.free_shot_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.free_shots.free_shot_type IS 'Type of shot: free_shot (awarded for rule violations) or penalty (serious infractions, closer to post)';


--
-- Name: COLUMN free_shots.reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.free_shots.reason IS 'What caused the free shot/penalty to be awarded';


--
-- Name: game_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_events (
    id integer NOT NULL,
    game_id integer NOT NULL,
    event_type character varying(50) NOT NULL,
    player_id integer,
    club_id integer NOT NULL,
    period integer NOT NULL,
    time_remaining interval,
    details jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: match_commentary; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_commentary (
    id integer NOT NULL,
    game_id integer NOT NULL,
    period integer NOT NULL,
    time_remaining interval,
    commentary_type character varying(50) NOT NULL,
    title character varying(100),
    content text NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT match_commentary_commentary_type_check CHECK (((commentary_type)::text = ANY ((ARRAY['note'::character varying, 'highlight'::character varying, 'injury'::character varying, 'weather'::character varying, 'technical'::character varying])::text[])))
);


--
-- Name: TABLE match_commentary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.match_commentary IS 'Timestamped commentary and notes during matches';


--
-- Name: COLUMN match_commentary.commentary_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.match_commentary.commentary_type IS 'Type of commentary: note (general), highlight (key moment), injury, weather (conditions), technical (rule clarification)';


--
-- Name: players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.players (
    id integer NOT NULL,
    club_id integer,
    first_name character varying(50) NOT NULL,
    last_name character varying(50) NOT NULL,
    jersey_number integer,
    gender character varying(10),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    team_id integer,
    is_twizzit_registered boolean DEFAULT false,
    twizzit_verified_at timestamp without time zone,
    CONSTRAINT players_gender_check CHECK ((((gender)::text = ANY ((ARRAY['male'::character varying, 'female'::character varying])::text[])) OR (gender IS NULL)))
);


--
-- Name: TABLE players; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.players IS 'Player information. Note: Captain role is game-specific and stored in game_rosters table.';


--
-- Name: COLUMN players.club_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.players.club_id IS 'Club/organization the player belongs to';


--
-- Name: COLUMN players.gender; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.players.gender IS 'Player gender: male or female. Required for korfball team composition (4 males + 4 females per team).';


--
-- Name: COLUMN players.is_twizzit_registered; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.players.is_twizzit_registered IS 'Whether player is registered in Twizzit (KBKB - Belgian Korfball Federation). Required for official match participation per KBKB rules.';


--
-- Name: COLUMN players.twizzit_verified_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.players.twizzit_verified_at IS 'Timestamp when Twizzit registration was last verified via sync or manual confirmation.';


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id integer NOT NULL,
    club_id integer NOT NULL,
    name character varying(100) NOT NULL,
    age_group character varying(20),
    gender character varying(10),
    season_id integer,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT teams_gender_check CHECK ((((gender)::text = ANY ((ARRAY['male'::character varying, 'female'::character varying, 'mixed'::character varying])::text[])) OR (gender IS NULL)))
);


--
-- Name: TABLE teams; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.teams IS 'Teams within clubs (e.g., U17, U15, U13 age groups). Players belong to teams.';


--
-- Name: COLUMN teams.age_group; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teams.age_group IS 'Age group identifier (e.g., U17, U15, U13, U11, Senior)';


--
-- Name: COLUMN teams.gender; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teams.gender IS 'Team gender: male, female, or mixed for korfball';


--
-- Name: COLUMN teams.season_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.teams.season_id IS 'Optional season link for historical team tracking';


--
-- Name: timeouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timeouts (
    id integer NOT NULL,
    game_id integer NOT NULL,
    club_id integer,
    timeout_type character varying(50) NOT NULL,
    period integer NOT NULL,
    time_remaining interval,
    duration interval DEFAULT '00:01:00'::interval,
    reason character varying(200),
    called_by character varying(100),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    ended_at timestamp with time zone,
    CONSTRAINT timeouts_timeout_type_check CHECK (((timeout_type)::text = ANY ((ARRAY['team'::character varying, 'injury'::character varying, 'official'::character varying, 'tv'::character varying])::text[])))
);


--
-- Name: TABLE timeouts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.timeouts IS 'Detailed timeout tracking including team, injury, and official timeouts';


--
-- Name: COLUMN timeouts.club_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeouts.club_id IS 'Club that called timeout (NULL for official/tv timeouts)';


--
-- Name: COLUMN timeouts.timeout_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeouts.timeout_type IS 'Type of timeout: team (tactical), injury, official (referee), tv (television)';


--
-- Name: COLUMN timeouts.called_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.timeouts.called_by IS 'Person who called the timeout (coach name, referee, etc.)';


--
-- Name: comprehensive_match_events; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.comprehensive_match_events AS
 SELECT 'game_event'::text AS source_table,
    ge.id,
    ge.game_id,
    ge.event_type AS type,
    ge.club_id,
    ge.player_id,
    ge.period,
    ge.time_remaining,
    ge.details,
    ge.created_at,
    t.name AS team_name,
    p.first_name,
    p.last_name,
    p.jersey_number,
    NULL::jsonb AS specific_details
   FROM ((public.game_events ge
     JOIN public.teams t ON ((ge.club_id = t.id)))
     LEFT JOIN public.players p ON ((ge.player_id = p.id)))
UNION ALL
 SELECT 'free_shot'::text AS source_table,
    fs.id,
    fs.game_id,
    concat('free_shot_', fs.free_shot_type) AS type,
    fs.club_id,
    fs.player_id,
    fs.period,
    fs.time_remaining,
    jsonb_build_object('result', fs.result, 'reason', fs.reason, 'x_coord', fs.x_coord, 'y_coord', fs.y_coord, 'distance', fs.distance) AS details,
    fs.created_at,
    t.name AS team_name,
    p.first_name,
    p.last_name,
    p.jersey_number,
    jsonb_build_object('free_shot_type', fs.free_shot_type, 'result', fs.result, 'distance', fs.distance) AS specific_details
   FROM ((public.free_shots fs
     JOIN public.teams t ON ((fs.club_id = t.id)))
     JOIN public.players p ON ((fs.player_id = p.id)))
UNION ALL
 SELECT 'timeout'::text AS source_table,
    to1.id,
    to1.game_id,
    concat('timeout_', to1.timeout_type) AS type,
    to1.club_id,
    NULL::integer AS player_id,
    to1.period,
    to1.time_remaining,
    jsonb_build_object('duration', to1.duration, 'reason', to1.reason, 'called_by', to1.called_by, 'ended_at', to1.ended_at) AS details,
    to1.created_at,
    t.name AS team_name,
    NULL::character varying AS first_name,
    NULL::character varying AS last_name,
    NULL::integer AS jersey_number,
    jsonb_build_object('timeout_type', to1.timeout_type, 'duration', to1.duration, 'called_by', to1.called_by) AS specific_details
   FROM (public.timeouts to1
     LEFT JOIN public.teams t ON ((to1.club_id = t.id)))
UNION ALL
 SELECT 'commentary'::text AS source_table,
    mc.id,
    mc.game_id,
    concat('commentary_', mc.commentary_type) AS type,
    NULL::integer AS club_id,
    NULL::integer AS player_id,
    mc.period,
    mc.time_remaining,
    jsonb_build_object('title', mc.title, 'content', mc.content, 'created_by', mc.created_by) AS details,
    mc.created_at,
    NULL::character varying AS team_name,
    NULL::character varying AS first_name,
    NULL::character varying AS last_name,
    NULL::integer AS jersey_number,
    jsonb_build_object('commentary_type', mc.commentary_type, 'title', mc.title, 'content', mc.content) AS specific_details
   FROM public.match_commentary mc
  ORDER BY 10 DESC;


--
-- Name: VIEW comprehensive_match_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.comprehensive_match_events IS 'Unified view of all match events from different tables for easy querying and timeline display';


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id integer NOT NULL,
    game_id integer NOT NULL,
    event_type character varying(255) NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    club_id integer
);


--
-- Name: events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.events_id_seq OWNED BY public.events.id;


--
-- Name: export_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.export_settings (
    id integer NOT NULL,
    user_id integer NOT NULL,
    default_format character varying(20) DEFAULT 'pdf'::character varying,
    default_template_id integer,
    anonymize_opponents boolean DEFAULT false,
    include_sensitive_data boolean DEFAULT true,
    auto_delete_after_days integer,
    allow_public_sharing boolean DEFAULT false,
    allowed_share_roles jsonb DEFAULT '["coach", "admin"]'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE export_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.export_settings IS 'User-specific export configuration and preferences';


--
-- Name: COLUMN export_settings.anonymize_opponents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.export_settings.anonymize_opponents IS 'Whether to hide opponent team names and player names in reports';


--
-- Name: COLUMN export_settings.auto_delete_after_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.export_settings.auto_delete_after_days IS 'Automatically delete generated reports after N days (NULL = never)';


--
-- Name: COLUMN export_settings.allowed_share_roles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.export_settings.allowed_share_roles IS 'Array of user roles that can access shared reports';


--
-- Name: export_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.export_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: export_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.export_settings_id_seq OWNED BY public.export_settings.id;


--
-- Name: free_shots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.free_shots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: free_shots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.free_shots_id_seq OWNED BY public.free_shots.id;


--
-- Name: game_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.game_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: game_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.game_events_id_seq OWNED BY public.game_events.id;


--
-- Name: game_rosters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_rosters (
    id integer NOT NULL,
    game_id integer NOT NULL,
    club_id integer NOT NULL,
    player_id integer NOT NULL,
    is_captain boolean DEFAULT false,
    is_starting boolean DEFAULT true,
    starting_position character varying(20),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT game_rosters_starting_position_check CHECK ((((starting_position)::text = ANY ((ARRAY['offense'::character varying, 'defense'::character varying])::text[])) OR (starting_position IS NULL)))
);


--
-- Name: TABLE game_rosters; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.game_rosters IS 'Tracks which players are in the roster for each game and who is captain for that specific game. Role is game-specific, not permanent.';


--
-- Name: COLUMN game_rosters.is_captain; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.game_rosters.is_captain IS 'Whether this player is the captain for this specific game. One captain per team per game.';


--
-- Name: COLUMN game_rosters.is_starting; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.game_rosters.is_starting IS 'Whether this player is in the starting lineup (on court) vs on the bench.';


--
-- Name: game_rosters_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.game_rosters_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: game_rosters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.game_rosters_id_seq OWNED BY public.game_rosters.id;


--
-- Name: games; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.games (
    id integer NOT NULL,
    home_club_id integer NOT NULL,
    away_club_id integer NOT NULL,
    home_score integer DEFAULT 0,
    away_score integer DEFAULT 0,
    date timestamp with time zone NOT NULL,
    status character varying(20) DEFAULT 'scheduled'::character varying,
    game_type character varying(10) DEFAULT 'club'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    home_attacking_side character varying(10),
    number_of_periods integer DEFAULT 4,
    current_period integer DEFAULT 1,
    period_duration interval DEFAULT '00:10:00'::interval,
    time_remaining interval,
    timer_state character varying(20) DEFAULT 'stopped'::character varying,
    timer_started_at timestamp with time zone,
    timer_paused_at timestamp with time zone,
    season_id integer,
    home_team_id integer,
    away_team_id integer,
    competition_id integer,
    CONSTRAINT check_current_period CHECK (((current_period >= 1) AND (current_period <= 10))),
    CONSTRAINT check_number_of_periods CHECK (((number_of_periods >= 1) AND (number_of_periods <= 10))),
    CONSTRAINT check_timer_state CHECK (((timer_state)::text = ANY ((ARRAY['stopped'::character varying, 'running'::character varying, 'paused'::character varying])::text[]))),
    CONSTRAINT games_current_period_check CHECK (((current_period >= 1) AND (current_period <= 10))),
    CONSTRAINT games_game_type_check CHECK (((game_type)::text = ANY ((ARRAY['club'::character varying, 'team'::character varying])::text[]))),
    CONSTRAINT games_home_attacking_side_check CHECK (((home_attacking_side)::text = ANY ((ARRAY['left'::character varying, 'right'::character varying])::text[]))),
    CONSTRAINT games_home_club_id_away_club_id_check CHECK ((home_club_id <> away_club_id)),
    CONSTRAINT games_home_club_id_check CHECK ((home_club_id <> away_club_id)),
    CONSTRAINT games_status_check CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'to_reschedule'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT valid_period CHECK (((current_period >= 1) AND (current_period <= 4))),
    CONSTRAINT valid_timer_state CHECK (((timer_state)::text = ANY ((ARRAY['stopped'::character varying, 'running'::character varying, 'paused'::character varying])::text[])))
);


--
-- Name: TABLE games; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.games IS 'Tracks all matches between clubs, including scores and status.';


--
-- Name: COLUMN games.game_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.games.game_type IS 'Type of game: club (senior level) or team (age group specific)';


--
-- Name: COLUMN games.home_attacking_side; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.games.home_attacking_side IS 'Indicates which korf the home team attacks throughout the match. Left = 13% x-coord, Right = 87% x-coord. Within each team, attacking and defending players switch sides every 2 goals, but teams always attack the same korf.';


--
-- Name: COLUMN games.number_of_periods; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.games.number_of_periods IS 'Number of periods in the game. Configurable from 1-10. Teams switch sides every period.';


--
-- Name: COLUMN games.current_period; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.games.current_period IS 'Current period of the game (1-4)';


--
-- Name: COLUMN games.period_duration; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.games.period_duration IS 'Duration of each period (default 10 minutes)';


--
-- Name: COLUMN games.time_remaining; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.games.time_remaining IS 'Time remaining in current period (calculated when paused/stopped)';


--
-- Name: COLUMN games.timer_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.games.timer_state IS 'Current state of the game timer: stopped, running, or paused';


--
-- Name: COLUMN games.timer_started_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.games.timer_started_at IS 'Timestamp when timer was last started/resumed';


--
-- Name: COLUMN games.timer_paused_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.games.timer_paused_at IS 'Timestamp when timer was paused';


--
-- Name: COLUMN games.competition_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.games.competition_id IS 'Links game to a competition (tournament/league). NULL for friendly matches.';


--
-- Name: CONSTRAINT games_status_check ON games; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT games_status_check ON public.games IS 'Valid game statuses: scheduled (planned), to_reschedule (needs new date), in_progress (currently playing), completed (finished), cancelled (not played)';


--
-- Name: games_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.games_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: games_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.games_id_seq OWNED BY public.games.id;


--
-- Name: head_to_head; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.head_to_head (
    id integer NOT NULL,
    team1_id integer NOT NULL,
    team2_id integer NOT NULL,
    total_games integer DEFAULT 0,
    team1_wins integer DEFAULT 0,
    team2_wins integer DEFAULT 0,
    draws integer DEFAULT 0,
    team1_goals integer DEFAULT 0,
    team2_goals integer DEFAULT 0,
    last_game_id integer,
    last_game_date timestamp with time zone,
    streak_team_id integer,
    streak_count integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT head_to_head_check CHECK ((team1_id < team2_id))
);


--
-- Name: TABLE head_to_head; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.head_to_head IS 'Historical head-to-head records between pairs of teams';


--
-- Name: COLUMN head_to_head.streak_team_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.head_to_head.streak_team_id IS 'Team with the current winning streak in head-to-head matches';


--
-- Name: head_to_head_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.head_to_head_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: head_to_head_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.head_to_head_id_seq OWNED BY public.head_to_head.id;


--
-- Name: historical_performance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historical_performance (
    id integer NOT NULL,
    entity_type character varying(20) NOT NULL,
    entity_id integer NOT NULL,
    time_period character varying(50) NOT NULL,
    games_played integer NOT NULL,
    metric_type character varying(50) NOT NULL,
    metric_value numeric(10,2) NOT NULL,
    calculation_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE historical_performance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.historical_performance IS 'Stores historical performance metrics for players and teams';


--
-- Name: COLUMN historical_performance.entity_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.historical_performance.entity_type IS 'Type of entity: player or team';


--
-- Name: COLUMN historical_performance.entity_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.historical_performance.entity_id IS 'ID of player or team';


--
-- Name: COLUMN historical_performance.time_period; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.historical_performance.time_period IS 'Time period for calculation (season, days, career, etc.)';


--
-- Name: COLUMN historical_performance.metric_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.historical_performance.metric_type IS 'Type of performance metric';


--
-- Name: COLUMN historical_performance.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.historical_performance.metadata IS 'Additional statistics and context';


--
-- Name: historical_performance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.historical_performance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: historical_performance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.historical_performance_id_seq OWNED BY public.historical_performance.id;


--
-- Name: login_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_history (
    id integer NOT NULL,
    user_id integer,
    username character varying(50) NOT NULL,
    success boolean NOT NULL,
    ip_address character varying(45),
    user_agent text,
    error_message text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE login_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.login_history IS 'Tracks all login attempts (successful and failed) for security auditing';


--
-- Name: COLUMN login_history.success; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.login_history.success IS 'True if login was successful, false otherwise';


--
-- Name: COLUMN login_history.ip_address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.login_history.ip_address IS 'IP address of the login attempt';


--
-- Name: COLUMN login_history.user_agent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.login_history.user_agent IS 'Browser/client user agent string';


--
-- Name: COLUMN login_history.error_message; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.login_history.error_message IS 'Error message if login failed (e.g., invalid password, user not found)';


--
-- Name: login_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.login_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: login_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.login_history_id_seq OWNED BY public.login_history.id;


--
-- Name: match_commentary_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.match_commentary_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: match_commentary_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.match_commentary_id_seq OWNED BY public.match_commentary.id;


--
-- Name: match_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_templates (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    number_of_periods integer DEFAULT 4,
    period_duration_minutes integer DEFAULT 10,
    competition_type character varying(50),
    created_by integer,
    is_system_template boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT match_templates_number_of_periods_check CHECK (((number_of_periods >= 1) AND (number_of_periods <= 10))),
    CONSTRAINT match_templates_period_duration_minutes_check CHECK (((period_duration_minutes >= 1) AND (period_duration_minutes <= 60)))
);


--
-- Name: TABLE match_templates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.match_templates IS 'Match templates for saving common match configurations (periods, duration)';


--
-- Name: COLUMN match_templates.number_of_periods; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.match_templates.number_of_periods IS 'Number of periods in the match (1-10)';


--
-- Name: COLUMN match_templates.period_duration_minutes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.match_templates.period_duration_minutes IS 'Duration of each period in minutes (1-60)';


--
-- Name: COLUMN match_templates.competition_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.match_templates.competition_type IS 'Type of competition: league, cup, friendly, tournament';


--
-- Name: COLUMN match_templates.is_system_template; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.match_templates.is_system_template IS 'System templates are pre-defined and cannot be deleted by users';


--
-- Name: match_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.match_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: match_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.match_templates_id_seq OWNED BY public.match_templates.id;


--
-- Name: player_achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_achievements (
    id integer NOT NULL,
    player_id integer NOT NULL,
    achievement_id integer NOT NULL,
    game_id integer,
    earned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    metadata jsonb
);


--
-- Name: player_achievements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.player_achievements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: player_achievements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.player_achievements_id_seq OWNED BY public.player_achievements.id;


--
-- Name: player_leaderboard; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_leaderboard (
    id integer NOT NULL,
    player_id integer NOT NULL,
    season character varying(20) NOT NULL,
    total_shots integer DEFAULT 0,
    total_goals integer DEFAULT 0,
    fg_percentage numeric(5,2) DEFAULT 0,
    achievement_points integer DEFAULT 0,
    games_played integer DEFAULT 0,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: player_leaderboard_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.player_leaderboard_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: player_leaderboard_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.player_leaderboard_id_seq OWNED BY public.player_leaderboard.id;


--
-- Name: player_predictions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_predictions (
    id integer NOT NULL,
    player_id integer NOT NULL,
    game_id integer,
    prediction_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    prediction_type character varying(50) NOT NULL,
    predicted_fg_percentage numeric(5,2),
    predicted_goals integer,
    predicted_shots integer,
    confidence_score numeric(5,2),
    form_trend character varying(20),
    fatigue_level character varying(20),
    factors jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE player_predictions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.player_predictions IS 'Stores AI-based predictions for player performance';


--
-- Name: COLUMN player_predictions.prediction_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.player_predictions.prediction_type IS 'Type: next_game, form_trend, or fatigue';


--
-- Name: COLUMN player_predictions.confidence_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.player_predictions.confidence_score IS 'Prediction confidence level (0-100)';


--
-- Name: COLUMN player_predictions.form_trend; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.player_predictions.form_trend IS 'Player form trend: improving, declining, stable, hot, cold';


--
-- Name: COLUMN player_predictions.fatigue_level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.player_predictions.fatigue_level IS 'Fatigue indicator: fresh, normal, tired, exhausted';


--
-- Name: COLUMN player_predictions.factors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.player_predictions.factors IS 'JSON object with contributing factors';


--
-- Name: player_predictions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.player_predictions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: player_predictions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.player_predictions_id_seq OWNED BY public.player_predictions.id;


--
-- Name: players_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.players_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: players_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.players_id_seq OWNED BY public.players.id;


--
-- Name: report_exports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_exports (
    id integer NOT NULL,
    template_id integer,
    scheduled_report_id integer,
    generated_by integer,
    report_name character varying(200) NOT NULL,
    report_type character varying(50) NOT NULL,
    format character varying(20) NOT NULL,
    game_id integer,
    team_id integer,
    player_id integer,
    date_range jsonb,
    file_path character varying(500),
    file_size_bytes integer,
    file_hash character varying(64),
    is_public boolean DEFAULT false,
    share_token character varying(64),
    access_count integer DEFAULT 0,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE report_exports; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.report_exports IS 'Tracks all generated reports for download and history';


--
-- Name: COLUMN report_exports.report_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.report_exports.report_type IS 'Type of report: game (single match), player, team, or season';


--
-- Name: COLUMN report_exports.share_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.report_exports.share_token IS 'Unique token for public sharing if is_public is true';


--
-- Name: COLUMN report_exports.expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.report_exports.expires_at IS 'When to auto-delete this report (based on user retention policy)';


--
-- Name: report_exports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.report_exports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: report_exports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.report_exports_id_seq OWNED BY public.report_exports.id;


--
-- Name: report_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_templates (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    type character varying(50) NOT NULL,
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_by integer,
    description text,
    sections jsonb DEFAULT '[]'::jsonb,
    metrics jsonb DEFAULT '[]'::jsonb,
    branding jsonb DEFAULT '{}'::jsonb,
    language character varying(10) DEFAULT 'en'::character varying,
    date_format character varying(20) DEFAULT 'YYYY-MM-DD'::character varying,
    time_format character varying(20) DEFAULT '24h'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE report_templates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.report_templates IS 'Stores report template definitions for generating match reports';


--
-- Name: COLUMN report_templates.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.report_templates.type IS 'Template type: summary, detailed, coach_focused, or custom';


--
-- Name: COLUMN report_templates.is_default; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.report_templates.is_default IS 'True for system-provided templates that cannot be deleted';


--
-- Name: COLUMN report_templates.sections; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.report_templates.sections IS 'Array of section identifiers to include in the report';


--
-- Name: COLUMN report_templates.metrics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.report_templates.metrics IS 'Array of specific metrics to display';


--
-- Name: COLUMN report_templates.branding; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.report_templates.branding IS 'Team branding configuration: logo, colors, headers, footers';


--
-- Name: report_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.report_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: report_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.report_templates_id_seq OWNED BY public.report_templates.id;


--
-- Name: scheduled_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_reports (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    created_by integer NOT NULL,
    template_id integer NOT NULL,
    schedule_type character varying(50) NOT NULL,
    is_active boolean DEFAULT true,
    team_id integer,
    game_filters jsonb DEFAULT '{}'::jsonb,
    send_email boolean DEFAULT false,
    email_recipients jsonb DEFAULT '[]'::jsonb,
    email_subject character varying(200),
    email_body text,
    last_run_at timestamp with time zone,
    next_run_at timestamp with time zone,
    run_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT scheduled_reports_schedule_type_check CHECK (((schedule_type)::text = ANY ((ARRAY['after_match'::character varying, 'weekly'::character varying, 'monthly'::character varying, 'season_end'::character varying])::text[])))
);


--
-- Name: TABLE scheduled_reports; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.scheduled_reports IS 'Configuration for automatically generating and sending reports on schedule';


--
-- Name: COLUMN scheduled_reports.schedule_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scheduled_reports.schedule_type IS 'When to generate: after_match, weekly, monthly, or season_end';


--
-- Name: COLUMN scheduled_reports.game_filters; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scheduled_reports.game_filters IS 'Additional filters for selecting games to include in report';


--
-- Name: COLUMN scheduled_reports.email_recipients; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.scheduled_reports.email_recipients IS 'Array of email addresses to send report to';


--
-- Name: scheduled_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.scheduled_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: scheduled_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.scheduled_reports_id_seq OWNED BY public.scheduled_reports.id;


--
-- Name: seasons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seasons (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    season_type character varying(20),
    is_active boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT seasons_check CHECK ((end_date >= start_date)),
    CONSTRAINT seasons_season_type_check CHECK ((((season_type)::text = ANY ((ARRAY['indoor'::character varying, 'outdoor'::character varying, 'mixed'::character varying])::text[])) OR (season_type IS NULL)))
);


--
-- Name: TABLE seasons; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.seasons IS 'Seasons for organizing games and tracking historical performance';


--
-- Name: COLUMN seasons.season_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.seasons.season_type IS 'Type of season: indoor, outdoor, or mixed';


--
-- Name: COLUMN seasons.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.seasons.is_active IS 'Indicates the current active season. Only one season should be active at a time.';


--
-- Name: seasons_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.seasons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seasons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.seasons_id_seq OWNED BY public.seasons.id;


--
-- Name: series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.series (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    level integer NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE series; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.series IS 'Belgian korfball division levels (e.g., Eerste Klasse, Tweede Klasse). Used for league hierarchy and promotion/relegation tracking';


--
-- Name: COLUMN series.name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.series.name IS 'Division name (e.g., "Eerste Klasse", "Tweede Klasse", "Derde Klasse")';


--
-- Name: COLUMN series.level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.series.level IS 'Numeric level for hierarchy (1 = highest division, 2 = second highest, etc.)';


--
-- Name: series_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.series_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: series_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.series_id_seq OWNED BY public.series.id;


--
-- Name: shots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shots (
    id integer NOT NULL,
    game_id integer NOT NULL,
    player_id integer NOT NULL,
    club_id integer NOT NULL,
    x_coord numeric NOT NULL,
    y_coord numeric NOT NULL,
    result character varying(20) NOT NULL,
    period integer NOT NULL,
    time_remaining interval,
    shot_type character varying(50),
    distance numeric,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: shots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shots_id_seq OWNED BY public.shots.id;


--
-- Name: substitutions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.substitutions (
    id integer NOT NULL,
    game_id integer NOT NULL,
    club_id integer NOT NULL,
    player_in_id integer NOT NULL,
    player_out_id integer NOT NULL,
    period integer NOT NULL,
    time_remaining interval,
    reason character varying(50),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT different_players CHECK ((player_in_id <> player_out_id))
);


--
-- Name: TABLE substitutions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.substitutions IS 'Tracks player substitutions during live matches. Player_out goes to bench, player_in enters the court.';


--
-- Name: COLUMN substitutions.player_in_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.substitutions.player_in_id IS 'Player entering the court (coming from bench)';


--
-- Name: COLUMN substitutions.player_out_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.substitutions.player_out_id IS 'Player leaving the court (going to bench)';


--
-- Name: COLUMN substitutions.reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.substitutions.reason IS 'Reason for substitution: tactical, injury, fatigue, disciplinary';


--
-- Name: substitutions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.substitutions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: substitutions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.substitutions_id_seq OWNED BY public.substitutions.id;


--
-- Name: team_leaderboard; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_leaderboard (
    id integer NOT NULL,
    team_id integer NOT NULL,
    season character varying(20) NOT NULL,
    total_points integer DEFAULT 0,
    games_played integer DEFAULT 0,
    wins integer DEFAULT 0,
    losses integer DEFAULT 0,
    total_shots integer DEFAULT 0,
    total_goals integer DEFAULT 0,
    avg_fg_percentage numeric(5,2) DEFAULT 0,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: team_leaderboard_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.team_leaderboard_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: team_leaderboard_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.team_leaderboard_id_seq OWNED BY public.team_leaderboard.id;


--
-- Name: team_rankings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_rankings (
    id integer NOT NULL,
    team_id integer NOT NULL,
    season_id integer,
    overall_rank integer,
    points integer DEFAULT 0,
    rating numeric(6,2),
    games_played integer DEFAULT 0,
    wins integer DEFAULT 0,
    losses integer DEFAULT 0,
    draws integer DEFAULT 0,
    goals_for integer DEFAULT 0,
    goals_against integer DEFAULT 0,
    goal_difference integer GENERATED ALWAYS AS ((goals_for - goals_against)) STORED,
    win_percentage numeric(5,2) GENERATED ALWAYS AS (
CASE
    WHEN (games_played > 0) THEN round((((wins)::numeric / (games_played)::numeric) * (100)::numeric), 2)
    ELSE (0)::numeric
END) STORED,
    avg_goals_per_game numeric(4,2),
    avg_goals_conceded numeric(4,2),
    clean_sheets integer DEFAULT 0,
    longest_win_streak integer DEFAULT 0,
    current_streak character varying(20),
    last_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE team_rankings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.team_rankings IS 'Team rankings based on performance metrics, can be season-specific or overall';


--
-- Name: COLUMN team_rankings.rating; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.team_rankings.rating IS 'ELO-style rating for team strength comparison';


--
-- Name: team_rankings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.team_rankings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: team_rankings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.team_rankings_id_seq OWNED BY public.team_rankings.id;


--
-- Name: teams_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.teams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.teams_id_seq OWNED BY public.teams.id;


--
-- Name: timeouts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.timeouts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: timeouts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.timeouts_id_seq OWNED BY public.timeouts.id;


--
-- Name: tournament_brackets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_brackets (
    id integer NOT NULL,
    competition_id integer NOT NULL,
    round_number integer NOT NULL,
    round_name character varying(100),
    match_number integer NOT NULL,
    game_id integer,
    home_team_id integer,
    away_team_id integer,
    winner_team_id integer,
    next_bracket_id integer,
    scheduled_date timestamp with time zone,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT tournament_brackets_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'scheduled'::character varying, 'in_progress'::character varying, 'completed'::character varying])::text[])))
);


--
-- Name: TABLE tournament_brackets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tournament_brackets IS 'Tournament bracket structure linking rounds and matches';


--
-- Name: COLUMN tournament_brackets.next_bracket_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tournament_brackets.next_bracket_id IS 'ID of the bracket match where the winner advances';


--
-- Name: tournament_brackets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_brackets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_brackets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_brackets_id_seq OWNED BY public.tournament_brackets.id;


--
-- Name: trainer_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trainer_assignments (
    id integer NOT NULL,
    user_id integer NOT NULL,
    club_id integer NOT NULL,
    team_id integer,
    active_from date DEFAULT CURRENT_DATE,
    active_to date,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT trainer_assignments_active_dates CHECK (((active_to IS NULL) OR (active_to >= active_from)))
);


--
-- Name: trainer_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.trainer_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: trainer_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.trainer_assignments_id_seq OWNED BY public.trainer_assignments.id;


--
-- Name: twizzit_competition_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.twizzit_competition_mappings (
    id integer NOT NULL,
    local_competition_id integer,
    twizzit_competition_id character varying(100) NOT NULL,
    twizzit_competition_name character varying(255),
    season character varying(50),
    last_synced_at timestamp without time zone,
    sync_status character varying(50) DEFAULT 'pending'::character varying,
    sync_error text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: twizzit_competition_mappings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.twizzit_competition_mappings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: twizzit_competition_mappings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.twizzit_competition_mappings_id_seq OWNED BY public.twizzit_competition_mappings.id;


--
-- Name: twizzit_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.twizzit_credentials (
    id integer NOT NULL,
    organization_name character varying(255) NOT NULL,
    api_username character varying(255) NOT NULL,
    encrypted_password text NOT NULL,
    encryption_iv text NOT NULL,
    api_endpoint character varying(500) DEFAULT 'https://api.twizzit.com/v1'::character varying NOT NULL,
    is_active boolean DEFAULT true,
    last_verified_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: twizzit_credentials_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.twizzit_credentials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: twizzit_credentials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.twizzit_credentials_id_seq OWNED BY public.twizzit_credentials.id;


--
-- Name: twizzit_player_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.twizzit_player_mappings (
    id integer NOT NULL,
    local_player_id integer,
    twizzit_player_id character varying(100) NOT NULL,
    twizzit_player_name character varying(255),
    team_mapping_id integer,
    last_synced_at timestamp without time zone,
    sync_status character varying(50) DEFAULT 'pending'::character varying,
    sync_error text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: twizzit_player_mappings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.twizzit_player_mappings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: twizzit_player_mappings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.twizzit_player_mappings_id_seq OWNED BY public.twizzit_player_mappings.id;


--
-- Name: twizzit_sync_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.twizzit_sync_config (
    id integer NOT NULL,
    credential_id integer,
    sync_teams boolean DEFAULT true,
    sync_players boolean DEFAULT true,
    sync_competitions boolean DEFAULT true,
    sync_interval_minutes integer DEFAULT 60,
    auto_sync_enabled boolean DEFAULT false,
    last_sync_at timestamp without time zone,
    next_sync_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: twizzit_sync_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.twizzit_sync_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: twizzit_sync_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.twizzit_sync_config_id_seq OWNED BY public.twizzit_sync_config.id;


--
-- Name: twizzit_sync_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.twizzit_sync_history (
    id integer NOT NULL,
    credential_id integer,
    sync_type character varying(50) NOT NULL,
    sync_direction character varying(20) NOT NULL,
    status character varying(50) NOT NULL,
    items_processed integer DEFAULT 0,
    items_succeeded integer DEFAULT 0,
    items_failed integer DEFAULT 0,
    error_message text,
    started_at timestamp without time zone NOT NULL,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: twizzit_sync_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.twizzit_sync_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: twizzit_sync_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.twizzit_sync_history_id_seq OWNED BY public.twizzit_sync_history.id;


--
-- Name: twizzit_team_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.twizzit_team_mappings (
    id integer NOT NULL,
    local_club_id integer,
    twizzit_team_id character varying(100) NOT NULL,
    twizzit_team_name character varying(255),
    last_synced_at timestamp without time zone,
    sync_status character varying(50) DEFAULT 'pending'::character varying,
    sync_error text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: twizzit_team_mappings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.twizzit_team_mappings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: twizzit_team_mappings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.twizzit_team_mappings_id_seq OWNED BY public.twizzit_team_mappings.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20) DEFAULT 'user'::character varying,
    password_must_change boolean DEFAULT false,
    is_active boolean DEFAULT true NOT NULL,
    last_login timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: COLUMN users.password_must_change; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.password_must_change IS 'Forces user to change password on next login (used for default admin and password resets)';


--
-- Name: COLUMN users.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.is_active IS 'Soft delete flag - false indicates user has been deactivated';


--
-- Name: COLUMN users.last_login; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.last_login IS 'Timestamp of user''s most recent successful login';


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: video_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video_events (
    id integer NOT NULL,
    game_id integer NOT NULL,
    event_type character varying(50) NOT NULL,
    event_id integer,
    video_url text,
    timestamp_start integer NOT NULL,
    timestamp_end integer,
    description text,
    is_highlight boolean DEFAULT false,
    tags text[],
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE video_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.video_events IS 'Links game events to video timestamps for video integration and highlight reel generation';


--
-- Name: COLUMN video_events.event_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.video_events.event_type IS 'Type of event: shot, goal, substitution, timeout, foul, etc.';


--
-- Name: COLUMN video_events.event_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.video_events.event_id IS 'Reference to specific event ID in related table';


--
-- Name: COLUMN video_events.timestamp_start; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.video_events.timestamp_start IS 'Video timestamp in seconds where event starts';


--
-- Name: COLUMN video_events.is_highlight; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.video_events.is_highlight IS 'Mark as highlight for automatic reel generation';


--
-- Name: COLUMN video_events.tags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.video_events.tags IS 'Array of tags for categorization and filtering';


--
-- Name: video_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.video_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: video_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.video_events_id_seq OWNED BY public.video_events.id;


--
-- Name: achievements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements ALTER COLUMN id SET DEFAULT nextval('public.achievements_id_seq'::regclass);


--
-- Name: ball_possessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ball_possessions ALTER COLUMN id SET DEFAULT nextval('public.ball_possessions_id_seq'::regclass);


--
-- Name: clubs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clubs ALTER COLUMN id SET DEFAULT nextval('public.clubs_id_seq'::regclass);


--
-- Name: competition_benchmarks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competition_benchmarks ALTER COLUMN id SET DEFAULT nextval('public.competition_benchmarks_id_seq'::regclass);


--
-- Name: competition_standings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competition_standings ALTER COLUMN id SET DEFAULT nextval('public.competition_standings_id_seq'::regclass);


--
-- Name: competition_teams id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competition_teams ALTER COLUMN id SET DEFAULT nextval('public.competition_teams_id_seq'::regclass);


--
-- Name: competitions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitions ALTER COLUMN id SET DEFAULT nextval('public.competitions_id_seq'::regclass);


--
-- Name: events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events ALTER COLUMN id SET DEFAULT nextval('public.events_id_seq'::regclass);


--
-- Name: export_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.export_settings ALTER COLUMN id SET DEFAULT nextval('public.export_settings_id_seq'::regclass);


--
-- Name: free_shots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.free_shots ALTER COLUMN id SET DEFAULT nextval('public.free_shots_id_seq'::regclass);


--
-- Name: game_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_events ALTER COLUMN id SET DEFAULT nextval('public.game_events_id_seq'::regclass);


--
-- Name: game_rosters id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_rosters ALTER COLUMN id SET DEFAULT nextval('public.game_rosters_id_seq'::regclass);


--
-- Name: games id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games ALTER COLUMN id SET DEFAULT nextval('public.games_id_seq'::regclass);


--
-- Name: head_to_head id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.head_to_head ALTER COLUMN id SET DEFAULT nextval('public.head_to_head_id_seq'::regclass);


--
-- Name: historical_performance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historical_performance ALTER COLUMN id SET DEFAULT nextval('public.historical_performance_id_seq'::regclass);


--
-- Name: login_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_history ALTER COLUMN id SET DEFAULT nextval('public.login_history_id_seq'::regclass);


--
-- Name: match_commentary id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_commentary ALTER COLUMN id SET DEFAULT nextval('public.match_commentary_id_seq'::regclass);


--
-- Name: match_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_templates ALTER COLUMN id SET DEFAULT nextval('public.match_templates_id_seq'::regclass);


--
-- Name: player_achievements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_achievements ALTER COLUMN id SET DEFAULT nextval('public.player_achievements_id_seq'::regclass);


--
-- Name: player_leaderboard id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_leaderboard ALTER COLUMN id SET DEFAULT nextval('public.player_leaderboard_id_seq'::regclass);


--
-- Name: player_predictions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_predictions ALTER COLUMN id SET DEFAULT nextval('public.player_predictions_id_seq'::regclass);


--
-- Name: players id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players ALTER COLUMN id SET DEFAULT nextval('public.players_id_seq'::regclass);


--
-- Name: report_exports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_exports ALTER COLUMN id SET DEFAULT nextval('public.report_exports_id_seq'::regclass);


--
-- Name: report_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_templates ALTER COLUMN id SET DEFAULT nextval('public.report_templates_id_seq'::regclass);


--
-- Name: scheduled_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_reports ALTER COLUMN id SET DEFAULT nextval('public.scheduled_reports_id_seq'::regclass);


--
-- Name: seasons id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seasons ALTER COLUMN id SET DEFAULT nextval('public.seasons_id_seq'::regclass);


--
-- Name: series id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series ALTER COLUMN id SET DEFAULT nextval('public.series_id_seq'::regclass);


--
-- Name: shots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shots ALTER COLUMN id SET DEFAULT nextval('public.shots_id_seq'::regclass);


--
-- Name: substitutions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.substitutions ALTER COLUMN id SET DEFAULT nextval('public.substitutions_id_seq'::regclass);


--
-- Name: team_leaderboard id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_leaderboard ALTER COLUMN id SET DEFAULT nextval('public.team_leaderboard_id_seq'::regclass);


--
-- Name: team_rankings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_rankings ALTER COLUMN id SET DEFAULT nextval('public.team_rankings_id_seq'::regclass);


--
-- Name: teams id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams ALTER COLUMN id SET DEFAULT nextval('public.teams_id_seq'::regclass);


--
-- Name: timeouts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeouts ALTER COLUMN id SET DEFAULT nextval('public.timeouts_id_seq'::regclass);


--
-- Name: tournament_brackets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_brackets ALTER COLUMN id SET DEFAULT nextval('public.tournament_brackets_id_seq'::regclass);


--
-- Name: trainer_assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainer_assignments ALTER COLUMN id SET DEFAULT nextval('public.trainer_assignments_id_seq'::regclass);


--
-- Name: twizzit_competition_mappings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_competition_mappings ALTER COLUMN id SET DEFAULT nextval('public.twizzit_competition_mappings_id_seq'::regclass);


--
-- Name: twizzit_credentials id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_credentials ALTER COLUMN id SET DEFAULT nextval('public.twizzit_credentials_id_seq'::regclass);


--
-- Name: twizzit_player_mappings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_player_mappings ALTER COLUMN id SET DEFAULT nextval('public.twizzit_player_mappings_id_seq'::regclass);


--
-- Name: twizzit_sync_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_sync_config ALTER COLUMN id SET DEFAULT nextval('public.twizzit_sync_config_id_seq'::regclass);


--
-- Name: twizzit_sync_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_sync_history ALTER COLUMN id SET DEFAULT nextval('public.twizzit_sync_history_id_seq'::regclass);


--
-- Name: twizzit_team_mappings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_team_mappings ALTER COLUMN id SET DEFAULT nextval('public.twizzit_team_mappings_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: video_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_events ALTER COLUMN id SET DEFAULT nextval('public.video_events_id_seq'::regclass);


--
-- Name: achievements achievements_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_name_key UNIQUE (name);


--
-- Name: achievements achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_pkey PRIMARY KEY (id);


--
-- Name: ball_possessions ball_possessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ball_possessions
    ADD CONSTRAINT ball_possessions_pkey PRIMARY KEY (id);


--
-- Name: clubs clubs_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_name_key UNIQUE (name);


--
-- Name: clubs clubs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_pkey PRIMARY KEY (id);


--
-- Name: competition_benchmarks competition_benchmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competition_benchmarks
    ADD CONSTRAINT competition_benchmarks_pkey PRIMARY KEY (id);


--
-- Name: competition_standings competition_standings_competition_id_team_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competition_standings
    ADD CONSTRAINT competition_standings_competition_id_team_id_key UNIQUE (competition_id, team_id);


--
-- Name: competition_standings competition_standings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competition_standings
    ADD CONSTRAINT competition_standings_pkey PRIMARY KEY (id);


--
-- Name: competition_teams competition_teams_competition_id_team_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competition_teams
    ADD CONSTRAINT competition_teams_competition_id_team_id_key UNIQUE (competition_id, team_id);


--
-- Name: competition_teams competition_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competition_teams
    ADD CONSTRAINT competition_teams_pkey PRIMARY KEY (id);


--
-- Name: competitions competitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitions
    ADD CONSTRAINT competitions_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: export_settings export_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.export_settings
    ADD CONSTRAINT export_settings_pkey PRIMARY KEY (id);


--
-- Name: export_settings export_settings_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.export_settings
    ADD CONSTRAINT export_settings_user_id_key UNIQUE (user_id);


--
-- Name: free_shots free_shots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.free_shots
    ADD CONSTRAINT free_shots_pkey PRIMARY KEY (id);


--
-- Name: game_events game_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_events
    ADD CONSTRAINT game_events_pkey PRIMARY KEY (id);


--
-- Name: game_rosters game_rosters_game_id_player_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_rosters
    ADD CONSTRAINT game_rosters_game_id_player_id_key UNIQUE (game_id, player_id);


--
-- Name: game_rosters game_rosters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_rosters
    ADD CONSTRAINT game_rosters_pkey PRIMARY KEY (id);


--
-- Name: games games_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_pkey PRIMARY KEY (id);


--
-- Name: head_to_head head_to_head_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.head_to_head
    ADD CONSTRAINT head_to_head_pkey PRIMARY KEY (id);


--
-- Name: head_to_head head_to_head_team1_id_team2_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.head_to_head
    ADD CONSTRAINT head_to_head_team1_id_team2_id_key UNIQUE (team1_id, team2_id);


--
-- Name: historical_performance historical_performance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historical_performance
    ADD CONSTRAINT historical_performance_pkey PRIMARY KEY (id);


--
-- Name: login_history login_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_history
    ADD CONSTRAINT login_history_pkey PRIMARY KEY (id);


--
-- Name: match_commentary match_commentary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_commentary
    ADD CONSTRAINT match_commentary_pkey PRIMARY KEY (id);


--
-- Name: match_templates match_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_templates
    ADD CONSTRAINT match_templates_pkey PRIMARY KEY (id);


--
-- Name: player_achievements player_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_achievements
    ADD CONSTRAINT player_achievements_pkey PRIMARY KEY (id);


--
-- Name: player_achievements player_achievements_player_id_achievement_id_game_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_achievements
    ADD CONSTRAINT player_achievements_player_id_achievement_id_game_id_key UNIQUE (player_id, achievement_id, game_id);


--
-- Name: player_leaderboard player_leaderboard_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_leaderboard
    ADD CONSTRAINT player_leaderboard_pkey PRIMARY KEY (id);


--
-- Name: player_leaderboard player_leaderboard_player_id_season_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_leaderboard
    ADD CONSTRAINT player_leaderboard_player_id_season_key UNIQUE (player_id, season);


--
-- Name: player_predictions player_predictions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_predictions
    ADD CONSTRAINT player_predictions_pkey PRIMARY KEY (id);


--
-- Name: players players_club_id_jersey_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_club_id_jersey_number_key UNIQUE (club_id, jersey_number);


--
-- Name: CONSTRAINT players_club_id_jersey_number_key ON players; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT players_club_id_jersey_number_key ON public.players IS 'Ensures jersey numbers are unique within a club';


--
-- Name: players players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_pkey PRIMARY KEY (id);


--
-- Name: report_exports report_exports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_exports
    ADD CONSTRAINT report_exports_pkey PRIMARY KEY (id);


--
-- Name: report_exports report_exports_share_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_exports
    ADD CONSTRAINT report_exports_share_token_key UNIQUE (share_token);


--
-- Name: report_templates report_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_templates
    ADD CONSTRAINT report_templates_pkey PRIMARY KEY (id);


--
-- Name: scheduled_reports scheduled_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_reports
    ADD CONSTRAINT scheduled_reports_pkey PRIMARY KEY (id);


--
-- Name: seasons seasons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seasons
    ADD CONSTRAINT seasons_pkey PRIMARY KEY (id);


--
-- Name: series series_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series
    ADD CONSTRAINT series_pkey PRIMARY KEY (id);


--
-- Name: shots shots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shots
    ADD CONSTRAINT shots_pkey PRIMARY KEY (id);


--
-- Name: substitutions substitutions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.substitutions
    ADD CONSTRAINT substitutions_pkey PRIMARY KEY (id);


--
-- Name: team_leaderboard team_leaderboard_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_leaderboard
    ADD CONSTRAINT team_leaderboard_pkey PRIMARY KEY (id);


--
-- Name: team_leaderboard team_leaderboard_team_id_season_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_leaderboard
    ADD CONSTRAINT team_leaderboard_team_id_season_key UNIQUE (team_id, season);


--
-- Name: team_rankings team_rankings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_rankings
    ADD CONSTRAINT team_rankings_pkey PRIMARY KEY (id);


--
-- Name: team_rankings team_rankings_team_id_season_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_rankings
    ADD CONSTRAINT team_rankings_team_id_season_id_key UNIQUE (team_id, season_id);


--
-- Name: teams teams_club_id_name_season_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_club_id_name_season_id_key UNIQUE (club_id, name, season_id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: timeouts timeouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeouts
    ADD CONSTRAINT timeouts_pkey PRIMARY KEY (id);


--
-- Name: tournament_brackets tournament_brackets_competition_id_round_number_match_numbe_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_brackets
    ADD CONSTRAINT tournament_brackets_competition_id_round_number_match_numbe_key UNIQUE (competition_id, round_number, match_number);


--
-- Name: tournament_brackets tournament_brackets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_brackets
    ADD CONSTRAINT tournament_brackets_pkey PRIMARY KEY (id);


--
-- Name: trainer_assignments trainer_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainer_assignments
    ADD CONSTRAINT trainer_assignments_pkey PRIMARY KEY (id);


--
-- Name: twizzit_competition_mappings twizzit_competition_mappings_local_competition_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_competition_mappings
    ADD CONSTRAINT twizzit_competition_mappings_local_competition_id_key UNIQUE (local_competition_id);


--
-- Name: twizzit_competition_mappings twizzit_competition_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_competition_mappings
    ADD CONSTRAINT twizzit_competition_mappings_pkey PRIMARY KEY (id);


--
-- Name: twizzit_competition_mappings twizzit_competition_mappings_twizzit_competition_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_competition_mappings
    ADD CONSTRAINT twizzit_competition_mappings_twizzit_competition_id_key UNIQUE (twizzit_competition_id);


--
-- Name: twizzit_credentials twizzit_credentials_organization_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_credentials
    ADD CONSTRAINT twizzit_credentials_organization_name_key UNIQUE (organization_name);


--
-- Name: twizzit_credentials twizzit_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_credentials
    ADD CONSTRAINT twizzit_credentials_pkey PRIMARY KEY (id);


--
-- Name: twizzit_player_mappings twizzit_player_mappings_local_player_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_player_mappings
    ADD CONSTRAINT twizzit_player_mappings_local_player_id_key UNIQUE (local_player_id);


--
-- Name: twizzit_player_mappings twizzit_player_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_player_mappings
    ADD CONSTRAINT twizzit_player_mappings_pkey PRIMARY KEY (id);


--
-- Name: twizzit_player_mappings twizzit_player_mappings_twizzit_player_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_player_mappings
    ADD CONSTRAINT twizzit_player_mappings_twizzit_player_id_key UNIQUE (twizzit_player_id);


--
-- Name: twizzit_sync_config twizzit_sync_config_credential_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_sync_config
    ADD CONSTRAINT twizzit_sync_config_credential_id_key UNIQUE (credential_id);


--
-- Name: twizzit_sync_config twizzit_sync_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_sync_config
    ADD CONSTRAINT twizzit_sync_config_pkey PRIMARY KEY (id);


--
-- Name: twizzit_sync_history twizzit_sync_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_sync_history
    ADD CONSTRAINT twizzit_sync_history_pkey PRIMARY KEY (id);


--
-- Name: twizzit_team_mappings twizzit_team_mappings_local_club_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_team_mappings
    ADD CONSTRAINT twizzit_team_mappings_local_club_id_key UNIQUE (local_club_id);


--
-- Name: twizzit_team_mappings twizzit_team_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_team_mappings
    ADD CONSTRAINT twizzit_team_mappings_pkey PRIMARY KEY (id);


--
-- Name: twizzit_team_mappings twizzit_team_mappings_twizzit_team_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_team_mappings
    ADD CONSTRAINT twizzit_team_mappings_twizzit_team_id_key UNIQUE (twizzit_team_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: video_events video_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_events
    ADD CONSTRAINT video_events_pkey PRIMARY KEY (id);


--
-- Name: idx_achievements_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_achievements_category ON public.achievements USING btree (category);


--
-- Name: idx_ball_possessions_club_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ball_possessions_club_id ON public.ball_possessions USING btree (club_id);


--
-- Name: idx_ball_possessions_game_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ball_possessions_game_id ON public.ball_possessions USING btree (game_id);


--
-- Name: idx_benchmarks_competition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_benchmarks_competition ON public.competition_benchmarks USING btree (competition_name);


--
-- Name: idx_benchmarks_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_benchmarks_position ON public.competition_benchmarks USING btree ("position");


--
-- Name: idx_benchmarks_season; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_benchmarks_season ON public.competition_benchmarks USING btree (season);


--
-- Name: idx_benchmarks_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_benchmarks_type ON public.competition_benchmarks USING btree (benchmark_type);


--
-- Name: idx_competition_standings_competition_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_competition_standings_competition_id ON public.competition_standings USING btree (competition_id);


--
-- Name: idx_competition_standings_rank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_competition_standings_rank ON public.competition_standings USING btree (rank);


--
-- Name: idx_competition_standings_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_competition_standings_team_id ON public.competition_standings USING btree (team_id);


--
-- Name: idx_competition_teams_competition_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_competition_teams_competition_id ON public.competition_teams USING btree (competition_id);


--
-- Name: idx_competition_teams_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_competition_teams_team_id ON public.competition_teams USING btree (team_id);


--
-- Name: idx_competitions_season_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_competitions_season_id ON public.competitions USING btree (season_id);


--
-- Name: idx_competitions_series_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_competitions_series_id ON public.competitions USING btree (series_id);


--
-- Name: idx_competitions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_competitions_status ON public.competitions USING btree (status);


--
-- Name: idx_competitions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_competitions_type ON public.competitions USING btree (competition_type);


--
-- Name: idx_export_settings_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_export_settings_user_id ON public.export_settings USING btree (user_id);


--
-- Name: idx_free_shots_club_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_free_shots_club_id ON public.free_shots USING btree (club_id);


--
-- Name: idx_free_shots_game_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_free_shots_game_id ON public.free_shots USING btree (game_id);


--
-- Name: idx_free_shots_player_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_free_shots_player_id ON public.free_shots USING btree (player_id);


--
-- Name: idx_game_rosters_club_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_rosters_club_id ON public.game_rosters USING btree (club_id);


--
-- Name: idx_game_rosters_game_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_rosters_game_id ON public.game_rosters USING btree (game_id);


--
-- Name: idx_game_rosters_player_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_rosters_player_id ON public.game_rosters USING btree (player_id);


--
-- Name: idx_games_competition_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_games_competition_id ON public.games USING btree (competition_id);


--
-- Name: idx_games_season_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_games_season_id ON public.games USING btree (season_id);


--
-- Name: idx_head_to_head_last_game; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_head_to_head_last_game ON public.head_to_head USING btree (last_game_date DESC);


--
-- Name: idx_head_to_head_teams; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_head_to_head_teams ON public.head_to_head USING btree (team1_id, team2_id);


--
-- Name: idx_historical_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_historical_entity ON public.historical_performance USING btree (entity_type, entity_id);


--
-- Name: idx_historical_metric; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_historical_metric ON public.historical_performance USING btree (metric_type);


--
-- Name: idx_historical_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_historical_period ON public.historical_performance USING btree (time_period);


--
-- Name: idx_login_history_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_login_history_created_at ON public.login_history USING btree (created_at DESC);


--
-- Name: idx_login_history_success; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_login_history_success ON public.login_history USING btree (success);


--
-- Name: idx_login_history_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_login_history_user_id ON public.login_history USING btree (user_id);


--
-- Name: idx_match_commentary_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_commentary_created_by ON public.match_commentary USING btree (created_by);


--
-- Name: idx_match_commentary_game_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_commentary_game_id ON public.match_commentary USING btree (game_id);


--
-- Name: idx_match_commentary_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_commentary_type ON public.match_commentary USING btree (commentary_type);


--
-- Name: idx_match_templates_competition_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_templates_competition_type ON public.match_templates USING btree (competition_type);


--
-- Name: idx_match_templates_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_templates_created_by ON public.match_templates USING btree (created_by);


--
-- Name: idx_match_templates_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_templates_name ON public.match_templates USING btree (name);


--
-- Name: idx_player_achievements_earned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_achievements_earned ON public.player_achievements USING btree (earned_at DESC);


--
-- Name: idx_player_achievements_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_achievements_player ON public.player_achievements USING btree (player_id);


--
-- Name: idx_player_leaderboard_season; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_leaderboard_season ON public.player_leaderboard USING btree (season, fg_percentage DESC);


--
-- Name: idx_player_predictions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_predictions_date ON public.player_predictions USING btree (prediction_date);


--
-- Name: idx_player_predictions_game_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_predictions_game_id ON public.player_predictions USING btree (game_id);


--
-- Name: idx_player_predictions_player_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_predictions_player_id ON public.player_predictions USING btree (player_id);


--
-- Name: idx_player_predictions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_predictions_type ON public.player_predictions USING btree (prediction_type);


--
-- Name: idx_players_club_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_players_club_id ON public.players USING btree (club_id);


--
-- Name: idx_players_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_players_team_id ON public.players USING btree (team_id);


--
-- Name: idx_players_twizzit_registered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_players_twizzit_registered ON public.players USING btree (is_twizzit_registered);


--
-- Name: idx_report_exports_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_exports_created_at ON public.report_exports USING btree (created_at);


--
-- Name: idx_report_exports_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_exports_expires_at ON public.report_exports USING btree (expires_at);


--
-- Name: idx_report_exports_game_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_exports_game_id ON public.report_exports USING btree (game_id);


--
-- Name: idx_report_exports_generated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_exports_generated_by ON public.report_exports USING btree (generated_by);


--
-- Name: idx_report_exports_player_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_exports_player_id ON public.report_exports USING btree (player_id);


--
-- Name: idx_report_exports_share_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_exports_share_token ON public.report_exports USING btree (share_token);


--
-- Name: idx_report_exports_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_exports_team_id ON public.report_exports USING btree (team_id);


--
-- Name: idx_report_templates_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_templates_created_by ON public.report_templates USING btree (created_by);


--
-- Name: idx_report_templates_is_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_templates_is_default ON public.report_templates USING btree (is_default);


--
-- Name: idx_report_templates_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_templates_type ON public.report_templates USING btree (type);


--
-- Name: idx_scheduled_reports_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_reports_created_by ON public.scheduled_reports USING btree (created_by);


--
-- Name: idx_scheduled_reports_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_reports_is_active ON public.scheduled_reports USING btree (is_active);


--
-- Name: idx_scheduled_reports_next_run_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_reports_next_run_at ON public.scheduled_reports USING btree (next_run_at);


--
-- Name: idx_scheduled_reports_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_reports_team_id ON public.scheduled_reports USING btree (team_id);


--
-- Name: idx_scheduled_reports_template_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_reports_template_id ON public.scheduled_reports USING btree (template_id);


--
-- Name: idx_seasons_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seasons_dates ON public.seasons USING btree (start_date, end_date);


--
-- Name: idx_seasons_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seasons_is_active ON public.seasons USING btree (is_active);


--
-- Name: idx_substitutions_club_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_substitutions_club_id ON public.substitutions USING btree (club_id);


--
-- Name: idx_substitutions_game_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_substitutions_game_id ON public.substitutions USING btree (game_id);


--
-- Name: idx_substitutions_player_in_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_substitutions_player_in_id ON public.substitutions USING btree (player_in_id);


--
-- Name: idx_substitutions_player_out_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_substitutions_player_out_id ON public.substitutions USING btree (player_out_id);


--
-- Name: idx_team_leaderboard_season; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_leaderboard_season ON public.team_leaderboard USING btree (season, total_points DESC);


--
-- Name: idx_team_rankings_rank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_rankings_rank ON public.team_rankings USING btree (overall_rank);


--
-- Name: idx_team_rankings_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_rankings_rating ON public.team_rankings USING btree (rating DESC);


--
-- Name: idx_team_rankings_season_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_rankings_season_id ON public.team_rankings USING btree (season_id);


--
-- Name: idx_team_rankings_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_rankings_team_id ON public.team_rankings USING btree (team_id);


--
-- Name: idx_teams_club_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teams_club_id ON public.teams USING btree (club_id);


--
-- Name: idx_teams_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teams_is_active ON public.teams USING btree (is_active);


--
-- Name: idx_teams_season_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teams_season_id ON public.teams USING btree (season_id);


--
-- Name: idx_timeouts_club_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeouts_club_id ON public.timeouts USING btree (club_id);


--
-- Name: idx_timeouts_game_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeouts_game_id ON public.timeouts USING btree (game_id);


--
-- Name: idx_timeouts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeouts_type ON public.timeouts USING btree (timeout_type);


--
-- Name: idx_tournament_brackets_competition_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_brackets_competition_id ON public.tournament_brackets USING btree (competition_id);


--
-- Name: idx_tournament_brackets_game_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_brackets_game_id ON public.tournament_brackets USING btree (game_id);


--
-- Name: idx_tournament_brackets_round; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournament_brackets_round ON public.tournament_brackets USING btree (round_number);


--
-- Name: idx_trainer_assignments_club; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trainer_assignments_club ON public.trainer_assignments USING btree (club_id);


--
-- Name: idx_trainer_assignments_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trainer_assignments_team ON public.trainer_assignments USING btree (team_id);


--
-- Name: idx_trainer_assignments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trainer_assignments_user ON public.trainer_assignments USING btree (user_id);


--
-- Name: idx_twizzit_competition_mappings_local_competition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_twizzit_competition_mappings_local_competition ON public.twizzit_competition_mappings USING btree (local_competition_id);


--
-- Name: idx_twizzit_player_mappings_local_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_twizzit_player_mappings_local_player ON public.twizzit_player_mappings USING btree (local_player_id);


--
-- Name: idx_twizzit_player_mappings_team_mapping; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_twizzit_player_mappings_team_mapping ON public.twizzit_player_mappings USING btree (team_mapping_id);


--
-- Name: idx_twizzit_player_mappings_twizzit_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_twizzit_player_mappings_twizzit_player ON public.twizzit_player_mappings USING btree (twizzit_player_id);


--
-- Name: idx_twizzit_sync_history_credential; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_twizzit_sync_history_credential ON public.twizzit_sync_history USING btree (credential_id);


--
-- Name: idx_twizzit_sync_history_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_twizzit_sync_history_started_at ON public.twizzit_sync_history USING btree (started_at DESC);


--
-- Name: idx_twizzit_team_mappings_local_club; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_twizzit_team_mappings_local_club ON public.twizzit_team_mappings USING btree (local_club_id);


--
-- Name: idx_twizzit_team_mappings_twizzit_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_twizzit_team_mappings_twizzit_team ON public.twizzit_team_mappings USING btree (twizzit_team_id);


--
-- Name: idx_users_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_is_active ON public.users USING btree (is_active);


--
-- Name: idx_users_last_login; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_last_login ON public.users USING btree (last_login);


--
-- Name: idx_users_password_must_change; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_password_must_change ON public.users USING btree (password_must_change) WHERE (password_must_change = true);


--
-- Name: idx_video_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_video_events_event_type ON public.video_events USING btree (event_type);


--
-- Name: idx_video_events_game_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_video_events_game_id ON public.video_events USING btree (game_id);


--
-- Name: idx_video_events_is_highlight; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_video_events_is_highlight ON public.video_events USING btree (is_highlight);


--
-- Name: twizzit_team_mappings_local_club_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX twizzit_team_mappings_local_club_unique ON public.twizzit_team_mappings USING btree (local_club_id);


--
-- Name: uniq_trainer_assignment_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_trainer_assignment_active ON public.trainer_assignments USING btree (user_id, club_id, COALESCE(team_id, '-1'::integer)) WHERE ((is_active = true) AND (active_to IS NULL));


--
-- Name: twizzit_player_mappings trigger_sync_player_twizzit_registration; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_player_twizzit_registration AFTER INSERT OR DELETE ON public.twizzit_player_mappings FOR EACH ROW EXECUTE FUNCTION public.sync_player_twizzit_registration();


--
-- Name: teams update_age_groups_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_age_groups_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: clubs update_clubs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_clubs_updated_at BEFORE UPDATE ON public.clubs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: competition_benchmarks update_competition_benchmarks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_competition_benchmarks_updated_at BEFORE UPDATE ON public.competition_benchmarks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: competition_standings update_competition_standings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_competition_standings_updated_at BEFORE UPDATE ON public.competition_standings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: competitions update_competitions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_competitions_updated_at BEFORE UPDATE ON public.competitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: export_settings update_export_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_export_settings_updated_at BEFORE UPDATE ON public.export_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: games update_games_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON public.games FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: head_to_head update_head_to_head_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_head_to_head_updated_at BEFORE UPDATE ON public.head_to_head FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: historical_performance update_historical_performance_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_historical_performance_updated_at BEFORE UPDATE ON public.historical_performance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: match_commentary update_match_commentary_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_match_commentary_updated_at BEFORE UPDATE ON public.match_commentary FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: players update_players_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON public.players FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: report_templates update_report_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_report_templates_updated_at BEFORE UPDATE ON public.report_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: scheduled_reports update_scheduled_reports_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_scheduled_reports_updated_at BEFORE UPDATE ON public.scheduled_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: seasons update_seasons_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_seasons_updated_at BEFORE UPDATE ON public.seasons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: teams update_teams_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: trainer_assignments update_trainer_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_trainer_assignments_updated_at BEFORE UPDATE ON public.trainer_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: video_events update_video_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_video_events_updated_at BEFORE UPDATE ON public.video_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ball_possessions ball_possessions_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ball_possessions
    ADD CONSTRAINT ball_possessions_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: ball_possessions ball_possessions_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ball_possessions
    ADD CONSTRAINT ball_possessions_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;


--
-- Name: competition_standings competition_standings_competition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competition_standings
    ADD CONSTRAINT competition_standings_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.competitions(id) ON DELETE CASCADE;


--
-- Name: competition_standings competition_standings_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competition_standings
    ADD CONSTRAINT competition_standings_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: competition_teams competition_teams_competition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competition_teams
    ADD CONSTRAINT competition_teams_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.competitions(id) ON DELETE CASCADE;


--
-- Name: competition_teams competition_teams_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competition_teams
    ADD CONSTRAINT competition_teams_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: competitions competitions_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitions
    ADD CONSTRAINT competitions_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE SET NULL;


--
-- Name: competitions competitions_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitions
    ADD CONSTRAINT competitions_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.series(id) ON DELETE SET NULL;


--
-- Name: events events_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: events events_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;


--
-- Name: export_settings export_settings_default_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.export_settings
    ADD CONSTRAINT export_settings_default_template_id_fkey FOREIGN KEY (default_template_id) REFERENCES public.report_templates(id) ON DELETE SET NULL;


--
-- Name: export_settings export_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.export_settings
    ADD CONSTRAINT export_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: free_shots free_shots_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.free_shots
    ADD CONSTRAINT free_shots_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: free_shots free_shots_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.free_shots
    ADD CONSTRAINT free_shots_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;


--
-- Name: free_shots free_shots_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.free_shots
    ADD CONSTRAINT free_shots_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: game_events game_events_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_events
    ADD CONSTRAINT game_events_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: game_events game_events_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_events
    ADD CONSTRAINT game_events_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;


--
-- Name: game_events game_events_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_events
    ADD CONSTRAINT game_events_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: game_rosters game_rosters_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_rosters
    ADD CONSTRAINT game_rosters_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: game_rosters game_rosters_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_rosters
    ADD CONSTRAINT game_rosters_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;


--
-- Name: game_rosters game_rosters_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_rosters
    ADD CONSTRAINT game_rosters_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: games games_away_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_away_club_id_fkey FOREIGN KEY (away_club_id) REFERENCES public.clubs(id);


--
-- Name: games games_away_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_away_team_id_fkey FOREIGN KEY (away_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: games games_competition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.competitions(id) ON DELETE SET NULL;


--
-- Name: games games_home_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_home_club_id_fkey FOREIGN KEY (home_club_id) REFERENCES public.clubs(id);


--
-- Name: games games_home_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_home_team_id_fkey FOREIGN KEY (home_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: games games_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE SET NULL;


--
-- Name: head_to_head head_to_head_last_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.head_to_head
    ADD CONSTRAINT head_to_head_last_game_id_fkey FOREIGN KEY (last_game_id) REFERENCES public.games(id) ON DELETE SET NULL;


--
-- Name: head_to_head head_to_head_streak_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.head_to_head
    ADD CONSTRAINT head_to_head_streak_team_id_fkey FOREIGN KEY (streak_team_id) REFERENCES public.teams(id);


--
-- Name: head_to_head head_to_head_team1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.head_to_head
    ADD CONSTRAINT head_to_head_team1_id_fkey FOREIGN KEY (team1_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: head_to_head head_to_head_team2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.head_to_head
    ADD CONSTRAINT head_to_head_team2_id_fkey FOREIGN KEY (team2_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: login_history login_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_history
    ADD CONSTRAINT login_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: match_commentary match_commentary_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_commentary
    ADD CONSTRAINT match_commentary_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: match_commentary match_commentary_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_commentary
    ADD CONSTRAINT match_commentary_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;


--
-- Name: match_templates match_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_templates
    ADD CONSTRAINT match_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: player_achievements player_achievements_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_achievements
    ADD CONSTRAINT player_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievements(id) ON DELETE CASCADE;


--
-- Name: player_achievements player_achievements_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_achievements
    ADD CONSTRAINT player_achievements_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE SET NULL;


--
-- Name: player_achievements player_achievements_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_achievements
    ADD CONSTRAINT player_achievements_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: player_leaderboard player_leaderboard_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_leaderboard
    ADD CONSTRAINT player_leaderboard_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: player_predictions player_predictions_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_predictions
    ADD CONSTRAINT player_predictions_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;


--
-- Name: player_predictions player_predictions_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_predictions
    ADD CONSTRAINT player_predictions_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: players players_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE SET NULL;


--
-- Name: players players_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: report_exports report_exports_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_exports
    ADD CONSTRAINT report_exports_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;


--
-- Name: report_exports report_exports_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_exports
    ADD CONSTRAINT report_exports_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: report_exports report_exports_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_exports
    ADD CONSTRAINT report_exports_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: report_exports report_exports_scheduled_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_exports
    ADD CONSTRAINT report_exports_scheduled_report_id_fkey FOREIGN KEY (scheduled_report_id) REFERENCES public.scheduled_reports(id) ON DELETE SET NULL;


--
-- Name: report_exports report_exports_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_exports
    ADD CONSTRAINT report_exports_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: report_exports report_exports_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_exports
    ADD CONSTRAINT report_exports_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.report_templates(id) ON DELETE SET NULL;


--
-- Name: report_templates report_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_templates
    ADD CONSTRAINT report_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: scheduled_reports scheduled_reports_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_reports
    ADD CONSTRAINT scheduled_reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: scheduled_reports scheduled_reports_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_reports
    ADD CONSTRAINT scheduled_reports_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: scheduled_reports scheduled_reports_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_reports
    ADD CONSTRAINT scheduled_reports_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.report_templates(id) ON DELETE CASCADE;


--
-- Name: shots shots_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shots
    ADD CONSTRAINT shots_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: shots shots_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shots
    ADD CONSTRAINT shots_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;


--
-- Name: shots shots_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shots
    ADD CONSTRAINT shots_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: substitutions substitutions_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.substitutions
    ADD CONSTRAINT substitutions_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: substitutions substitutions_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.substitutions
    ADD CONSTRAINT substitutions_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;


--
-- Name: substitutions substitutions_player_in_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.substitutions
    ADD CONSTRAINT substitutions_player_in_id_fkey FOREIGN KEY (player_in_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: substitutions substitutions_player_out_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.substitutions
    ADD CONSTRAINT substitutions_player_out_id_fkey FOREIGN KEY (player_out_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: team_leaderboard team_leaderboard_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_leaderboard
    ADD CONSTRAINT team_leaderboard_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: team_rankings team_rankings_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_rankings
    ADD CONSTRAINT team_rankings_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE SET NULL;


--
-- Name: team_rankings team_rankings_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_rankings
    ADD CONSTRAINT team_rankings_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: teams teams_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: teams teams_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE SET NULL;


--
-- Name: timeouts timeouts_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeouts
    ADD CONSTRAINT timeouts_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: timeouts timeouts_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timeouts
    ADD CONSTRAINT timeouts_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;


--
-- Name: tournament_brackets tournament_brackets_away_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_brackets
    ADD CONSTRAINT tournament_brackets_away_team_id_fkey FOREIGN KEY (away_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: tournament_brackets tournament_brackets_competition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_brackets
    ADD CONSTRAINT tournament_brackets_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.competitions(id) ON DELETE CASCADE;


--
-- Name: tournament_brackets tournament_brackets_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_brackets
    ADD CONSTRAINT tournament_brackets_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE SET NULL;


--
-- Name: tournament_brackets tournament_brackets_home_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_brackets
    ADD CONSTRAINT tournament_brackets_home_team_id_fkey FOREIGN KEY (home_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: tournament_brackets tournament_brackets_next_bracket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_brackets
    ADD CONSTRAINT tournament_brackets_next_bracket_id_fkey FOREIGN KEY (next_bracket_id) REFERENCES public.tournament_brackets(id) ON DELETE SET NULL;


--
-- Name: tournament_brackets tournament_brackets_winner_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_brackets
    ADD CONSTRAINT tournament_brackets_winner_team_id_fkey FOREIGN KEY (winner_team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: trainer_assignments trainer_assignments_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainer_assignments
    ADD CONSTRAINT trainer_assignments_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;


--
-- Name: trainer_assignments trainer_assignments_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainer_assignments
    ADD CONSTRAINT trainer_assignments_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: trainer_assignments trainer_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainer_assignments
    ADD CONSTRAINT trainer_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: twizzit_competition_mappings twizzit_competition_mappings_local_competition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_competition_mappings
    ADD CONSTRAINT twizzit_competition_mappings_local_competition_id_fkey FOREIGN KEY (local_competition_id) REFERENCES public.competitions(id) ON DELETE CASCADE;


--
-- Name: twizzit_player_mappings twizzit_player_mappings_local_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_player_mappings
    ADD CONSTRAINT twizzit_player_mappings_local_player_id_fkey FOREIGN KEY (local_player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: twizzit_player_mappings twizzit_player_mappings_team_mapping_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_player_mappings
    ADD CONSTRAINT twizzit_player_mappings_team_mapping_id_fkey FOREIGN KEY (team_mapping_id) REFERENCES public.twizzit_team_mappings(id) ON DELETE CASCADE;


--
-- Name: twizzit_sync_config twizzit_sync_config_credential_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_sync_config
    ADD CONSTRAINT twizzit_sync_config_credential_id_fkey FOREIGN KEY (credential_id) REFERENCES public.twizzit_credentials(id) ON DELETE CASCADE;


--
-- Name: twizzit_sync_history twizzit_sync_history_credential_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_sync_history
    ADD CONSTRAINT twizzit_sync_history_credential_id_fkey FOREIGN KEY (credential_id) REFERENCES public.twizzit_credentials(id) ON DELETE CASCADE;


--
-- Name: twizzit_team_mappings twizzit_team_mappings_local_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twizzit_team_mappings
    ADD CONSTRAINT twizzit_team_mappings_local_club_id_fkey FOREIGN KEY (local_club_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: video_events video_events_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_events
    ADD CONSTRAINT video_events_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict iLe3bX54Frr855O6hiogtiGG25tDzB4bYiNuA9JEPt4ugonFEwhK2ejafWBzObw


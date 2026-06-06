import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getPlayerStats,
  refreshProfile,
  type ProfileStatsResponse,
} from "../api";

const LAST_GAMES_OPTIONS = [
  { label: "All", value: 0 },
  { label: "10", value: 10 },
  { label: "20", value: 20 },
  { label: "50", value: 50 },
];

export function ProfilePage() {
  const { accountId = "" } = useParams();
  const [stats, setStats] = useState<ProfileStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGames, setLastGames] = useState(0);
  const [patchId, setPatchId] = useState("");
  const [heroId, setHeroId] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getPlayerStats(accountId, {
      lastGames: lastGames > 0 ? lastGames : undefined,
      patchId: patchId || undefined,
      heroId: heroId > 0 ? heroId : undefined,
    })
      .then((response) => {
        if (active) {
          setStats(response);
        }
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Failed to fetch stats",
          );
          setStats(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [accountId, heroId, lastGames, patchId]);

  const heroOptions = useMemo(() => {
    if (!stats) {
      return [];
    }
    return stats.perHero.map((entry) => ({
      value: entry.heroId,
      label: entry.heroName ?? `Hero ${entry.heroId}`,
    }));
  }, [stats]);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      await refreshProfile(accountId);
      const response = await getPlayerStats(accountId, {
        lastGames: lastGames > 0 ? lastGames : undefined,
        patchId: patchId || undefined,
        heroId: heroId > 0 ? heroId : undefined,
      });
      setStats(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <main className="page">
      <div className="row space-between">
        <div>
          <h1>Profile {accountId}</h1>
          <p className="muted">
            Shareable URL: <code>{window.location.href}</code>
          </p>
        </div>
        <div className="row">
          <button type="button" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh Profile"}
          </button>
          <Link to="/">Back</Link>
        </div>
      </div>

      <section className="card filter-grid">
        <label>
          Last X games
          <select
            value={lastGames}
            onChange={(event) => setLastGames(Number(event.target.value))}
          >
            {LAST_GAMES_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Patch
          <select
            value={patchId}
            onChange={(event) => setPatchId(event.target.value)}
          >
            <option value="">All patches</option>
            {stats?.availablePatches.map((patch) => (
              <option key={patch.patchId} value={patch.patchId}>
                {patch.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Hero
          <select
            value={heroId}
            onChange={(event) => setHeroId(Number(event.target.value))}
          >
            <option value={0}>All heroes</option>
            {heroOptions.map((hero) => (
              <option key={hero.value} value={hero.value}>
                {hero.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {loading ? <p>Loading profile...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {stats ? (
        <>
          <section className="grid">
            <article className="card metric">
              <h3>Matches</h3>
              <p>{stats.totals.totalMatches}</p>
            </article>
            <article className="card metric">
              <h3>Tracker Rating</h3>
              <p>{stats.player.trackerRating.toFixed(1)}</p>
            </article>
            <article className="card metric">
              <h3>Win Rate</h3>
              <p>{(stats.totals.winRate * 100).toFixed(1)}%</p>
            </article>
            <article className="card metric">
              <h3>Avg KDA</h3>
              <p>{stats.totals.avgKda.toFixed(2)}</p>
            </article>
            <article className="card metric">
              <h3>Avg CS</h3>
              <p>{stats.totals.avgCs.toFixed(1)}</p>
            </article>
          </section>

          <section className="card">
            <h2>Progression Summary</h2>
            <p>
              Performance Index (z-score avg):{" "}
              <strong>
                {stats.progression.performanceIndex.zScoreAvg.toFixed(2)}
              </strong>
            </p>
            <p>
              Lobby percentile avg:{" "}
              <strong>
                {stats.progression.lobbyPercentileOverTime.averagePercentile.toFixed(
                  1,
                )}
                %
              </strong>
            </p>
            <p>
              Lead AUC surrogate:{" "}
              <strong>{stats.progression.leadAuc.toFixed(2)}</strong>
            </p>
            <p>
              Queue mix:{" "}
              <strong>
                Solo {stats.trackerRating.queueBreakdown.solo} / Unsure{" "}
                {stats.trackerRating.queueBreakdown.unsure} / Party{" "}
                {stats.trackerRating.queueBreakdown.party} / High-ELO repeat{" "}
                {stats.trackerRating.queueBreakdown.high_elo_repeat}
              </strong>
            </p>
          </section>

          <section className="card table-wrap">
            <h2>Per Hero Breakdown</h2>
            <table>
              <thead>
                <tr>
                  <th>Hero</th>
                  <th>Games</th>
                  <th>Win Rate</th>
                  <th>Avg KDA</th>
                  <th>Avg Net Worth</th>
                </tr>
              </thead>
              <tbody>
                {stats.perHero.map((hero) => (
                  <tr key={hero.heroId}>
                    <td>{hero.heroName ?? `Hero ${hero.heroId}`}</td>
                    <td>{hero.games}</td>
                    <td>{(hero.winRate * 100).toFixed(1)}%</td>
                    <td>{hero.avgKda.toFixed(2)}</td>
                    <td>{hero.avgNetWorth.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card table-wrap">
            <h2>Recent Matches</h2>
            <table>
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Patch</th>
                  <th>Hero</th>
                  <th>K / D / A</th>
                  <th>Queue</th>
                  <th>Weight</th>
                  <th>Tracker Delta</th>
                  <th>Net Worth</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {stats.matches.map((match) => (
                  <tr key={match.matchId}>
                    <td>{match.matchId}</td>
                    <td>{match.patchId ?? "-"}</td>
                    <td>{match.heroName ?? match.heroId ?? "-"}</td>
                    <td>
                      {match.kills ?? 0} / {match.deaths ?? 0} /{" "}
                      {match.assists ?? 0}
                    </td>
                    <td>{match.queueCategory}</td>
                    <td>{match.queueWeight.toFixed(2)}</td>
                    <td>
                      {match.trackerDelta !== null
                        ? match.trackerDelta.toFixed(2)
                        : "-"}
                    </td>
                    <td>{match.netWorth ?? "-"}</td>
                    <td>{match.win ? "Win" : "Loss"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </main>
  );
}

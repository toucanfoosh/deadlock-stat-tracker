import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getGlobalStats, type GlobalStatsResponse } from "../api";

export function GlobalStatsPage() {
  const [data, setData] = useState<GlobalStatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [patchId, setPatchId] = useState("");
  const [rank, setRank] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [region, setRegion] = useState("europe");

  async function load(showLoading = true) {
    if (showLoading) {
      setLoading(true);
      setError(null);
    }
    try {
      const response = await getGlobalStats({
        patchId: patchId || undefined,
        rank: rank ? Number(rank) : undefined,
        from: from || undefined,
        to: to || undefined,
        region: region || undefined,
      });
      setData(response);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load global stats",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load();
  }

  return (
    <main className="page">
      <div className="row space-between">
        <h1>Global Stats</h1>
        <Link to="/">Back</Link>
      </div>

      <form className="card filter-grid" onSubmit={onFilter}>
        <label>
          Patch
          <input
            value={patchId}
            onChange={(event) => setPatchId(event.target.value)}
          />
        </label>
        <label>
          Rank
          <input
            value={rank}
            onChange={(event) => setRank(event.target.value)}
          />
        </label>
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <label>
          Region
          <input
            value={region}
            onChange={(event) => setRegion(event.target.value)}
          />
        </label>
        <button type="submit">Apply Filters</button>
      </form>

      {loading ? <p>Loading global stats...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {data ? (
        <section className="grid">
          <article className="card">
            <h2>Hero Stats</h2>
            <pre>{JSON.stringify(data.heroStats, null, 2)}</pre>
          </article>
          <article className="card">
            <h2>Item Stats</h2>
            <pre>{JSON.stringify(data.itemStats, null, 2)}</pre>
          </article>
          <article className="card">
            <h2>Ability Order Stats</h2>
            <pre>{JSON.stringify(data.abilityOrderStats, null, 2)}</pre>
          </article>
          <article className="card">
            <h2>Rank Distribution</h2>
            <pre>{JSON.stringify(data.badgeDistribution, null, 2)}</pre>
          </article>
          <article className="card">
            <h2>Leaderboard ({region})</h2>
            <pre>{JSON.stringify(data.leaderboard, null, 2)}</pre>
          </article>
        </section>
      ) : null}
    </main>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  registerProfile,
  resolveProfile,
  searchProfiles,
  type ProfileSearchResult,
} from "../api";

export function HomePage() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ProfileSearchResult[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      setIsSuggesting(true);
      searchProfiles(trimmed, 25)
        .then((response) => {
          setSuggestions(response.results.slice(0, 25));
          setShowSuggestions(true);
        })
        .catch(() => {
          setSuggestions([]);
        })
        .finally(() => {
          setIsSuggesting(false);
        });
    }, 220);

    return () => clearTimeout(timer);
  }, [query]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resolved = await resolveProfile(query.trim());
      await registerProfile({ accountId: resolved.accountId });
      setShowSuggestions(false);
      navigate(`/profile/${resolved.accountId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to resolve profile",
      );
    } finally {
      setLoading(false);
    }
  }

  async function onSelectSuggestion(result: ProfileSearchResult) {
    setLoading(true);
    setError(null);
    try {
      await registerProfile({
        accountId: result.accountId,
        personaName: result.personaName,
        avatarUrl: result.avatarUrl,
        steamId64: result.steamId64,
      });
      setQuery(result.personaName ?? String(result.accountId));
      setShowSuggestions(false);
      navigate(`/profile/${result.accountId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to open selected profile",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <h1>Deadlock Stat Tracker</h1>
      <p className="muted">
        Search by account ID, Steam ID, or player name to open a shareable
        profile page.
      </p>
      <form className="card form-grid" onSubmit={onSubmit}>
        <label htmlFor="query">Profile lookup</label>
        <div className="autocomplete">
          <input
            id="query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 120);
            }}
            placeholder="7656119... or player name"
            autoComplete="off"
          />
          {showSuggestions && (isSuggesting || suggestions.length > 0) ? (
            <div className="autocomplete-list">
              {isSuggesting ? (
                <div className="autocomplete-item muted">Searching...</div>
              ) : null}
              {!isSuggesting &&
                suggestions.map((item) => (
                  <button
                    key={`${item.accountId}-${item.source}`}
                    type="button"
                    className="autocomplete-item"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onSelectSuggestion(item)}
                  >
                    <span>{item.personaName ?? "Unknown player"}</span>
                    <span className="muted">#{item.accountId}</span>
                  </button>
                ))}
            </div>
          ) : null}
        </div>
        <button type="submit" disabled={loading}>
          {loading ? "Resolving..." : "Open Profile"}
        </button>
        {error ? <p className="error">{error}</p> : null}
      </form>

      <section className="quick-links">
        <Link to="/upload" className="card action">
          Upload / Scan Match Data
        </Link>
        <Link to="/stats" className="card action">
          Global Stats
        </Link>
      </section>
    </main>
  );
}

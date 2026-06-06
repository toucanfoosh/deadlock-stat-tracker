import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { manualIngest, uploadHttpcache } from "../api";

export function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [manualAccountId, setManualAccountId] = useState("");
  const [manualSteamId, setManualSteamId] = useState("");
  const [manualMatchIds, setManualMatchIds] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitFiles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (files.length === 0) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await uploadHttpcache(files);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const accountId = manualAccountId.trim()
        ? Number(manualAccountId)
        : undefined;
      const matchIds = manualMatchIds
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((value) => Number.isFinite(value) && value > 0);

      const response = await manualIngest({
        accountId,
        steamId: manualSteamId.trim() || undefined,
        matchIds: matchIds.length > 0 ? matchIds : undefined,
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Manual ingest failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="row space-between">
        <h1>Upload / Scan Match Data</h1>
        <Link to="/">Back</Link>
      </div>

      <section className="grid">
        <form className="card form-grid" onSubmit={submitFiles}>
          <h2>HTTP cache upload</h2>
          <p className="muted">
            Select one or more files from <code>Steam/appcache/httpcache</code>.
          </p>
          <input
            type="file"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          />
          <button type="submit" disabled={loading || files.length === 0}>
            {loading ? "Scanning..." : "Scan Uploaded Files"}
          </button>
        </form>

        <form className="card form-grid" onSubmit={submitManual}>
          <h2>Manual ingest</h2>
          <label>
            Account ID
            <input
              value={manualAccountId}
              onChange={(event) => setManualAccountId(event.target.value)}
              placeholder="123456789"
            />
          </label>
          <label>
            Steam ID
            <input
              value={manualSteamId}
              onChange={(event) => setManualSteamId(event.target.value)}
              placeholder="7656119..."
            />
          </label>
          <label>
            Match IDs (comma-separated)
            <input
              value={manualMatchIds}
              onChange={(event) => setManualMatchIds(event.target.value)}
              placeholder="1234, 5678"
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Submitting..." : "Run Manual Ingest"}
          </button>
        </form>
      </section>

      {error ? <p className="error">{error}</p> : null}
      {result ? (
        <section className="card">
          <h2>Ingest result</h2>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </section>
      ) : null}
    </main>
  );
}

import { useState } from "react";
import "./App.css";

type Payload = {
  id: number;
  billing: { email: string; first_name: string };
  line_items: Array<{
    name: string;
    meta_data: Array<{ key: string; value: string | number }>;
  }>;
  meta_data?: Array<{ key: string; value: string }>;
};

export default function App() {
  const [email, setEmail] = useState("client@example.com");
  const [firstName, setFirstName] = useState("Client");
  const [orderId, setOrderId] = useState<number>(123456);
  const [ram, setRam] = useState<number>(4096);
  const [slots, setSlots] = useState<number>(10);
  const [version, setVersion] = useState("1.20.6");
  const [type, setType] = useState("paper"); // paper | vanilla | forge | fabric
  const [subdomain, setSubdomain] = useState("demo-123");
  const [status, setStatus] = useState<null | { ok: boolean; msg: string }>(null);
  const [loading, setLoading] = useState(false);

  const makeWooPayload = (): Payload => {
    return {
      id: orderId,
      billing: {
        email,
        first_name: firstName,
      },
      line_items: [
        {
          name: "Minecraft Hosting",
          meta_data: [
            { key: "RAM", value: ram },
            { key: "SLOTS", value: slots },
            { key: "VERSION", value: version },
            { key: "TYPE", value: type },
          ],
        },
      ],
      meta_data: [
        // opțional: dacă folosești subdomeniul la nivel de comandă
        { key: "subdomain", value: subdomain },
      ],
    };
  };

  const sendTest = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/woo-order-completed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeWooPayload()),
      });

      // Nota: funcția noastră de pe Vercel ar trebui să răspundă foarte repede 200
      // și să facă apoi provisioning în background (sau imediat dacă e scurt).
      if (!res.ok) {
        const text = await res.text();
        setStatus({ ok: false, msg: `HTTP ${res.status}: ${text}` });
      } else {
        const json = await res.json().catch(() => ({}));
        setStatus({ ok: true, msg: `Trimis ✅ ${JSON.stringify(json)}` });
      }
    } catch (e: any) {
      setStatus({ ok: false, msg: e?.message || "Eroare la fetch" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App" style={{ maxWidth: 840, margin: "40px auto", padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Provisioner UI (test)</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Trimite un payload tip WooCommerce → <code>/api/woo-order-completed</code>
      </p>

      <div className="card" style={{ textAlign: "left" }}>
        <h3>Detalii client / comandă</h3>
        <div className="grid" style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@example.com" />
          </label>
          <label>
            Prenume
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Client" />
          </label>
          <label>
            Order ID
            <input
              type="number"
              value={orderId}
              onChange={(e) => setOrderId(Number(e.target.value || 0))}
              min={1}
            />
          </label>
          <label>
            Subdomeniu
            <input value={subdomain} onChange={(e) => setSubdomain(e.target.value)} placeholder="ex: lucaluk" />
          </label>
        </div>

        <h3 style={{ marginTop: 24 }}>Config server</h3>
        <div className="grid" style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
          <label>
            RAM (MB)
            <input
              type="number"
              value={ram}
              onChange={(e) => setRam(Number(e.target.value || 0))}
              min={512}
              step={512}
            />
          </label>
          <label>
            Slots
            <input
              type="number"
              value={slots}
              onChange={(e) => setSlots(Number(e.target.value || 0))}
              min={1}
            />
          </label>
          <label>
            Versiune
            <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.20.6" />
          </label>
          <label>
            Tip
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="paper">Paper</option>
              <option value="vanilla">Vanilla</option>
              <option value="forge">Forge</option>
              <option value="fabric">Fabric</option>
            </select>
          </label>
        </div>

        <button style={{ marginTop: 20 }} onClick={sendTest} disabled={loading}>
          {loading ? "Trimit..." : "Trimite payload test"}
        </button>

        {status && (
          <p style={{ marginTop: 12, color: status.ok ? "var(--success, #2e7d32)" : "var(--danger, #c62828)" }}>
            {status.msg}
          </p>
        )}

        <details style={{ marginTop: 12 }}>
          <summary>Vezi JSON-ul pe care îl trimitem</summary>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {JSON.stringify(makeWooPayload(), null, 2)}
          </pre>
        </details>
      </div>

      <p className="read-the-docs" style={{ marginTop: 16 }}>
        AI keys (Pterodactyl/Cloudflare) rămân pe server. Frontend-ul DOAR lovește endpoint-ul tău.
      </p>
    </div>
  );
}

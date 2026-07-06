"use client";

import { useMemo, useState } from "react";

type ImportStatus = "idle" | "submitting" | "success" | "error";

export default function ImportConfigPage() {
  const [rawConfig, setRawConfig] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [error, setError] = useState("");
  const [configUrl, setConfigUrl] = useState("");

  const canSubmit = useMemo(() => rawConfig.trim().length > 2 && status !== "submitting", [rawConfig, status]);

  async function handleSubmit() {
    if (!canSubmit) return;

    setStatus("submitting");
    setError("");
    setConfigUrl("");

    try {
      const res = await fetch("/api/config/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawConfig, name, email, phone }),
      });
      const data = await res.json().catch(() => undefined);

      if (!res.ok) {
        throw new Error(data?.error ?? "Nu am putut importa configuratia.");
      }

      setConfigUrl(data.url);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "A aparut o eroare.");
      setStatus("error");
    }
  }

  function resetForm() {
    setRawConfig("");
    setName("");
    setEmail("");
    setPhone("");
    setStatus("idle");
    setError("");
    setConfigUrl("");
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8] px-4 py-8 text-gray-900">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#80613c]">ASAB intern</p>
          <h1 className="text-3xl font-semibold">Import configuratie veche</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-gray-500">
            Lipeste JSON-ul primit in emailurile vechi si genereaza un link pe care designerul il poate deschide in configurator.
          </p>
        </header>

        <section className="rounded-2xl border border-[#e7dac8] bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-3">
            <input
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-900"
              placeholder="Nume client"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <input
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-900"
              placeholder="Email client"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-900"
              placeholder="Telefon client"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>

          <label className="mt-5 block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">JSON configuratie</span>
            <textarea
              className="min-h-[360px] w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-xs leading-relaxed text-gray-900 outline-none transition focus:border-gray-900"
              placeholder='{"cabinets":[...],"colorway":{...},"dimensions":{...}}'
              value={rawConfig}
              onChange={(event) => setRawConfig(event.target.value)}
              spellCheck={false}
            />
          </label>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition disabled:opacity-40"
            >
              {status === "submitting" ? "Se importa..." : "Genereaza link configuratie"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-900 transition hover:border-gray-900"
            >
              Curata formularul
            </button>
          </div>
        </section>

        {status === "success" && (
          <section className="rounded-2xl border border-green-200 bg-green-50 p-5 text-green-900">
            <p className="text-sm font-semibold">Configuratia a fost importata.</p>
            <div className="mt-3 rounded-xl bg-white p-3 text-sm text-gray-900 break-all">{configUrl}</div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <a
                href={configUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-gray-900 px-5 py-3 text-center text-sm font-semibold text-white"
              >
                Deschide configuratia
              </a>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(configUrl)}
                className="rounded-xl border border-green-300 bg-white px-5 py-3 text-sm font-semibold text-green-900"
              >
                Copiaza linkul
              </button>
            </div>
          </section>
        )}

        {status === "error" && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {error}
          </section>
        )}
      </div>
    </main>
  );
}

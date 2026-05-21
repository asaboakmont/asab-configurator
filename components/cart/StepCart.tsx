"use client";
import { useMemo, useState } from "react";
import { useConfigStore } from "@/store/configuratorStore";
import {
  BACKSPLASH_OPTIONS,
  BUDGET_OPTIONS,
  DESIGN_COLLECTIONS,
  FLOOR_TEXTURE_OPTIONS,
  WALL_COLOR_OPTIONS,
} from "@/data/designCollections";
import type {
  Appliances,
  BudgetPreference,
  DesignCollectionId,
  LayoutType,
  OvenPlacement,
  RoomFinishes,
} from "@/types/kitchen";

export default function StepCart() {
  const {
    cabinets,
    colorway,
    totalPrice,
    dimensions,
    layout,
    appliances,
    constraints,
    collection,
    budget,
    roomFinishes,
    contact,
    setStep,
  } = useConfigStore();

  const [submitting, setSubmitting] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasIsland = layout === "island" || dimensions.hasIsland === true;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/shopify/draft-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cabinets,
          colorway,
          handle: colorway.handle,
          totalPrice,
          dimensions,
          layout,
          contact,
          constraints,
          collection,
          budget,
          roomFinishes,
        }),
      });

      if (!res.ok) throw new Error("Eroare la creare comandă");

      const data = await res.json();
      setCheckoutUrl(data.checkoutUrl);
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : "A apărut o eroare. Vă rugăm încercați din nou."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (checkoutUrl) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
          ✓
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Bucătăria ta e gata!
          </h1>
          <p className="text-sm text-gray-400 max-w-xs mx-auto">
            Am creat coșul de cumpărături. Continuă către checkout pentru a finaliza comanda.
          </p>
        </div>

        <div className="w-full border border-gray-100 rounded-xl p-4 space-y-2 text-left">
          <SummaryRow label="Produse" value={`${cabinets.length} buc`} />
          <SummaryRow label="Culoare" value={colorway.name} />
          <SummaryRow
            label="Total estimat"
            value={`${totalPrice.toLocaleString("ro-RO")} RON`}
            border
          />
        </div>

        <OrderTrackingPreview />

        <a
          href={checkoutUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold text-center block"
        >
          Finalizează comanda →
        </a>

        <button
          onClick={() => setCheckoutUrl(null)}
          className="text-xs text-gray-400 underline underline-offset-2"
        >
          Înapoi la configurator
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      <header>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Pas 11 din 11</p>
        <h1 className="text-2xl font-semibold text-gray-900">Configuratia ta este gata. Ce urmeaza?</h1>
        <p className="text-sm text-gray-400 mt-1">
          Am salvat configuratia ta si am pregatit un rezumat al bucatariei. Urmatorul pas este o verificare tehnica rapida cu un specialist ASAB pentru a confirma dimensiunile, pozitionarea instalatiilor si compatibilitatea mobilierului cu spatiul tau.
        </p>
      </header>

      <section className="border border-gray-100 bg-gray-50 rounded-2xl p-4 space-y-4">
        <div>
          <p className="text-xs text-gray-400">Rezumat configuratie</p>
          <h2 className="text-lg font-semibold text-gray-900 mt-1">Bucatarie configurata</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Tip" value={layoutLabel(layout)} />
          <Metric label="Colectie" value={collectionLabel(collection)} />
          <Metric label="Module" value={`${cabinets.length} corpuri`} />
          <Metric label="Buget" value={budgetLabel(budget.range)} />
          <Metric label="Culoare" value={colorway.name} />
          <Metric label="Blat" value={worktopLabel(colorway.worktop)} />
          <Metric label="Manere" value={handleLabel(colorway.handle)} />
          <Metric label="Electrocasnice" value={applianceCount(appliances)} />
        </div>
        <div className="pt-4 border-t border-gray-200 flex justify-between gap-4 items-end">
          <div>
            <p className="text-xs text-gray-400">Estimare preț, TVA inclus</p>
            <p className="text-2xl font-semibold text-gray-900">{totalPrice.toLocaleString("ro-RO")} RON</p>
          </div>
          <div className="flex gap-1">
            <div className="w-8 h-14 rounded-l-lg border border-gray-200" style={{ background: colorway.doorHex }} />
            <div className="w-4 h-14 rounded-r-lg border border-gray-200" style={{ background: colorway.worktopHex }} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle title="Ce include experiența ASAB" />
        <div className="grid grid-cols-2 gap-3">
          <TrustCard
            icon="▦"
            title="Mobilier configurat"
            text="Corpuri generate pe baza dimensiunilor și opțiunilor alese."
          />
          <TrustCard
            icon="▣"
            title="Livrare urmărită"
            text="Status clar: confirmare, producție, pregătire și livrare."
          />
          <TrustCard
            icon="▶"
            title="Video de montaj"
            text="Fiecare produs are video dedicat, disponibil pe telefon."
          />
          <TrustCard
            icon="☎"
            title="Suport zilnic"
            text="Asistență telefon / WhatsApp pentru instrucțiuni și piese."
          />
        </div>
      </section>

      <section className="border border-gray-100 rounded-2xl p-4 space-y-3">
        <SectionTitle title="Directie design & camera" />
        <SummaryRow label="Colectie" value={collectionLabel(collection)} />
        <SummaryRow label="Buget orientativ" value={budgetLabel(budget.range)} />
        <SummaryRow label="Prioritate" value={budgetPriorityLabel(budget.priority)} />
        <SummaryRow label="Pereti" value={wallColorLabel(roomFinishes.wallColor)} />
        <SummaryRow label="Pardoseala" value={floorTextureLabel(roomFinishes.floorTexture)} />
        <SummaryRow label="Faianta / backsplash" value={backsplashLabel(roomFinishes.backsplashTexture)} />
      </section>

      <section className="border border-gray-100 rounded-2xl p-4 space-y-3">
        <SectionTitle title="Dimensiuni bucatarie" />
        <SummaryRow label="Perete principal" value={`${dimensions.wallA} cm`} />
        {layout === "l-shape" && <SummaryRow label="Perete secundar" value={`${dimensions.wallB ?? 0} cm`} />}
        {hasIsland && (
          <>
            <SummaryRow label="Insula" value={`${dimensions.islandWidth ?? 180} x ${dimensions.islandDepth ?? 90} cm`} />
            <SummaryRow label="Distanta perete" value={`${dimensions.islandDistance ?? 100} cm`} />
            <SummaryRow label="Pozitie insula" value={positionLabel(dimensions.islandPosition)} />
          </>
        )}
      </section>

      <section className="border border-gray-100 rounded-2xl p-4 space-y-3">
        <SectionTitle title="Electrocasnice selectate" />
        <SummaryRow label="Chiuveta" value={appliances.hasSink ? `${appliances.sinkSize} cm` : "Fara"} />
        <SummaryRow label="Plita" value={appliances.hasHob ? `${appliances.hobSize} cm` : "Fara"} />
        <SummaryRow label="Cuptor" value={ovenLabel(appliances.hasOven)} />
        {appliances.hasOven === "tall-column" && (
          <SummaryRow label="Microunde incorporat" value={appliances.hasIntegratedMicrowave ? "Da" : "Nu"} />
        )}
        <SummaryRow label="Masina vase" value={appliances.hasDishwasher ? `${appliances.dishwasherSize} cm` : "Fara"} />
        <SummaryRow label="Hota" value={appliances.hasHood ? "Da" : "Nu"} />
      </section>

      <section className="border border-gray-100 rounded-2xl p-4 space-y-3">
        <SectionTitle title="Camera & puncte tehnice" />
        <SummaryRow label="Ferestre / usi" value={`${constraints.openings?.length ?? 0}`} />
        <SummaryRow label="Gheuri / obstacole" value={`${constraints.obstructions?.length ?? 0}`} />
        <SummaryRow label="Puncte tehnice" value={`${constraints.servicePoints?.length ?? 0}`} />
        <SummaryRow label="Centrala termica" value={constraints.boiler ? "Da" : "Nu"} />
      </section>

      <section className="border border-gray-100 rounded-2xl p-4 space-y-3">
        <SectionTitle title="Lista estimata de corpuri" />
        <div className="divide-y divide-gray-100">
          {cabinets.slice(0, 8).map((cab) => (
            <div key={`${cab.sku}-${cab.wall}-${cab.xPos}`} className="py-2 flex justify-between gap-3 text-xs">
              <span className="text-gray-600">{cab.label ?? cab.sku}</span>
              <strong className="text-gray-900 text-right">{cab.width} cm · perete {cab.wall}</strong>
            </div>
          ))}
          {cabinets.length > 8 && <div className="py-2 text-xs text-gray-400">+ inca {cabinets.length - 8} corpuri in PDF</div>}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle title="Informații importante" />
        <div className="border border-gray-100 rounded-2xl p-4 space-y-4">
          <InfoStep number="1" title="Livrare" text="Primești estimare și actualizări pe etape până la livrare." />
          <InfoStep number="2" title="Montaj" text="Ai video pentru fiecare produs și suport zilnic pentru instrucțiuni." />
          <InfoStep number="3" title="Retur" text="Produsele standard au drepturi de retur; produsele personalizate trebuie explicate separat." />
          <InfoStep number="4" title="Garanție" text="Garanție legală, procedură de reclamații și condiții clare pentru montaj incorect." />
        </div>
      </section>

      {hasIsland && (
        <div className="border border-amber-100 bg-amber-50 text-amber-800 rounded-xl px-4 py-3 text-sm">
          Configuratiile cu insula necesita verificare tehnica pentru pozitionare exacta, distante de circulatie si instalatii.
        </div>
      )}

      <OrderTrackingPreview />

      <h2 className="text-lg font-bold text-gray-900 pt-2 tracking-tight">
        Verifica proiectul cu un tehnician telefonic 100% Gratuit
      </h2>

      <TechnicianBooking
        config={{
          cabinets,
          colorway,
          totalPrice,
          dimensions,
          layout,
          appliances,
          constraints,
          collection,
          budget,
          roomFinishes,
        }}
      />

      {error && <div className="border border-red-200 bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm">{error}</div>}

      <section className="space-y-3 pb-8">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-40 transition-all"
        >
          {submitting ? "Se creează comanda…" : "Comandă"}
        </button>
        <button onClick={() => setStep("viewer")} className="w-full py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">
          ← Înapoi la previzualizare
        </button>
      </section>

      <LegalInfo />
    </div>
  );
}

function TechnicianBooking({ config }: { config: unknown }) {
  const generatedDays = useMemo(() => getNextBusinessDays(5), []);
  const slots = ["10:00", "12:30", "14:00", "15:30", "17:00", "18:30"];

  const [selectedDay, setSelectedDay] = useState(generatedDays[0].value);
  const [selectedSlot, setSelectedSlot] = useState("12:30");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDayLabel = generatedDays.find((day) => day.value === selectedDay)?.label ?? selectedDay;
  const isValid = Boolean(name && email && phone);

  const handleBooking = async () => {
    if (!isValid) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/config/technician-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config,
          name,
          email,
          phone,
          city,
          notes,
          selectedDay,
          selectedDayLabel,
          selectedSlot,
        }),
      });

      if (!res.ok) throw new Error("Nu am putut trimite cererea de verificare.");
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "A apărut o eroare. Vă rugăm încercați din nou.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="technician-booking" className="border border-gray-100 rounded-2xl p-4 space-y-4 bg-white">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Alege o zi avantajoasă</p>
        <p className="text-sm text-gray-400 mt-1">
          Alege un interval, lasă datele tale, iar un tehnician ASAB va verifica proiectul și te va contacta pentru confirmare.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {generatedDays.map((day) => (
            <button
              key={day.value}
              type="button"
              onClick={() => {
                setSelectedDay(day.value);
                setSuccess(false);
              }}
              className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition-all ${
                selectedDay === day.value
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-900 border-gray-200 hover:border-gray-400"
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Alege ora</p>
        <div className="grid grid-cols-3 gap-2">
          {slots.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => {
                setSelectedSlot(slot);
                setSuccess(false);
              }}
              className={`rounded-xl border py-3 text-xs font-semibold transition-all ${
                selectedSlot === slot
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-900 border-gray-200 hover:border-gray-400"
              }`}
            >
              {slot}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date contact pentru confirmare</p>
        <div className="grid grid-cols-2 gap-3">
          <input
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-gray-900 transition-all"
            placeholder="Nume *"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-gray-900 transition-all"
            placeholder="Telefon *"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <input
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-gray-900 transition-all"
          placeholder="Email *"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-gray-900 transition-all"
          placeholder="Oraș (opțional)"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <textarea
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-gray-900 transition-all resize-none"
          rows={3}
          placeholder="Mentiuni (Ex: exista tevi aparente sau centrala pe perete)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <button
        type="button"
        onClick={handleBooking}
        disabled={!isValid || submitting}
        className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-40 transition-all"
      >
        {submitting ? "Se trimite cererea…" : "Trimite cererea de verificare"}
      </button>

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Cererea a fost trimisă. Un tehnician ASAB va analiza proiectul și te va contacta pentru confirmare.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}
    </section>
  );
}

function OrderTrackingPreview() {
  const steps = [
    { label: "Confirmată", date: "", state: "done" },
    { label: "Producție", date: "", state: "current" },
    { label: "Pregătită", date: "", state: "upcoming" },
    { label: "Livrată", date: "", state: "upcoming" },
  ];

  return (
    <section className="border border-gray-100 rounded-2xl p-4 space-y-4 bg-white text-left">
      <div className="flex justify-between gap-4 items-start">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Track & Trace comandă</h2>
          <p className="text-xs text-gray-400 mt-1">Exemplu: #ASB-BUC-20481</p>
        </div>
        <span className="shrink-0 rounded-full border border-green-200 bg-green-50 text-green-700 px-3 py-1.5 text-xs font-semibold">
          Livrare transparentă
        </span>
      </div>

      <div className="relative pt-2">
        <div className="absolute left-4 right-4 top-[17px] h-[3px] bg-gray-200 rounded-full" />
        <div className="absolute left-4 top-[17px] h-[3px] w-[56%] bg-gray-900 rounded-full" />

        <div className="relative z-10 grid grid-cols-4 gap-1">
          {steps.map((step) => (
            <div key={step.label} className="text-center">
              <div
                className={`w-4 h-4 mx-auto rounded-full bg-white border-[3px] ${
                  step.state === "upcoming" ? "border-gray-300" : "border-gray-900"
                } ${step.state === "current" ? "ring-4 ring-gray-100" : ""}`}
              />
              <p className="text-[10px] font-semibold text-gray-900 mt-2 leading-tight">{step.label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{step.date}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-100 divide-y divide-gray-100">
        <TrackingRow label="Estimare livrare" value="5-7 zile lucratoare" />
        <TrackingRow label="Documente incluse" value="PDF · Factură · Video montaj" />
      </div>
    </section>
  );
}

function LegalInfo() {
  const items = [
    { title: "Termeni și condiții", text: "Comandă, produse personalizate, livrare, montaj, garanție.", href: "https://asab-design.ro/pages/informatii-legale" },
    { title: "Politica de retur", text: "Retur produse standard și excepții pentru personalizare.", href: "https://asab-design.ro/pages/informatii-legale" },
    { title: "Garanție & service", text: "Procedură reclamații, defecte, montaj incorect.", href: "https://asab-design.ro/pages/informatii-legale" },
    { title: "GDPR & cookie-uri", text: "Date personale, comunicări, consimțământ.", href: "https://asab-design.ro/pages/informatii-legale" },
  ];

  return (
    <section className="border border-gray-100 rounded-2xl p-4 space-y-4 bg-white text-left">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Informații legale utile</h2>
        <p className="text-sm text-gray-400 mt-1">Rezumat scurt aici, cu link către paginile complete.</p>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <a
            key={item.title}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full border border-gray-100 rounded-xl p-3 flex justify-between gap-4 text-left hover:border-gray-300 transition"
          >
            <span>
              <span className="block text-sm font-semibold text-gray-900">{item.title}</span>
              <span className="block text-xs text-gray-400 mt-1 leading-relaxed">{item.text}</span>
            </span>
            <span className="text-gray-400">›</span>
          </a>
        ))}
      </div>
    </section>
  );
}

function getNextBusinessDays(count: number) {
  const result: { label: string; value: string }[] = [];
  const date = new Date();

  while (result.length < count) {
    date.setDate(date.getDate() + 1);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    result.push({
      label: date.toLocaleDateString("ro-RO", {
        weekday: "long",
        day: "numeric",
        month: "short",
      }),
      value: date.toISOString(),
    });
  }
  return result;
}

function SectionTitle({ title }: { title: string }) {
  return <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</p>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-gray-200 bg-white rounded-xl p-3 text-left">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value, border }: { label: string; value: string; border?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 text-sm ${border ? "pt-2 border-t border-gray-100" : ""}`}>
      <span className="text-gray-400">{label}</span>
      <span className="font-semibold text-gray-900 text-right">{value}</span>
    </div>
  );
}

function TrackingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-3 text-xs text-left">
      <span className="text-gray-400">{label}</span>
      <strong className="text-gray-900 text-right">{value}</strong>
    </div>
  );
}

function TrustCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="border border-gray-100 rounded-xl p-3 min-h-[130px] bg-white text-left">
      <div className="w-8 h-8 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-sm mb-3">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="text-xs text-gray-400 mt-1 leading-relaxed">{text}</p>
    </div>
  );
}

function InfoStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="grid grid-cols-[32px_1fr] gap-3 text-left">
      <div className="w-8 h-8 rounded-full border border-gray-900 flex items-center justify-center text-xs font-semibold">{number}</div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-400 mt-1 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function layoutLabel(layout: LayoutType): string {
  const labels: Record<LayoutType, string> = {
    linear: "Liniara",
    "l-shape": "In colt",
    island: "Cu insula",
    peninsula: "Liniara",
  };
  return labels[layout];
}

function worktopLabel(worktop: string): string {
  return worktop === "stejar" ? "Stejar" : "Gri piatra";
}

function handleLabel(handle: string): string {
  return handle === "inox" ? "Inox" : "Negru mat";
}

function ovenLabel(value: OvenPlacement): string {
  const labels: Record<OvenPlacement, string> = {
    "under-hob": "Sub plita",
    "tall-column": "In coloana",
    none: "Fara",
  };
  return labels[value];
}

function applianceCount(appliances: Appliances): string {
  const count = [
    appliances.hasSink,
    appliances.hasHob,
    appliances.hasDishwasher,
    appliances.hasHood,
    appliances.hasOven !== "none",
    appliances.hasIntegratedMicrowave,
  ].filter(Boolean).length;
  return `${count} selectate`;
}

function positionLabel(value?: "left" | "center" | "right"): string {
  const labels = { left: "Stanga", center: "Centru", right: "Dreapta" };
  return labels[value ?? "center"];
}

function collectionLabel(collection: DesignCollectionId): string {
  return DESIGN_COLLECTIONS.find((item) => item.id === collection)?.name ?? "Japandi";
}

function budgetLabel(range: BudgetPreference["range"]): string {
  return BUDGET_OPTIONS.find((item) => item.id === range)?.label ?? "Nu stiu inca";
}

function budgetPriorityLabel(priority: BudgetPreference["priority"]): string {
  const labels: Record<BudgetPreference["priority"], string> = {
    price: "Pret eficient",
    balanced: "Echilibru",
    premium: "Finisaje premium",
  };
  return labels[priority];
}

function wallColorLabel(color: string): string {
  return WALL_COLOR_OPTIONS.find((item) => item.value.toLowerCase() === color.toLowerCase())?.label ?? color;
}

function floorTextureLabel(texture: RoomFinishes["floorTexture"]): string {
  return FLOOR_TEXTURE_OPTIONS.find((item) => item.id === texture)?.label ?? texture;
}

function backsplashLabel(texture: RoomFinishes["backsplashTexture"]): string {
  return BACKSPLASH_OPTIONS.find((item) => item.id === texture)?.label ?? texture;
}
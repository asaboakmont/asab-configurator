"use client";
import { useState, type ReactNode } from "react";
import { useConfigStore } from "@/store/configuratorStore";
import {
  BACKSPLASH_OPTIONS,
  BUDGET_OPTIONS,
  DESIGN_COLLECTIONS,
  FLOOR_TEXTURE_OPTIONS,
  WALL_COLOR_OPTIONS,
} from "@/data/designCollections";
import type {
  BudgetPreference,
  DesignCollectionId,
  LayoutType,
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
    setStep,
  } = useConfigStore();

  const hasIsland = layout === "island" || dimensions.hasIsland === true;
  const estimateRange = kitchenEstimateRange(totalPrice);

  return (
    <div className="space-y-8 pb-8">
      <header>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Pas 11 din 11</p>
        <h1 className="text-2xl font-semibold text-gray-900">Configuratia ta este gata. Afla pretul final</h1>
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
        </div>
        <div className="pt-4 border-t border-gray-200 flex justify-between gap-4 items-end">
          <div>
            <p className="text-xs text-gray-400">Estimare bucatarie</p>
            <p className="text-2xl font-semibold text-gray-900">{estimateRange}</p>
          </div>
          <div className="flex gap-1">
            <div className="w-8 h-14 rounded-l-lg border border-gray-200" style={{ background: colorway.doorHex }} />
            <div className="w-4 h-14 rounded-r-lg border border-gray-200" style={{ background: colorway.worktopHex }} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border-1 border-[#2f2a21] bg-[#fbf6ee] p-4 space-y-2 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-[#6f4f24]">Vine gata asamblata</p>
        <h2 className="text-lg font-semibold text-gray-900">Corpurile ajung deja montate.</h2>
        <p className="text-sm leading-relaxed text-gray-500">
          Bucataria este livrata in module solide, deja asamblate. Echipa trebuie doar sa le puna pe pozitie, sa le fixeze pe perete si sa ajusteze detaliile finale.
        </p>
      </section>

      <section className="space-y-3">
        <DesignerContact
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
      </section>

      {hasIsland && (
        <div className="border border-amber-100 bg-amber-50 text-amber-800 rounded-xl px-4 py-3 text-sm">
          Configuratiile cu insula necesita verificare impreuna cu un Designer ASAB pentru pozitionare exacta, distante de circulatie si instalatii.
        </div>
      )}

      <section className="space-y-3 pb-8">
        <ContactInfo />
        <SampleBoxCard />
        <button onClick={() => setStep("viewer")} className="w-full py-3 rounded-xl border border-gray-200 bg-gray-900 text-sm font-semibold text-white">
          ← Înapoi la previzualizare
        </button>
      </section>

      <LegalInfo />
    </div>
  );
}

function DesignerContact({ config }: { config: unknown }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = Boolean(name && email && phone);

  const handleSubmit = async () => {
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
        }),
      });

      const data = await res.json().catch(() => undefined);
      if (!res.ok) throw new Error(data?.error ?? "Nu am putut trimite cererea catre designer.");
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "A aparut o eroare. Va rugam incercati din nou.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="technician-booking" className="border-2 border-gray-900 rounded-2xl p-4 space-y-4 bg-white shadow-sm">
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <p className="text-xs font-bold text-gray-900 uppercase tracking-wider">Vorbeste cu un Designer ASAB</p>
        <h3 className="mt-1 text-xl font-semibold text-gray-900">Afla pretul real al bucatariei tale</h3>
        <p className="text-sm text-gray-500 mt-1">
          Lasa-ne numarul de telefon si emailul, iar un Designer ASAB te contacteaza cu pretul bucatariei tale.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Daca previzualizarea 3D nu este exact ce iti doreai, nicio problema: cream impreuna bucataria pana la ultimul detaliu.
        </p>
      </div>

      <div className="space-y-3 pt-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date de contact</p>
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
          placeholder="Oras (optional)"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <textarea
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-gray-900 transition-all resize-none"
          rows={3}
          placeholder="Mentiuni (Ex: ce vrei sa schimbi in proiect sau in previzualizarea 3D)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!isValid || submitting}
        className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-40 transition-all"
      >
        {submitting ? "Se trimite cererea..." : "Afla pretul"}
      </button>

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Cererea a fost trimisa. Un Designer ASAB va analiza proiectul si te va contacta cu pretul final.
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

function ContactInfo() {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e7dac8] bg-[#fbf6ee] shadow-sm">
      <div className="border-b border-[#eadfce] bg-[#f7efe2] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#80613c]">Contact direct ASAB</p>
        <h2 className="mt-1 text-base font-semibold text-gray-900">Showroom ASAB Design Iasi</h2>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          Discuta direct cu echipa din showroom sau gaseste-ne pe Google Maps.
        </p>
      </div>
      <div className="grid gap-2 p-3 text-sm">
        <a className="grid grid-cols-[42px_1fr] items-center gap-3 rounded-xl border border-[#eadfce] bg-white/80 px-3 py-3 transition hover:border-[#cbb89c]" href="tel:0753494810">
          <IconBubble>
            <PhoneIcon />
          </IconBubble>
          <span>
            <span className="block text-xs font-semibold uppercase tracking-wider text-gray-400">Showroom Iasi</span>
            <span className="block font-semibold text-gray-900">0753 494 810</span>
          </span>
        </a>
        <a className="grid grid-cols-[42px_1fr] items-center gap-3 rounded-xl border border-[#eadfce] bg-white/80 px-3 py-3 transition hover:border-[#cbb89c]" href="mailto:office@asab-design.ro">
          <IconBubble>
            <MailIcon />
          </IconBubble>
          <span>
            <span className="block text-xs font-semibold uppercase tracking-wider text-gray-400">Email</span>
            <span className="block font-semibold text-gray-900">office@asab-design.ro</span>
          </span>
        </a>
        <a
          className="grid grid-cols-[42px_1fr] items-center gap-3 rounded-xl border border-[#eadfce] bg-white/80 px-3 py-3 transition hover:border-[#cbb89c]"
          href="https://www.google.com/maps/search/?api=1&query=ASAB%20DESIGN%20SHOWROOM"
          target="_blank"
          rel="noopener noreferrer"
        >
          <IconBubble>
            <MapPinIcon />
          </IconBubble>
          <span>
            <span className="block text-xs font-semibold uppercase tracking-wider text-gray-400">Locatie</span>
            <span className="block font-semibold text-gray-900">ASAB DESIGN SHOWROOM pe Google Maps</span>
          </span>
        </a>
      </div>
    </section>
  );
}

function SampleBoxCard() {
  const sampleUrl = "https://asab-design.ro/products/cutie-mostre-fronturi-blaturi-de-bucatarie";
  const sampleImage = "https://asab-design.ro/cdn/shop/files/ChatGPTImageSep23_2025_01_08_56PM.png?v=1758622270&width=1946";

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e7dac8] bg-white shadow-sm">
      <div className="grid grid-cols-[92px_1fr] gap-3 p-3">
        <a
          href={sampleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block aspect-square rounded-xl border border-[#eadfce] bg-white bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url('${sampleImage}')` }}
          aria-label="Comanda cutia de mostre"
        />
        <div className="min-w-0 py-1">
          <div className="flex items-center gap-2">
            <IconBubble compact>
              <PackageIcon />
            </IconBubble>
            <p className="text-xs font-bold uppercase tracking-wider text-[#80613c]">Mostre materiale</p>
          </div>
          <h2 className="mt-2 text-base font-semibold leading-tight text-gray-900">
            Comanda cutia de mostre si vezi finisajele acasa.
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            Verifici fronturile si blaturile in lumina reala, apoi alegi materialele impreuna cu designerul.
          </p>
        </div>
      </div>
      <a
        href={sampleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block border-t border-[#eadfce] bg-white/70 px-4 py-3 text-center text-sm font-semibold text-gray-900 transition hover:bg-white"
      >
        Vezi cutia de mostre
      </a>
    </section>
  );
}

function IconBubble({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-gray-900 text-white ${compact ? "h-8 w-8" : "h-10 w-10"}`}>
      {children}
    </span>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.11 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.91.33 1.79.62 2.64a2 2 0 0 1-.45 2.11L8 9.75a16 16 0 0 0 6.25 6.25l1.28-1.28a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.64.62A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function PackageIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m21 8-9-5-9 5 9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="font-semibold text-gray-900 text-right">{value}</span>
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

function kitchenEstimateRange(totalPrice: number): string {
  const lower = totalPrice;
  const upper = Math.round(totalPrice * 1.2);
  return `${lower.toLocaleString("ro-RO")} - ${upper.toLocaleString("ro-RO")} RON`;
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

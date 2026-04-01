"use client";
import { useEffect } from "react";
import ConfiguratorFlow from "@/components/configurator/ConfiguratorFlow";
import { useConfigStore } from "@/store/configuratorStore";

export default function Home() {
  const store = useConfigStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const configId = params.get("config");
    if (!configId) return;

    fetch(`/api/config/load?id=${configId}`)
      .then(r => r.json())
      .then(({ config }) => {
        if (!config) return;
        const c = typeof config === "string" ? JSON.parse(config) : config;
        if (c.layout)     store.setLayout(c.layout);
        if (c.dimensions) store.setDimensions(c.dimensions);
        if (c.appliances) store.setAppliances(c.appliances);
        if (c.colorway)   store.setColorway(c.colorway);
        store.generate();
      })
      .catch(console.error);
  }, []);

  return (
    <main className="min-h-screen bg-asab-cream">
      <ConfiguratorFlow />
    </main>
  );
}

import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { getInternalRole } from "@/lib/auth/internalSession";
import CatalogAdmin from "@/components/admin/CatalogAdmin";
export const dynamic = "force-dynamic";
export default function CatalogPage() {
  const request = new NextRequest("http://localhost/admin/catalog", { headers: { cookie: cookies().toString() } });
  return <CatalogAdmin authorized={getInternalRole(request) === "admin"} />;
}

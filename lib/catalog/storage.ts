import { Redis } from "@upstash/redis";
import { EMPTY_CATALOG, type Catalog } from "./schema";
const KEY = "asab:catalog:v1";
function redis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) throw new Error("Configurati UPSTASH_REDIS_REST_URL si UPSTASH_REDIS_REST_TOKEN.");
  return Redis.fromEnv();
}
export async function readCatalog(): Promise<Catalog> { return await redis().get<Catalog>(KEY) ?? structuredClone(EMPTY_CATALOG); }
export async function writeCatalog(catalog: Catalog, expectedRevision: number) {
  const next = { ...catalog, revision: expectedRevision + 1 };
  const result = await redis().eval<number>(`
    local current = redis.call('GET', KEYS[1])
    local revision = 0
    if current then revision = cjson.decode(current).revision end
    if revision ~= tonumber(ARGV[1]) then return 0 end
    redis.call('SET', KEYS[1], ARGV[2])
    return 1
  `, [KEY], [expectedRevision, JSON.stringify(next)]);
  if (result !== 1) throw new Error("Catalogul a fost modificat in alta fereastra. Reincarcati si incercati din nou.");
  return next;
}

const ASSETS = "asab:catalog:assets:v1";
export async function registerAsset(url: string) { await redis().hset(ASSETS, { [url]: true }); }
export async function checkAssets(urls: string[]) {
  const unique = [...new Set(urls.filter(Boolean))];
  if (!unique.length) return;
  const registered = await redis().hmget<Record<string, boolean>>(ASSETS, ...unique);
  if (unique.some(url => !registered?.[url])) throw new Error("Un GLB nu a fost verificat. Incarcati fisierul prin pagina catalogului.");
}

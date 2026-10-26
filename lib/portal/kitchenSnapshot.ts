import type {useConfigStore} from '@/store/configuratorStore';
type Store=ReturnType<typeof useConfigStore.getState>;
export function kitchenSnapshot(store:Store){
 return JSON.parse(JSON.stringify({schemaVersion:1,layout:store.layout,dimensions:store.dimensions,appliances:store.appliances,colorway:store.colorway,constraints:store.constraints,collection:store.collection,budget:store.budget,roomFinishes:store.roomFinishes,cabinets:store.cabinets}));
}
export function restoreKitchenSnapshot(value:unknown,store:Store){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Configuratie invalida.');
 const c=value as Record<string,any>;
 if(!['linear','l-shape','island','peninsula'].includes(c.layout)||!['smart','japandi','germain','franc'].includes(c.collection)||!c.dimensions||!Number.isFinite(c.dimensions.wallA)||c.dimensions.wallA<=0||!c.colorway||!c.appliances||!Array.isArray(c.cabinets)||c.cabinets.some((x:any)=>!x||typeof x.sku!=='string'||!Number.isFinite(x.width)||x.width<=0))throw new Error('Configuratia salvata nu este compatibila.');
 store.setLayout(c.layout);store.setDimensions(c.dimensions);store.setAppliances(c.appliances);store.setColorway(c.colorway);store.setConstraints(c.constraints||{});store.setCollection(c.collection);if(c.budget)store.setBudget(c.budget);if(c.roomFinishes)store.setRoomFinishes(c.roomFinishes);store.generate();store.restoreCabinets(c.cabinets);store.setStep('viewer');
}

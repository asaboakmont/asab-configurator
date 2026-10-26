// Guest identity is a local hint only. It never authorizes account/API access.
export const GUEST_EMAIL_KEY='asab_guest_email';
export const PENDING_KITCHEN_KEY='asab_pending_kitchen';
export function guestEmail(storage:Pick<Storage,'getItem'>){
 try{return storage.getItem(GUEST_EMAIL_KEY)||'';}catch{return '';}
}
export function rememberGuest(storage:Pick<Storage,'setItem'>,email:string){
 const normalized=email.trim().toLowerCase();
 if(normalized.length>254||!/^\S+@\S+\.\S+$/.test(normalized))throw new Error('Introdu o adresa de email valida.');
 storage.setItem(GUEST_EMAIL_KEY,normalized);
}

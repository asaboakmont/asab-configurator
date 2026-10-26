export async function portalFetch<T=any>(path:string,body?:unknown,method?:string):Promise<T>{
 const response=await fetch(path,{method:method||(body===undefined?'GET':'POST'),credentials:'same-origin',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(data.error||'Operatia nu poate fi finalizata.') as Error&{status:number};error.status=response.status;throw error;}
 return data;
}
export function safePortalNext(value:string|null){
 if(!value?.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u0020]/.test(value))return '/cont';
 try{const url=new URL(value,'https://portal.invalid');return url.origin==='https://portal.invalid'?url.pathname+url.search+url.hash:'/cont';}catch{return '/cont';}
}

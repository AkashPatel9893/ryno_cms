import { createHash } from "node:crypto";
import { MARKET_ID, SNAPSHOT, type Row } from "./data";
export class ApiError extends Error {
  constructor(public status:number, public code:string,message:string,public details:Record<string,unknown>={}){super(message)}
}
export const headers={"X-Mock-API":"true","Cache-Control":"no-store","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Authorization, Content-Type, Idempotency-Key","Access-Control-Allow-Methods":"GET, POST, PATCH, OPTIONS"};
export function json(body:unknown,status=200){return Response.json(body,{status,headers})}
export function fail(status:number,code:string,message:string):never{throw new ApiError(status,code,message)}
export function invalid(message:string):never{return fail(422,"VALIDATION_ERROR",message)}
export function find<T extends {id:string}>(items:T[],key:string):T{return items.find(i=>i.id===key)??fail(404,"NOT_FOUND","Record not found")}
export function text(body:Record<string,unknown>,name:string,min=1,max=255):string {
 const value=body[name];if(typeof value!=="string"||value.trim().length<min||value.length>max)invalid(`${name} must be a string with ${min}–${max} characters`);return value.trim();
}
export function choice(body:Record<string,unknown>,name:string,values:string[],fallback?:string):string{
 const value=body[name]??fallback;if(typeof value!=="string"||!values.includes(value))invalid(`${name} must be one of ${values.join(", ")}`);return value;
}
export function amount(value:unknown,name="amount",allowZero=false):string {
 if(typeof value!=="string"&&typeof value!=="number")invalid(`${name} must be a decimal amount`);
 if(!/^\d{1,12}(\.\d{1,2})?$/.test(String(value))||Number(value)<0||(!allowZero&&Number(value)===0))invalid(`${name} must be ${allowZero?"non-negative":"positive"} with up to two decimal places`);
 return Number(value).toFixed(2);
}
export async function bodyOf(request:Request):Promise<Record<string,unknown>>{
 if(Number(request.headers.get("content-length")||0)>1_048_576)fail(413,"PAYLOAD_TOO_LARGE","JSON body must be under 1 MB");
 let value:unknown;try{value=JSON.parse(await request.text())}catch{fail(400,"INVALID_JSON","Provide a valid JSON object")}
 if(!value||typeof value!=="object"||Array.isArray(value))invalid("Provide a JSON object");return value as Record<string,unknown>;
}
export function scope(params:URLSearchParams){
 const market=params.get("market_id")||MARKET_ID;if(market!==MARKET_ID)fail(404,"MARKET_NOT_FOUND","Only the Bengaluru mock market is available");
 const first=params.get("from")||"2026-10-01",last=params.get("to")||"2026-10-14";
 for(const value of [first,last])if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)invalid("from and to must be valid YYYY-MM-DD dates");
 if(first>last||Date.parse(last)-Date.parse(first)>366*86400000)invalid("Date range must be ordered and no longer than 366 days");
 return {market_id:market,from_date:first,to_date:last,timezone:"Asia/Kolkata",currency:"INR",as_of:SNAPSHOT};
}
export function inRange(timestamp:string,params:URLSearchParams){const range=scope(params);const day=new Date(Date.parse(timestamp)+330*60000).toISOString().slice(0,10);return day>=range.from_date&&day<=range.to_date}
export function paginate<T extends {id:string}>(items:T[],params:URLSearchParams){
 const raw=params.get("limit")||"50";if(!/^\d+$/.test(raw)||Number(raw)<1||Number(raw)>200)invalid("limit must be an integer between 1 and 200");
 const signature=new URLSearchParams(params);signature.delete("cursor");signature.delete("limit");signature.sort();const binding=createHash("sha256").update(signature.toString()).digest("hex").slice(0,16);
 let start=0;const cursor=params.get("cursor");if(cursor){try{const value=JSON.parse(Buffer.from(cursor,"base64url").toString());if(value.binding!==binding||typeof value.after!=="string")invalid("Cursor does not match these filters");start=items.findIndex(i=>i.id===value.after)+1;if(start===0)invalid("Cursor record no longer exists")}catch(error){if(error instanceof ApiError)throw error;invalid("Invalid cursor")}}
 const page=items.slice(start,start+Number(raw));const next=start+page.length<items.length?Buffer.from(JSON.stringify({after:page.at(-1)?.id,binding})).toString("base64url"):null;
 return {items:page,next_cursor:next,total_count:items.length,as_of:SNAPSHOT};
}
export function filterRows(items:Row[],params:URLSearchParams,fields:string[]=[]){const q=(params.get("q")||"").toLowerCase();return items.filter(row=>(!q||JSON.stringify(row).toLowerCase().includes(q))&&fields.every(key=>!params.has(key)||String(row[key])===params.get(key)))}
export function csv(rows:Record<string,unknown>[],filename:string,columns?:string[]){
 const fields=columns?.length?columns:rows.length?Object.keys(rows[0]):["id"];const cell=(value:unknown)=>{let s=value==null?"":typeof value==="object"?JSON.stringify(value):String(value);if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'};
 return new Response("\ufeff"+[fields,...rows.map(r=>fields.map(f=>r[f]))].map(row=>row.map(cell).join(",")).join("\r\n"),{headers:{...headers,"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${filename.replace(/[^a-zA-Z0-9_.-]/g,"_")}.csv"`}});
}

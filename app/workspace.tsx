"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect,useRef,useState,type ReactNode } from "react";
import { api,dateTime,useApi,type Actions,type Dialog,type Page,type Period,type Row } from "@/lib/cms/client";
import { DashboardScreen,OrdersScreen,PartnersScreen,ReportsScreen } from "@/components/cms/operations";
import { AnalyticsScreen,MarketingScreen } from "@/components/cms/insights";
import { DataScreen,PaymentsScreen } from "@/components/cms/transfers";
import { RecordDetail } from "@/components/cms/ui";

const sections=["Dashboard","Orders","Reports","Marketing","Partners","Analytics","Data","Payments"];
const descriptions:Record<string,string>={
 Dashboard:"Your last-mile operations, at a glance. Every figure comes from the mock API.",
 Orders:"Track each booking, its backend status and how the customer pays.",
 Reports:"Operational statements with clear periods, definitions and reconciliation status.",
 Marketing:"Manage campaign drafts, fare discounts and creative previews.",
 Partners:"The people and businesses keeping Bengaluru moving.",
 Analytics:"Explore booking demand, delivered fares and the data currently available.",
 Data:"Bring validated records in. Download traceable CSV snapshots.",
 Payments:"Wallet balances and payout records, with explicit simulation controls.",
};
const iconPaths=[
 "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
 "m12 3 9 5v9l-9 5-9-5V8z M3 8l9 5 9-5 M12 13v9 M7 5l10 6",
 "M5 3h10l4 4v14H5z M14 3v5h5 M8 17v-4 M12 17v-7 M16 17v-2",
 "M4 9h5l11-5v16L9 15H4z M7 15l2 6 M9 9v6",
 "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 3a4 4 0 0 1 0 8 M22 21v-3a4 4 0 0 0-3-4",
 "M3 20v-5 M8 20v-8 M13 20v-5 M18 20V8 M2 12l6-6 5 4 8-8",
 "M3 6c0-5 18-5 18 0s-18 5-18 0 M3 6v12c0 5 18 5 18 0V6 M3 12c0 5 18 5 18 0",
 "M3 7V4h15v3 M3 7h18v14H3z M21 12h-6v5h6",
];
function Icon({index=0,children}:{index?:number;children?:ReactNode}){
 return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children||<path d={iconPaths[index]}/>}</svg>;
}
function Modal({value,onClose}:{value:Dialog;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);const [busy,setBusy]=useState(false),[error,setError]=useState("");
 useEffect(()=>{const dialog=ref.current;const opener=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;dialog?.showModal();document.body.style.overflow="hidden";return()=>{dialog?.close();document.body.style.overflow=overflow;opener?.focus()}},[]);
 return <dialog ref={ref} className="modal" aria-label={value.title} onCancel={event=>{event.preventDefault();if(!busy)onClose()}} onClick={event=>{if(event.target===event.currentTarget&&!busy){const bounds=event.currentTarget.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)onClose()}}}>
  <div className="panel-heading"><h2>{value.title}</h2><button autoFocus className="close" aria-label="Close dialog" disabled={busy} onClick={onClose}>×</button></div>
  {value.body}
  {value.fields&&<form className="stack" onSubmit={async event=>{event.preventDefault();const form=new FormData(event.currentTarget);setBusy(true);setError("");try{await value.submit?.(form);onClose()}catch(error){setError(error instanceof Error?error.message:"Could not save. Try again.")}finally{setBusy(false)}}}>
   {value.fields.map(field=><label key={field.name}>{field.label}{field.options?<select name={field.name} defaultValue={field.value} disabled={busy}>{field.options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>:<input name={field.name} type={field.type||"text"} required={field.required} defaultValue={field.value} min={field.min} max={field.max} disabled={busy}/> }</label>)}
   {error&&<p role="alert" className="inline-error">{error}</p>}
   <button type="submit" className="button primary" disabled={busy}>{busy?"Saving…":value.submitLabel||"Save"}</button>
  </form>}
 </dialog>;
}
export default function Workspace({initialSection="dashboard"}:{initialSection?:string}){
 const section=sections.find(s=>s.toLowerCase()===initialSection)||"Dashboard";
 const [mobile,setMobile]=useState(false),[revision,setRevision]=useState(0),[toast,setToast]=useState("");
 const [period,setPeriod]=useState<Period>({from:"2026-10-01",to:"2026-10-14"});
 const [dialog,setDialog]=useState<(Dialog&{id:number})|null>(null);
 const context=useApi<[{user:Row;server_time:string;markets:Row[]},Page<Row>]>(["/admin/workspace","/admin/alerts?limit=10"],revision);
 const currentUser=context.data?.[0].user;
 function notify(message:string){setToast(message);setTimeout(()=>setToast(""),5000)}
 function openDialog(value:Dialog){setDialog({...value,id:Date.now()})}
 const actions:Actions={notify,dialog:openDialog,refresh:()=>setRevision(r=>r+1),inspect:(title,path)=>{
  const id=Date.now();setDialog({id,title,body:<p className="muted">Loading record…</p>});
  api(path).then(record=>setDialog(current=>current?.id===id?{...current,body:<RecordDetail record={record}/>} :current)).catch(error=>setDialog(current=>current?.id===id?{...current,body:<p className="inline-error" role="alert">{error instanceof Error?error.message:"Could not load record"}</p>}:current));
 }};
 const props={period,revision,actions};
 const screen=section==="Dashboard"?<DashboardScreen {...props}/>:section==="Orders"?<OrdersScreen key={period.from+period.to} {...props}/>:section==="Reports"?<ReportsScreen {...props}/>:section==="Marketing"?<MarketingScreen {...props}/>:section==="Partners"?<PartnersScreen key={period.from+period.to} {...props}/>:section==="Analytics"?<AnalyticsScreen {...props}/>:section==="Data"?<DataScreen {...props}/>:<PaymentsScreen {...props}/>;
 return <div className="workspace">
  {mobile&&<button className="mobile-scrim" aria-label="Close navigation" onClick={()=>setMobile(false)}/>}
  <aside className={"sidebar "+(mobile?"open":"")}>
   <Link href="/" className="brand" aria-label="Ryno mobility home"><Image src="/ryno-logo.png" width={144} height={66} alt="Ryno mobility" priority/></Link>
   <div className="location"><span><Icon><path d="M3 21V8h6V3h9v18M7 21v-6h6v6M12 7h2m-2 4h2m-2 4h2M3 21h18"/></Icon></span><div><strong>Bengaluru</strong><small>All zones · IN</small></div></div>
   <nav aria-label="Main navigation">{sections.map((name,i)=><Link href={name==="Dashboard"?"/":"/"+name.toLowerCase()} key={name} className={section===name?"active":""} aria-current={section===name?"page":undefined} onClick={()=>setMobile(false)}><Icon index={i}/>{name}</Link>)}</nav>
   <div className="sidebar-note"><span className="broadcast"><Icon><circle cx="12" cy="12" r="2"/><path d="M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10M4 4a11 11 0 0 0 0 16M20 4a11 11 0 0 1 0 16"/></Icon></span><strong>Every delivery counts.</strong><p>Delivering more.<br/>Worrying less.</p></div>
   <button className="help" onClick={()=>openDialog({title:"About this workspace",body:<><p>This CMS reads the local mock API. Orders, partner records, campaigns, imports and export jobs share one server-side dataset.</p><p>All contacts and amounts are illustrative. Writes survive page navigation and reset when the server restarts. No SMS, wallet posting or bank transfer occurs.</p><a className="text-button" href="/api/v1" target="_blank" rel="noreferrer">Open mock API index ↗</a></>})}><span className="help-icon">?</span>Help & support</button>
  </aside>
  <div className="main-shell">
   <header><div className="breadcrumb"><button className="mobile-toggle" aria-label="Toggle navigation" aria-expanded={mobile} onClick={()=>setMobile(!mobile)}><Icon><path d="M3 6h18M3 12h18M3 18h18"/></Icon></button><span>Workspace</span><span>/</span><strong>{section}</strong></div>
    <div className="header-right"><span className="badge workspace-mode">{context.error?"API unavailable":context.loading?"Connecting…":"Mock API"}</span><span className="updated">Snapshot · {context.data?dateTime(context.data[0].server_time):"Loading…"} IST</span><button className="notification" aria-label="Notifications" onClick={()=>openDialog({title:"Operational alerts",body:context.data?<div className="notifications">{context.data[1].items.filter(r=>r.status!=="RESOLVED").map(r=><p key={r.id}><strong>{String(r.title)}</strong><small>{labelStatus(r.status)} · {dateTime(r.created_at)}</small></p>)}</div>:<p>Alerts are not available. Refresh the workspace and try again.</p>})}><Icon><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4"/></Icon></button><span className="avatar">AK</span><strong>{String(currentUser?.name||"Workspace")}</strong></div>
   </header>
   <main>
    <div className="page-heading"><div><h1>{section}</h1><p>{descriptions[section]}</p></div><select aria-label="Reporting period" value={period.from+"/"+period.to} onChange={event=>{const [from,to]=event.target.value.split("/");setPeriod({from,to})}}><option value="2026-10-01/2026-10-14">1–14 Oct 2026</option><option value="2026-10-14/2026-10-14">14 Oct 2026</option><option value="2026-09-01/2026-09-30">September 2026</option></select></div>
    {context.error&&<div className="notice" role="alert">Workspace unavailable: {context.error}<button className="text-button" onClick={actions.refresh}>Retry</button></div>}
    {screen}
    <footer><span>Bengaluru · INR · {context.data?`Mock snapshot ${dateTime(context.data[0].server_time)} IST`:"Loading mock data"}</span><span>ryno / built for the last mile</span></footer>
   </main>
  </div>
  {toast&&<div className="toast" role="status"><span>✓</span>{toast}<button aria-label="Dismiss notification" onClick={()=>setToast("")}>×</button></div>}
  {dialog&&<Modal key={dialog.id} value={dialog} onClose={()=>setDialog(null)}/>}
 </div>;
}
function labelStatus(value:unknown){return String(value||"").replaceAll("_"," ").toLowerCase()}

import { getStore, SNAPSHOT, type Order } from "./data";
import { choice, inRange, invalid, scope } from "./http";
export function money(cents:number){return (cents/100).toFixed(2)}
export function cents(value:unknown){return Math.round(Number(value)*100)}
export function selectOrders(params:URLSearchParams):Order[]{
 scope(params);const status=params.get("status"),group=params.get("status_group"),method=params.get("payment_method_type"),type=params.get("customer_type"),timing=params.get("payment_timing");
 if(status&&group)invalid("Use status or status_group, not both");
 if(type)choice({type},"type",["INDIVIDUAL","BUSINESS"]);
 if(method)choice({method},"method",["UPI","CARD","CASH","NETBANKING","WALLET"]);
 if(group)choice({group},"group",["UNASSIGNED","CONFIRMED","ACTIVE","DELIVERED","CANCELLED","FAILED"]);
 if(status)choice({status},"status",["CREATED","PAYMENT_PENDING","PAYMENT_FAILED","SEARCHING_DRIVER","NO_DRIVER_FOUND","DRIVER_ASSIGNED","DRIVER_ARRIVED_AT_PICKUP","PICKED_UP","DRIVER_ARRIVED_AT_DROP","AWAITING_PAYMENT","DELIVERED","CANCELLED","DELIVERY_FAILED"]);
 if(timing)choice({timing},"timing",["PRE_DISPATCH","POST_DELIVERY"]);
 const q=(params.get("q")||"").toLowerCase();
 return getStore().orders.filter(o=>inRange(o.created_at,params)&&(!status||o.status===status)&&(!group||o.status_group===group)&&(!method||o.payment.method===method)&&(!timing||o.payment.timing===timing)&&(!type||o.customer.customer_type===type)&&(!q||[o.order_number,o.customer.display_name,o.customer.phone_masked].some(x=>x.toLowerCase().includes(q)))).sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));
}
export function summary(orders:Order[]){
 const counts:Record<string,number>={UNASSIGNED:0,CONFIRMED:0,ACTIVE:0,DELIVERED:0,CANCELLED:0,FAILED:0};const raw:Record<string,number>={};
 for(const o of orders){counts[o.status_group]=(counts[o.status_group]||0)+1;raw[o.status]=(raw[o.status]||0)+1}
 return {total_count:orders.length,counts_by_group:counts,counts_by_status:raw,delivered_count:counts.DELIVERED,in_progress_count:counts.UNASSIGNED+counts.CONFIRMED+counts.ACTIVE,cancelled_count:counts.CANCELLED,failed_count:counts.FAILED,cancellation_rate_percent:orders.length?Number((counts.CANCELLED/orders.length*100).toFixed(2)):null};
}
export function revenue(orders:Order[]){return money(orders.filter(o=>o.status==="DELIVERED").reduce((sum,o)=>sum+cents(o.fare.final_amount??o.fare.quoted_amount),0))}
export function series(params:URLSearchParams,orders:Order[]){
 const range=scope(params);const values=[];
 for(let date=Date.parse(range.from_date);date<=Date.parse(range.to_date);date+=86400000){const day=new Date(date).toISOString().slice(0,10);const rows=orders.filter(o=>new Date(Date.parse(o.created_at)+330*60000).toISOString().slice(0,10)===day);values.push({date:day,amount:revenue(rows),bookings_count:rows.length,comparison_amount:null})}
 return values;
}
export function aggregate<T>(params:URLSearchParams,data:T){return {...scope(params),data}}
export function dashboard(params:URLSearchParams){
 const orders=selectOrders(params),s=summary(orders);const todayParams=new URLSearchParams({from:"2026-10-14",to:"2026-10-14"});const today=selectOrders(todayParams);
 return aggregate(params,{gross_fare_revenue:revenue(orders),today_date:"2026-10-14",today_gross_fare_revenue:revenue(today),revenue_change_percent:null,bookings_count:orders.length,today_bookings_count:today.length,counts_by_group:s.counts_by_group,today_counts_by_group:summary(today).counts_by_group,bookings_by_customer_type:{INDIVIDUAL:orders.filter(o=>o.customer.customer_type==="INDIVIDUAL").length,BUSINESS:orders.filter(o=>o.customer.customer_type==="BUSINESS").length},revenue_series:series(params,orders),rides_by_customer_type_and_group:Object.keys(s.counts_by_group).map(status_group=>({status_group,individual_count:orders.filter(o=>o.status_group===status_group&&o.customer.customer_type==="INDIVIDUAL").length,business_count:orders.filter(o=>o.status_group===status_group&&o.customer.customer_type==="BUSINESS").length})),open_web_enquiries_count:getStore().enquiries.filter(e=>e.status!=="RESOLVED").length});
}
export function settlements(){return getStore().drivers.filter(d=>d.account_status==="ACTIVE").map((d,i)=>({id:d.id,driver_id:d.id,driver_number:d.driver_number,name:`${d.first_name} ${d.last_name||""}`.trim(),bank_account:{bank_name:["HDFC","SBI","ICICI","Axis"][i%4],account_number_last4:String(4218+i),verification_status:"VERIFIED"},driver_wallet_balance:(i<5?[5000,8000,4000,6000,7000][i]:3000).toFixed(2),eligible_withdrawable_amount:(i<5?[5000,8000,4000,6000,7000][i]:3000).toFixed(2),currency:"INR",due_date:null,in_flight_payout_amount:"0.00",status:"ELIGIBLE",as_of:SNAPSHOT}))}
export function statement(params:URLSearchParams){const rows=selectOrders(params),s=summary(rows);return aggregate(params,{mtd_period:{from_date:scope(params).from_date,to_date:scope(params).to_date},ytd_period:null,reconciled_at:null,rows:[{measure:"total_bookings",label:"Total bookings",value:s.total_count,unit:"COUNT",audit_basis:"Order created_at"},{measure:"delivered_orders",label:"Successfully delivered",value:s.delivered_count,unit:"COUNT",audit_basis:"Delivered orders in selected booking cohort"},{measure:"cancelled_orders",label:"Cancelled rides",value:s.cancelled_count,unit:"COUNT",audit_basis:"Order status CANCELLED"},{measure:"gross_fare_revenue",label:"Gross fare revenue",value:revenue(rows),unit:"MONEY",audit_basis:"Sum of mock delivered final fares; no tax inference"}],coverage:{ytd:"NOT_SEEDED",finance_reconciliation:"NOT_CHECKED"}})}

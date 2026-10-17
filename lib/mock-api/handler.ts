import { randomUUID, createHash } from "node:crypto";
import { getStore, MARKET_ID, markets, permissions, SNAPSHOT, TOKEN, user, vehicleTypes, zones, type Row, type Order, type Store } from "./data";
import { ApiError, amount, bodyOf, choice, csv, fail, filterRows, find, headers, invalid, json, paginate, scope, text } from "./http";
import { aggregate, cents, dashboard, money, revenue, selectOrders, series, settlements, statement, summary } from "./metrics";

const resources:Record<string,{key:keyof Store;filters:string[]}>={
 "admin/campaigns":{key:"campaigns",filters:["audience","status","format","market_id"]},
 "admin/coupons":{key:"coupons",filters:[]},"admin/drivers":{key:"drivers",filters:["account_status","onboarding_status","compliance_status","availability"]},
 "admin/customers":{key:"customers",filters:["customer_type","status"]},"admin/business-accounts":{key:"businessAccounts",filters:["status"]},
 "admin/brands":{key:"brands",filters:["status"]},"admin/brand-campaigns":{key:"brandCampaigns",filters:["status","brand_id"]},
 "admin/web-enquiries":{key:"enquiries",filters:["status","owner_user_id"]},"admin/alerts":{key:"alerts",filters:["status"]},
 "admin/payouts":{key:"payouts",filters:["status","driver_id","cadence"]},"admin/payout-batches":{key:"batches",filters:["status"]},
 "admin/creative-assets":{key:"assets",filters:[]},"admin/incentive-programs":{key:"programs",filters:["status"]},
 "admin/incentive-claims":{key:"claims",filters:["status","program_id"]},"admin/driver-invitations":{key:"invitations",filters:["status"]},
 "admin/data/imports":{key:"imports",filters:["status","dataset"]},"admin/data/exports":{key:"exports",filters:["status","dataset"]},
};
const datasets=["order_register","customers","business_accounts","driver_settlements","finance_statement","reconciliation"];
const importDatasets=["customers","riders","business_accounts"];
const exportFields:Record<string,string[]>={
 order_register:["order_number","customer_display_name","customer_type","status","payment_method_type","payment_timing","quoted_amount","final_amount","currency","created_at"],
 customers:["id","customer_number","display_name","customer_type","status","phone_masked","email"],
 business_accounts:["id","customer_id","display_name","account_code","location_count","payment_terms","status"],
 driver_settlements:["driver_id","driver_number","name","bank_account","driver_wallet_balance","eligible_withdrawable_amount","currency","due_date","in_flight_payout_amount","status","as_of"],
 finance_statement:["measure","label","value","unit","audit_basis"],reconciliation:["name","status","expected_amount","observed_amount","difference","reason"]
};
function audit(action:string,entity:Row,reason="Mock API action"){getStore().audit.unshift({id:randomUUID(),actor_user_id:user.id,actor_type:"ADMIN",action,entity_type:"mock_resource",entity_id:entity.id,reason,created_at:SNAPSHOT})}
function insert(items:Row[],value:Record<string,unknown>){const row={id:randomUUID(),created_at:SNAPSHOT,...value};items.unshift(row);audit("CREATED",row);return row}
function pool(key:keyof Store):Row[]{return getStore()[key] as Row[]}
function orderDetail(order:Order){return {order:{...order,quoted_amount:order.fare.quoted_amount,final_amount:order.fare.final_amount,currency:"INR",payment_timing:order.payment.timing,assigned_vehicle_id:null,active_trip_id:null,stops:[{sequence_number:1,stop_type:"PICKUP",address_line_1:order.route.pickup_label},{sequence_number:2,stop_type:"DROP",address_line_1:order.route.drop_label}],items:[{description:"Mock delivery parcel",quantity:1,category:"PARCEL"}]},history:[{from_status:null,to_status:order.status,actor_type:"SYSTEM",reason:"Mock seed",created_at:order.created_at}],assignments:order.assigned_driver_id?[{driver_id:order.assigned_driver_id,status:"ACTIVE",source:"MOCK"}]:[],trips:[],payments:[{id:order.payment.payment_id,purpose:order.payment.timing==="PRE_DISPATCH"?"ORDER_PREPAYMENT":"ORDER_POSTPAYMENT",status:order.payment.gateway_status,amount:order.fare.quoted_amount,refunded_amount:order.payment.refunded_amount}]}}
function listWithActivity(kind:"customers"|"drivers",params:URLSearchParams){
 const activityParams=new URLSearchParams(params);for(const field of ["q","cursor","limit"])activityParams.delete(field);const orders=selectOrders(activityParams);const values=new Map<string,{count:number;cents:number}>();
 for(const o of orders){if(o.status!=="DELIVERED")continue;const key=kind==="customers"?o.customer.id:o.assigned_driver_id;if(!key)continue;const v=values.get(key)||{count:0,cents:0};v.count++;v.cents+=cents(o.fare.final_amount);values.set(key,v)}
 return pool(kind).map(row=>({...row,period_delivered_count:values.get(row.id)?.count||0,period_fare_revenue:money(values.get(row.id)?.cents||0),currency:"INR"}));
}
function reconciliation(){return {status:"NOT_CHECKED",checked_at:null,controls:["Gateway collections","Cash collections","Bank payout confirmations"].map(name=>({name,status:"NOT_CHECKED",expected_amount:null,observed_amount:null,difference:null,reason:"Mock API does not ingest bank or gateway statements"}))}}
function exportRows(dataset:string,params:URLSearchParams):Record<string,unknown>[]{
 if(dataset==="order_register")return selectOrders(params).map(o=>({order_number:o.order_number,customer_display_name:o.customer.display_name,customer_type:o.customer.customer_type,status:o.status,payment_method_type:o.payment.method,payment_timing:o.payment.timing,quoted_amount:o.fare.quoted_amount,final_amount:o.fare.final_amount,currency:"INR",created_at:o.created_at}));
 if(dataset==="customers")return getStore().customers;
 if(dataset==="business_accounts")return getStore().businessAccounts;
 if(dataset==="driver_settlements")return settlements();
 if(dataset==="finance_statement")return statement(params).data.rows;
 return reconciliation().controls;
}
async function read(path:string,p:URLSearchParams):Promise<Response>{
 const store=getStore();
 if(path==="auth/me")return json(user);
 if(path==="admin/workspace")return json({user,roles:["MOCK_ADMIN"],permissions,markets,selected_market_id:MARKET_ID,server_time:SNAPSHOT,mock:true});
 if(path==="admin/markets")return json(markets);
 if(path===`admin/markets/${MARKET_ID}/zones`)return json(zones);
 if(path==="vehicle-types")return json(vehicleTypes);
 if(path==="admin/dashboard")return json(dashboard(p));
 if(path==="admin/order-register/summary"||path==="admin/orders/summary")return json({...scope(p),...summary(selectOrders(p))});
 if(path==="admin/order-register")return json(paginate(selectOrders(p),p));
 if(path==="admin/orders")return json(paginate(selectOrders(p),p).items.map(o=>({id:o.id,order_number:o.order_number,status:o.status,quoted_amount:o.fare.quoted_amount,final_amount:o.fare.final_amount,currency:"INR",created_at:o.created_at})));
 if(path.startsWith("admin/orders/")&&path.split("/").length===3)return json(orderDetail(find(store.orders,path.split("/")[2])));
 if(path==="admin/active-trips")return json(paginate(store.orders.filter(o=>["ACTIVE","CONFIRMED"].includes(o.status_group)),p).items.map(o=>({id:o.id,trip_number:`TRIP-${o.order_number}`,order_id:o.id,driver_id:o.assigned_driver_id,status:o.status,attempt_number:1,created_at:o.created_at})));
 if(path==="admin/partners/summary")return json(aggregate(p,{registered_riders:store.drivers.length,registered_customers:store.customers.length,live_b2b_partners:store.businessAccounts.filter(x=>x.status==="ACTIVE").length,advertising_brands:store.brands.length,online_riders:store.drivers.filter(x=>x.availability==="AVAILABLE").length,on_delivery_riders:store.drivers.filter(x=>x.availability==="ASSIGNED").length}));
 if(path==="admin/reports/statement")return json(statement(p));
 if(path==="admin/reports/reconciliation")return json(aggregate(p,reconciliation()));
 if(path==="admin/settlements/summary"){scope(p);const eligible=settlements();return json(aggregate(p,{driver_wallet_balance:money(eligible.reduce((n,d)=>n+cents(d.driver_wallet_balance),0)),eligible_withdrawable_balance:money(eligible.reduce((n,d)=>n+cents(d.eligible_withdrawable_amount),0)),eligible_driver_count:eligible.length,paid_payouts_mtd:money(store.payouts.filter(x=>x.status==="PAID").reduce((n,d)=>n+cents(d.net_amount),0)),in_flight_payout_amount:money(store.payouts.filter(x=>x.status==="PROCESSING").reduce((n,d)=>n+cents(d.net_amount),0)),due_today:null,next_run_at:null,basis:"Illustrative current wallet balances; not MTD earnings minus payouts"}))}
 if(path==="admin/settlements"){scope(p);return json(paginate(filterRows(settlements(),p,["status"]),p))}
 if(path==="admin/marketing/summary")return json(aggregate(p,{live_campaigns:store.campaigns.filter(c=>c.status==="LIVE"&&(!c.start_at||Date.parse(String(c.start_at))<=Date.parse(SNAPSHOT))&&(!c.end_at||Date.parse(String(c.end_at))>Date.parse(SNAPSHOT))).length,impressions:store.campaigns.reduce((n,c)=>n+Number(c.impressions||0),0),coupon_redemptions:store.coupons.reduce((n,c)=>n+Number(c.usage_count||0),0),cashback_credited:"0.00",incentives_credited:"0.00",measurement_basis:"Illustrative campaign seed counters, not instrumented events"}));
 if(path==="admin/coupons/usage")return json(paginate(store.coupons.map(c=>({id:c.id,code:c.code,applied_count:c.usage_count,reversed_count:0,discount_amount:money(Number(c.usage_count||0)*cents(c.discount_value))})),p));
 if(path==="admin/analytics/overview"){const orders=selectOrders(p);return json(aggregate(p,{gross_fare_revenue:revenue(orders),bookings_count:orders.length,revenue_change_percent:null,average_rating:null,on_time_rate_percent:null,coverage:{ratings:"NOT_SEEDED",on_time:"NO_SLA_TARGET"}}))}
 if(path==="admin/analytics/revenue")return json(aggregate(p,{series:series(p,selectOrders(p)),total:revenue(selectOrders(p))}));
 if(path==="admin/analytics/demand"){const points=series(p,selectOrders(p));return json(aggregate(p,{series:points.map(x=>({date:x.date,bookings_count:x.bookings_count})),peak:points.reduce((a,b)=>a.bookings_count>=b.bookings_count?a:b,points[0])}))}
 if(path==="admin/analytics/customers")return json(aggregate(p,paginate(listWithActivity("customers",p).sort((a,b)=>Number(b.period_fare_revenue)-Number(a.period_fare_revenue)).map((row,i)=>({...row,revenue_rank:i+1})),p)));
 if(path==="admin/analytics/drivers")return json(aggregate(p,paginate(listWithActivity("drivers",p).map(d=>({...d,on_time_rate_percent:null,rejected_offers_count:0})).sort((a,b)=>b.period_delivered_count-a.period_delivered_count),p)));
 if(path==="admin/analytics/areas"){const orders=selectOrders(p);const areas=new Map<string,number>();for(const o of orders)areas.set(o.route.pickup_label,(areas.get(o.route.pickup_label)||0)+1);return json(aggregate(p,{basis:"Seeded pickup labels; not production locality geometry",items:[...areas].map(([name,bookings_count])=>({name,bookings_count,share_percent:orders.length?Number((bookings_count/orders.length*100).toFixed(2)):0})),unclassified_count:0}))}
 if(path==="admin/analytics/ratings"){scope(p);return json(aggregate(p,{items:[],average_rating:null,coverage:"NOT_SEEDED"}))}
 if(path==="admin/analytics/cancellations"){const rows=selectOrders(p).filter(o=>o.status==="CANCELLED");return json(aggregate(p,{total:rows.length,items:[{actor_type:"CUSTOMER",reason_code:"CHANGED_MIND",count:Math.ceil(rows.length*.625)},{actor_type:"DRIVER",reason_code:"VEHICLE_BREAKDOWN",count:rows.length-Math.ceil(rows.length*.625)}],basis:"Synthetic cancellation attribution, not stored production evidence"}))}
 if(path==="admin/onboarding/pending")return json(store.drivers.filter(d=>d.onboarding_status!=="APPROVED"));
 if(path==="admin/verifications/pending")return json([]);
 if(path==="admin/audit"||path==="admin/admin-actions")return json(paginate(filterRows(store.audit,p,["entity_id","entity_type"]),p).items);
 if(path==="admin/data/templates")return json(importDatasets.map(dataset=>({dataset,schema_version:"1",formats:["csv"],required_fields:dataset==="customers"?["display_name","phone","email","city"]:dataset==="riders"?["first_name","phone","market_code"]:["display_name","customer_id","account_code"]})));
 if(path.startsWith("admin/data/templates/")){const dataset=path.split("/").at(-1)!;if(!importDatasets.includes(dataset))fail(404,"NOT_FOUND","Unknown template dataset");if(p.has("format")&&p.get("format")!=="csv")invalid("Mock templates support CSV only");const row=dataset==="customers"?{display_name:"Example customer",phone:"+919900000010",email:"customer@example.com",city:"Bengaluru"}:dataset==="riders"?{first_name:"Example rider",phone:"+919900000011",market_code:"BLR"}:{display_name:"Example business",customer_id:store.customers[1].id,account_code:"BIZ-001"};return csv([row],`${dataset}_template`)}
 if(path==="admin/data/summary")return json({imports_count:store.imports.length,exports_count:store.exports.length,committed_records:store.imports.reduce((n,r)=>n+Number(r.committed_rows||0),0),last_transfer_at:store.imports.length||store.exports.length?SNAPSHOT:null,as_of:SNAPSHOT});
 if(path==="admin/data/transfers")return json(paginate(filterRows([...store.imports.map(x=>({...publicRow(x),direction:"IMPORT"})),...store.exports.map(x=>({...publicRow(x),direction:"EXPORT"}))],p,["direction","dataset","status"]),p));
 const downloadMatch=path.match(/^admin\/data\/exports\/([^/]+)\/download$/);
 if(downloadMatch){const job=find(store.exports,downloadMatch[1]);if(job.status!=="READY")fail(409,"EXPORT_NOT_READY","Export is not ready");return csv(job.rows as Record<string,unknown>[],String(job.dataset),job.fields as string[])}
 const errorMatch=path.match(/^admin\/data\/imports\/([^/]+)\/errors$/);
 if(errorMatch){const job=find(store.imports,errorMatch[1]);return json({items:job.errors||[],total_count:(job.errors as unknown[]||[]).length})}
 const receipt=path.match(/^admin\/payouts\/([^/]+)\/receipt$/);
 if(receipt){const row=find(store.payouts,receipt[1]);if(row.status!=="PAID")fail(409,"PAYOUT_NOT_PAID","Receipts are available only for PAID mock payouts");return json({mock:true,payout_reference:row.payout_reference,net_amount:row.net_amount,currency:"INR",paid_at:row.paid_at,provider_reference:row.provider_reference,notice:"Mock receipt — no funds transferred"})}
 for(const [base,config] of Object.entries(resources)){
  if(path===base){scope(p);let rows=base==="admin/customers"?listWithActivity("customers",p):base==="admin/drivers"?listWithActivity("drivers",p):pool(config.key);rows=filterRows(rows,p,config.filters).map(publicRow);return json(base==="admin/coupons"?rows:paginate(rows,p))}
  if(path.startsWith(base+"/")&&path.split("/").length===base.split("/").length+1)return json(publicRow(find(pool(config.key),path.slice(base.length+1))));
 }
 fail(404,"NOT_FOUND","Mock endpoint not found. GET /api/v1 lists available endpoints.");
}
function validateDates(body:Record<string,unknown>,first:string,last:string){
 for(const field of [first,last])if(body[field]!=null&&(typeof body[field]!=="string"||!Number.isFinite(Date.parse(String(body[field])))))invalid(`${field} must be a valid date`);
 if(body[first]&&body[last]&&Date.parse(String(body[last]))<=Date.parse(String(body[first])))invalid(`${last} must be after ${first}`);
}
async function mutate(request:Request,path:string):Promise<Response>{
 const store=getStore();
 if(path==="auth/otp/request"){const b=await bodyOf(request);text(b,"phone",6,20);choice(b,"app_type",["ADMIN"]);return json({phone_masked:"+91 99•••••001",expires_in_seconds:300,mock:true,demo_code:"000000"},202)}
 if(path==="auth/otp/verify"){const b=await bodyOf(request);text(b,"phone",6,20);choice(b,"app_type",["ADMIN"]);if(b.code!=="000000")fail(401,"INVALID_OTP","Use the mock OTP 000000; no SMS is sent");return json({access_token:TOKEN,refresh_token:"mock-refresh-token-for-demo-only",token_type:"bearer",expires_in_seconds:86400,is_new_user:false,user})}
 if(path==="auth/refresh"){const b=await bodyOf(request);if(b.refresh_token!=="mock-refresh-token-for-demo-only")fail(401,"UNAUTHORIZED","Invalid mock refresh token");return json({access_token:TOKEN,refresh_token:b.refresh_token,token_type:"bearer",expires_in_seconds:86400,is_new_user:false,user})}
 if(path==="auth/logout")return new Response(null,{status:204,headers});
 if(path==="admin/data/imports")return uploadImport(request);
 if(path==="admin/creative-assets")return uploadAsset(request);
 const b=await bodyOf(request);
 if(path==="admin/campaigns"&&request.method==="POST"){
  validateDates(b,"start_at","end_at");
  const title=text(b,"title",1,120),audience=choice(b,"audience",["CUSTOMER","DRIVER"]),format=choice(b,"format",["HOME_BANNER","TESTIMONIAL","POPUP","INCENTIVE"],"HOME_BANNER");
  return json(insert(store.campaigns,{title,description:typeof b.description==="string"?b.description:"",audience,format,placement:audience==="CUSTOMER"?"CUSTOMER_HOME":"DRIVER_REWARDS",market_id:MARKET_ID,status:"DRAFT",start_at:b.start_at||null,end_at:b.end_at||null,impressions:0,clicks:0,version:1}),201);
 }
 if(path==="admin/coupons"&&request.method==="POST"){
  validateDates(b,"valid_from","valid_until");
  const code=text(b,"code",3,32).toUpperCase();if(!/^[A-Z0-9_-]+$/.test(code))invalid("Invalid coupon code");if(store.coupons.some(c=>c.code===code))fail(409,"COUPON_CODE_TAKEN","Coupon code already exists");
  const kind=choice(b,"discount_type",["FLAT","PERCENT"]),value=amount(b.discount_value,"discount_value");if(kind==="PERCENT"&&Number(value)>100)invalid("Percent discount cannot exceed 100");
  return json(insert(store.coupons,{code,title:text(b,"title",1,120),description:text(b,"description",1,255),discount_type:kind,discount_value:value,max_discount:b.max_discount==null?null:amount(b.max_discount,"max_discount"),min_fare:b.min_fare==null?null:amount(b.min_fare,"min_fare",true),vehicle_type_codes:b.vehicle_type_codes||null,valid_from:b.valid_from||null,valid_until:b.valid_until||null,max_uses_per_customer:b.max_uses_per_customer||null,is_active:true,usage_count:0}),201);
 }
 if(path==="admin/driver-invitations"){const name=text(b,"name",1,160),phone=text(b,"phone",6,20);if(!/^\+\d{6,15}$/.test(phone))invalid("phone must use E.164 format");return json(insert(store.invitations,{name,phone_masked:phone.slice(0,5)+"••••"+phone.slice(-3),market_id:MARKET_ID,status:"PENDING",notice:"Mock invitation only; no SMS/email sent and no approved driver created"}),201)}
 if(path==="admin/business-accounts"&&request.method==="POST"){const customer=find(store.customers,text(b,"customer_id"));if(customer.customer_type!=="BUSINESS")invalid("customer_id must reference a BUSINESS customer");return json(insert(store.businessAccounts,{customer_id:customer.id,display_name:text(b,"display_name",1,160),account_code:text(b,"account_code",1,32),payment_terms:choice(b,"payment_terms",["PREPAID","NET_15","NET_30"],"PREPAID"),status:"ACTIVE",location_count:0,version:1}),201)}
 if(path==="admin/brands"&&request.method==="POST")return json(insert(store.brands,{display_name:text(b,"display_name",1,160),contact_name:text(b,"contact_name",1,160),email:text(b,"email",3,254),status:"ACTIVE"}),201);
 if(path==="admin/brand-campaigns"&&request.method==="POST"){find(store.brands,text(b,"brand_id"));return json(insert(store.brandCampaigns,{brand_id:b.brand_id,title:text(b,"title",1,120),booked_ad_value:amount(b.booked_ad_value,"booked_ad_value"),currency:"INR",placement:text(b,"placement"),start_at:b.start_at||null,end_at:b.end_at||null,status:"DRAFT"}),201)}
 if(path==="admin/incentive-programs"&&request.method==="POST")return json(insert(store.programs,{code:text(b,"code",3,32),title:text(b,"title",1,120),reward_amount:amount(b.reward_amount,"reward_amount"),currency:"INR",status:"DRAFT",claims_count:0,notice:"No rewards are credited by this mock API"}),201);
 if(path==="admin/reports/reviews")return json(insert(store.reviews,{market_id:MARKET_ID,from_date:text(b,"from_date"),to_date:text(b,"to_date"),note:text(b,"note"),reason:text(b,"reason",3,500),reviewed_by:user.id,reviewed_at:SNAPSHOT}),201);
 if(path==="admin/data/exports"){
  const dataset=choice(b,"dataset",datasets);choice(b,"format",["csv"]);
  const query=new URLSearchParams();for(const [key,value] of Object.entries(b.filters&&typeof b.filters==="object"?b.filters:{}))query.set(key,String(value));
  if(b.market_id)query.set("market_id",String(b.market_id));if(b.from_date)query.set("from",String(b.from_date));if(b.to_date)query.set("to",String(b.to_date));
  let rows=structuredClone(exportRows(dataset,query));const fields=b.fields===undefined?exportFields[dataset]:b.fields;
  if(!Array.isArray(fields)||!fields.length||fields.some(f=>typeof f!=="string"||!exportFields[dataset].includes(f)))invalid("fields must be a non-empty array of supported dataset fields");
  rows=rows.map(row=>Object.fromEntries(fields.map(f=>[f,row[f]])));const job=insert(store.exports,{dataset,format:"csv",status:"READY",schema_version:"1",rows,fields,record_count:rows.length,created_by:user.id,...scope(query)});
  return json({...job,rows:undefined,download_url:`/api/v1/admin/data/exports/${job.id}/download`,mock:true},202);
 }
 const imported=path.match(/^admin\/data\/imports\/([^/]+)\/(validate|commit)$/);
 if(imported)return importAction(find(store.imports,imported[1]),imported[2],b);
 if(path==="admin/payout-batches/preview"){
  if(b.market_id&&b.market_id!==MARKET_ID)invalid("Unknown market_id");const eligible=settlements();
  const preview=insert(store.previews,{eligible_driver_count:eligible.length,total_amount:money(eligible.reduce((n,d)=>n+cents(d.eligible_withdrawable_amount),0)),currency:"INR",market_id:MARKET_ID,status:"PREVIEW",criteria_hash:randomUUID(),expires_at:new Date(Date.now()+900000).toISOString(),notice:"Preview only — no money moved"});return json(preview);
 }
 if(path==="admin/payout-batches"&&request.method==="POST"){
  const preview=find(store.previews,text(b,"preview_id"));text(b,"reason",3,500);if(b.confirmed!==true)invalid("confirmed must be true");if(preview.status!=="PREVIEW")fail(409,"PREVIEW_USED","Preview was already confirmed");if(Date.parse(String(preview.expires_at))<Date.now())fail(409,"PREVIEW_EXPIRED","Create a new preview");preview.status="CONFIRMED";
  return json(insert(store.batches,{preview_id:preview.id,status:"SIMULATED",total_amount:preview.total_amount,currency:"INR",driver_count:preview.eligible_driver_count,created_by:user.id,notice:"Simulation only — no wallet posting, bank transfer, or gateway call"}),201);
 }
 if(path==="admin/payouts/run"){
  choice(b,"cadence",["DAILY","WEEKLY","MANUAL"]);return json({mock:true,status:"SIMULATED",payouts:[],notice:"This mock endpoint does not run the real backend PayoutService or move money"});
 }
 const orderAction=path.match(/^admin\/orders\/([^/]+)\/(cancel|assign|reassign)$/);
 if(orderAction){const order=find(store.orders,orderAction[1]);if(["DELIVERED","CANCELLED","DELIVERY_FAILED"].includes(order.status))fail(409,"INVALID_ORDER_STATE","Terminal orders cannot be changed");
  if(orderAction[2]==="cancel"){text(b,"reason_code",2,64);order.status="CANCELLED";order.status_group="CANCELLED";audit("ORDER_CANCELLED",order);return new Response(null,{status:204,headers})}
  text(b,"reason",3,500);if(order.status_group==="ACTIVE")fail(409,"INVALID_ORDER_STATE","Mock reassignment is only available before pickup");
  if(b.driver_id==null&&orderAction[2]==="reassign"){order.assigned_driver_id=null;order.status="SEARCHING_DRIVER";order.status_group="UNASSIGNED";audit("ORDER_RELEASED",order);return json(null)}
  const driver=find(store.drivers,text(b,"driver_id"));if(driver.account_status!=="ACTIVE")fail(409,"DRIVER_NOT_ELIGIBLE","Select an active mock driver");if(store.orders.some(o=>o.assigned_driver_id===driver.id&&["ACTIVE","CONFIRMED"].includes(o.status_group)))fail(409,"DRIVER_BUSY","Driver is assigned to another mock order");order.assigned_driver_id=driver.id;order.status="DRIVER_ASSIGNED";order.status_group="CONFIRMED";audit("ORDER_ASSIGNED",order);return json({id:randomUUID(),driver_id:driver.id,order_id:order.id,vehicle_id:(driver.current_vehicle as {id:string}).id,source:"MOCK_ADMIN",status:"ACTIVE",assigned_at:SNAPSHOT,release_reason:null})
 }
 const alertAction=path.match(/^admin\/alerts\/([^/]+)\/(acknowledge|resolve)$/);
 if(alertAction){const alert=find(store.alerts,alertAction[1]);if(alert.status==="RESOLVED")fail(409,"ALERT_RESOLVED","Alert is already resolved");if(alertAction[2]==="resolve"){alert.resolution_note=text(b,"note",3,2000);alert.status="RESOLVED";alert.resolved_at=SNAPSHOT;alert.resolved_by=user.id}else{alert.status="ACKNOWLEDGED";alert.acknowledged_by=user.id;alert.acknowledged_at=SNAPSHOT}audit("ALERT_"+alert.status,alert);return json(alert)}
 const campaignAction=path.match(/^admin\/campaigns\/([^/]+)\/(publish|pause)$/);
 if(campaignAction){const row=find(store.campaigns,campaignAction[1]);text(b,"reason",3,500);if(campaignAction[2]==="publish"){if(!row.start_at||!row.end_at||!Number.isFinite(Date.parse(String(row.start_at)))||!Number.isFinite(Date.parse(String(row.end_at)))||Date.parse(String(row.start_at))>=Date.parse(String(row.end_at)))invalid("Valid start_at and end_at are required before publishing");row.status="LIVE"}else row.status="PAUSED";row.version=Number(row.version)+1;audit("CAMPAIGN_"+row.status,row);return json(row)}
 const patch=path.match(/^admin\/(campaigns|coupons|business-accounts|web-enquiries)\/([^/]+)$/);
 if(patch&&request.method==="PATCH"){
  const row=find(pool(resources[`admin/${patch[1]}`].key),patch[2]);text(b,"reason",3,500);
  if(b.version!==undefined&&b.version!==row.version)fail(409,"VERSION_CONFLICT","Resource changed; reload it before updating");
  const allowed=patch[1]==="campaigns"?["title","description","start_at","end_at"]:patch[1]==="coupons"?["is_active","valid_until"]:patch[1]==="business-accounts"?["display_name","payment_terms"]:["status","owner_user_id","follow_up_at","note"];
  if(patch[1]==="campaigns")validateDates({...row,...b},"start_at","end_at");if(patch[1]==="coupons")validateDates({...row,...b},"valid_from","valid_until");if(b.title!==undefined)text(b,"title",1,120);if(b.is_active!==undefined&&typeof b.is_active!=="boolean")invalid("is_active must be boolean");if(patch[1]==="web-enquiries"&&b.status!==undefined)choice(b,"status",["NEW","ASSIGNED","FOLLOW_UP","RESOLVED","SPAM"]);
  for(const key of allowed)if(key in b)row[key]=b[key];if("version"in row)row.version=Number(row.version)+1;audit("UPDATED",row,String(b.reason));return json(row);
 }
 fail(404,"NOT_FOUND","Mock write endpoint not found");
}
function parseCsv(content:string):string[][] {
 const rows:string[][]=[];let row:string[]=[],cell="",quoted=false;
 for(let i=0;i<content.length;i++){
  const c=content[i];if(c==='"'){if(quoted&&content[i+1]==='"'){cell+='"';i++}else if(!quoted&&cell.length)invalid("CSV quotes must start at the beginning of a field");else quoted=!quoted}
  else if(c===","&&!quoted){row.push(cell);cell=""}
  else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&content[i+1]==="\n")i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=""}
  else cell+=c;
 }
 if(quoted)invalid("CSV contains an unclosed quoted field");row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows;
}
async function uploadImport(request:Request){
 const form=await request.formData();const dataset=choice({dataset:form.get("dataset")},"dataset",importDatasets);const file=form.get("file");
 if(!(file instanceof File))invalid("Provide multipart file and dataset fields");if(file.size>20*1024*1024)fail(413,"FILE_TOO_LARGE","Files must be no larger than 20 MB");if(!file.name.toLowerCase().endsWith(".csv"))invalid("Mock imports support UTF-8 CSV only; XLSX requires a parser");
 const values=parseCsv((await file.text()).replace(/^\uFEFF/,""));if(values.length<2)invalid("CSV must contain a header and at least one data row");if(values.length>10001)invalid("Mock imports support at most 10,000 data rows");
 const keys=values[0].map(v=>v.trim());if(keys.some(k=>!k)||new Set(keys).size!==keys.length)invalid("CSV headers must be non-empty and unique");
 const rows=values.slice(1).map(row=>Object.fromEntries(keys.map((key,i)=>[key,row[i]||""])));
 const job=insert(getStore().imports,{dataset,schema_version:"1",original_filename:file.name,size_bytes:file.size,status:"UPLOADED",total_rows:rows.length,valid_rows:0,invalid_rows:0,committed_rows:0,created_by:user.id,market_id:MARKET_ID,version:1,staged_rows:rows,errors:[]});return json(publicRow(job),201);
}
function publicRow(row:Row){const {rows,staged_rows,...visible}=row;void rows;void staged_rows;return visible}
function importAction(job:Row,action:string,b:Record<string,unknown>){
 if(b.version!==job.version)fail(409,"VERSION_CONFLICT","Pass the current import job version");
 if(action==="validate"){
  if(!["UPLOADED","NEEDS_REVIEW"].includes(String(job.status)))fail(409,"INVALID_IMPORT_STATE","Only uploaded/review imports can be validated");
  const required=job.dataset==="customers"?["display_name","phone","email","city"]:job.dataset==="riders"?["first_name","phone","market_code"]:["display_name","customer_id","account_code"];
  const errors:{row:number;column:string;code:string;message:string}[]=[];const rows=job.staged_rows as Record<string,string>[];const seen=new Set<string>();
  rows.forEach((row,i)=>{for(const key of required)if(!row[key]?.trim())errors.push({row:i+2,column:key,code:"REQUIRED",message:`${key} is required`});if(row.phone&&!/^\+\d{6,15}$/.test(row.phone))errors.push({row:i+2,column:"phone",code:"INVALID_PHONE",message:"Use E.164 phone format"});if(row.phone&&seen.has(row.phone))errors.push({row:i+2,column:"phone",code:"DUPLICATE",message:"Phone repeats within this file"});if(row.phone)seen.add(row.phone);if(row.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))errors.push({row:i+2,column:"email",code:"INVALID_EMAIL",message:"Email is invalid"});if(job.dataset==="business_accounts"&&row.customer_id&&!getStore().customers.some(c=>c.id===row.customer_id&&c.customer_type==="BUSINESS"))errors.push({row:i+2,column:"customer_id",code:"INVALID_BUSINESS_CUSTOMER",message:"Use an existing BUSINESS customer UUID"})});
  job.errors=errors;job.invalid_rows=new Set(errors.map(e=>e.row)).size;job.valid_rows=rows.length-Number(job.invalid_rows);job.status=errors.length?"NEEDS_REVIEW":"VALIDATED";job.validated_at=SNAPSHOT;job.version=Number(job.version)+1;audit("IMPORT_VALIDATED",job);return json(publicRow(job));
 }
 text(b,"reason",3,500);if(job.status!=="VALIDATED")fail(409,"IMPORT_NOT_VALIDATED","Resolve all validation errors before committing this mock import");
 for(const row of job.staged_rows as Record<string,string>[]){
  if(job.dataset==="customers")insert(getStore().customers,{display_name:row.display_name,customer_number:`CUS-MOCK-${getStore().customers.length+1}`,phone_masked:row.phone.slice(0,5)+"••••"+row.phone.slice(-3),email:row.email,customer_type:"INDIVIDUAL",status:"ACTIVE",email_verified:false,mock_import:true});
  else if(job.dataset==="riders")insert(getStore().invitations,{name:row.first_name,phone_masked:row.phone.slice(0,5)+"••••"+row.phone.slice(-3),market_code:row.market_code,status:"PENDING",mock_import:true});
  else insert(getStore().businessAccounts,{display_name:row.display_name,customer_id:row.customer_id,account_code:row.account_code,status:"ACTIVE",version:1,mock_import:true});
 }
 job.committed_rows=job.valid_rows;job.status="COMPLETED";job.committed_at=SNAPSHOT;job.version=Number(job.version)+1;audit("IMPORT_COMMITTED",job,String(b.reason));return json(publicRow(job));
}
async function uploadAsset(request:Request){const form=await request.formData();const file=form.get("file");if(!(file instanceof File))invalid("Provide a file");if(file.size>5*1024*1024)fail(413,"FILE_TOO_LARGE","Mock asset metadata supports files up to 5 MB");if(!["image/png","image/jpeg","image/webp"].includes(file.type))invalid("Use a PNG, JPEG or WebP image");return json(insert(getStore().assets,{name:file.name,content_type:file.type,size_bytes:file.size,url:null,status:"METADATA_ONLY",notice:"Mock stores metadata only; file bytes are not persisted or published"}),201)}
export const endpoints=[
 ["GET","/","Public endpoint index"],["POST","/auth/otp/request","Mock OTP 000000; no SMS"],["POST","/auth/otp/verify","Get mock bearer token"],["POST","/auth/refresh","Mock token refresh"],["POST","/auth/logout","No-op logout"],["GET","/auth/me","Mock admin"],
 ["GET","/admin/workspace","User, roles, permissions, markets"],["GET","/admin/markets","Mock markets"],["GET","/admin/markets/{market_id}/zones","Mock zones"],["GET","/vehicle-types","Vehicle catalog"],
 ["GET","/admin/dashboard","Calculated dashboard"],["GET","/admin/order-register","Paginated enriched orders"],["GET","/admin/order-register/summary","Filtered counts"],["GET","/admin/orders","Legacy-style order summary array"],["GET","/admin/orders/{id}","Order detail"],["GET","/admin/active-trips","Synthetic trip projections"],
 ...["cancel","assign","reassign"].map(action=>["POST",`/admin/orders/{id}/${action}`,"Simulated order action"]),
 ["GET","/admin/partners/summary","Partner counts"],["GET","/admin/reports/statement","Period statement"],["GET","/admin/reports/reconciliation","NOT_CHECKED mock controls"],["POST","/admin/reports/reviews","Record mock finance review"],
 ...["overview","revenue","demand","customers","drivers","areas","ratings","cancellations"].map(name=>["GET",`/admin/analytics/${name}`,"Mock analytics"]),
 ["GET","/admin/marketing/summary","Campaign counters"],["GET","/admin/coupons/usage","Illustrative coupon usage"],["GET","/admin/settlements","Wallet balance projections"],["GET","/admin/settlements/summary","Settlement summary"],
 ...Object.keys(resources).flatMap(path=>[["GET",`/${path}`,"Resource list"],["GET",`/${path}/{id}`,"Resource detail"]]),
 ...["campaigns","coupons","brands","brand-campaigns","business-accounts","incentive-programs","driver-invitations"].map(name=>["POST",`/admin/${name}`,"Create mock resource"]),
 ...["campaigns","coupons","business-accounts","web-enquiries"].map(name=>["PATCH",`/admin/${name}/{id}`,"Update allowlisted fields with reason"]),
 ...["publish","pause"].map(name=>["POST",`/admin/campaigns/{id}/${name}`,"Campaign state action"]),
 ...["acknowledge","resolve"].map(name=>["POST",`/admin/alerts/{id}/${name}`,"Alert action"]),
 ["GET","/admin/onboarding/pending","Pending mock riders"],["GET","/admin/verifications/pending","Empty verification queue"],["GET","/admin/audit","Mock mutation history"],["GET","/admin/admin-actions","Mock mutation history"],
 ["GET","/admin/data/summary","Actual transfer totals"],["GET","/admin/data/templates","CSV schema metadata"],["GET","/admin/data/templates/{dataset}","Download CSV template"],["POST","/admin/data/imports","Multipart CSV upload"],["GET","/admin/data/imports/{id}/errors","Redacted validation errors"],
 ...["validate","commit"].map(name=>["POST",`/admin/data/imports/{id}/${name}`,"Staged import action"]),
 ["POST","/admin/data/exports","Create frozen CSV export"],["GET","/admin/data/exports/{id}/download","Download CSV"],["GET","/admin/data/transfers","Import/export job history"],["POST","/admin/creative-assets","Store image metadata only"],
 ["POST","/admin/payout-batches/preview","No-side-effect preview"],["POST","/admin/payout-batches","Confirm simulation"],["POST","/admin/payouts/run","Simulation only, no real payments"],["GET","/admin/payouts/{id}/receipt","Mock PAID payout receipt"],
].map(([method,path,description])=>({method,path:path==="/"?"/api/v1":"/api/v1"+path,description}));
const pending=new Map<string,{fingerprint:string;promise:Promise<{body:unknown;status:number}>}>();
export async function handle(request:Request,segments:string[]=[]):Promise<Response>{
 const path=segments.join("/");const p=new URL(request.url).searchParams;
 try{
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(!path&&request.method==="GET")return json({name:"Ryno CMS mock API",mock:true,base_url:"/api/v1",authentication:`Bearer ${TOKEN}`,snapshot:SNAPSHOT,notice:"Illustrative in-memory data. No connection to FastAPI, database, SMS, bank, or payment provider. State resets on process restart. CMS screens use this mock API.",endpoints});
  const matching=endpoints.filter(endpoint=>{const parts=endpoint.path.replace(/^\/api\/v1\/?/,"").split("/");return parts.length===segments.length&&parts.every((part,i)=>part.startsWith("{")||part===segments[i])});
  if(matching.length&&!matching.some(endpoint=>endpoint.method===request.method))fail(405,"METHOD_NOT_ALLOWED","Method not available for this mock endpoint");
  const publicAuth=["auth/otp/request","auth/otp/verify","auth/refresh"];
  if(!publicAuth.includes(path)&&request.headers.get("authorization")!==`Bearer ${TOKEN}`)fail(401,"UNAUTHORIZED",`Use Authorization: Bearer ${TOKEN} for this mock API`);
  if(request.method==="GET")return await read(path,p);
  if(!["POST","PATCH"].includes(request.method))fail(405,"METHOD_NOT_ALLOWED","Supported mock methods: GET, POST, PATCH, OPTIONS");
  const key=request.headers.get("idempotency-key");const needsKey=request.method==="POST"&&(path==="admin/payout-batches"||path==="admin/data/exports"||/^admin\/data\/imports\/[^/]+\/commit$/.test(path));
  if(needsKey&&!key)invalid("Idempotency-Key header is required");if(key&&(key.length<4||key.length>128))invalid("Idempotency-Key must contain 4–128 characters");
  if(!key)return await mutate(request,path);
  const fingerprint=createHash("sha256").update(request.method+path+await request.clone().text()).digest("hex");const cacheKey=request.method+":"+path+":"+key;const existing=getStore().idempotency.get(cacheKey);const active=pending.get(cacheKey);
  if(existing){if(existing.fingerprint!==fingerprint)fail(409,"IDEMPOTENCY_KEY_REUSED","Key was used with a different request body");return existing.status===204?new Response(null,{status:204,headers}):json(existing.body,existing.status)}
  if(active){if(active.fingerprint!==fingerprint)fail(409,"IDEMPOTENCY_KEY_REUSED","Key is in use with a different request body");const result=await active.promise;return result.status===204?new Response(null,{status:204,headers}):json(result.body,result.status)}
  const promise=(async()=>{const result=await mutate(request,path);const body=result.status===204?null:await result.json();const cached={body,status:result.status};getStore().idempotency.set(cacheKey,{fingerprint,...cached});return cached})();
  pending.set(cacheKey,{fingerprint,promise});try{const result=await promise;return result.status===204?new Response(null,{status:204,headers}):json(result.body,result.status)}finally{pending.delete(cacheKey)}
 }catch(error){if(error instanceof ApiError)return json({code:error.code,message:error.message,details:error.details},error.status);console.error("Mock API request failed:",error instanceof Error?error.message:"unknown error");return json({code:"INTERNAL_ERROR",message:"Mock API request failed",details:{}},500)}
}

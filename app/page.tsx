"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarDays, ChevronDown, CircleDollarSign, LayoutDashboard, LoaderCircle, Pencil, Plus, ReceiptText, Search, Settings, Target, Trash2, WalletCards, X } from "lucide-react";
import { accounts, budgets, payments as initialPayments, transactions as initialTransactions } from "@/lib/demo-data";
import type { Payment, Transaction } from "@/lib/types";
import { AuthGate } from "@/app/auth-gate";
import { useHousehold } from "@/app/family-context";
import { supabase } from "@/lib/supabase";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const shortDate = (value: string) => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));

type View = "Resumen" | "Movimientos" | "Presupuesto" | "Cuentas" | "Pagos";

export default function Home() {
  const [view, setView] = useState<View>("Resumen");
  const [transactions, setTransactions] = useState(initialTransactions);
  const [payments, setPayments] = useState(initialPayments);
  const [modal, setModal] = useState<"transaction" | "payment" | null>(null);
  const available = accounts.reduce((sum, account) => sum + account.balance, 0);
  const pending = payments.filter((p) => p.status === "pending").reduce((sum, payment) => sum + payment.amount, 0);
  const projected = available - pending;

  const page = view === "Resumen" ? <Dashboard available={available} pending={pending} projected={projected} transactions={transactions} payments={payments} setView={setView} />
    : view === "Movimientos" ? <Transactions items={transactions} />
    : view === "Presupuesto" ? <Budget />
    : view === "Cuentas" ? <Accounts pending={payments} />
    : <Payments items={payments} onToggle={(id) => setPayments(items => items.map(item => item.id === id ? {...item, status: item.status === "paid" ? "pending" : "paid"} : item))} />;

  return (
    <AuthGate>
    <div className="shell">
      <Sidebar view={view} setView={setView} />
      <main className="main">
        <header className="topbar">
          <div><p className="eyebrow">FINANZAS FAMILIARES</p><h1>{view}</h1></div>
          <div className="top-actions"><button className="period"><CalendarDays size={17}/> Julio 2026 <ChevronDown size={16}/></button><button className="primary" onClick={() => setModal("transaction")}><Plus size={18}/> Nuevo movimiento</button></div>
        </header>
        {page}
      </main>
      {modal && <EntryModal type={modal} onClose={() => setModal(null)} onTransaction={(item) => setTransactions(x => [item, ...x])} onPayment={(item) => setPayments(x => [item, ...x])}/>} 
    </div>
    </AuthGate>
  );
}

function Sidebar({view,setView}:{view:View;setView:(v:View)=>void}) {
  const links: [View, React.ReactNode][] = [["Resumen",<LayoutDashboard key="1"/>],["Movimientos",<ReceiptText key="2"/>],["Presupuesto",<Target key="3"/>],["Cuentas",<WalletCards key="4"/>],["Pagos",<CircleDollarSign key="5"/>]];
  return <aside className="sidebar"><div className="brand"><span>c</span><strong>clara</strong></div><nav>{links.map(([label,icon])=><button className={view===label?"active":""} onClick={()=>setView(label)} key={label}>{icon}{label}</button>)}</nav><div className="side-bottom"><div className="demo"><span>Supabase activo</span><small>Las cuentas se guardan de forma segura en la nube.</small></div><button><Settings/>Configuración</button><div className="profile"><span>GC</span><div><strong>Guada Cruz</strong><small>Cuenta familiar</small></div></div></div></aside>
}

function Dashboard({available,pending,projected,transactions,payments,setView}:{available:number;pending:number;projected:number;transactions:Transaction[];payments:Payment[];setView:(v:View)=>void}) {
  return <div className="content"><section className="welcome"><div><h2>Tu dinero, más claro.</h2><p>Una vista simple de cómo viene el mes y qué pagos se acercan.</p></div><div className="health"><span className="dot"/> Mes bajo control</div></section>
    <section className="stat-grid"><Stat label="Disponible total" value={available} note="Efectivo + bancos" icon={<ArrowUpRight/>}/><Stat label="Pagos pendientes" value={pending} note={`${payments.filter(p=>p.status==="pending").length} compromisos`} warn icon={<ArrowDownRight/>}/><Stat label="Disponible proyectado" value={projected} note="Después de pagos pendientes" featured icon={<WalletCards/>}/></section>
    <section className="two-col"><div className="card"><CardTitle title="Presupuesto del mes" action="Ver detalle" onClick={()=>setView("Presupuesto")}/><div className="budget-total"><div><small>Gastado</small><strong>{money.format(budgets.reduce((s,b)=>s+b.actual,0))}</strong></div><div className="right"><small>de {money.format(budgets.reduce((s,b)=>s+b.planned,0))}</small><strong>38%</strong></div></div><div className="bar"><i style={{width:"38%"}}/></div><div className="budget-list">{budgets.slice(0,4).map((b,i)=><div key={b.category}><span className={`cat c${i}`}/><p>{b.category}<small>{money.format(b.actual)} de {money.format(b.planned)}</small></p><strong>{Math.round(b.actual/b.planned*100)}%</strong></div>)}</div></div>
      <div className="card"><CardTitle title="Próximos pagos" action="Ver todos" onClick={()=>setView("Pagos")}/><div className="payment-list">{payments.filter(p=>p.status==="pending").map(p=><div key={p.id}><time>{shortDate(p.due)}</time><p>{p.description}<small>{p.account}</small></p><strong>{money.format(p.amount)}</strong></div>)}</div><button className="soft" onClick={()=>setView("Pagos")}><Plus size={17}/> Agregar pago</button></div></section>
    <section className="card recent"><CardTitle title="Últimos movimientos" action="Ver todos" onClick={()=>setView("Movimientos")}/><TransactionTable items={transactions.slice(0,5)}/></section>
  </div>
}

function Stat({label,value,note,icon,warn,featured}:{label:string;value:number;note:string;icon:React.ReactNode;warn?:boolean;featured?:boolean}) {return <div className={`stat ${featured?"featured":""}`}><div className={warn?"stat-icon warn":"stat-icon"}>{icon}</div><p>{label}</p><strong>{money.format(value)}</strong><small>{note}</small></div>}
function CardTitle({title,action,onClick}:{title:string;action:string;onClick:()=>void}) {return <div className="card-title"><h3>{title}</h3><button onClick={onClick}>{action} →</button></div>}
function TransactionTable({items}:{items:Transaction[]}) {return <div className="table"><div className="tr head"><span>FECHA</span><span>DETALLE</span><span>CATEGORÍA</span><span>CUENTA</span><span>IMPORTE</span></div>{items.map(t=><div className="tr" key={t.id}><span>{shortDate(t.date)}</span><strong>{t.description}</strong><span><i className="mini-dot"/>{t.category}</span><span>{t.account}</span><strong className="negative">− {money.format(t.amount)}</strong></div>)}</div>}

function Transactions({items}:{items:Transaction[]}) {return <div className="content"><div className="toolbar"><div className="search"><Search size={17}/><input placeholder="Buscar movimientos…"/></div><button className="period">Todos los tipos <ChevronDown size={16}/></button></div><section className="card"><CardTitle title="Movimientos del mes" action={`${items.length} registros`} onClick={()=>{}}/><TransactionTable items={items}/></section></div>}
function Budget(){const total=budgets.reduce((s,b)=>s+b.planned,0); const actual=budgets.reduce((s,b)=>s+b.actual,0); return <div className="content"><section className="stat-grid"><Stat label="Presupuesto mensual" value={total} note="Plan total de julio" icon={<Target/>}/><Stat label="Gasto real" value={actual} note={`${Math.round(actual/total*100)}% utilizado`} icon={<ReceiptText/>}/><Stat label="Restante" value={total-actual} note="Disponible para el mes" featured icon={<WalletCards/>}/></section><section className="card"><CardTitle title="Plan vs. real por categoría" action="Julio 2026" onClick={()=>{}}/><div className="category-grid">{budgets.map((b,i)=><div className="category-row" key={b.category}><span className={`cat c${i}`}/><div><strong>{b.category}</strong><small>{money.format(b.actual)} gastado</small></div><div className="bar"><i style={{width:`${Math.min(100,b.actual/b.planned*100)}%`}}/></div><strong>{money.format(b.planned-b.actual)}</strong></div>)}</div></section></div>}
type DbAccount={id:string;name:string;kind:"cash"|"bank"|"wallet";opening_balance:number;color:string};
const accountKinds={cash:"EFECTIVO",bank:"CUENTA BANCARIA",wallet:"BILLETERA VIRTUAL"};

function Accounts({pending}:{pending:Payment[]}){
  const household=useHousehold();
  const [items,setItems]=useState<DbAccount[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [editing,setEditing]=useState<DbAccount|null|undefined>(undefined);
  useEffect(()=>{if(!supabase||!household){setLoading(false);return} supabase.from("accounts").select("id,name,kind,opening_balance,color").eq("household_id",household.id).order("created_at").then(({data,error:e})=>{setItems((data||[]) as DbAccount[]);setError(e?.message||"");setLoading(false)})},[household]);
  async function remove(item:DbAccount){if(!supabase||!confirm(`¿Eliminar la cuenta ${item.name}?`))return;const {error:e}=await supabase.from("accounts").delete().eq("id",item.id);if(e)setError(e.message);else setItems(x=>x.filter(a=>a.id!==item.id))}
  if(loading)return <div className="content empty-state"><LoaderCircle className="spin"/><p>Cargando cuentas…</p></div>;
  return <div className="content"><div className="section-heading"><div><h2>Tus cuentas</h2><p>Efectivo, bancos y billeteras de la familia.</p></div><button className="primary" onClick={()=>setEditing(null)}><Plus size={17}/> Nueva cuenta</button></div>{error&&<p className="form-message error">{error}</p>}{items.length===0?<div className="card empty-state"><WalletCards/><h3>Todavía no hay cuentas</h3><p>Creá la primera para empezar a registrar saldos y movimientos.</p><button className="primary" onClick={()=>setEditing(null)}><Plus size={17}/> Crear cuenta</button></div>:<div className="account-grid">{items.map(a=>{const balance=Number(a.opening_balance);const commitments=pending.filter(p=>p.account===a.name&&p.status==="pending").reduce((s,p)=>s+p.amount,0);return <article className="account" key={a.id} style={{"--accent":a.color} as React.CSSProperties}><div className="account-head"><span>{a.name.slice(0,2).toUpperCase()}</span><small>{accountKinds[a.kind]}</small></div><div className="account-actions"><button aria-label="Editar" onClick={()=>setEditing(a)}><Pencil/></button><button aria-label="Eliminar" onClick={()=>remove(a)}><Trash2/></button></div><p>Saldo inicial</p><strong>{money.format(balance)}</strong><div><small>Comprometido</small><b>{money.format(commitments)}</b></div><div><small>Proyectado</small><b>{money.format(balance-commitments)}</b></div></article>})}</div>}<CategoriesManager/>{editing!==undefined&&household&&<AccountModal account={editing} householdId={household.id} onClose={()=>setEditing(undefined)} onSaved={saved=>{setItems(x=>editing?x.map(a=>a.id===saved.id?saved:a):[...x,saved]);setEditing(undefined)}}/>}</div>
}

function AccountModal({account,householdId,onClose,onSaved}:{account:DbAccount|null;householdId:string;onClose:()=>void;onSaved:(a:DbAccount)=>void}){
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!supabase)return;setBusy(true);setError("");const f=new FormData(e.currentTarget);const values={household_id:householdId,name:String(f.get("name")).trim(),kind:String(f.get("kind")),opening_balance:Number(f.get("balance")),color:String(f.get("color"))};const query=account?supabase.from("accounts").update(values).eq("id",account.id):supabase.from("accounts").insert(values);const {data,error:saveError}=await query.select("id,name,kind,opening_balance,color").single();setBusy(false);if(saveError)setError(saveError.message);else onSaved(data as DbAccount)}
  return <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><form className="modal" onSubmit={submit}><div className="modal-head"><div><p className="eyebrow">CUENTAS</p><h2>{account?"Editar cuenta":"Nueva cuenta"}</h2></div><button type="button" onClick={onClose}><X/></button></div><label>Nombre<input name="name" required maxLength={60} defaultValue={account?.name}/></label><div className="form-row"><label>Tipo<select name="kind" defaultValue={account?.kind||"bank"}><option value="cash">Efectivo</option><option value="bank">Cuenta bancaria</option><option value="wallet">Billetera virtual</option></select></label><label>Color<input name="color" type="color" defaultValue={account?.color||"#20e88f"}/></label></div><label>Saldo inicial<input name="balance" type="number" step="0.01" required defaultValue={account?.opening_balance||0}/></label>{error&&<p className="form-message error">{error}</p>}<button className="primary submit" disabled={busy}>{busy?<LoaderCircle className="spin"/>:account?"Guardar cambios":"Crear cuenta"}</button></form></div>
}

type DbCategory={id:string;name:string;kind:"income"|"expense"};
function CategoriesManager(){
  const household=useHousehold();const [items,setItems]=useState<DbCategory[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [editing,setEditing]=useState<DbCategory|null|undefined>(undefined);
  useEffect(()=>{if(!supabase||!household){setLoading(false);return}supabase.from("categories").select("id,name,kind").eq("household_id",household.id).order("kind").order("name").then(({data,error:e})=>{setItems((data||[]) as DbCategory[]);setError(e?.message||"");setLoading(false)})},[household]);
  async function remove(item:DbCategory){if(!supabase||!confirm(`¿Eliminar la categoría ${item.name}?`))return;setError("");const {error:e}=await supabase.from("categories").delete().eq("id",item.id);if(e)setError("No se puede eliminar porque está siendo utilizada en movimientos, pagos o presupuestos.");else setItems(x=>x.filter(c=>c.id!==item.id))}
  return <section className="categories-section"><div className="section-heading"><div><h2>Categorías</h2><p>Organizá ingresos y gastos para entender mejor el presupuesto.</p></div><button className="primary" onClick={()=>setEditing(null)}><Plus size={17}/> Nueva categoría</button></div>{error&&<p className="form-message error">{error}</p>}{loading?<div className="card category-empty"><LoaderCircle className="spin"/> Cargando categorías…</div>:items.length===0?<div className="card category-empty">Todavía no hay categorías. Creá la primera para clasificar movimientos.</div>:<div className="category-columns">{(["expense","income"] as const).map(kind=><div className="card" key={kind}><div className="category-column-title"><h3>{kind==="expense"?"Gastos":"Ingresos"}</h3><span>{items.filter(x=>x.kind===kind).length}</span></div><div className="category-items">{items.filter(x=>x.kind===kind).map(item=><div key={item.id}><span className={`category-kind ${kind}`}/><strong>{item.name}</strong><button aria-label={`Editar ${item.name}`} onClick={()=>setEditing(item)}><Pencil/></button><button aria-label={`Eliminar ${item.name}`} onClick={()=>remove(item)}><Trash2/></button></div>)}{!items.some(x=>x.kind===kind)&&<p>Sin categorías de {kind==="expense"?"gastos":"ingresos"}.</p>}</div></div>)}</div>}{editing!==undefined&&household&&<CategoryModal category={editing} householdId={household.id} onClose={()=>setEditing(undefined)} onSaved={saved=>{setItems(x=>editing?x.map(c=>c.id===saved.id?saved:c):[...x,saved]);setEditing(undefined)}}/>}</section>
}

function CategoryModal({category,householdId,onClose,onSaved}:{category:DbCategory|null;householdId:string;onClose:()=>void;onSaved:(c:DbCategory)=>void}){
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!supabase)return;setBusy(true);setError("");const f=new FormData(e.currentTarget);const values={household_id:householdId,name:String(f.get("name")).trim(),kind:String(f.get("kind"))};const query=category?supabase.from("categories").update(values).eq("id",category.id):supabase.from("categories").insert(values);const {data,error:saveError}=await query.select("id,name,kind").single();setBusy(false);if(saveError)setError(saveError.code==="23505"?"Ya existe una categoría con ese nombre.":saveError.message);else onSaved(data as DbCategory)}
  return <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><form className="modal" onSubmit={submit}><div className="modal-head"><div><p className="eyebrow">CATEGORÍAS</p><h2>{category?"Editar categoría":"Nueva categoría"}</h2></div><button type="button" onClick={onClose}><X/></button></div><label>Nombre<input name="name" required maxLength={60} defaultValue={category?.name} placeholder="Ej. Supermercado"/></label><label>Tipo<select name="kind" defaultValue={category?.kind||"expense"}><option value="expense">Gasto</option><option value="income">Ingreso</option></select></label>{error&&<p className="form-message error">{error}</p>}<button className="primary submit" disabled={busy}>{busy?<LoaderCircle className="spin"/>:category?"Guardar cambios":"Crear categoría"}</button></form></div>
}
function Payments({items,onToggle}:{items:Payment[];onToggle:(id:string)=>void}){return <div className="content"><section className="card"><CardTitle title="Órdenes de pago" action={`${items.filter(x=>x.status==="pending").length} pendientes`} onClick={()=>{}}/><div className="payment-table">{items.map(p=><div key={p.id}><button onClick={()=>onToggle(p.id)} className={p.status==="paid"?"check checked":"check"}>{p.status==="paid"?"✓":""}</button><time>{shortDate(p.due)}</time><p>{p.description}<small>{p.category} · {p.account}</small></p><strong>{money.format(p.amount)}</strong><span className={`pill ${p.status}`}>{p.status==="paid"?"Pagado":"Pendiente"}</span></div>)}</div></section></div>}

function EntryModal({type,onClose,onTransaction,onPayment}:{type:"transaction"|"payment";onClose:()=>void;onTransaction:(x:Transaction)=>void;onPayment:(x:Payment)=>void}) {
  const isPayment=type==="payment"; const submit=(formData:FormData)=>{const base={id:crypto.randomUUID(),date:String(formData.get("date")),description:String(formData.get("description")),category:String(formData.get("category")),account:String(formData.get("account")),amount:Number(formData.get("amount"))}; if(isPayment)onPayment({id:base.id,due:base.date,description:base.description,category:base.category,account:base.account,amount:base.amount,status:"pending"});else onTransaction(base);onClose()};
  return <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><form className="modal" action={submit}><div className="modal-head"><div><p className="eyebrow">NUEVO REGISTRO</p><h2>{isPayment?"Agregar pago":"Agregar movimiento"}</h2></div><button type="button" onClick={onClose}><X/></button></div><label>Fecha<input name="date" type="date" required defaultValue="2026-07-18"/></label><label>Detalle<input name="description" required placeholder="Ej. Supermercado"/></label><div className="form-row"><label>Categoría<select name="category"><option>Comida / supermercado</option><option>Familia</option><option>Vivienda y servicios</option><option>Transporte</option><option>Suscripciones</option></select></label><label>Cuenta<select name="account">{accounts.map(a=><option key={a.id}>{a.name}</option>)}</select></label></div><label>Importe<input name="amount" type="number" min="0" step="0.01" required placeholder="$ 0,00"/></label><button className="primary submit" type="submit">Guardar {isPayment?"pago":"movimiento"}</button></form></div>
}

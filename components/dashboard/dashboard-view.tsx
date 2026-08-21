"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, LoaderCircle, Plus, ReceiptText, WalletCards } from "lucide-react";
import { useHousehold } from "@/app/family-context";
import { loadDashboard, type DashboardData, type DashboardTransaction } from "@/features/dashboard/service";

const money = new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0});
const shortDate = (value: string) => new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short"}).format(new Date(`${value}T12:00:00`));

function currentMonthStart() {
  return `${new Date().toISOString().slice(0,7)}-01`;
}

export function DashboardView({setView,refreshKey=0}:{setView:(view:"Movimientos"|"Presupuesto"|"Pagos")=>void;refreshKey?:number}) {
  const household = useHousehold();
  const [data,setData] = useState<DashboardData | null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");

  useEffect(()=>{
    if (!household) return;
    setLoading(true);
    setError("");
    loadDashboard(household.id,currentMonthStart())
      .then(setData)
      .catch(err=>setError(err instanceof Error ? err.message : "No se pudo cargar el tablero."))
      .finally(()=>setLoading(false));
  },[household,refreshKey]);

  if (loading) return <div className="content empty-state"><LoaderCircle className="spin"/><p>Cargando tablero...</p></div>;
  if (error) return <div className="content"><p className="form-message error">{error}</p></div>;
  if (!data) return <div className="content empty-state"><p>No hay datos para mostrar.</p></div>;

  return <div className="content">
    <section className="welcome">
      <div><h2>Tu dinero, mas claro.</h2><p>Indicadores calculados desde los datos reales del hogar.</p></div>
      <div className="health"><span className="dot"/> SQL como fuente</div>
    </section>
    <section className="stat-grid">
      <Stat label="Disponible total" value={data.available} note="Saldos iniciales + movimientos" icon={<ArrowUpRight/>}/>
      <Stat label="Pagos pendientes" value={data.pending} note={`${data.pendingCount} compromisos`} warn icon={<ArrowDownRight/>}/>
      <Stat label="Disponible proyectado" value={data.projected} note="Despues de pagos pendientes" featured icon={<WalletCards/>}/>
    </section>
    <section className="two-col">
      <div className="card">
        <CardTitle title="Presupuesto del mes" action="Ver detalle" onClick={()=>setView("Presupuesto")}/>
        <div className="budget-total">
          <div><small>Gastado</small><strong>{money.format(data.budget.actual)}</strong></div>
          <div className="right"><small>de {money.format(data.budget.planned)}</small><strong>{data.budget.usedPercent}%</strong></div>
        </div>
        <div className="bar"><i style={{width:`${Math.min(100,data.budget.usedPercent)}%`}}/></div>
        <div className="budget-list">
          {data.budget.lines.slice(0,4).map((line,index)=><div key={line.category_id}><span className={`cat c${index}`}/><p>{line.category_name}<small>{money.format(line.actual_amount)} de {money.format(line.planned_amount)}</small></p><strong>{line.planned_amount === 0 ? 0 : Math.round(line.actual_amount/line.planned_amount*100)}%</strong></div>)}
        </div>
        {data.budget.lines.length === 0 && <div className="category-empty">Todavia no hay categorias de gasto.</div>}
      </div>
      <div className="card">
        <CardTitle title="Proximos pagos" action="Ver todos" onClick={()=>setView("Pagos")}/>
        <div className="payment-list">
          {data.payments.map(payment=><div key={payment.id}><time>{shortDate(payment.due_date)}</time><p>{payment.description}<small>{payment.account_name}</small></p><strong>{money.format(payment.amount)}</strong></div>)}
        </div>
        {data.payments.length === 0 && <div className="category-empty">No hay pagos pendientes.</div>}
        <button className="soft" onClick={()=>setView("Pagos")}><Plus size={17}/> Agregar pago</button>
      </div>
    </section>
    <section className="card recent">
      <CardTitle title="Ultimos movimientos" action="Ver todos" onClick={()=>setView("Movimientos")}/>
      {data.transactions.length === 0 ? <div className="category-empty">Todavia no hay movimientos.</div> : <TransactionTable items={data.transactions}/>}
    </section>
  </div>;
}

function Stat({label,value,note,icon,warn,featured}:{label:string;value:number;note:string;icon:React.ReactNode;warn?:boolean;featured?:boolean}) {
  return <div className={`stat ${featured?"featured":""}`}><div className={warn?"stat-icon warn":"stat-icon"}>{icon}</div><p>{label}</p><strong>{money.format(value)}</strong><small>{note}</small></div>;
}

function CardTitle({title,action,onClick}:{title:string;action:string;onClick:()=>void}) {
  return <div className="card-title"><h3>{title}</h3><button onClick={onClick}>{action}</button></div>;
}

function TransactionTable({items}:{items:DashboardTransaction[]}) {
  return <div className="table"><div className="tr head"><span>FECHA</span><span>DETALLE</span><span>CATEGORIA</span><span>CUENTA</span><span>IMPORTE</span></div>{items.map(item=><div className="tr" key={item.id}><span>{shortDate(item.transaction_date)}</span><strong>{item.description}</strong><span><i className="mini-dot"/>{item.category_name}</span><span>{item.account_name}</span><strong className={item.kind==="expense"?"negative":"positive"}>{item.kind==="expense"?"- ":"+ "}{money.format(item.amount)}</strong></div>)}</div>;
}

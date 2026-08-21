"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CircleDollarSign, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useHousehold } from "@/app/family-context";
import { EntryModal } from "@/components/transactions/entry-modal";
import { confirmPaymentOrder, deletePaymentOrder, listPaymentOrders, type DbPaymentOrder } from "@/features/payments/service";
import type { Payment, Transaction } from "@/lib/types";

const money = new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0});
const shortDate = (value: string) => new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short"}).format(new Date(`${value}T12:00:00`));

export function PaymentsView({refreshKey=0}:{refreshKey?:number}) {
  const household = useHousehold();
  const [items,setItems] = useState<DbPaymentOrder[]>([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState<string | null>(null);
  const [modal,setModal] = useState(false);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");

  async function reload() {
    if (!household) return;
    setLoading(true);
    setError("");
    try {
      setItems(await listPaymentOrders(household.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los pagos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{reload()},[household,refreshKey]);

  const pending = useMemo(()=>items.filter(item=>item.status==="pending"),[items]);
  const paid = useMemo(()=>items.filter(item=>item.status==="paid"),[items]);
  const pendingTotal = pending.reduce((total,item)=>total+item.amount,0);

  async function confirmPayment(item: DbPaymentOrder) {
    if (!window.confirm(`Confirmar pago de ${item.description} por ${money.format(item.amount)}?`)) return;
    setBusy(item.id);
    setError("");
    setMessage("");
    try {
      const transactionId = await confirmPaymentOrder(item.id, new Date().toISOString().slice(0,10));
      setItems(current=>current.map(payment=>payment.id===item.id ? {...payment,status:"paid",paid_at:new Date().toISOString(),paid_transaction_id:transactionId} : payment));
      setMessage("Pago confirmado y movimiento de gasto generado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo confirmar el pago.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(item: DbPaymentOrder) {
    if (!window.confirm(`Eliminar el pago pendiente ${item.description}?`)) return;
    setBusy(item.id);
    setError("");
    try {
      await deletePaymentOrder(item.id);
      setItems(current=>current.filter(payment=>payment.id!==item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Solo se pueden eliminar pagos pendientes.");
    } finally {
      setBusy(null);
    }
  }

  function onPayment(payment: Payment) {
    setItems(current=>[{
      id: payment.id,
      due_date: payment.due,
      description: payment.description,
      amount: payment.amount,
      status: payment.status,
      paid_at: null,
      paid_transaction_id: null,
      account_id: null,
      category_id: null,
      account_name: payment.account,
      category_name: payment.category,
    },...current]);
  }

  if (loading) return <div className="content empty-state"><LoaderCircle className="spin"/><p>Cargando pagos...</p></div>;

  return <div className="content">
    <div className="section-heading">
      <div><h2>Pagos programados</h2><p>Vencimientos, cuenta de origen y confirmacion con movimiento real.</p></div>
      <button className="primary" onClick={()=>setModal(true)}><Plus size={17}/> Nuevo pago</button>
    </div>
    {error && <p className="form-message error">{error}</p>}
    {message && <p className="form-message success">{message}</p>}
    <section className="stat-grid">
      <Stat label="Pendiente" value={pendingTotal} note={`${pending.length} compromisos`} icon={<CircleDollarSign/>}/>
      <Stat label="Confirmados" value={paid.reduce((total,item)=>total+item.amount,0)} note={`${paid.length} pagos`} icon={<Check/>}/>
      <Stat label="Proximo vencimiento" text={pending[0] ? shortDate(pending[0].due_date) : "-"} note={pending[0]?.description || "Sin pagos pendientes"} featured icon={<CircleDollarSign/>}/>
    </section>
    {items.length === 0 ? <div className="card empty-state"><CircleDollarSign/><h3>No hay pagos programados</h3><p>Agrega vencimientos para proyectar compromisos y confirmarlos al pagar.</p></div> :
      <section className="card">
        <div className="card-title"><h3>Ordenes de pago</h3><span>{pending.length} pendientes</span></div>
        <div className="payment-table payment-real">
          {items.map(item=><div key={item.id}>
            <button onClick={()=>item.status==="pending" ? confirmPayment(item) : undefined} disabled={item.status==="paid" || busy===item.id} className={item.status==="paid"?"check checked":"check"} aria-label={`Confirmar ${item.description}`}>{busy===item.id?<LoaderCircle className="spin"/>:item.status==="paid"?"✓":""}</button>
            <time>{shortDate(item.due_date)}</time>
            <p>{item.description}<small>{item.category_name} · {item.account_name}</small></p>
            <strong>{money.format(item.amount)}</strong>
            <span className={`pill ${item.status}`}>{item.status==="paid"?"Pagado":"Pendiente"}</span>
            <span className="row-actions">{item.status==="pending" && <button aria-label={`Eliminar ${item.description}`} onClick={()=>remove(item)} disabled={busy===item.id}><Trash2/></button>}</span>
          </div>)}
        </div>
      </section>}
    {modal && <EntryModal type="payment" onClose={()=>setModal(false)} onPayment={onPayment} onTransaction={(_:Transaction)=>{}}/>}
  </div>;
}

function Stat({label,value,text,note,icon,featured}:{label:string;value?:number;text?:string;note:string;icon:React.ReactNode;featured?:boolean}) {
  return <div className={`stat ${featured?"featured":""}`}><div className="stat-icon">{icon}</div><p>{label}</p><strong>{text || money.format(value || 0)}</strong><small>{note}</small></div>;
}

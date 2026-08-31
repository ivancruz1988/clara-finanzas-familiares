"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, Check, CircleDollarSign, LayoutList, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useHousehold } from "@/app/family-context";
import { EntryModal } from "@/components/transactions/entry-modal";
import { confirmPaymentOrder, deletePaymentOrder, listPaymentOrders, updatePaymentOrderDate, type DbPaymentOrder } from "@/features/payments/service";
import type { Payment, Transaction } from "@/lib/types";

const money = new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0});
const shortDate = (value: string) => new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short"}).format(new Date(`${value}T12:00:00`));
const longDay = (value: string) => new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"long"}).format(new Date(`${value}T12:00:00`));
const weekdays = ["Dom","Lun","Mar","Mie","Jue","Vie","Sab"];

type PaymentMode = "list" | "calendar";
type CalendarCell = { date: string; day: number; inMonth: boolean; payments: DbPaymentOrder[]; weekIndex: number };

function monthBounds(month: string) {
  const start = new Date(`${month}T12:00:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth()+1);
  return { start, end };
}

function isoDate(date: Date) {
  return date.toISOString().slice(0,10);
}

function buildCalendar(month: string, items: DbPaymentOrder[]) {
  const { start, end } = monthBounds(month);
  const first = new Date(start);
  first.setDate(first.getDate()-first.getDay());
  const last = new Date(end);
  last.setDate(last.getDate()+(6-last.getDay()));
  const byDate = new Map<string,DbPaymentOrder[]>();
  for (const item of items) {
    const bucket = byDate.get(item.due_date) || [];
    bucket.push(item);
    byDate.set(item.due_date,bucket);
  }
  const cells: CalendarCell[] = [];
  const cursor = new Date(first);
  while (cursor <= last) {
    const date = isoDate(cursor);
    cells.push({
      date,
      day: cursor.getDate(),
      inMonth: cursor.getMonth() === start.getMonth(),
      payments: byDate.get(date) || [],
      weekIndex: Math.floor(cells.length/7),
    });
    cursor.setDate(cursor.getDate()+1);
  }
  return cells;
}

function total(items: DbPaymentOrder[]) {
  return items.reduce((sum,item)=>sum+item.amount,0);
}

function compactMoney(value: number) {
  if (value >= 1000000) return `$${(value/1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value/1000)}k`;
  return money.format(value);
}

export function PaymentsView({month,refreshKey=0}:{month:string;refreshKey?:number}) {
  const household = useHousehold();
  const [items,setItems] = useState<DbPaymentOrder[]>([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState<string | null>(null);
  const [modal,setModal] = useState(false);
  const [mode,setMode] = useState<PaymentMode>("list");
  const [selectedDate,setSelectedDate] = useState(month);
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
  useEffect(()=>{setSelectedDate(month)},[month]);

  const selectedMonth = month.slice(0,7);
  const visibleItems = useMemo(()=>items.filter(item=>item.due_date.startsWith(selectedMonth)),[items,selectedMonth]);
  const pending = useMemo(()=>visibleItems.filter(item=>item.status==="pending"),[visibleItems]);
  const paid = useMemo(()=>visibleItems.filter(item=>item.status==="paid"),[visibleItems]);
  const pendingTotal = total(pending);
  const monthTotal = total(visibleItems);
  const calendarCells = useMemo(()=>buildCalendar(month,visibleItems),[month,visibleItems]);
  const selectedPayments = useMemo(()=>visibleItems.filter(item=>item.due_date===selectedDate),[visibleItems,selectedDate]);
  const weekTotals = useMemo(()=>{
    const rows = Array.from({length: Math.max(1,Math.ceil(calendarCells.length/7))},(_,index)=>({index,total:0,count:0}));
    for (const cell of calendarCells) {
      if (!cell.inMonth) continue;
      rows[cell.weekIndex].total += total(cell.payments);
      rows[cell.weekIndex].count += cell.payments.length;
    }
    return rows;
  },[calendarCells]);
  const heaviestWeek = weekTotals.reduce((max,row)=>row.total>max.total?row:max,weekTotals[0]);
  const maxWeekTotal = Math.max(1,...weekTotals.map(row=>row.total));

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

  async function changeDueDate(item: DbPaymentOrder, dueDate: string) {
    if (!dueDate || dueDate === item.due_date) return;
    setBusy(item.id);
    setError("");
    setMessage("");
    try {
      await updatePaymentOrderDate(item.id, dueDate);
      setItems(current=>current.map(payment=>payment.id===item.id ? {...payment,due_date:dueDate} : payment).sort((a,b)=>{
        if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
        return a.due_date.localeCompare(b.due_date);
      }));
      setSelectedDate(dueDate);
      setMessage("Fecha de pago actualizada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la fecha del pago.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmSelectedDay() {
    for (const item of selectedPayments.filter(payment=>payment.status==="pending")) {
      await confirmPayment(item);
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
    <div className="section-heading payments-heading">
      <div><h2>Pagos programados</h2><p>Vencimientos, cuenta de origen y confirmacion con movimiento real.</p></div>
      <div className="payments-heading-actions">
        <div className="segmented-control" aria-label="Vista de pagos">
          <button className={mode==="list"?"active":""} onClick={()=>setMode("list")}><LayoutList size={16}/> Lista</button>
          <button className={mode==="calendar"?"active":""} onClick={()=>setMode("calendar")}><CalendarDays size={16}/> Calendario</button>
        </div>
        <button className="primary" onClick={()=>setModal(true)}><Plus size={17}/> Nuevo pago</button>
      </div>
    </div>
    {error && <p className="form-message error">{error}</p>}
    {message && <p className="form-message success">{message}</p>}

    {mode === "list" ? <>
      <section className="stat-grid">
        <Stat label="Pendiente" value={pendingTotal} note={`${pending.length} compromisos`} icon={<CircleDollarSign/>}/>
        <Stat label="Confirmados" value={total(paid)} note={`${paid.length} pagos`} icon={<Check/>}/>
        <Stat label="Proximo vencimiento" text={pending[0] ? shortDate(pending[0].due_date) : "-"} note={pending[0]?.description || "Sin pagos pendientes"} featured icon={<CircleDollarSign/>}/>
      </section>
      <PaymentsList items={visibleItems} pendingCount={pending.length} busy={busy} onConfirm={confirmPayment} onDateChange={changeDueDate} onRemove={remove}/>
    </> : <>
      <section className="stat-grid">
        <Stat label="Total del mes" value={monthTotal} note={`${visibleItems.length} vencimientos`} icon={<CircleDollarSign/>}/>
        <Stat label="Semana mas pesada" value={heaviestWeek.total} note={`Semana ${heaviestWeek.index+1} · ${heaviestWeek.count} pagos`} icon={<BarChart3/>}/>
        <Stat label="Proximo vencimiento" text={pending[0] ? shortDate(pending[0].due_date) : "-"} note={pending[0]?.description || "Sin pagos pendientes"} featured icon={<CalendarDays/>}/>
      </section>
      {visibleItems.length === 0 ? <div className="card empty-state"><CircleDollarSign/><h3>No hay pagos programados</h3><p>Agrega vencimientos para proyectar compromisos y confirmarlos al pagar.</p></div> :
        <div className="payments-calendar-layout">
          <section className="card payments-calendar-card">
            <div className="calendar-weekdays">{weekdays.map(day=><span key={day}>{day}</span>)}</div>
            <div className="payments-calendar-grid">
              {calendarCells.map(cell=><button key={cell.date} className={`calendar-day ${cell.inMonth?"":"outside"} ${cell.payments.length?"has-events":""} ${cell.date===selectedDate?"selected":""} ${total(cell.payments)>=200000?"high-spend":""}`} onClick={()=>setSelectedDate(cell.date)}>
                <span className="calendar-day-number">{cell.day}</span>
                <div className="calendar-events">
                  {cell.payments.slice(0,3).map(payment=><span className={`calendar-chip ${payment.status}`} key={payment.id}><b>{payment.description}</b>{payment.amount>=50000&&<em>{compactMoney(payment.amount)}</em>}</span>)}
                  {cell.payments.length>3&&<span className="calendar-more">+{cell.payments.length-3} mas</span>}
                </div>
                {cell.payments.length>0&&<strong>{money.format(total(cell.payments))}</strong>}
              </button>)}
            </div>
          </section>
          <aside className="calendar-side">
            <section className="card day-detail-card">
              <div className="card-title"><h3>{longDay(selectedDate)}</h3><span>{selectedPayments.length} pagos</span></div>
              {selectedPayments.length === 0 ? <p className="category-empty">No hay vencimientos este dia.</p> : <>
                <div className="day-payments">
                  {selectedPayments.map(item=><div className="day-payment" key={item.id}>
                    <div><strong>{item.description}</strong><small>{item.category_name} · {item.account_name}</small><b>{money.format(item.amount)}</b></div>
                    <div className="row-actions">
                      {item.status==="pending"&&<label className="icon-date" title="Cambiar fecha"><CalendarDays/><input aria-label={`Cambiar fecha de ${item.description}`} type="date" value={item.due_date} disabled={busy===item.id} onChange={event=>changeDueDate(item,event.target.value)}/></label>}
                      {item.status==="pending"&&<button aria-label={`Confirmar ${item.description}`} disabled={busy===item.id} onClick={()=>confirmPayment(item)}>{busy===item.id?<LoaderCircle className="spin"/>:<Check/>}</button>}
                      {item.status==="pending"&&<button aria-label={`Eliminar ${item.description}`} disabled={busy===item.id} onClick={()=>remove(item)}><Trash2/></button>}
                    </div>
                  </div>)}
                </div>
                <div className="day-total"><span>Total del dia</span><strong>{money.format(total(selectedPayments))}</strong></div>
                {selectedPayments.some(item=>item.status==="pending")&&<button className="soft mark-day-paid" onClick={confirmSelectedDay}><Check size={16}/> Marcar pendientes del dia</button>}
              </>}
            </section>
            <section className="card week-totals-card">
              <div className="card-title"><h3>Totales por semana</h3><BarChart3 size={18}/></div>
              {weekTotals.map(row=><div className="week-total" key={row.index}>
                <div><span>Semana {row.index+1}</span><strong>{money.format(row.total)}</strong></div>
                <i><b style={{width:`${Math.round(row.total/maxWeekTotal*100)}%`}}/></i>
              </div>)}
            </section>
          </aside>
        </div>}
    </>}
    {modal && <EntryModal type="payment" onClose={()=>setModal(false)} onPayment={onPayment} onTransaction={(_:Transaction)=>{}}/>}
  </div>;
}

function PaymentsList({items,pendingCount,busy,onConfirm,onDateChange,onRemove}:{items:DbPaymentOrder[];pendingCount:number;busy:string|null;onConfirm:(item:DbPaymentOrder)=>void;onDateChange:(item:DbPaymentOrder,date:string)=>void;onRemove:(item:DbPaymentOrder)=>void}) {
  if (items.length === 0) return <div className="card empty-state"><CircleDollarSign/><h3>No hay pagos programados</h3><p>Agrega vencimientos para proyectar compromisos y confirmarlos al pagar.</p></div>;
  return <section className="card">
    <div className="card-title"><h3>Ordenes de pago</h3><span>{pendingCount} pendientes</span></div>
    <div className="payment-table payment-real">
      {items.map(item=><div key={item.id}>
        <button onClick={()=>item.status==="pending" ? onConfirm(item) : undefined} disabled={item.status==="paid" || busy===item.id} className={item.status==="paid"?"check checked":"check"} aria-label={`Confirmar ${item.description}`}>{busy===item.id?<LoaderCircle className="spin"/>:item.status==="paid"?"✓":""}</button>
        {item.status==="pending" ? <label className="payment-date"><span>{shortDate(item.due_date)}</span><input aria-label={`Cambiar fecha de ${item.description}`} type="date" value={item.due_date} disabled={busy===item.id} onChange={event=>onDateChange(item,event.target.value)}/></label> : <time>{shortDate(item.due_date)}</time>}
        <p>{item.description}<small>{item.category_name} · {item.account_name}</small></p>
        <strong>{money.format(item.amount)}</strong>
        <span className={`pill ${item.status}`}>{item.status==="paid"?"Pagado":"Pendiente"}</span>
        <span className="row-actions">{item.status==="pending" && <button aria-label={`Eliminar ${item.description}`} onClick={()=>onRemove(item)} disabled={busy===item.id}><Trash2/></button>}</span>
      </div>)}
    </div>
  </section>;
}

function Stat({label,value,text,note,icon,featured}:{label:string;value?:number;text?:string;note:string;icon:React.ReactNode;featured?:boolean}) {
  return <div className={`stat ${featured?"featured":""}`}><div className="stat-icon">{icon}</div><p>{label}</p><strong>{text || money.format(value || 0)}</strong><small>{note}</small></div>;
}

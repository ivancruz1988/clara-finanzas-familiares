"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Copy, LoaderCircle, Save, Target, WalletCards, ReceiptText } from "lucide-react";
import { useHousehold } from "@/app/family-context";
import { copyMonthlyBudget, listMonthlyBudget, saveMonthlyBudget, type BudgetRow } from "@/features/budgets/service";
import { calculateBudgetRemaining, calculateBudgetTotals } from "@/lib/finance";

const money = new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0});

function monthStart(value: string) {
  return `${value}-01`;
}

function previousMonth(value: string) {
  const date = new Date(`${monthStart(value)}T12:00:00`);
  date.setMonth(date.getMonth()-1);
  return date.toISOString().slice(0,7);
}

function currentMonth() {
  return new Date().toISOString().slice(0,7);
}

export function BudgetView() {
  const household = useHousehold();
  const [month,setMonth] = useState(currentMonth());
  const [rows,setRows] = useState<BudgetRow[]>([]);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState<string | null>(null);
  const [copying,setCopying] = useState(false);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");

  async function reload() {
    if (!household) return;
    setLoading(true);
    setError("");
    try {
      setRows(await listMonthlyBudget(household.id, monthStart(month)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el presupuesto.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{reload()},[household,month]);

  const totals = useMemo(()=>calculateBudgetTotals(rows.map(row=>({
    categoryId: row.category_id,
    plannedAmount: row.planned_amount,
    actualAmount: row.actual_amount,
  }))),[rows]);

  async function saveRow(event: FormEvent<HTMLFormElement>, row: BudgetRow) {
    event.preventDefault();
    if (!household) return;
    const plannedAmount = Number(new FormData(event.currentTarget).get("planned"));
    setSaving(row.category_id);
    setError("");
    setMessage("");
    try {
      const saved = await saveMonthlyBudget({ householdId: household.id, categoryId: row.category_id, month: monthStart(month), plannedAmount });
      setRows(items=>items.map(item=>item.category_id===row.category_id ? {...item,id:saved.id,planned_amount:saved.planned_amount} : item));
      setMessage("Presupuesto guardado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el presupuesto.");
    } finally {
      setSaving(null);
    }
  }

  async function copyPrevious() {
    if (!household) return;
    setCopying(true);
    setError("");
    setMessage("");
    try {
      const count = await copyMonthlyBudget({ householdId: household.id, sourceMonth: monthStart(previousMonth(month)), targetMonth: monthStart(month) });
      setMessage(count === 0 ? "No habia presupuesto en el mes anterior." : `Se copiaron ${count} categorias.`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo copiar el presupuesto.");
    } finally {
      setCopying(false);
    }
  }

  if (loading) return <div className="content empty-state"><LoaderCircle className="spin"/><p>Cargando presupuesto...</p></div>;

  return <div className="content">
    <div className="section-heading">
      <div><h2>Presupuesto mensual</h2><p>Plan por categoria y comparacion contra gastos reales.</p></div>
      <div className="heading-actions">
        <input className="month-picker" type="month" value={month} onChange={event=>setMonth(event.target.value)} />
        <button className="soft compact" onClick={copyPrevious} disabled={copying}><Copy size={17}/> Copiar mes anterior</button>
      </div>
    </div>
    {error && <p className="form-message error">{error}</p>}
    {message && <p className="form-message success">{message}</p>}
    <section className="stat-grid">
      <Stat label="Plan mensual" value={totals.planned} note={`${rows.length} categorias`} icon={<Target/>}/>
      <Stat label="Gasto real" value={totals.actual} note={`${totals.usedPercent}% utilizado`} icon={<ReceiptText/>}/>
      <Stat label="Restante" value={totals.remaining} note="Plan menos gasto real" featured icon={<WalletCards/>}/>
    </section>
    {rows.length === 0 ? <div className="card empty-state"><Target/><h3>No hay categorias de gasto</h3><p>Crea categorias de gasto para armar el presupuesto mensual.</p></div> :
      <section className="card">
        <div className="card-title"><h3>Plan vs. real por categoria</h3><span>{month}</span></div>
        <div className="budget-real-table">
          <div className="budget-real-row head"><span>Categoria</span><span>Plan</span><span>Real</span><span>Restante</span><span/></div>
          {rows.map((row,index)=>{
            const remaining = calculateBudgetRemaining({plannedAmount:row.planned_amount,actualAmount:row.actual_amount});
            const percent = row.planned_amount === 0 ? 0 : Math.min(100, Math.round((row.actual_amount/row.planned_amount)*100));
            return <form className="budget-real-row" onSubmit={event=>saveRow(event,row)} key={row.category_id}>
              <div className="budget-category"><span className={`cat c${index%5}`}/><strong>{row.category_name}</strong></div>
              <input name="planned" type="number" min="0" step="0.01" defaultValue={row.planned_amount}/>
              <div><strong>{money.format(row.actual_amount)}</strong><div className="bar"><i style={{width:`${percent}%`}}/></div></div>
              <strong className={remaining < 0 ? "negative" : ""}>{money.format(remaining)}</strong>
              <button className="soft compact" disabled={saving===row.category_id}>{saving===row.category_id?<LoaderCircle className="spin"/>:<Save size={15}/>}</button>
            </form>;
          })}
        </div>
      </section>}
  </div>;
}

function Stat({label,value,note,icon,featured}:{label:string;value:number;note:string;icon:React.ReactNode;featured?:boolean}) {
  return <div className={`stat ${featured?"featured":""}`}><div className="stat-icon">{icon}</div><p>{label}</p><strong>{money.format(value)}</strong><small>{note}</small></div>;
}

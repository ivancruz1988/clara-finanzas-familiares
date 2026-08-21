"use client";

import { FormEvent, useState } from "react";
import { Bot, LoaderCircle, MessageCircle, ReceiptText, Send, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Mode = "question" | "ticket";
type Message = { role:"user"|"assistant"; text:string };

async function askAssistant(message: string) {
  if (!supabase) throw new Error("Supabase no esta configurado.");
  const { data,error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Necesitas iniciar sesion.");
  const response = await fetch("/api/assistant",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":`Bearer ${data.session.access_token}`,
    },
    body:JSON.stringify({message,locale:"es-AR",timezone:"America/Buenos_Aires"}),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "No se pudo consultar al asistente.");
  if (payload) return String(payload.answer || "Sin respuesta.");
  const filterLine = payload.filters?.period
    ? `\n\nDetectado: ${payload.intent || "unknown"} · ${payload.filters.period.label} (${payload.filters.period.from} a ${payload.filters.period.to})`
    : "";
  return `${String(payload.answer || "Sin respuesta.")}${filterLine}`;
}

export function AssistantWidget() {
  const [open,setOpen] = useState(false);
  const [mode,setMode] = useState<Mode>("question");
  const [messages,setMessages] = useState<Message[]>([
    {role:"assistant",text:"Puedo ayudarte a consultar tus finanzas o preparar la carga de un ticket."},
  ]);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = new FormData(form);
    const text = String(input.get("message")).trim();
    if (!text) return;
    form.reset();
    const prompt = mode === "ticket"
      ? `Quiero cargar este ticket o comprobante. Extrae fecha, comercio, categoria sugerida, importe y cuenta si aparecen. No confirmes escrituras todavia: ${text}`
      : text;
    setMessages(current=>[...current,{role:"user",text}]);
    setBusy(true);
    setError("");
    try {
      const answer = await askAssistant(prompt);
      setMessages(current=>[...current,{role:"assistant",text:answer}]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo consultar al asistente.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button className="ai-fab" onClick={()=>setOpen(true)} aria-label="Abrir asistente financiero"><Bot size={22}/><span>IA</span></button>
    {open && <div className="ai-panel" role="dialog" aria-label="Asistente financiero">
      <div className="ai-head">
        <div><p className="eyebrow">ASISTENTE</p><h2>Clara IA</h2></div>
        <button onClick={()=>setOpen(false)} aria-label="Cerrar asistente"><X/></button>
      </div>
      <div className="ai-tabs">
        <button className={mode==="question"?"active":""} onClick={()=>setMode("question")}><MessageCircle size={15}/> Consulta</button>
        <button className={mode==="ticket"?"active":""} onClick={()=>setMode("ticket")}><ReceiptText size={15}/> Ticket</button>
      </div>
      <div className="ai-thread">
        {messages.map((message,index)=><div className={`ai-message ${message.role}`} key={index}>{message.text}</div>)}
        {busy && <div className="ai-message assistant"><LoaderCircle className="spin"/> Pensando...</div>}
      </div>
      {error && <p className="form-message error">{error}</p>}
      <form className="ai-compose" onSubmit={submit}>
        <textarea name="message" rows={3} placeholder={mode==="ticket"?"Pega el detalle del ticket o comprobante":"Preguntame por saldos, pagos o presupuesto"} />
        <button className="primary" disabled={busy}><Send size={16}/></button>
      </form>
    </div>}
  </>;
}

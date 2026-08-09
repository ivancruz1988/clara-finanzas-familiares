"use client";

import type { Session, User } from "@supabase/supabase-js";
import { ArrowRight, Check, Eye, EyeOff, LoaderCircle, LogOut, ShieldCheck, Sparkles, Users } from "lucide-react";
import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Household = { id: string; name: string };
type Mode = "signin" | "signup";

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [household, setHousehold] = useState<Household | null | undefined>(undefined);
  const [error, setError] = useState("");

  const loadHousehold = useCallback(async (user: User) => {
    if (!supabase) return;
    setHousehold(undefined);
    const { data, error: queryError } = await supabase
      .from("households")
      .select("id, name")
      .eq("created_by", user.id)
      .limit(1)
      .maybeSingle();

    if (queryError) {
      setError("No pudimos cargar tu hogar. Probá actualizar la página.");
      setHousehold(null);
      return;
    }
    setHousehold(data);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadHousehold(data.session.user);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) loadHousehold(nextSession.user);
      else setHousehold(undefined);
    });
    return () => listener.subscription.unsubscribe();
  }, [loadHousehold]);

  if (!isSupabaseConfigured) return children;
  if (session === undefined) return <LoadingScreen />;
  if (!session) return <AuthScreen onSuccess={() => setError("")} />;
  if (household === undefined) return <LoadingScreen label="Preparando tu espacio familiar…" />;
  if (!household) return <HouseholdSetup user={session.user} error={error} onCreated={setHousehold} />;

  return (
    <>
      <div className="session-strip">
        <span><ShieldCheck size={15} /> {household.name}</span>
        <span className="session-email">{session.user.email}</span>
        <button onClick={() => supabase?.auth.signOut()}><LogOut size={14} /> Salir</button>
      </div>
      {children}
    </>
  );
}

function LoadingScreen({ label = "Abriendo Clara…" }: { label?: string }) {
  return <main className="auth-page"><div className="auth-loading"><div className="auth-mark">c</div><LoaderCircle className="spin" /><p>{label}</p></div></main>;
}

function AuthScreen({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email")).trim();
    const password = String(values.get("password"));
    setBusy(true); setError(""); setNotice("");

    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    setBusy(false);
    if (result.error) {
      setError(result.error.message === "Invalid login credentials"
        ? "Email o contraseña incorrectos."
        : result.error.message);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setNotice("Revisá tu email para confirmar la cuenta y después iniciá sesión.");
    } else onSuccess();
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-brand"><span>c</span><strong>clara</strong></div>
        <div><p className="eyebrow">FINANZAS FAMILIARES</p><h1>Tu dinero.<br/><em>Una sola mirada.</em></h1><p>Presupuesto, cuentas y próximos pagos compartidos con tu familia.</p></div>
        <ul><li><Check /> Datos protegidos por hogar</li><li><Check /> Disponible proyectado automático</li><li><Check /> Acceso desde cualquier dispositivo</li></ul>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card-icon"><Sparkles /></div>
          <p className="eyebrow">BIENVENIDO A CLARA</p>
          <h2>{mode === "signin" ? "Ingresá a tu cuenta" : "Creá tu cuenta"}</h2>
          <p className="auth-subtitle">{mode === "signin" ? "Continuá donde dejaste tus finanzas." : "Empezá a ordenar las finanzas de tu hogar."}</p>
          <form onSubmit={submit}>
            <label>Email<input name="email" type="email" autoComplete="email" required placeholder="tu@email.com" /></label>
            <label>Contraseña<div className="password-field"><input name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={6} required placeholder="Mínimo 6 caracteres"/><button type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setShowPassword(x => !x)}>{showPassword ? <EyeOff/> : <Eye/>}</button></div></label>
            {error && <p className="form-message error">{error}</p>}
            {notice && <p className="form-message success">{notice}</p>}
            <button className="primary auth-submit" disabled={busy}>{busy ? <LoaderCircle className="spin"/> : <>{mode === "signin" ? "Ingresar" : "Crear cuenta"}<ArrowRight/></>}</button>
          </form>
          <button className="auth-switch" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setNotice(""); }}>{mode === "signin" ? "¿No tenés cuenta? Crear una" : "Ya tengo cuenta · Ingresar"}</button>
        </div>
      </section>
    </main>
  );
}

function HouseholdSetup({ user, error, onCreated }: { user: User; error: string; onCreated: (household: Household) => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(error);

  async function createHousehold(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const name = String(new FormData(event.currentTarget).get("name")).trim();
    setBusy(true); setMessage("");
    const { data, error: insertError } = await supabase
      .from("households")
      .insert({ name, created_by: user.id })
      .select("id, name")
      .single();
    setBusy(false);
    if (insertError) setMessage("No pudimos crear el hogar. Intentá nuevamente.");
    else onCreated(data);
  }

  return <main className="auth-page setup-page"><section className="setup-card"><div className="auth-card-icon"><Users/></div><p className="eyebrow">PRIMER PASO</p><h1>Creá tu espacio familiar</h1><p>Este nombre identifica el presupuesto compartido. Después podrás invitar a otros miembros.</p><form onSubmit={createHousehold}><label>Nombre del hogar<input name="name" required maxLength={60} defaultValue="Familia Cruz" /></label>{message && <p className="form-message error">{message}</p>}<button className="primary auth-submit" disabled={busy}>{busy ? <LoaderCircle className="spin"/> : <>Crear hogar<ArrowRight/></>}</button></form><button className="auth-switch" onClick={() => supabase?.auth.signOut()}>Usar otra cuenta</button></section></main>;
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type PaymentRow = {
  id: string;
  household_id: string;
  due_date: string;
  description: string;
  amount: number | string;
  payment_method: string | null;
  accounts: { name: string }[] | { name: string } | null;
  categories: { name: string }[] | { name: string } | null;
};

type HouseholdMemberRow = {
  household_id: string;
  user_id: string;
  households: { name: string }[] | { name: string } | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
};

type ReminderRow = {
  payment_order_id: string;
  user_id: string;
};

const TIME_ZONE = "America/Argentina/Buenos_Aires";
const CURRENCY_FORMATTER = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta configurar ${name}`);
  return value;
}

function todayInBuenosAires(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function getAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMoney(value: number | string) {
  return CURRENCY_FORMATTER.format(Number(value));
}

function relationName(relation: { name: string }[] | { name: string } | null | undefined, fallback: string) {
  if (Array.isArray(relation)) return relation[0]?.name || fallback;
  return relation?.name || fallback;
}

function buildEmailHtml(input: {
  householdName: string;
  payments: PaymentRow[];
  total: number;
  url: string;
}) {
  const rows = input.payments
    .map((payment) => {
      const accountName = relationName(payment.accounts, "Sin cuenta");
      const categoryName = relationName(payment.categories, "Sin categoria");
      const method = payment.payment_method ? ` - ${payment.payment_method}` : "";
      return `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid rgba(190,255,226,0.14);">
            <div style="font-size:16px;font-weight:800;color:#f4fff9;line-height:1.25;">${escapeHtml(payment.description)}</div>
            <div style="margin-top:4px;font-size:13px;color:#a8d8c5;line-height:1.45;">${escapeHtml(categoryName)} - ${escapeHtml(accountName)}${escapeHtml(method)}</div>
          </td>
          <td align="right" style="padding:14px 0;border-bottom:1px solid rgba(190,255,226,0.14);font-size:16px;font-weight:900;color:#ffffff;white-space:nowrap;">${formatMoney(payment.amount)}</td>
        </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Recordatorio de pagos</title>
  </head>
  <body style="margin:0;background:#04140d;font-family:Arial,Helvetica,sans-serif;color:#f4fff9;">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;">Tenes pagos que vencen hoy en Clara.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#04140d;padding:28px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#092418;border:1px solid rgba(74,222,128,0.28);border-radius:22px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.28);">
            <tr>
              <td style="padding:26px 28px 22px;background:#0f6b45;">
                <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:900;color:#6effb7;">Clara Finanzas Familiares</div>
                <h1 style="margin:14px 0 8px;font-size:30px;line-height:1.08;color:#ffffff;">Vencen pagos hoy</h1>
                <p style="margin:0;font-size:15px;line-height:1.5;color:#d7fbe9;">${escapeHtml(input.householdName)} tiene ${input.payments.length} ${input.payments.length === 1 ? "compromiso" : "compromisos"} para revisar.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:18px;background:#0d3323;border:1px solid rgba(190,255,226,0.16);border-radius:16px;">
                  <tr>
                    <td style="padding:18px 20px;color:#a8d8c5;font-size:13px;">Total a pagar hoy</td>
                    <td align="right" style="padding:18px 20px;color:#ffffff;font-size:24px;font-weight:900;white-space:nowrap;">${formatMoney(input.total)}</td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table>
                <div style="padding-top:24px;">
                  <a href="${escapeHtml(input.url)}" style="display:inline-block;background:#20e68a;color:#02130c;text-decoration:none;font-size:15px;font-weight:900;padding:14px 18px;border-radius:12px;">Abrir Clara</a>
                </div>
                <p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:#7fb69e;">Este recordatorio se envia automaticamente el dia del vencimiento. Si ya pagaste, marcala como pagada en Clara para mantener el tablero al dia.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendEmail(input: { to: string; subject: string; html: string }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getRequiredEnv("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getRequiredEnv("REMINDER_FROM_EMAIL"),
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Resend rechazo el email (${response.status}): ${details}`);
  }
}

export async function GET(request: NextRequest) {
  const expectedSecret = getRequiredEnv("CRON_SECRET");
  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const supabase = createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const reminderDate = todayInBuenosAires();
  const { data: payments, error: paymentsError } = await supabase
    .from("payment_orders")
    .select("id,household_id,due_date,description,amount,payment_method,accounts(name),categories(name)")
    .eq("status", "pending")
    .eq("due_date", reminderDate)
    .order("due_date", { ascending: true });

  if (paymentsError) throw paymentsError;
  const duePayments = (payments || []) as unknown as PaymentRow[];
  if (duePayments.length === 0) {
    return NextResponse.json({ ok: true, reminderDate, emails: 0, payments: 0 });
  }

  const householdIds = [...new Set(duePayments.map((payment) => payment.household_id))];
  const paymentIds = duePayments.map((payment) => payment.id);

  const { data: members, error: membersError } = await supabase
    .from("household_members")
    .select("household_id,user_id,households(name)")
    .in("household_id", householdIds);
  if (membersError) throw membersError;

  const householdMembers = (members || []) as unknown as HouseholdMemberRow[];
  const userIds = [...new Set(householdMembers.map((member) => member.user_id))];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id,email")
    .in("id", userIds);
  if (profilesError) throw profilesError;

  const { data: alreadySent, error: remindersError } = await supabase
    .from("payment_reminders")
    .select("payment_order_id,user_id")
    .eq("reminder_date", reminderDate)
    .in("payment_order_id", paymentIds);
  if (remindersError) throw remindersError;

  const emailByUserId = new Map((profiles || []).map((profile) => [(profile as ProfileRow).id, (profile as ProfileRow).email]));
  const sentKeys = new Set((alreadySent || []).map((reminder) => {
    const row = reminder as ReminderRow;
    return `${row.payment_order_id}:${row.user_id}`;
  }));
  const paymentsByHousehold = new Map<string, PaymentRow[]>();
  for (const payment of duePayments) {
    paymentsByHousehold.set(payment.household_id, [...(paymentsByHousehold.get(payment.household_id) || []), payment]);
  }

  let emails = 0;
  let reminderRows = 0;
  const errors: string[] = [];

  for (const member of householdMembers) {
    const email = emailByUserId.get(member.user_id);
    if (!email) continue;

    const memberPayments = (paymentsByHousehold.get(member.household_id) || []).filter(
      (payment) => !sentKeys.has(`${payment.id}:${member.user_id}`),
    );
    if (memberPayments.length === 0) continue;

    const total = memberPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const householdName = relationName(member.households, "Tu hogar");

    try {
      await sendEmail({
        to: email,
        subject: `Clara: ${memberPayments.length} ${memberPayments.length === 1 ? "pago vence" : "pagos vencen"} hoy`,
        html: buildEmailHtml({ householdName, payments: memberPayments, total, url: getAppUrl() }),
      });

      const rowsToInsert = memberPayments.map((payment) => ({
        household_id: payment.household_id,
        payment_order_id: payment.id,
        user_id: member.user_id,
        reminder_date: reminderDate,
      }));
      const { error: insertError } = await supabase.from("payment_reminders").insert(rowsToInsert);
      if (insertError) throw insertError;
      emails += 1;
      reminderRows += rowsToInsert.length;
    } catch (error) {
      errors.push(`${email}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const ok = errors.length === 0;
  return NextResponse.json(
    { ok, reminderDate, emails, payments: duePayments.length, reminderRows, errors },
    { status: ok ? 200 : 207 },
  );
}



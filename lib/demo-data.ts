import { Account, Budget, Payment, Transaction } from "./types";

export const accounts: Account[] = [
  { id: "cash", name: "Efectivo", kind: "cash", balance: 44900, color: "#17a673" },
  { id: "uala", name: "Ualá", kind: "bank", balance: 8120.81, color: "#7357ff" },
  { id: "mp", name: "Mercado Pago", kind: "bank", balance: 73455.93, color: "#168ed4" },
  { id: "icbc", name: "ICBC", kind: "bank", balance: 0, color: "#ef4444" },
  { id: "personal", name: "Personal Pay", kind: "bank", balance: 0.48, color: "#f59e0b" }
];

export const payments: Payment[] = [
  { id: "p1", due: "2026-07-23", description: "EDESUR", category: "Servicios", account: "Ualá", amount: 27924.74, status: "pending" },
  { id: "p2", due: "2026-07-20", description: "Microsoft 365", category: "Suscripciones", account: "Personal Pay", amount: 4550, status: "pending" },
  { id: "p3", due: "2026-07-14", description: "Metrogas", category: "Servicios", account: "Ualá", amount: 62518.92, status: "paid" }
];

export const transactions: Transaction[] = [
  { id: "t1", date: "2026-07-17", description: "Remis y medicina", category: "Familia", account: "Mercado Pago", amount: 70000 },
  { id: "t2", date: "2026-07-16", description: "Facultad y trabajo", category: "Comida / supermercado", account: "Efectivo", amount: 9100 },
  { id: "t3", date: "2026-07-16", description: "Efectivo", category: "Transporte / SUBE", account: "Mercado Pago", amount: 6300 },
  { id: "t4", date: "2026-07-14", description: "Carrefour", category: "Comida / supermercado", account: "Efectivo", amount: 157776 },
  { id: "t5", date: "2026-07-14", description: "Metrogas", category: "Servicios", account: "Mercado Pago", amount: 62518.92 }
];

export const budgets: Budget[] = [
  { category: "Vivienda y servicios", planned: 510000, actual: 438700 },
  { category: "Comida / supermercado", planned: 800000, actual: 247976 },
  { category: "Familia", planned: 200000, actual: 98400 },
  { category: "Transporte", planned: 150000, actual: 42997 },
  { category: "Suscripciones", planned: 120000, actual: 80622 }
];

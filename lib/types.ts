export type Account = { id: string; name: string; kind: "cash" | "bank"; balance: number; color: string };
export type Transaction = { id: string; date: string; description: string; category: string; account: string; amount: number };
export type Payment = { id: string; due: string; description: string; category: string; account: string; amount: number; status: "pending" | "paid" };
export type Budget = { category: string; planned: number; actual: number };

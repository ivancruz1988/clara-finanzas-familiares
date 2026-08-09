import { supabase } from "@/lib/supabase";
import type { DbAccount, DbCategory } from "@/features/accounts/types";

function client() {
  if (!supabase) throw new Error("Supabase no está configurado.");
  return supabase;
}

export async function loadEntryOptions(householdId: string) {
  const [accounts, categories] = await Promise.all([
    client().from("accounts").select("id,name,kind,opening_balance,color").eq("household_id", householdId).order("name"),
    client().from("categories").select("id,name,kind").eq("household_id", householdId).order("name"),
  ]);
  if (accounts.error) throw accounts.error;
  if (categories.error) throw categories.error;
  return { accounts: (accounts.data || []) as DbAccount[], categories: (categories.data || []) as DbCategory[] };
}

export async function createTransaction(input: { householdId:string; accountId:string; categoryId:string; date:string; description:string; amount:number; kind:"income"|"expense" }) {
  const { data, error } = await client().from("transactions").insert({ household_id:input.householdId, account_id:input.accountId, category_id:input.categoryId, transaction_date:input.date, description:input.description, amount:input.amount, kind:input.kind }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function createPayment(input: { householdId:string; accountId:string; categoryId:string; date:string; description:string; amount:number }) {
  const { data, error } = await client().from("payment_orders").insert({ household_id:input.householdId, account_id:input.accountId, category_id:input.categoryId, due_date:input.date, description:input.description, amount:input.amount, status:"pending" }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

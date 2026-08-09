import { supabase } from "@/lib/supabase";
import type { AccountInput, CategoryInput, DbAccount, DbCategory } from "./types";

function client() {
  if (!supabase) throw new Error("Supabase no está configurado.");
  return supabase;
}

export async function listAccounts(householdId: string) {
  const { data, error } = await client().from("accounts").select("id,name,kind,opening_balance,color").eq("household_id", householdId).order("created_at");
  if (error) throw error;
  return (data || []) as DbAccount[];
}

export async function saveAccount(values: AccountInput, id?: string) {
  const query = id ? client().from("accounts").update(values).eq("id", id) : client().from("accounts").insert(values);
  const { data, error } = await query.select("id,name,kind,opening_balance,color").single();
  if (error) throw error;
  return data as DbAccount;
}

export async function deleteAccount(id: string) {
  const { error } = await client().from("accounts").delete().eq("id", id);
  if (error) throw error;
}

export async function listCategories(householdId: string) {
  const { data, error } = await client().from("categories").select("id,name,kind").eq("household_id", householdId).order("kind").order("name");
  if (error) throw error;
  return (data || []) as DbCategory[];
}

export async function saveCategory(values: CategoryInput, id?: string) {
  const query = id ? client().from("categories").update(values).eq("id", id) : client().from("categories").insert(values);
  const { data, error } = await query.select("id,name,kind").single();
  if (error) throw error;
  return data as DbCategory;
}

export async function deleteCategory(id: string) {
  const { error } = await client().from("categories").delete().eq("id", id);
  if (error) throw error;
}

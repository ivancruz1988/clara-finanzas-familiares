import { supabase } from "@/lib/supabase";
import type { DbAccount, DbCategory } from "@/features/accounts/types";

function client() {
  if (!supabase) throw new Error("Supabase no está configurado.");
  return supabase;
}

export type DbTransaction = {
  id:string; transaction_date:string; description:string; amount:number;
  kind:"income"|"expense"; account_id:string; category_id:string;
  account_name:string; category_name:string;
};

export async function listTransactions(householdId:string) {
  const { data,error }=await client().from("transactions").select("id,transaction_date,description,amount,kind,account_id,category_id,accounts(name),categories(name)").eq("household_id",householdId).order("transaction_date",{ascending:false}).order("created_at",{ascending:false});
  if(error)throw error;
  return (data||[]).map(item=>{const account=item.accounts as unknown as {name:string}|null;const category=item.categories as unknown as {name:string}|null;return {id:item.id,transaction_date:item.transaction_date,description:item.description,amount:Number(item.amount),kind:item.kind,account_id:item.account_id,category_id:item.category_id,account_name:account?.name||"Sin cuenta",category_name:category?.name||"Sin categoría"} as DbTransaction});
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

export async function updateTransaction(id:string,input:{accountId:string;categoryId:string;date:string;description:string;amount:number;kind:"income"|"expense"}){
  const {error}=await client().from("transactions").update({account_id:input.accountId,category_id:input.categoryId,transaction_date:input.date,description:input.description,amount:input.amount,kind:input.kind}).eq("id",id);
  if(error)throw error;
}

export async function deleteTransaction(id:string){const {error}=await client().from("transactions").delete().eq("id",id);if(error)throw error;}

export async function createPayment(input: { householdId:string; accountId:string; categoryId:string; date:string; description:string; amount:number }) {
  const { data, error } = await client().from("payment_orders").insert({ household_id:input.householdId, account_id:input.accountId, category_id:input.categoryId, due_date:input.date, description:input.description, amount:input.amount, status:"pending" }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

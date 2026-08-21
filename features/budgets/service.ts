import { supabase } from "@/lib/supabase";
import type { DbCategory } from "@/features/accounts/types";

function client() {
  if (!supabase) throw new Error("Supabase no esta configurado.");
  return supabase;
}

export type BudgetRow = {
  id: string | null;
  category_id: string;
  category_name: string;
  planned_amount: number;
  actual_amount: number;
};

function nextMonth(month: string) {
  const date = new Date(`${month}T12:00:00`);
  date.setMonth(date.getMonth()+1);
  return date.toISOString().slice(0,10);
}

export async function listMonthlyBudget(householdId: string, month: string) {
  const api = client();
  const [categories,budgets,transactions] = await Promise.all([
    api.from("categories").select("id,name,kind").eq("household_id",householdId).eq("kind","expense").order("name"),
    api.from("monthly_budgets").select("id,category_id,planned_amount").eq("household_id",householdId).eq("month",month),
    api.from("transactions").select("category_id,amount").eq("household_id",householdId).eq("kind","expense").gte("transaction_date",month).lt("transaction_date",nextMonth(month)),
  ]);

  if (categories.error) throw categories.error;
  if (budgets.error) throw budgets.error;
  if (transactions.error) throw transactions.error;

  const budgetByCategory = new Map((budgets.data || []).map(item=>[item.category_id as string,item]));
  const actualByCategory = new Map<string,number>();
  for (const item of transactions.data || []) {
    if (!item.category_id) continue;
    actualByCategory.set(item.category_id, (actualByCategory.get(item.category_id) || 0) + Number(item.amount));
  }

  return ((categories.data || []) as DbCategory[]).map(category=>{
    const budget = budgetByCategory.get(category.id);
    return {
      id: budget?.id || null,
      category_id: category.id,
      category_name: category.name,
      planned_amount: Number(budget?.planned_amount || 0),
      actual_amount: actualByCategory.get(category.id) || 0,
    } satisfies BudgetRow;
  });
}

export async function saveMonthlyBudget(input: { householdId:string; categoryId:string; month:string; plannedAmount:number }) {
  const { data,error } = await client().from("monthly_budgets").upsert({
    household_id: input.householdId,
    category_id: input.categoryId,
    month: input.month,
    planned_amount: input.plannedAmount,
  }, { onConflict: "household_id,category_id,month" }).select("id,category_id,planned_amount").single();
  if (error) throw error;
  return { id:data.id as string, category_id:data.category_id as string, planned_amount:Number(data.planned_amount) };
}

export async function copyMonthlyBudget(input: { householdId:string; sourceMonth:string; targetMonth:string }) {
  const { data,error } = await client().from("monthly_budgets").select("category_id,planned_amount,inflation_rate").eq("household_id",input.householdId).eq("month",input.sourceMonth);
  if (error) throw error;
  const rows = (data || []).map(item=>({
    household_id: input.householdId,
    category_id: item.category_id,
    month: input.targetMonth,
    planned_amount: item.planned_amount,
    inflation_rate: item.inflation_rate,
  }));
  if (rows.length === 0) return 0;
  const result = await client().from("monthly_budgets").upsert(rows, { onConflict: "household_id,category_id,month" });
  if (result.error) throw result.error;
  return rows.length;
}

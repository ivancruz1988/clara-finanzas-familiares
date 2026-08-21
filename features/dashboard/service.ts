import { supabase } from "@/lib/supabase";
import { calculateAccountBalance, calculateBudgetTotals, calculatePending, calculateProjected, type FinancialMovement } from "@/lib/finance";

function client() {
  if (!supabase) throw new Error("Supabase no esta configurado.");
  return supabase;
}

export type DashboardTransaction = {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  kind: "income" | "expense";
  account_name: string;
  category_name: string;
};

export type DashboardPayment = {
  id: string;
  due_date: string;
  description: string;
  amount: number;
  account_name: string;
};

export type DashboardBudgetLine = {
  category_id: string;
  category_name: string;
  planned_amount: number;
  actual_amount: number;
};

export type DashboardData = {
  available: number;
  pending: number;
  projected: number;
  pendingCount: number;
  budget: {
    planned: number;
    actual: number;
    remaining: number;
    usedPercent: number;
    lines: DashboardBudgetLine[];
  };
  payments: DashboardPayment[];
  transactions: DashboardTransaction[];
};

function nextMonth(month: string) {
  const date = new Date(`${month}T12:00:00`);
  date.setMonth(date.getMonth()+1);
  return date.toISOString().slice(0,10);
}

export async function loadDashboard(householdId: string, month: string): Promise<DashboardData> {
  const api = client();
  const [accounts,movements,payments,categories,budgets,monthExpenses,recentTransactions] = await Promise.all([
    api.from("accounts").select("id,opening_balance").eq("household_id",householdId),
    api.from("transactions").select("account_id,amount,kind").eq("household_id",householdId),
    api.from("payment_orders").select("id,due_date,description,amount,accounts(name)").eq("household_id",householdId).eq("status","pending").order("due_date",{ascending:true}).limit(6),
    api.from("categories").select("id,name").eq("household_id",householdId).eq("kind","expense").order("name"),
    api.from("monthly_budgets").select("category_id,planned_amount").eq("household_id",householdId).eq("month",month),
    api.from("transactions").select("category_id,amount").eq("household_id",householdId).eq("kind","expense").gte("transaction_date",month).lt("transaction_date",nextMonth(month)),
    api.from("transactions").select("id,transaction_date,description,amount,kind,accounts(name),categories(name)").eq("household_id",householdId).order("transaction_date",{ascending:false}).order("created_at",{ascending:false}).limit(5),
  ]);

  for (const result of [accounts,movements,payments,categories,budgets,monthExpenses,recentTransactions]) {
    if (result.error) throw result.error;
  }

  const financialMovements = (movements.data || []).map(item=>({
    accountId: item.account_id as string,
    amount: Number(item.amount),
    kind: item.kind as "income" | "expense",
  } satisfies FinancialMovement));

  const available = (accounts.data || []).reduce((total,account)=>total+calculateAccountBalance({
    id: account.id as string,
    openingBalance: Number(account.opening_balance),
  }, financialMovements),0);

  const paymentRows = (payments.data || []).map(item=>{
    const account = item.accounts as unknown as {name:string} | null;
    return {
      id: item.id,
      due_date: item.due_date,
      description: item.description,
      amount: Number(item.amount),
      account_name: account?.name || "Sin cuenta",
    } satisfies DashboardPayment;
  });
  const pending = calculatePending(paymentRows.map(item=>item.amount));

  const budgetByCategory = new Map((budgets.data || []).map(item=>[item.category_id as string,Number(item.planned_amount)]));
  const actualByCategory = new Map<string,number>();
  for (const item of monthExpenses.data || []) {
    if (!item.category_id) continue;
    actualByCategory.set(item.category_id, (actualByCategory.get(item.category_id) || 0) + Number(item.amount));
  }
  const budgetLines = (categories.data || []).map(category=>({
    category_id: category.id as string,
    category_name: category.name as string,
    planned_amount: budgetByCategory.get(category.id as string) || 0,
    actual_amount: actualByCategory.get(category.id as string) || 0,
  } satisfies DashboardBudgetLine));
  const budgetTotals = calculateBudgetTotals(budgetLines.map(line=>({
    categoryId: line.category_id,
    plannedAmount: line.planned_amount,
    actualAmount: line.actual_amount,
  })));

  const transactions = (recentTransactions.data || []).map(item=>{
    const account = item.accounts as unknown as {name:string} | null;
    const category = item.categories as unknown as {name:string} | null;
    return {
      id: item.id,
      transaction_date: item.transaction_date,
      description: item.description,
      amount: Number(item.amount),
      kind: item.kind,
      account_name: account?.name || "Sin cuenta",
      category_name: category?.name || "Sin categoria",
    } satisfies DashboardTransaction;
  });

  return {
    available,
    pending,
    projected: calculateProjected(available,pending),
    pendingCount: paymentRows.length,
    budget: {...budgetTotals,lines: budgetLines},
    payments: paymentRows,
    transactions,
  };
}

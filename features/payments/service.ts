import { supabase } from "@/lib/supabase";

function client() {
  if (!supabase) throw new Error("Supabase no esta configurado.");
  return supabase;
}

export type DbPaymentOrder = {
  id: string;
  due_date: string;
  description: string;
  amount: number;
  status: "pending" | "paid";
  paid_at: string | null;
  paid_transaction_id: string | null;
  account_id: string | null;
  category_id: string | null;
  account_name: string;
  category_name: string;
};

export async function listPaymentOrders(householdId: string) {
  const { data,error } = await client()
    .from("payment_orders")
    .select("id,due_date,description,amount,status,paid_at,paid_transaction_id,account_id,category_id,accounts(name),categories(name)")
    .eq("household_id",householdId)
    .order("status")
    .order("due_date",{ascending:true});
  if (error) throw error;
  return (data || []).map(item=>{
    const account = item.accounts as unknown as {name:string} | null;
    const category = item.categories as unknown as {name:string} | null;
    return {
      id: item.id,
      due_date: item.due_date,
      description: item.description,
      amount: Number(item.amount),
      status: item.status,
      paid_at: item.paid_at,
      paid_transaction_id: item.paid_transaction_id,
      account_id: item.account_id,
      category_id: item.category_id,
      account_name: account?.name || "Sin cuenta",
      category_name: category?.name || "Sin categoria",
    } as DbPaymentOrder;
  }).sort((a,b)=>{
    if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
    return a.due_date.localeCompare(b.due_date);
  });
}

export async function confirmPaymentOrder(paymentId: string, paidDate: string) {
  const { data,error } = await client().rpc("confirm_payment_order", {
    target_payment: paymentId,
    payment_date: paidDate,
  });
  if (error) throw error;
  return data as string;
}

export async function deletePaymentOrder(paymentId: string) {
  const { error } = await client().from("payment_orders").delete().eq("id",paymentId).eq("status","pending");
  if (error) throw error;
}

export async function updatePaymentOrderDate(paymentId: string, dueDate: string) {
  const { error } = await client()
    .from("payment_orders")
    .update({ due_date: dueDate })
    .eq("id", paymentId)
    .eq("status", "pending");
  if (error) throw error;
}
export async function createPayment(input: { householdId:string; accountId:string; categoryId:string; date:string; description:string; amount:number }) {
  const { data, error } = await client().from("payment_orders").insert({
    household_id:input.householdId,
    account_id:input.accountId,
    category_id:input.categoryId,
    due_date:input.date,
    description:input.description,
    amount:input.amount,
    status:"pending",
    idempotency_key: crypto.randomUUID(),
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}


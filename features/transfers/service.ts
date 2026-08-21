import { supabase } from "@/lib/supabase";

export async function createTransfer(input:{sourceAccount:string;destinationAccount:string;date:string;description:string;amount:number}){
  if(!supabase)throw new Error("Supabase no está configurado.");
  const {data,error}=await supabase.rpc("create_transfer",{source_account:input.sourceAccount,destination_account:input.destinationAccount,transfer_date:input.date,transfer_description:input.description,transfer_amount:input.amount});
  if(error)throw error;
  return data as string;
}

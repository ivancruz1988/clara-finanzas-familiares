export type FinancialMovement = {
  accountId: string;
  amount: number;
  kind: "income" | "expense";
};

export type OpeningAccount = { id: string; openingBalance: number };

export function signedAmount(movement: Pick<FinancialMovement,"amount"|"kind">) {
  return movement.kind === "income" ? movement.amount : -movement.amount;
}

export function calculateAccountBalance(account: OpeningAccount, movements: FinancialMovement[]) {
  return movements.filter(item=>item.accountId===account.id).reduce((balance,item)=>balance+signedAmount(item),account.openingBalance);
}

export function calculateAvailable(accounts: OpeningAccount[], movements: FinancialMovement[]) {
  return accounts.reduce((total,account)=>total+calculateAccountBalance(account,movements),0);
}

export function calculatePending(amounts: number[]) {
  return amounts.reduce((total,amount)=>total+amount,0);
}

export function calculateProjected(available: number, pending: number) {
  return available-pending;
}

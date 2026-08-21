export type AssistantSummaryInput = {
  accounts: { id:string; name?:string; opening_balance:number | string }[];
  movements: { account_id:string; amount:number | string; kind:"income" | "expense" }[];
  pendingPayments: { amount:number | string }[];
};

type FinancialMovement = {
  accountId: string;
  amount: number;
  kind: "income" | "expense";
};

function signedAmount(movement: Pick<FinancialMovement,"amount"|"kind">) {
  return movement.kind === "income" ? movement.amount : -movement.amount;
}

function calculateAccountBalance(account: {id:string; openingBalance:number}, movements: FinancialMovement[]) {
  return movements.filter(item=>item.accountId===account.id).reduce((balance,item)=>balance+signedAmount(item),account.openingBalance);
}

export type AssistantFinancialSummary = {
  available: number;
  pending: number;
  projected: number;
  accountCount: number;
  pendingCount: number;
};

export function buildFinancialSummary(input: AssistantSummaryInput): AssistantFinancialSummary {
  const movements = input.movements.map(item=>({
    accountId: item.account_id,
    amount: Number(item.amount),
    kind: item.kind,
  } satisfies FinancialMovement));
  const available = input.accounts.reduce((total,account)=>total+calculateAccountBalance({
    id: account.id,
    openingBalance: Number(account.opening_balance),
  },movements),0);
  const pending = input.pendingPayments.reduce((total,item)=>total+Number(item.amount),0);
  return {
    available,
    pending,
    projected: available-pending,
    accountCount: input.accounts.length,
    pendingCount: input.pendingPayments.length,
  };
}

export function formatArs(value: number) {
  return new Intl.NumberFormat("es-AR",{
    style:"currency",
    currency:"ARS",
    maximumFractionDigits:0,
  }).format(value);
}

export function summaryAnswer(summary: AssistantFinancialSummary) {
  return `Tenes ${formatArs(summary.available)} disponible. Tenes ${formatArs(summary.pending)} en pagos pendientes, asi que el disponible proyectado queda en ${formatArs(summary.projected)}.`;
}

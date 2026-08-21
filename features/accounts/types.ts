export type AccountKind = "cash" | "bank" | "wallet";
export type CategoryKind = "income" | "expense";

export type DbAccount = {
  id: string;
  name: string;
  kind: AccountKind;
  opening_balance: number;
  color: string;
};

export type DbCategory = { id: string; name: string; kind: CategoryKind };

export type AccountInput = Omit<DbAccount, "id"> & { household_id: string };
export type CategoryInput = Omit<DbCategory, "id"> & { household_id: string };

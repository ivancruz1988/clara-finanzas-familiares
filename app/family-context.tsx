"use client";

import { createContext, useContext } from "react";

export type Household = { id: string; name: string; role?: string };

const HouseholdContext = createContext<Household | null>(null);

export const HouseholdProvider = HouseholdContext.Provider;

export function useHousehold() {
  return useContext(HouseholdContext);
}

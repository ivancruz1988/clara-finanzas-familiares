import test from "node:test";
import assert from "node:assert/strict";
import { calculateAccountBalance, calculateAvailable, calculateBudgetRemaining, calculateBudgetTotals, calculatePending, calculateProjected } from "../../lib/finance/index.ts";

const movements=[
  {accountId:"cash",amount:500,kind:"income"},
  {accountId:"cash",amount:120,kind:"expense"},
  {accountId:"bank",amount:300,kind:"expense"},
];

test("calcula el saldo de una cuenta",()=>{
  assert.equal(calculateAccountBalance({id:"cash",openingBalance:1000},movements),1380);
});

test("calcula totales y restante de presupuesto",()=>{
  const totals=calculateBudgetTotals([
    {categoryId:"food",plannedAmount:1000,actualAmount:250},
    {categoryId:"home",plannedAmount:500,actualAmount:600},
  ]);
  assert.deepEqual(totals,{planned:1500,actual:850,remaining:650,usedPercent:57});
  assert.equal(calculateBudgetRemaining({plannedAmount:500,actualAmount:600}),-100);
});

test("calcula disponible, pendientes y proyección",()=>{
  const accounts=[{id:"cash",openingBalance:1000},{id:"bank",openingBalance:2000}];
  const available=calculateAvailable(accounts,movements);
  const pending=calculatePending([200,50]);
  assert.equal(available,3080);
  assert.equal(pending,250);
  assert.equal(calculateProjected(available,pending),2830);
});

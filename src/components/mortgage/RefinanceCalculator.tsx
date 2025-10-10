import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import {
  Tooltip as UiTooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

/* -----------------------------------------------
   Helpers
----------------------------------------------- */

// PMT formula helper (fixed-rate, fully amortizing)
function pmt(principal: number, annualRatePct: number, months: number) {
  const r = annualRatePct / 100 / 12;
  if (months <= 0) return 0;
  if (r === 0) return principal / months;
  const f = Math.pow(1 + r, months);
  return (principal * r * f) / (f - 1);
}

// Remaining balance after k payments
function remainingBalance(
  originalPrincipal: number,
  annualRatePct: number,
  totalMonths: number,
  monthsPaid: number
) {
  const r = annualRatePct / 100 / 12;
  if (totalMonths <= 0) return 0;
  if (monthsPaid <= 0) return originalPrincipal;
  if (monthsPaid >= totalMonths) return 0;
  if (r === 0) {
    const principalPaid = (originalPrincipal / totalMonths) * monthsPaid;
    return Math.max(0, originalPrincipal - principalPaid);
  }
  const m = pmt(originalPrincipal, annualRatePct, totalMonths);
  const bal =
    originalPrincipal * Math.pow(1 + r, monthsPaid) -
    (m / r) * (Math.pow(1 + r, monthsPaid) - 1);
  return Math.max(0, bal);
}

// Months between two yyyy-mm dates (floor to months)
function monthsBetween(startISO: string, end: Date) {
  if (!startISO) return 0;
  const [y, m] = startISO.split("-").map(Number);
  if (!y || !m) return 0;
  const start = new Date(y, m - 1, 1);
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  const total = years * 12 + months;
  return Math.max(0, total);
}

/* ---- NEW: compact formatter + row-with-bar component ---- */

const fmtMoney = (n: number, digits = 0) =>
  `$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: digits })}`;

function ComparisonRow({
  label,
  value,
  pct, // 0–100
  fillClass,
  trackClass,
  height = 24,
}: {
  label: string;
  value: string;
  pct: number;
  fillClass: string;
  trackClass: string;
  height?: number;
}) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between text-sm font-semibold mb-2">
        <div>{label}</div>
        <div>{value}</div>
      </div>
      <div
        className={`w-full rounded-md overflow-hidden ${trackClass}`}
        style={{ height }}
      >
        <div
          className={`h-full ${fillClass}`}
          style={{ width: `${w}%`, transition: "width .2s ease" }}
        />
      </div>
    </div>
  );
}

/* -----------------------------------------------
   Component
----------------------------------------------- */

export default function RefinanceCalculator() {
  /* ---------- Sidebar form state ---------- */

  // Importance
  const [priority, setPriority] = useState<"low-payment" | "low-interest">(
    "low-payment"
  );

  // Current loan (original)
  const [origAmount, setOrigAmount] = useState<number>(300000);
  const [origRate, setOrigRate] = useState<number>(5);
  const [termMode, setTermMode] = useState<"years" | "months">("years");
  const [termYears, setTermYears] = useState<number>(30);
  const [termMonths, setTermMonths] = useState<number>(360);
  const [origStartDate, setOrigStartDate] = useState<string>("2022-03-01");

  // New loan (explicit list)
  const [curBalance, setCurBalance] = useState<number>(250000);
  const [cashOut, setCashOut] = useState<number>(0);
  const [refiCosts, setRefiCosts] = useState<number>(1000);
  const [newRate, setNewRate] = useState<number>(5);
  const [newTermMode, setNewTermMode] = useState<"years" | "months">("years");
  const [newTermYears, setNewTermYears] = useState<number>(30);
  const [newTermMonths, setNewTermMonths] = useState<number>(360);
  const [newStartDate, setNewStartDate] = useState<string>("2025-09-01");
  const [costsHandling, setCostsHandling] = useState<"roll" | "cash">("roll"); // Include in Loan vs Pay Out Of Pocket

  /* ---------- Derived values ---------- */

  const totalMonths = termMode === "years" ? termYears * 12 : termMonths;
  const paidMonths = monthsBetween(origStartDate, new Date());
  const remainingMonths = Math.max(0, totalMonths - paidMonths);

  const currentMonthly = useMemo(
    () => pmt(origAmount, origRate, totalMonths),
    [origAmount, origRate, totalMonths]
  );

  const estRemainingBalance = useMemo(
    () => remainingBalance(origAmount, origRate, totalMonths, paidMonths),
    [origAmount, origRate, totalMonths, paidMonths]
  );

  // New loan amount (balance + optional costs + cash-out)
  const newLoanAmount = useMemo(
    () =>
      (curBalance || 0) +
      (costsHandling === "roll" ? refiCosts || 0 : 0) +
      (cashOut || 0),
    [curBalance, refiCosts, cashOut, costsHandling]
  );

  const newTotalMonths =
    newTermMode === "years" ? newTermYears * 12 : newTermMonths;
  const newMonthly = useMemo(
    () => pmt(newLoanAmount, newRate, newTotalMonths),
    [newLoanAmount, newRate, newTotalMonths]
  );

  // Bars + KPI math
  const monthlyDiff = useMemo(
    () => newMonthly - currentMonthly,
    [newMonthly, currentMonthly]
  );

  // Remaining interest on current loan (from now)
  const currentRemainingInterest = useMemo(() => {
    if (remainingMonths <= 0) return 0;
    const pay = pmt(estRemainingBalance, origRate, remainingMonths);
    return pay * remainingMonths - estRemainingBalance;
  }, [estRemainingBalance, origRate, remainingMonths]);

  // New loan total interest
  const newLoanInterest = useMemo(
    () => newMonthly * newTotalMonths - newLoanAmount,
    [newMonthly, newTotalMonths, newLoanAmount]
  );

  const interestDiff = useMemo(
    () => newLoanInterest - currentRemainingInterest,
    [newLoanInterest, currentRemainingInterest]
  );

  // Recoup months (only if payment decreases and costs paid out-of-pocket)
  const recoupMonths = useMemo(() => {
    const monthlySavings = -monthlyDiff;
    if (monthlySavings <= 0) return Number.NaN;
    const upfront = costsHandling === "cash" ? refiCosts : 0;
    if (upfront <= 0) return Number.NaN;
    return upfront / monthlySavings;
  }, [monthlyDiff, refiCosts, costsHandling]);

  const recoupText = isFinite(recoupMonths)
    ? `It will take you ${recoupMonths.toLocaleString(undefined, {
        maximumFractionDigits: 1,
      })} months to recoup the cost to refinance.`
    : `--`;

  /* ---------- Tiny UI helpers ---------- */

  const Seg = ({
    value,
    onChange,
    left,
    right,
    className = "",
  }: {
    value: string;
    onChange: (v: string) => void;
    left: string;
    right: string;
    className?: string;
  }) => (
    <div className={`fs-segment ${className}`}>
      <button
        type="button"
        className="fs-segbtn"
        aria-pressed={value === left}
        onClick={() => onChange(left)}
      >
        {left}
      </button>
      <button
        type="button"
        className="fs-segbtn"
        aria-pressed={value === right}
        onClick={() => onChange(right)}
      >
        {right}
      </button>
    </div>
  );

  /* ---------- Render ---------- */

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "500px 1fr 450px" }}>
      {/* LEFT SIDEBAR */}
      <div className="fs-panel fs-fixed">
        <h2 className="fs-title">Refinance Calculator</h2>

        <div className="fs-body mt-2">
          {/* What matters */}
          <div className="fs-field">
            <label className="fs-label flex items-center gap-2">
              What is most important to you?
              {/* Tooltip */}
              <UiTooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Your Priority"
                    className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="start"
                  sideOffset={8}
                  className="p-0 bg-transparent border-0 shadow-none"
                >
                  <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                    <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                    <div className="font-bold mb-1">Your Priority</div>
                    <p className="text-sm leading-5">
                      Choose whether you want the lowest monthly payment or to
                      minimize total interest paid.
                    </p>
                  </div>
                </TooltipContent>
              </UiTooltip>
            </label>
            <div className="grid gap-2">
              <button
                type="button"
                className={`fs-readonly justify-between ${
                  priority === "low-payment" ? "ring-2 ring-green-400" : ""
                }`}
                onClick={() => setPriority("low-payment")}
              >
                <span>Low Monthly Payment</span>
                <span className="text-xs opacity-75">(recommended)</span>
              </button>
              <button
                type="button"
                className={`fs-readonly justify-between ${
                  priority === "low-interest" ? "ring-2 ring-green-400" : ""
                }`}
                onClick={() => setPriority("low-interest")}
              >
                <span>Lower Interest Paid</span>
              </button>
            </div>
          </div>

          {/* Current Loan */}
          <div className="fs-field mt-5">
            <label className="fs-label">Current Loan</label>
          </div>

          <div className="fs-field">
            <label className="fs-label">
              Original Loan Amount
              <UiTooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Original Loan Amount"
                    className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="start"
                  sideOffset={8}
                  className="p-0 bg-transparent border-0 shadow-none"
                >
                  <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                    <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                    <div className="font-bold mb-1">Original Loan Amount</div>
                    <p className="text-sm leading-5">
                      The amount you originally borrowed when you first took out
                      the mortgage.
                    </p>
                  </div>
                </TooltipContent>
              </UiTooltip>
            </label>
            <Input
              type="text"
              inputMode="decimal"
              value={origAmount}
              onChange={(e) => setOrigAmount(Number(e.target.value || 0))}
              className="fs-input"
            />
          </div>

          <div className="fs-field mt-3">
            <label className="fs-label">
              Original Rate
              <UiTooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Original Interest Rate"
                    className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="start"
                  sideOffset={8}
                  className="p-0 bg-transparent border-0 shadow-none"
                >
                  <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                    <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                    <div className="font-bold mb-1">Original Interest Rate</div>
                    <p className="text-sm leading-5">
                      Your initial annual interest rate (APR) for the current
                      mortgage.
                    </p>
                  </div>
                </TooltipContent>
              </UiTooltip>
            </label>
            <Input
              type="text"
              inputMode="decimal"
              value={origRate}
              onChange={(e) => setOrigRate(Number(e.target.value || 0))}
              className="fs-input"
            />
          </div>

          <div className="fs-field mt-3">
            <label className="fs-label">
              Original Loan Term
              <UiTooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Original Loan Term"
                    className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="start"
                  sideOffset={8}
                  className="p-0 bg-transparent border-0 shadow-none"
                >
                  <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                    <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                    <div className="font-bold mb-1">Original Loan Term</div>
                    <p className="text-sm leading-5">
                      How long your original mortgage was scheduled to last (in
                      years or months).
                    </p>
                  </div>
                </TooltipContent>
              </UiTooltip>
            </label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              {termMode === "years" ? (
                <Input
                  type="text"
                  inputMode="numeric"
                  value={termYears}
                  onChange={(e) => {
                    const v = Number(e.target.value || 0);
                    setTermYears(v);
                    setTermMonths(Math.max(0, Math.round(v * 12)));
                  }}
                  className="fs-input"
                />
              ) : (
                <Input
                  type="text"
                  inputMode="numeric"
                  value={termMonths}
                  onChange={(e) => {
                    const v = Number(e.target.value || 0);
                    setTermMonths(v);
                    setTermYears(Math.max(0, Math.round(v / 12)));
                  }}
                  className="fs-input"
                />
              )}
              <Seg
                value={termMode === "years" ? "Year" : "Month"}
                onChange={(v) => setTermMode(v === "Year" ? "years" : "months")}
                left="Year"
                right="Month"
                className="w-[150px]"
              />
            </div>
          </div>

          <div className="fs-field mt-3">
            <label className="fs-label">
              Loan Start Date
              <UiTooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Loan Start Date"
                    className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="start"
                  sideOffset={8}
                  className="p-0 bg-transparent border-0 shadow-none"
                >
                  <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                    <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                    <div className="font-bold mb-1">Loan Start Date</div>
                    <p className="text-sm leading-5">
                      The month and year your current mortgage began.
                    </p>
                  </div>
                </TooltipContent>
              </UiTooltip>
            </label>
            <Input
              type="month"
              value={origStartDate.slice(0, 7)}
              onChange={(e) => setOrigStartDate(`${e.target.value}-01`)}
              className="fs-input"
            />
          </div>

          {/* New Loan */}
          <div className="fs-field mt-6">
            <label className="fs-label">New Loan</label>
          </div>

          <div className="fs-field">
            <label className="fs-label">
              Current Loan Balance
              <UiTooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Current Loan Balance"
                    className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="start"
                  sideOffset={8}
                  className="p-0 bg-transparent border-0 shadow-none"
                >
                  <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                    <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                    <div className="font-bold mb-1">Current Loan Balance</div>
                    <p className="text-sm leading-5">
                      Your payoff amount today for the existing mortgage.
                    </p>
                  </div>
                </TooltipContent>
              </UiTooltip>
            </label>
            <Input
              type="text"
              inputMode="decimal"
              value={curBalance}
              onChange={(e) => setCurBalance(Number(e.target.value || 0))}
              className="fs-input"
            />
          </div>

          <div className="fs-field mt-3">
            <label className="fs-label">
              Cash Out Amount
              <UiTooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Cash-Out"
                    className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="start"
                  sideOffset={8}
                  className="p-0 bg-transparent border-0 shadow-none"
                >
                  <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                    <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                    <div className="font-bold mb-1">Cash-Out</div>
                    <p className="text-sm leading-5">
                      Optional funds you take out above payoff and costs;
                      increases the new loan amount.
                    </p>
                  </div>
                </TooltipContent>
              </UiTooltip>
            </label>
            <Input
              type="text"
              inputMode="decimal"
              value={cashOut}
              onChange={(e) => setCashOut(Number(e.target.value || 0))}
              className="fs-input"
            />
          </div>

          <div className="fs-field mt-3">
            <label className="fs-label">
              Refinance Costs
              <UiTooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Refinance Costs"
                    className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="start"
                  sideOffset={8}
                  className="p-0 bg-transparent border-0 shadow-none"
                >
                  <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                    <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                    <div className="font-bold mb-1">Refinance Costs</div>
                    <p className="text-sm leading-5">
                      Estimated closing costs for the new mortgage (lender,
                      title, appraisal, etc.).
                    </p>
                  </div>
                </TooltipContent>
              </UiTooltip>
            </label>
            <Input
              type="text"
              inputMode="decimal"
              value={refiCosts}
              onChange={(e) => setRefiCosts(Number(e.target.value || 0))}
              className="fs-input"
            />
          </div>

          <div className="fs-field mt-3">
            <label className="fs-label">
              New Loan Amount
              <UiTooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="New Loan Amount"
                    className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="start"
                  sideOffset={8}
                  className="p-0 bg-transparent border-0 shadow-none"
                >
                  <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                    <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                    <div className="font-bold mb-1">New Loan Amount</div>
                    <p className="text-sm leading-5">
                      Balance plus any rolled-in costs and cash-out.
                    </p>
                  </div>
                </TooltipContent>
              </UiTooltip>
            </label>
            <div className="fs-readonly">
              ${newLoanAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="fs-field mt-3">
            <label className="fs-label">
              New Rate
              <UiTooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="New Interest Rate"
                    className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="start"
                  sideOffset={8}
                  className="p-0 bg-transparent border-0 shadow-none"
                >
                  <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                    <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                    <div className="font-bold mb-1">New Interest Rate</div>
                    <p className="text-sm leading-5">
                      Your estimated annual interest rate (APR) for the
                      refinance.
                    </p>
                  </div>
                </TooltipContent>
              </UiTooltip>
            </label>
            <Input
              type="text"
              inputMode="decimal"
              value={newRate}
              onChange={(e) => setNewRate(Number(e.target.value || 0))}
              className="fs-input"
            />
          </div>

          <div className="fs-field mt-3">
            <label className="fs-label">
              New Loan Term
              <UiTooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="New Loan Term"
                    className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="start"
                  sideOffset={8}
                  className="p-0 bg-transparent border-0 shadow-none"
                >
                  <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                    <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                    <div className="font-bold mb-1">New Loan Term</div>
                    <p className="text-sm leading-5">
                      How long the new mortgage will last (in years or months).
                    </p>
                  </div>
                </TooltipContent>
              </UiTooltip>
            </label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              {newTermMode === "years" ? (
                <Input
                  type="text"
                  inputMode="numeric"
                  value={newTermYears}
                  onChange={(e) => {
                    const v = Number(e.target.value || 0);
                    setNewTermYears(v);
                    setNewTermMonths(Math.max(0, Math.round(v * 12)));
                  }}
                  className="fs-input"
                />
              ) : (
                <Input
                  type="text"
                  inputMode="numeric"
                  value={newTermMonths}
                  onChange={(e) => {
                    const v = Number(e.target.value || 0);
                    setNewTermMonths(v);
                    setNewTermYears(Math.max(0, Math.round(v / 12)));
                  }}
                  className="fs-input"
                />
              )}
              <Seg
                value={newTermMode === "years" ? "Year" : "Month"}
                onChange={(v) => setNewTermMode(v === "Year" ? "years" : "months")}
                left="Year"
                right="Month"
                className="w-[150px]"
              />
            </div>
          </div>

          <div className="fs-field mt-3">
            <label className="fs-label">
              New Loan Start Date
              <UiTooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="New Loan Start Date"
                    className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="start"
                  sideOffset={8}
                  className="p-0 bg-transparent border-0 shadow-none"
                >
                  <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                    <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                    <div className="font-bold mb-1">New Loan Start Date</div>
                    <p className="text-sm leading-5">
                      When your new mortgage will begin.
                    </p>
                  </div>
                </TooltipContent>
              </UiTooltip>
            </label>
            <Input
              type="month"
              value={newStartDate.slice(0, 7)}
              onChange={(e) => setNewStartDate(`${e.target.value}-01`)}
              className="fs-input"
            />
          </div>

          <div className="fs-field mt-3">
            <label className="fs-label">
              Paying Refinance Costs
              <UiTooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="How to Pay Costs"
                    className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="start"
                  sideOffset={8}
                  className="p-0 bg-transparent border-0 shadow-none"
                >
                  <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                    <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                    <div className="font-bold mb-1">How to Pay Costs</div>
                    <p className="text-sm leading-5">
                      Include closing costs in your new loan (roll in) or pay
                      out-of-pocket at closing.
                    </p>
                  </div>
                </TooltipContent>
              </UiTooltip>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                style={{
                  color: costsHandling === "roll" ? "#0F2C4C" : "#71737A",
                }}
                variant={costsHandling === "roll" ? "default" : "secondary"}
                onClick={() => setCostsHandling("roll")}
              >
                Include in Loan
              </Button>
              <Button
                style={{
                  color: costsHandling === "cash" ? "#0F2C4C" : "#71737A",
                }}
                variant={costsHandling === "cash" ? "default" : "secondary"}
                onClick={() => setCostsHandling("cash")}
              >
                Pay Out Of Pocket
              </Button>
            </div>
          </div>

          <button className="fs-cta mt-5 w-full">GET A QUOTE</button>
        </div>
      </div>

      {/* RIGHT SIDE (two columns) */}
      <div className="col-span-2 grid gap-4 max-h-[64px]">
        {/* Banners row */}
        <div className="grid md:grid-cols-2 gap-4">
          <div
            className="rf-banner flex items-center"
            style={{ padding: "12px 16px", maxHeight: "64px" }}
          >
            {monthlyDiff >= 0
              ? `Your monthly payment will increase ${fmtMoney(
                  Math.abs(monthlyDiff),
                  0
                )} per month.`
              : `Your monthly payment will decrease ${fmtMoney(
                  Math.abs(monthlyDiff),
                  0
                )} per month.`}
          </div>
          <div
            className="rf-banner flex items-center justify-center text-center"
            style={{ padding: "12px 16px", maxHeight: "64px" }}
          >
            {recoupText}
          </div>
        </div>

        {/* KPI tiles (compact) */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <div
            className="rf-kpi flex flex-col justify-center"
            style={{ padding: "12px 16px", minHeight: "90px" }}
          >
            <div className="rf-kpi__label text-[13px] mb-1 leading-tight text-neutral-500">
              Monthly Payment {monthlyDiff >= 0 ? "Increase" : "Decrease"}
            </div>
            <div className="rf-kpi__value text-[22px] font-extrabold leading-tight">
              {fmtMoney(Math.abs(monthlyDiff), 0)}
            </div>
          </div>

          <div
            className="rf-kpi flex flex-col justify-center"
            style={{ padding: "12px 16px", minHeight: "90px" }}
          >
            <div className="rf-kpi__label text-[13px] mb-1 leading-tight text-neutral-500">
              Total Interest Difference
            </div>
            <div className="rf-kpi__value text-[22px] font-extrabold leading-tight">
              {interestDiff >= 0 ? "" : "-"}
              {fmtMoney(Math.abs(interestDiff), 0)}
            </div>
          </div>

          <div
            className="rf-kpi flex flex-col justify-center"
            style={{ padding: "12px 16px", minHeight: "90px" }}
          >
            <div className="rf-kpi__label text-[13px] mb-1 leading-tight text-neutral-500">
              Refinance Costs
            </div>
            <div className="rf-kpi__value text-[22px] font-extrabold leading-tight">
              {fmtMoney(refiCosts, 0)}
            </div>
          </div>

          <div
            className="rf-kpi flex flex-col justify-center"
            style={{ padding: "12px 16px", minHeight: "90px" }}
          >
            <div className="rf-kpi__label text-[13px] mb-1 leading-tight text-neutral-500">
              Time to Recoup Fees
            </div>
            <div className="rf-kpi__value text-[22px] font-extrabold leading-tight">
              {isFinite(recoupMonths)
                ? `${recoupMonths.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}`
                : "—"}
            </div>
          </div>
        </div>

        {/* Comparison cards */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="pc-card">
            <CardHeader className="pc-card__header">
              <CardTitle className="pc-card__title">
                Monthly Payment Comparison
              </CardTitle>
              <UiTooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="How to Pay Costs"
                    className="inline-flex items-center ml-1 text-[#000] focus:outline-none"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="start"
                  sideOffset={8}
                  className="p-0 bg-transparent border-0 shadow-none"
                >
                  <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                    <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                    <div className="font-bold mb-1">How to Pay Costs</div>
                    <p className="text-sm leading-5">
                      Include closing costs in your new loan (roll in) or pay
                      out-of-pocket at closing.
                    </p>
                  </div>
                </TooltipContent>
              </UiTooltip>
            </CardHeader>

            {/* ---- NEW rows with bars under labels ---- */}
            <CardContent className="pc-card__body">
              {(() => {
                const maxPay = Math.max(currentMonthly, newMonthly) || 1;
                return (
                  <>
                    <ComparisonRow
                      label="Current Loan"
                      value={fmtMoney(currentMonthly, 0)}
                      pct={(currentMonthly / maxPay) * 100}
                      fillClass="bg-neutral-800/90"
                      trackClass="bg-neutral-200/70"
                    />

                    <ComparisonRow
                      label="New Loan"
                      value={fmtMoney(newMonthly, 0)}
                      pct={(newMonthly / maxPay) * 100}
                      fillClass="bg-rose-300"
                      trackClass="bg-rose-100"
                    />

                    <ComparisonRow
                      label="Monthly Payment Difference"
                      value={`${
                        monthlyDiff >= 0 ? "+" : "-"
                      }${fmtMoney(Math.abs(monthlyDiff), 0)}`}
                      pct={(Math.abs(monthlyDiff) / maxPay) * 100}
                      fillClass="bg-rose-400"
                      trackClass="bg-rose-100"
                    />
                  </>
                );
              })()}
            </CardContent>
          </Card>

          <Card className="pc-card">
            <CardHeader className="pc-card__header">
              <CardTitle className="pc-card__title">
                Total Interest Comparison
              </CardTitle>
              <UiTooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="How to Pay Costs"
                    className="inline-flex items-center ml-1 text-[#000] focus:outline-none"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="start"
                  sideOffset={8}
                  className="p-0 bg-transparent border-0 shadow-none"
                >
                  <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                    <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                    <div className="font-bold mb-1">How to Pay Costs</div>
                    <p className="text-sm leading-5">
                      Include closing costs in your new loan (roll in) or pay
                      out-of-pocket at closing.
                    </p>
                  </div>
                </TooltipContent>
              </UiTooltip>
            </CardHeader>

            {/* ---- NEW rows with bars under labels ---- */}
            <CardContent className="pc-card__body">
              {(() => {
                const maxInt =
                  Math.max(currentRemainingInterest, newLoanInterest) || 1;
                return (
                  <>
                    <ComparisonRow
                      label="Current Loan Remaining Interest"
                      value={fmtMoney(currentRemainingInterest, 0)}
                      pct={(currentRemainingInterest / maxInt) * 100}
                      fillClass="bg-neutral-800/90"
                      trackClass="bg-neutral-200/70"
                    />

                    <ComparisonRow
                      label="New Loan Interest"
                      value={fmtMoney(newLoanInterest, 0)}
                      pct={(newLoanInterest / maxInt) * 100}
                      fillClass="bg-green-400"
                      trackClass="bg-green-100"
                    />

                    <ComparisonRow
                      label="Total Interest Difference"
                      value={`${interestDiff >= 0 ? "" : "-"}${fmtMoney(
                        Math.abs(interestDiff),
                        0
                      )}`}
                      pct={(Math.abs(interestDiff) / maxInt) * 100}
                      fillClass="bg-green-500"
                      trackClass="bg-green-100"
                    />
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

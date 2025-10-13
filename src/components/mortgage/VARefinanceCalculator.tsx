import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import {
  Tooltip as UiTooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

/* -------------------- Math helpers (unchanged) -------------------- */
function monthlyPayment(principal: number, monthlyRate: number, nMonths: number) {
  if (principal <= 0 || nMonths <= 0) return 0;
  if (monthlyRate === 0) return principal / nMonths;
  const r = monthlyRate;
  return (principal * (r * Math.pow(1 + r, nMonths))) / (Math.pow(1 + r, nMonths) - 1);
}

function balanceAfterMonths(principal: number, monthlyRate: number, nMonths: number, k: number) {
  if (principal <= 0 || nMonths <= 0) return 0;
  const pmt = monthlyPayment(principal, monthlyRate, nMonths);
  if (monthlyRate === 0) return Math.max(0, principal - pmt * k);
  const r = monthlyRate;
  const bal = principal * Math.pow(1 + r, k) - pmt * ((Math.pow(1 + r, k) - 1) / r);
  return Math.max(0, bal);
}

function totalInterestOverLife(principal: number, monthlyRate: number, nMonths: number) {
  if (principal <= 0 || nMonths <= 0) return 0;
  const pmt = monthlyPayment(principal, monthlyRate, nMonths);
  return pmt * nMonths - principal;
}

function monthsSince(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const y = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    const total = y * 12 + m + (now.getDate() >= d.getDate() ? 0 : -1);
    return Math.max(0, total);
  } catch {
    return 0;
  }
}

/* -------- Small UI helpers to match target visuals -------- */
const fmtMoney = (n: number, digits = 0) =>
  `$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: digits })}`;

function ComparisonRow({
  label,
  value,
  pct, // 0–100
  fillClass,
  trackClass,
  height = 22,
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
    <div className="mb-4">
      <div className="flex items-center justify-between text-sm font-semibold mb-2">
        <div>{label}</div>
        <div>{value}</div>
      </div>
      <div className={`w-full rounded-md overflow-hidden ${trackClass}`} style={{ height }}>
        <div className={`h-full ${fillClass}`} style={{ width: `${w}%`, transition: "width .2s ease" }} />
      </div>
    </div>
  );
}

/* ===========================================================
   Component
=========================================================== */

type Priority = "lowPayment" | "lowInterest";
type TermMode = "years" | "months";
type VAPurpose = "cashout" | "irrrl";
type VAUseType = "first" | "repeat" | "exempt";
type CostsHandling = "include" | "cash";

export default function VARefinanceCalculator() {
  // Left panel form state (existing block)
  const [priority, setPriority] = useState<Priority>("lowPayment");

  const [origAmount, setOrigAmount] = useState<number>(300000);
  const [origRate, setOrigRate] = useState<number>(5); // %
  const [origTermYears, setOrigTermYears] = useState<number>(30);
  const [termMode, setTermMode] = useState<TermMode>("years");
  const [origStart, setOrigStart] = useState<string>("2022-03-01");

  // ===== NEW LOAN (VA-specific rows) =====
  // Row 1: Current Loan Balance
  const [curBalance, setCurBalance] = useState<number>(250000);

  // Row 2: VA Refinance Purpose
  const [vaPurpose, setVaPurpose] = useState<VAPurpose>("cashout");

  // Row 3: Cash Out Amount
  const [cashOut, setCashOut] = useState<number>(10000);

  // Row 4: Refinance Costs
  const [refiCosts, setRefiCosts] = useState<number>(1000);

  // Row 5: VA Use (drives funding fee rate defaults for Row 6)
  const [vaUseType, setVaUseType] = useState<VAUseType>("first");

  // Row 6: VA Funding Fee (auto-defaults; editable)
  const [vaFundingRate, setVaFundingRate] = useState<number>(2.15);

  // Keep last non-IRRRL funding fee so we can restore when switching back from IRRRL
  const lastCashoutFundingRef = useRef<number>(2.15);

  // Row 11: Costs handling
  const [costsHandling, setCostsHandling] = useState<CostsHandling>("include");

  // Row 8: New Rate
  const [newRate, setNewRate] = useState<number>(3);

  // Row 9: New Loan Term with Year/Month toggle
  const [newTermMode, setNewTermMode] = useState<TermMode>("years");
  const [newTermYears, setNewTermYears] = useState<number>(15);
  const [newTermMonths, setNewTermMonths] = useState<number>(180);

  // Row 10: New Loan Start Date (defaults to current date)
  const todayISO = new Date().toISOString().slice(0, 10);
  const [newStart, setNewStart] = useState<string>(todayISO);

  /* ---------- VA defaults & IRRRL behavior ---------- */

  // Standard VA funding fee defaults when NOT IRRRL (Cash-Out path)
  useEffect(() => {
    if (vaPurpose === "cashout") {
      const std = vaUseType === "first" ? 2.15 : vaUseType === "repeat" ? 3.3 : 0;
      setVaFundingRate(std);
      lastCashoutFundingRef.current = std;
    }
  }, [vaUseType, vaPurpose]);

  // IRRRL rules:
  // - No cash-out allowed (force 0 and disable input)
  // - Funding fee 0.5% unless exempt (then 0)
  // - (optional) Prefer to include costs in the loan
  useEffect(() => {
    if (vaPurpose === "irrrl") {
      setCashOut(0);
      const irrFee = vaUseType === "exempt" ? 0 : 0.5;
      setVaFundingRate(irrFee);
      setCostsHandling("include"); // comment this line out if you don't want to auto-switch
    } else {
      // restore last cash-out funding fee (based on VA use)
      const std = vaUseType === "first" ? 2.15 : vaUseType === "repeat" ? 3.3 : 0;
      setVaFundingRate(std ?? lastCashoutFundingRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaPurpose, vaUseType]);

  // ===== Derived values for current loan (remaining balance & payments left) =====
  const elapsedMonths = monthsSince(origStart);
  const origTotalMonths = termMode === "years" ? origTermYears * 12 : origTermYears;
  const monthsRemaining = Math.max(0, origTotalMonths - elapsedMonths);

  const r0 = origRate / 100 / 12;
  const r1 = newRate / 100 / 12;

  const currentMonthly = useMemo(
    () => monthlyPayment(origAmount, r0, origTotalMonths),
    [origAmount, r0, origTotalMonths]
  );

  const currentBalanceNow = useMemo(
    () => balanceAfterMonths(origAmount, r0, origTotalMonths, elapsedMonths),
    [origAmount, r0, origTotalMonths, elapsedMonths]
  );

  // ===== NEW LOAN math (VA) =====
  // Base before funding fee:
  const newBaseAmount = useMemo(
    () =>
      (curBalance || 0) +
      (vaPurpose === "irrrl" ? 0 : cashOut || 0) + // IRRRL forbids cash-out
      (costsHandling === "include" ? refiCosts || 0 : 0),
    [curBalance, cashOut, refiCosts, costsHandling, vaPurpose]
  );

  // Funding fee derived from Row 6 rate (%)
  const vaFundingFeeAmt = useMemo(
    () => (newBaseAmount * (vaFundingRate || 0)) / 100,
    [newBaseAmount, vaFundingRate]
  );

  // Row 7: New Loan Amount = base + funding fee
  const newLoanAmount = useMemo(
    () => newBaseAmount + vaFundingFeeAmt,
    [newBaseAmount, vaFundingFeeAmt]
  );

  // New loan payment inputs
  const newTotalMonths = newTermMode === "years" ? newTermYears * 12 : newTermMonths;

  const newMonthly = useMemo(
    () => monthlyPayment(newLoanAmount, r1, newTotalMonths),
    [newLoanAmount, r1, newTotalMonths]
  );

  // KPIs
  const monthlyDelta = newMonthly - currentMonthly; // >0 increase, <0 decrease

  // Interest
  const currentRemainInterest = useMemo(
    () => totalInterestOverLife(currentBalanceNow, r0, monthsRemaining),
    [currentBalanceNow, r0, monthsRemaining]
  );
  const newLoanInterest = useMemo(
    () => totalInterestOverLife(newLoanAmount, r1, newTotalMonths),
    [newLoanAmount, r1, newTotalMonths]
  );
  const interestDifference = newLoanInterest - currentRemainInterest; // negative = savings

  // Recoup months (only meaningful when costs are paid out-of-pocket and monthly savings exist)
  const recoupMonths = useMemo(() => {
    const monthlySavings = -monthlyDelta; // positive if saving
    if (monthlySavings <= 0) return Number.NaN;
    if (costsHandling !== "cash") return Number.NaN;
    const upfront = refiCosts || 0;
    if (upfront <= 0) return Number.NaN;
    return upfront / monthlySavings;
  }, [monthlyDelta, refiCosts, costsHandling]);

  // small helper for segmented Y/M buttons
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

  return (
    <TooltipProvider>
      <div className="grid gap-6" style={{ gridTemplateColumns: "500px 1fr" }}>
        {/* LEFT PANEL */}
        <div className="fs-panel fs-fixed">
          <h2 className="fs-title">VA Refinance Calculator</h2>

          <div className="fs-body mt-2">
            {/* Priority */}
            <div className="fs-field">
              <label className="fs-label flex items-center gap-2">
                What is most important to you?
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
                        Choose whether you want the lowest monthly payment or to minimize total interest paid.
                      </p>
                    </div>
                  </TooltipContent>
                </UiTooltip>
              </label>

              <div className="va-radio">
                <button
                  type="button"
                  className={`va-radio__btn ${priority === "lowPayment" ? "is-active" : ""}`}
                  onClick={() => setPriority("lowPayment")}
                >
                  <span className="va-dot" /> Low Monthly Payment
                </button>
                <button
                  type="button"
                  className={`va-radio__btn ${priority === "lowInterest" ? "is-active" : ""}`}
                  onClick={() => setPriority("lowInterest")}
                >
                  <span className="va-dot" /> Lower Interest Paid
                </button>
              </div>
            </div>

            {/* Current loan */}
            <div className="fs-section mt-4">
              <div className="fs-section__title">Current Loan</div>

              <div className="fs-field mt-3">
                <label className="fs-label flex items-center">
                  Original Loan Amount
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="Original Loan Amount"
                        className="inline-flex items-center ml-2 text-[#FFFFFF] focus:outline-none"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                        <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                        <div className="font-bold mb-1">Original Loan Amount</div>
                        <p className="text-sm leading-5">
                          The amount you originally borrowed when you first took out the mortgage.
                        </p>
                      </div>
                    </TooltipContent>
                  </UiTooltip>
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={origAmount}
                  onChange={(e) => setOrigAmount(Number(e.target.value || 0))}
                  className="fs-input"
                />
              </div>

              <div className="fs-field mt-4">
                <label className="fs-label flex items-center">
                  Original Rate
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="Original Interest Rate"
                        className="inline-flex items-center ml-2 text-[#FFFFFF] focus:outline-none"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                        <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                        <div className="font-bold mb-1">Original Interest Rate</div>
                        <p className="text-sm leading-5">
                          Your initial annual interest rate (APR) for the current mortgage.
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

              <div className="fs-field mt-4">
                <label className="fs-label flex items-center">
                  Original Loan Term
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="Original Loan Term"
                        className="inline-flex items-center ml-2 text-[#FFFFFF] focus:outline-none"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                        <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                        <div className="font-bold mb-1">Original Loan Term</div>
                        <p className="text-sm leading-5">
                          How long your original mortgage was scheduled to last (in years or months).
                        </p>
                      </div>
                    </TooltipContent>
                  </UiTooltip>
                </label>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={origTermYears}
                    onChange={(e) => setOrigTermYears(Number(e.target.value || 0))}
                    className="fs-input"
                  />
                  <div className="fs-segment w-[160px]">
                    <button
                      type="button"
                      className="fs-segbtn"
                      aria-pressed={termMode === "years"}
                      onClick={() => setTermMode("years")}
                    >
                      Year
                    </button>
                    <button
                      type="button"
                      className="fs-segbtn"
                      aria-pressed={termMode === "months"}
                      onClick={() => setTermMode("months")}
                    >
                      Month
                    </button>
                  </div>
                </div>
              </div>

              <div className="fs-field mt-4">
                <label className="fs-label flex items-center">
                  Loan Start Date
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="Loan Start Date"
                        className="inline-flex items-center ml-2 text-[#FFFFFF] focus:outline-none"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                        <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                        <div className="font-bold mb-1">Loan Start Date</div>
                        <p className="text-sm leading-5">The month and year your current mortgage began.</p>
                      </div>
                    </TooltipContent>
                  </UiTooltip>
                </label>
                <Input
                  type="date"
                  value={origStart}
                  onChange={(e) => setOrigStart(e.target.value)}
                  className="fs-input"
                />
              </div>
            </div>

            {/* ===== NEW LOAN (VA) ===== */}
            <div className="fs-section mt-6">
              <div className="fs-section__title">New Loan (VA)</div>

              {/* Row 1: Current Loan Balance */}
              <div className="fs-field mt-3">
                <label className="fs-label flex items-center">
                  Current Loan Balance
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="Current Loan Balance" className="inline-flex items-center ml-2 text-[#FFFFFF] focus:outline-none">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                        <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                        <div className="font-bold mb-1">Current Loan Balance</div>
                        <p className="text-sm leading-5">Your payoff amount today for the existing mortgage.</p>
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

              {/* Row 2: VA Refinance Purpose */}
              <div className="fs-field mt-3">
                <label className="fs-label flex items-center">
                  VA Refinance Purpose
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="VA Refinance Purpose" className="inline-flex items-center ml-2 text-[#FFFFFF] focus:outline-none">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                        <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                        <div className="font-bold mb-1">Purpose</div>
                        <p className="text-sm leading-5">Choose Cash-Out Refinance or Interest Rate Reduction (IRRRL).</p>
                      </div>
                    </TooltipContent>
                  </UiTooltip>
                </label>
                <select
                  value={vaPurpose}
                  onChange={(e) => setVaPurpose(e.target.value as VAPurpose)}
                  className="fs-input fs-select"
                >
                  <option value="cashout">Cashout Refinance</option>
                  <option value="irrrl">Interest Rate Reduction (IRRRL)</option>
                </select>
              </div>

              {/* Row 3: Cash Out Amount */}
              <div className="fs-field mt-3">
                <label className="fs-label flex items-center">
                  Cash Out Amount
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="Cash Out Amount" className="inline-flex items-center ml-2 text-[#FFFFFF] focus:outline-none">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                        <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                        <div className="font-bold mb-1">Cash Out</div>
                        <p className="text-sm leading-5">Optional funds you take out above payoff and costs; increases the new loan amount.</p>
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
                  disabled={vaPurpose === "irrrl"}
                  placeholder={vaPurpose === "irrrl" ? "Not allowed for IRRRL" : undefined}
                />
              </div>

              {/* Row 4: Refinance Costs */}
              <div className="fs-field mt-3">
                <label className="fs-label flex items-center">
                  Refinance Costs
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="Refinance Costs" className="inline-flex items-center ml-2 text-[#FFFFFF] focus:outline-none">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                        <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                        <div className="font-bold mb-1">Refinance Costs</div>
                        <p className="text-sm leading-5">Estimated closing costs for the new mortgage.</p>
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

              {/* Row 5: VA Use Type */}
              <div className="fs-field mt-3">
                <label className="fs-label flex items-center">
                  This is my...
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="VA Use Type" className="inline-flex items-center ml-2 text-[#FFFFFF] focus:outline-none">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <div className="relative w-80 rounded-xl bg-[#44C264] text-white p-4">
                        <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                        <div className="font-bold mb-1">VA Funding Fee Defaults</div>
                        <p className="text-sm leading-5">
                          First time use → 2.15% • Used before → 3.3% • Exempt → 0% (IRRRL uses 0.5% unless exempt).
                        </p>
                      </div>
                    </TooltipContent>
                  </UiTooltip>
                </label>
                <select
                  value={vaUseType}
                  onChange={(e) => setVaUseType(e.target.value as VAUseType)}
                  className="fs-input fs-select"
                >
                  <option value="first">First Time Use of a VA Loan</option>
                  <option value="repeat">I Have Used a VA Loan Before</option>
                  <option value="exempt">I Am Exempt From the VA Funding Fee</option>
                </select>
              </div>

              {/* Row 6: VA Funding Fee (percent) — no % suffix pill */}
              <div className="fs-field mt-3">
                <label className="fs-label flex items-center">
                  VA Funding Fee
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="VA Funding Fee" className="inline-flex items-center ml-2 text-[#FFFFFF] focus:outline-none">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <div className="relative w-80 rounded-xl bg-[#44C264] text-white p-4">
                        <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                        <div className="font-bold mb-1">VA Funding Fee</div>
                        <p className="text-sm leading-5">
                          Defaults from your selection above. IRRRL typically uses 0.5% unless exempt.
                        </p>
                      </div>
                    </TooltipContent>
                  </UiTooltip>
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={vaFundingRate}
                  onChange={(e) => setVaFundingRate(Number(e.target.value || 0))}
                  className="fs-input"
                  placeholder="e.g., 2.15"
                />
                <div className="fs-sublabel">Funding fee amount: {fmtMoney(vaFundingFeeAmt, 0)}</div>
              </div>

              {/* Row 7: New Loan Amount (computed) */}
              <div className="fs-field mt-3">
                <label className="fs-label flex items-center">
                  New Loan Amount
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="New Loan Amount" className="inline-flex items-center ml-2 text-[#FFFFFF] focus:outline-none">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <div className="relative w-80 rounded-xl bg-[#44C264] text-white p-4">
                        <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                        <div className="font-bold mb-1">New Loan Amount</div>
                        <p className="text-sm leading-5">
                          Balance + (optional) rolled-in costs + cash-out (if allowed) + VA funding fee.
                        </p>
                      </div>
                    </TooltipContent>
                  </UiTooltip>
                </label>
                <div className="fs-readonly">{fmtMoney(newLoanAmount, 0)}</div>
              </div>

              {/* Row 8: New Rate — no % suffix pill */}
              <div className="fs-field mt-3">
                <label className="fs-label flex items-center">
                  New Rate
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="New Interest Rate" className="inline-flex items-center ml-2 text-[#FFFFFF] focus:outline-none">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                        <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                        <div className="font-bold mb-1">New Interest Rate</div>
                        <p className="text-sm leading-5">Your estimated annual interest rate (APR) for the refinance.</p>
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
                  placeholder="e.g., 3"
                />
              </div>

              {/* Row 9: New Loan Term with toggle */}
              <div className="fs-field mt-3">
                <label className="fs-label flex items-center">
                  New Loan Term
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="New Loan Term" className="inline-flex items-center ml-2 text-[#FFFFFF] focus:outline-none">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                        <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                        <div className="font-bold mb-1">New Loan Term</div>
                        <p className="text-sm leading-5">Set the new mortgage length in years or months.</p>
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
                  <div className="fs-segment w-[160px]">
                    <button
                      type="button"
                      className="fs-segbtn"
                      aria-pressed={newTermMode === "years"}
                      onClick={() => setNewTermMode("years")}
                    >
                      Year
                    </button>
                    <button
                      type="button"
                      className="fs-segbtn"
                      aria-pressed={newTermMode === "months"}
                      onClick={() => setNewTermMode("months")}
                    >
                      Month
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 10: New Loan Start Date */}
              <div className="fs-field mt-3">
                <label className="fs-label flex items-center">
                  New Loan Start Date
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="New Loan Start Date" className="inline-flex items-center ml-2 text-[#FFFFFF] focus:outline-none">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                        <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                        <div className="font-bold mb-1">New Loan Start Date</div>
                        <p className="text-sm leading-5">When your new mortgage will begin.</p>
                      </div>
                    </TooltipContent>
                  </UiTooltip>
                </label>
                <Input
                  type="date"
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                  className="fs-input"
                />
              </div>

              {/* Row 11: Paying Refinance Costs */}
              <div className="fs-field mt-3">
                <label className="fs-label flex items-center">
                  Paying Refinance Costs
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="How to Pay Costs" className="inline-flex items-center ml-2 text-[#FFFFFF] focus:outline-none">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <div className="relative w-80 rounded-xl bg-[#44C264] text-white p-4">
                        <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                        <div className="font-bold mb-1">How to Pay Costs</div>
                        <p className="text-sm leading-5">
                          Include closing costs in your new loan (Include in loan) or pay out of pocket at closing.
                        </p>
                      </div>
                    </TooltipContent>
                  </UiTooltip>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    style={{ color: costsHandling === "include" ? "#0F2C4C" : "#71737A" }}
                    variant={costsHandling === "include" ? "default" : "secondary"}
                    onClick={() => setCostsHandling("include")}
                  >
                    Include in loan
                  </Button>
                  <Button
                    style={{ color: costsHandling === "cash" ? "#0F2C4C" : "#71737A" }}
                    variant={costsHandling === "cash" ? "default" : "secondary"}
                    onClick={() => setCostsHandling("cash")}
                    disabled={vaPurpose === "irrrl" ? false : false} // keep both options; disable if you want to force roll-in
                  >
                    Pay out of pocket
                  </Button>
                </div>
              </div>
            </div>

            <Button asChild className="fs-cta w-full mt-5">
  <a href="https://creomortgage.com/#form" target="_blank" rel="noopener noreferrer">
    GET A QUOTE
  </a>
</Button>

          </div>
        </div>

        {/* RIGHT CONTENT — responsive height only (no fixed heights) */}
        <div className="grid gap-4 max-h-[64px]">
          {/* Banners row (two side-by-side) */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rf-banner flex items-center">
              {monthlyDelta >= 0
                ? `Your monthly payment will increase ${fmtMoney(Math.abs(monthlyDelta), 0)} per month.`
                : `Your monthly payment will decrease ${fmtMoney(Math.abs(monthlyDelta), 0)} per month.`}
            </div>
            <div className="rf-banner flex items-center justify-center text-center">
              {isFinite(recoupMonths)
                ? `It will take you ${recoupMonths.toLocaleString(undefined, { maximumFractionDigits: 1, })} months to recoup the cost to refinance.`
                : `--`}
            </div>
          </div>

          {/* KPI tiles (4) */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rf-kpi">
              <div className="rf-kpi__label">Monthly Payment {monthlyDelta >= 0 ? "Increase" : "Decrease"}</div>
              <div className="rf-kpi__value">{fmtMoney(Math.abs(monthlyDelta), 0)}</div>
            </div>

            <div className="rf-kpi">
              <div className="rf-kpi__label">Total Interest Difference</div>
              <div className="rf-kpi__value">
                {interestDifference >= 0 ? "" : "-"}
                {fmtMoney(Math.abs(interestDifference), 0)}
              </div>
            </div>

            <div className="rf-kpi">
              <div className="rf-kpi__label">Refinance Costs</div>
              <div className="rf-kpi__value">{fmtMoney(refiCosts, 0)}</div>
            </div>

            <div className="rf-kpi">
              <div className="rf-kpi__label">Time to Recoup Fees</div>
              <div className="rf-kpi__value">
                {isFinite(recoupMonths)
                  ? `${recoupMonths.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  : "—"}
              </div>
            </div>
          </div>

          {/* Comparison cards (2) */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="pc-card">
              <CardHeader className="pc-card__header">
                <CardTitle className="pc-card__title">Monthly Payment Comparison</CardTitle>
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="Monthly Payment Comparison" className="pc-info inline-flex items-center">
                      <Info size={16} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                    <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                      <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                      <div className="font-bold mb-1">Monthly Payment Comparison</div>
                      <p className="text-sm leading-5">
                        Compare your current monthly payment to the new payment if you refinance.
                      </p>
                    </div>
                  </TooltipContent>
                </UiTooltip>
              </CardHeader>
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
                        value={`${monthlyDelta >= 0 ? "+" : "-"}${fmtMoney(Math.abs(monthlyDelta), 0)}`}
                        pct={(Math.abs(monthlyDelta) / maxPay) * 100}
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
                <CardTitle className="pc-card__title">Total Interest Comparison</CardTitle>
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="Total Interest Comparison"
                      className="pc-info inline-flex items-center"
                    >
                      <Info size={16} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                    <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                      <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                      <div className="font-bold mb-1">Total Interest Comparison</div>
                      <p className="text-sm leading-5">
                        Compare remaining interest on your current loan versus the new loan.
                      </p>
                    </div>
                  </TooltipContent>
                </UiTooltip>
              </CardHeader>
              <CardContent className="pc-card__body">
                {(() => {
                  const maxInt = Math.max(currentRemainInterest, newLoanInterest, Math.abs(interestDifference)) || 1;
                  return (
                    <>
                      <ComparisonRow
                        label="Current Loan Remaining Interest"
                        value={fmtMoney(currentRemainInterest, 0)}
                        pct={(currentRemainInterest / maxInt) * 100}
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
                        value={`${interestDifference >= 0 ? "" : "-"}${fmtMoney(Math.abs(interestDifference), 0)}`}
                        pct={(Math.abs(interestDifference) / maxInt) * 100}
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
    </TooltipProvider>
  );
}

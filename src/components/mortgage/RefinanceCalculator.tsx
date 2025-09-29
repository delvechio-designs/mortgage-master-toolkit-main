import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";

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
function remainingBalance(originalPrincipal: number, annualRatePct: number, totalMonths: number, monthsPaid: number) {
  const r = annualRatePct / 100 / 12;
  if (totalMonths <= 0) return 0;
  if (monthsPaid <= 0) return originalPrincipal;
  if (monthsPaid >= totalMonths) return 0;
  if (r === 0) {
    const principalPaid = (originalPrincipal / totalMonths) * monthsPaid;
    return Math.max(0, originalPrincipal - principalPaid);
  }
  const m = pmt(originalPrincipal, annualRatePct, totalMonths);
  // Standard remaining balance formula
  const bal = originalPrincipal * Math.pow(1 + r, monthsPaid) - (m / r) * (Math.pow(1 + r, monthsPaid) - 1);
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

/* -----------------------------------------------
   Component
----------------------------------------------- */

export default function RefinanceCalculator() {
  /* ---------- Sidebar form state ---------- */

  // Importance
  const [priority, setPriority] = useState<"low-payment" | "low-interest">("low-payment");

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

  const currentMonthly = useMemo(() => pmt(origAmount, origRate, totalMonths), [origAmount, origRate, totalMonths]);

  const estRemainingBalance = useMemo(
    () => remainingBalance(origAmount, origRate, totalMonths, paidMonths),
    [origAmount, origRate, totalMonths, paidMonths]
  );

  // New loan amount (balance + optional costs + cash-out)
  const newLoanAmount = useMemo(
    () => (curBalance || 0) + (costsHandling === "roll" ? (refiCosts || 0) : 0) + (cashOut || 0),
    [curBalance, refiCosts, cashOut, costsHandling]
  );

  const newTotalMonths = newTermMode === "years" ? newTermYears * 12 : newTermMonths;
  const newMonthly = useMemo(() => pmt(newLoanAmount, newRate, newTotalMonths), [newLoanAmount, newRate, newTotalMonths]);

  // Bars + KPI math
  const monthlyDiff = useMemo(() => newMonthly - currentMonthly, [newMonthly, currentMonthly]);

  // Remaining interest on current loan (from now)
  const currentRemainingInterest = useMemo(() => {
    if (remainingMonths <= 0) return 0;
    const pay = pmt(estRemainingBalance, origRate, remainingMonths);
    return pay * remainingMonths - estRemainingBalance;
  }, [estRemainingBalance, origRate, remainingMonths]);

  // New loan total interest
  const newLoanInterest = useMemo(() => newMonthly * newTotalMonths - newLoanAmount, [newMonthly, newTotalMonths, newLoanAmount]);

  const interestDiff = useMemo(() => newLoanInterest - currentRemainingInterest, [newLoanInterest, currentRemainingInterest]);

  // Recoup months (only meaningful if monthly payment decreases and costs paid out-of-pocket)
  const recoupMonths = useMemo(() => {
    const monthlySavings = -monthlyDiff; // positive when newMonthly < currentMonthly
    if (monthlySavings <= 0) return Number.NaN;
    const upfront = costsHandling === "cash" ? refiCosts : 0;
    if (upfront <= 0) return Number.NaN;
    return upfront / monthlySavings;
  }, [monthlyDiff, refiCosts, costsHandling]);

  const recoupText = isFinite(recoupMonths)
    ? `It will take you ${recoupMonths.toLocaleString(undefined, { maximumFractionDigits: 1 })} months to recoup the cost to refinance.`
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
      <button type="button" className="fs-segbtn" aria-pressed={value === left} onClick={() => onChange(left)}>
        {left}
      </button>
      <button type="button" className="fs-segbtn" aria-pressed={value === right} onClick={() => onChange(right)}>
        {right}
      </button>
    </div>
  );

  const Bar = ({ value, max = 1, dark = false, rightLabel }: { value: number; max?: number; dark?: boolean; rightLabel?: string }) => {
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    return (
      <div className="w-full h-6 rounded-md bg-green-50 relative">
        <div
          className={`h-6 rounded-md ${dark ? "bg-neutral-800/90" : "bg-green-500/70"}`}
          style={{ width: `${pct}%`, transition: "width .2s ease" }}
        />
        {rightLabel && <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold">{rightLabel}</div>}
      </div>
    );
  };

  /* ---------- Render ---------- */

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "550px 1fr 1fr" }}>
      {/* LEFT SIDEBAR */}
      <div className="fs-panel fs-fixed">
        <h2 className="fs-title">Refinance Calculator</h2>

        <div className="fs-body mt-2">
          {/* What matters */}
          <div className="fs-field">
            <label className="fs-label flex items-center gap-2">
              What is most important to you?
              <span title="Lorem ipsum tooltip."><Info size={14} className="opacity-70" /></span>
            </label>
            <div className="grid gap-2">
              <button
                type="button"
                className={`fs-readonly justify-between ${priority === "low-payment" ? "ring-2 ring-green-400" : ""}`}
                onClick={() => setPriority("low-payment")}
              >
                <span>Low Monthly Payment</span>
                <span className="text-xs opacity-75">(recommended)</span>
              </button>
              <button
                type="button"
                className={`fs-readonly justify-between ${priority === "low-interest" ? "ring-2 ring-green-400" : ""}`}
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
              Original Loan Amount <span title="Lorem ipsum tooltip."><Info size={14} className="opacity-70" /></span>
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
              Original Rate <span title="Lorem ipsum tooltip."><Info size={14} className="opacity-70" /></span>
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
              Original Loan Term <span title="Lorem ipsum tooltip."><Info size={14} className="opacity-70" /></span>
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
              Loan Start Date <span title="Lorem ipsum tooltip."><Info size={14} className="opacity-70" /></span>
            </label>
            <Input type="month" value={origStartDate.slice(0, 7)} onChange={(e) => setOrigStartDate(`${e.target.value}-01`)} className="fs-input" />
          </div>

      {/* New Loan */}
          <div className="fs-field mt-6">
            <label className="fs-label">New Loan</label>
          </div>

          <div className="fs-field">
            <label className="fs-label">
              Current Loan Balance <span title="Lorem ipsum tooltip."><Info size={14} className="opacity-70" /></span>
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
              Cash Out Amount <span title="Lorem ipsum tooltip."><Info size={14} className="opacity-70" /></span>
            </label>
            <Input type="text" inputMode="decimal" value={cashOut} onChange={(e) => setCashOut(Number(e.target.value || 0))} className="fs-input" />
          </div>

          <div className="fs-field mt-3">
            <label className="fs-label">
              Refinance Costs <span title="Lorem ipsum tooltip."><Info size={14} className="opacity-70" /></span>
            </label>
            <Input type="text" inputMode="decimal" value={refiCosts} onChange={(e) => setRefiCosts(Number(e.target.value || 0))} className="fs-input" />
              </div>

          <div className="fs-field mt-3">
            <label className="fs-label">
              New Loan Amount <span title="Lorem ipsum tooltip."><Info size={14} className="opacity-70" /></span>
            </label>
            <div className="fs-readonly">
              ${newLoanAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="fs-field mt-3">
            <label className="fs-label">
              New Rate <span title="Lorem ipsum tooltip."><Info size={14} className="opacity-70" /></span>
            </label>
            <Input type="text" inputMode="decimal" value={newRate} onChange={(e) => setNewRate(Number(e.target.value || 0))} className="fs-input" />
                </div>

          <div className="fs-field mt-3">
            <label className="fs-label">
              New Loan Term <span title="Lorem ipsum tooltip."><Info size={14} className="opacity-70" /></span>
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
              New Loan Start Date <span title="Lorem ipsum tooltip."><Info size={14} className="opacity-70" /></span>
            </label>
            <Input type="month" value={newStartDate.slice(0, 7)} onChange={(e) => setNewStartDate(`${e.target.value}-01`)} className="fs-input" />
                </div>

          <div className="fs-field mt-3">
            <label className="fs-label">
              Paying Refinance Costs <span title="Lorem ipsum tooltip."><Info size={14} className="opacity-70" /></span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={costsHandling === "roll" ? "default" : "secondary"} onClick={() => setCostsHandling("roll")}>
                Include in Loan
              </Button>
              <Button variant={costsHandling === "cash" ? "default" : "secondary"} onClick={() => setCostsHandling("cash")}>
                Pay Out Of Pocket
              </Button>
            </div>
            </div>

          <button className="fs-cta mt-5 w-full">GET A QUOTE</button>
                  </div>
                </div>
                
      {/* RIGHT SIDE (two columns) */}
      <div className="col-span-2 grid gap-4">
        {/* Banners row */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rf-banner">
            {monthlyDiff >= 0
              ? `Your monthly payment will increase $${Math.abs(monthlyDiff).toLocaleString(undefined, { maximumFractionDigits: 0 })} per month.`
              : `Your monthly payment will decrease $${Math.abs(monthlyDiff).toLocaleString(undefined, { maximumFractionDigits: 0 })} per month.`}
                  </div>
          <div className="rf-banner">{recoupText}</div>
                </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rf-kpi">
            <div className="rf-kpi__label">Monthly Payment {monthlyDiff >= 0 ? "Increase" : "Decrease"}</div>
            <div className="rf-kpi__value">
              ${Math.abs(monthlyDiff).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
              </div>
          <div className="rf-kpi">
            <div className="rf-kpi__label">Total Interest Difference</div>
            <div className="rf-kpi__value">
              {interestDiff >= 0 ? "" : "-$"}
              {Math.abs(interestDiff).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="rf-kpi">
            <div className="rf-kpi__label">Refinance Costs</div>
            <div className="rf-kpi__value">${refiCosts.toLocaleString()}</div>
          </div>
          <div className="rf-kpi">
            <div className="rf-kpi__label">Time to Recoup Fees</div>
            <div className="rf-kpi__value">
              {isFinite(recoupMonths) ? `${recoupMonths.toLocaleString(undefined, { maximumFractionDigits: 1 })} months` : "—"}
            </div>
          </div>
        </div>

        {/* Comparison cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Monthly Payment Comparison */}
          <Card className="pc-card">
            <CardHeader className="pc-card__header">
              <CardTitle className="pc-card__title">Monthly Payment Comparison</CardTitle>
              <span className="pc-info" title="Lorem ipsum tooltip.">
                <Info size={16} />
              </span>
            </CardHeader>
            <CardContent className="pc-card__body space-y-4">
              <div className="text-sm font-semibold">Current Loan</div>
              <Bar
                value={currentMonthly}
                max={Math.max(currentMonthly, newMonthly) || 1}
                dark
                rightLabel={`$${currentMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              />

              <div className="text-sm font-semibold mt-3">New Loan</div>
              <Bar
                value={newMonthly}
                max={Math.max(currentMonthly, newMonthly) || 1}
                rightLabel={`$${newMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              />

              <div className="text-sm font-semibold mt-3">Monthly Payment Difference</div>
              <Bar
                value={Math.abs(monthlyDiff)}
                max={Math.max(currentMonthly, newMonthly) || 1}
                rightLabel={`${monthlyDiff >= 0 ? "+" : "-"}$${Math.abs(monthlyDiff).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}`}
              />
            </CardContent>
          </Card>

          {/* Total Interest Comparison */}
          <Card className="pc-card">
            <CardHeader className="pc-card__header">
              <CardTitle className="pc-card__title">Total Interest Comparison</CardTitle>
              <span className="pc-info" title="Lorem ipsum tooltip.">
                <Info size={16} />
              </span>
            </CardHeader>
            <CardContent className="pc-card__body space-y-4">
              <div className="text-sm font-semibold">Current Loan Remaining Interest</div>
              <Bar
                value={currentRemainingInterest}
                max={Math.max(currentRemainingInterest, newLoanInterest) || 1}
                dark
                rightLabel={`$${currentRemainingInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              />

              <div className="text-sm font-semibold mt-3">New Loan Interest</div>
              <Bar
                value={newLoanInterest}
                max={Math.max(currentRemainingInterest, newLoanInterest) || 1}
                rightLabel={`$${newLoanInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              />

              <div className="text-sm font-semibold mt-3">Total Interest Difference</div>
              <Bar
                value={Math.abs(interestDiff)}
                max={Math.max(currentRemainingInterest, newLoanInterest) || 1}
                rightLabel={`${interestDiff >= 0 ? "" : "-"}$${Math.abs(interestDiff).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}`}
              />
        </CardContent>
      </Card>
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";

/**
 * Helper — amortization payment (monthly P&I)
 */
function monthlyPayment(principal: number, monthlyRate: number, nMonths: number) {
  if (principal <= 0 || nMonths <= 0) return 0;
  if (monthlyRate === 0) return principal / nMonths;
  const r = monthlyRate;
  return principal * (r * Math.pow(1 + r, nMonths)) / (Math.pow(1 + r, nMonths) - 1);
}

/**
 * Helper — balance after k months (standard amortization)
 */
function balanceAfterMonths(principal: number, monthlyRate: number, nMonths: number, k: number) {
  if (principal <= 0 || nMonths <= 0) return 0;
  const pmt = monthlyPayment(principal, monthlyRate, nMonths);
  if (monthlyRate === 0) return Math.max(0, principal - pmt * k);
  const r = monthlyRate;
  // Remaining balance formula
  const bal = principal * Math.pow(1 + r, k) - pmt * ( (Math.pow(1 + r, k) - 1) / r );
  return Math.max(0, bal);
}

/**
 * Helper — total interest paid over the remaining life of the loan
 */
function totalInterestOverLife(principal: number, monthlyRate: number, nMonths: number) {
  if (principal <= 0 || nMonths <= 0) return 0;
  const pmt = monthlyPayment(principal, monthlyRate, nMonths);
  return pmt * nMonths - principal;
}

/**
 * Helper — months between two yyyy-mm or yyyy-mm-dd strings and now
 */
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

export default function VARefinanceCalculator() {
  // Left panel form state
  const [priority, setPriority] = useState<"lowPayment" | "lowInterest">("lowPayment");

  const [origAmount, setOrigAmount] = useState<number>(300000);
  const [origRate, setOrigRate] = useState<number>(5); // %
  const [origTermYears, setOrigTermYears] = useState<number>(30);
  const [termMode, setTermMode] = useState<"years" | "months">("years");
  const [origStart, setOrigStart] = useState<string>("2022-03-01");

  const [newRate, setNewRate] = useState<number>(5.75);
  const [newTermYears, setNewTermYears] = useState<number>(30);

  // Right-side constants
  const refinanceCosts = 1000;

  // Derived values for current loan (remaining balance & payments left)
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

  // New loan is based on remaining balance (classic VA refi scenario).
  const newTotalMonths = newTermYears * 12;
  const newMonthly = useMemo(
    () => monthlyPayment(currentBalanceNow, r1, newTotalMonths),
    [currentBalanceNow, r1, newTotalMonths]
  );

  // Top KPIs
  const monthlyDelta = newMonthly - currentMonthly; // >0 increase, <0 decrease
  const kpiMonthlyText = Math.abs(monthlyDelta).toLocaleString(undefined, { maximumFractionDigits: 0 });

  // Total interest (remaining current vs new loan)
  const currentRemainInterest = useMemo(
    () => totalInterestOverLife(currentBalanceNow, r0, monthsRemaining),
    [currentBalanceNow, r0, monthsRemaining]
  );
  const newLoanInterest = useMemo(
    () => totalInterestOverLife(currentBalanceNow, r1, newTotalMonths),
    [currentBalanceNow, r1, newTotalMonths]
  );
  const interestDifference = newLoanInterest - currentRemainInterest; // negative means savings

  // Recoup months (if new payment is higher because of refi fees)
  const recoupMonths = monthlyDelta > 0 ? refinanceCosts / monthlyDelta : Number.NaN;

  // Progress % helpers (for the comparison bars)
  const barPct = (val: number, max: number) => (max <= 0 ? 0 : Math.max(0, Math.min(100, (val / max) * 100)));

  // For the interest comparison card we visualize three bars:
  // 1) Current remaining interest
  // 2) New loan interest
  // 3) Absolute interest difference (positive length; label shows sign)
  const maxInterest = Math.max(currentRemainInterest, newLoanInterest, Math.abs(interestDifference));

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "430px 1fr" }}>
      {/* LEFT PANEL */}
      <div className="fs-panel fs-fixed">
        <h2 className="fs-title">VA Refinance Calculator</h2>

        <div className="fs-body mt-2">
          {/* Priority */}
          <div className="fs-field">
            <label className="fs-label">What is most important to you?</label>

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
              <label className="fs-label">
                Original Loan Amount <i className="fs-i">?</i>
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
              <label className="fs-label">
                Original Rate <i className="fs-i">?</i>
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
              <label className="fs-label">
                Original Loan Term <i className="fs-i">?</i>
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
              <label className="fs-label">
                Loan Start Date <i className="fs-i">?</i>
              </label>
              <Input
                type="date"
                value={origStart}
                onChange={(e) => setOrigStart(e.target.value)}
                className="fs-input"
              />
            </div>
          </div>

          {/* New loan */}
          <div className="fs-section mt-6">
            <div className="fs-section__title">New Loan</div>

            <div className="fs-field mt-3">
              <label className="fs-label">
                New Rate <i className="fs-i">?</i>
              </label>
              <Input
                type="text"
                inputMode="decimal"
                value={newRate}
                onChange={(e) => setNewRate(Number(e.target.value || 0))}
                className="fs-input"
              />
            </div>

            <div className="fs-field mt-4">
              <label className="fs-label">
                New Loan Term (Years) <i className="fs-i">?</i>
              </label>
              <Input
                type="text"
                inputMode="numeric"
                value={newTermYears}
                onChange={(e) => setNewTermYears(Number(e.target.value || 0))}
                className="fs-input"
              />
            </div>
          </div>

          <Button className="fs-cta mt-6 w-full">GET A QUOTE</Button>
        </div>
      </div>

      {/* RIGHT CONTENT */}
      <div className="grid gap-6">
        {/* Banner */}
        <div className="va-refi-banner">
          {monthlyDelta > 0 ? (
            <>Your monthly payment will increases ${Math.abs(monthlyDelta).toLocaleString(undefined, { maximumFractionDigits: 0 })} per month.</>
          ) : monthlyDelta < 0 ? (
            <>Your monthly payment will decreases ${Math.abs(monthlyDelta).toLocaleString(undefined, { maximumFractionDigits: 0 })} per month.</>
          ) : (
            <>Your monthly payment will not change.</>
          )}
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-4 gap-6">
          <div className="va-refi-kpi">
            <div className="va-refi-kpi__label">Monthly Payment {monthlyDelta > 0 ? "Increase" : "Decrease"}</div>
            <div className="va-refi-kpi__value">$ {kpiMonthlyText}</div>
          </div>

          <div className="va-refi-kpi">
            <div className="va-refi-kpi__label">Total Interest Difference</div>
            <div className="va-refi-kpi__value">
              {interestDifference >= 0 ? "" : "-$"}{Math.abs(interestDifference).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>

          <div className="va-refi-kpi">
            <div className="va-refi-kpi__label">Refinance Costs</div>
            <div className="va-refi-kpi__value">$ {refinanceCosts.toLocaleString()}</div>
          </div>

          <div className="va-refi-kpi">
            <div className="va-refi-kpi__label">Time to Recoup Fees</div>
            <div className="va-refi-kpi__value">
              {isFinite(recoupMonths) && recoupMonths > 0
                ? `${recoupMonths.toFixed(1)} months`
                : "—"}
            </div>
          </div>
        </div>

        {/* Two comparison cards */}
        <div className="grid grid-cols-2 gap-6">
          {/* Monthly Payment Comparison */}
          <Card className="va-refi-card">
            <CardHeader className="va-refi-card__header">
              <CardTitle className="va-refi-card__title">Monthly Payment Comparison</CardTitle>
              <span className="pc-info" title="Lorem ipsum dolor sit amet, consectetur adipisicing elit.">
                <Info size={16} />
              </span>
            </CardHeader>
            <CardContent className="va-refi-card__body">
              <div className="va-row">
                <div className="va-row__label">Current Loan</div>
                <div className="va-row__val">${currentMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="va-bar">
                <div className="va-bar__fill va-bar__fill--dark" style={{ width: "70%" }} />
                <div className="va-bar__fill va-bar__fill--light" />
              </div>

              <div className="va-row mt-4">
                <div className="va-row__label">New Loan</div>
                <div className="va-row__val">${newMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="va-bar">
                <div className="va-bar__fill va-bar__fill--pink" style={{ width: "95%" }} />
              </div>

              <div className="va-row mt-4">
                <div className="va-row__label">Monthly Payment Difference</div>
                <div className="va-row__val">
                  {monthlyDelta >= 0 ? "$" : "-$"}
                  {Math.abs(monthlyDelta).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="va-bar">
                <div
                  className="va-bar__fill va-bar__fill--pink"
                  style={{ width: `${barPct(Math.abs(monthlyDelta), Math.max(currentMonthly, newMonthly))}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Total Interest Comparison */}
          <Card className="va-refi-card">
            <CardHeader className="va-refi-card__header">
              <CardTitle className="va-refi-card__title">Total Interest Comparison</CardTitle>
              <span className="pc-info" title="Lorem ipsum dolor sit amet, consectetur adipisicing elit.">
                <Info size={16} />
              </span>
            </CardHeader>
            <CardContent className="va-refi-card__body">
              <div className="va-row">
                <div className="va-row__label">Current Loan Remaining Interest</div>
                <div className="va-row__val">${currentRemainInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="va-bar">
                <div
                  className="va-bar__fill va-bar__fill--dark"
                  style={{ width: `${barPct(currentRemainInterest, maxInterest)}%` }}
                />
              </div>

              <div className="va-row mt-4">
                <div className="va-row__label">New Loan Interest</div>
                <div className="va-row__val">${newLoanInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="va-bar">
                <div
                  className="va-bar__fill va-bar__fill--green"
                  style={{ width: `${barPct(newLoanInterest, maxInterest)}%` }}
                />
                <div className="va-bar__fill va-bar__fill--light" />
              </div>

              <div className="va-row mt-4">
                <div className="va-row__label">Total Interest Difference</div>
                <div className="va-row__val">
                  {interestDifference >= 0 ? "$" : "-$"}
                  {Math.abs(interestDifference).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="va-bar">
                <div
                  className="va-bar__fill va-bar__fill--green"
                  style={{ width: `${barPct(Math.abs(interestDifference), maxInterest)}%` }}
                />
                <div className="va-bar__fill va-bar__fill--light" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

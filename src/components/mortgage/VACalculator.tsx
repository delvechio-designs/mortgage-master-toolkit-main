import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label } from "recharts";
import { Info } from "lucide-react";

/* -------------------------------------------------------
   Helpers
------------------------------------------------------- */

// center label inside Recharts donut
function renderCenterMonthlyLabel(totalMonthly: number) {
  return ({ viewBox }: any) => {
    if (!viewBox || typeof viewBox.cx !== "number" || typeof viewBox.cy !== "number") return null;
    const { cx, cy } = viewBox;
    return (
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
        <tspan fontSize="16" fontWeight="700">
          ${totalMonthly.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </tspan>
        <tspan x={cx} dy="18" fontSize="12" fill="#6b7280">per month</tspan>
      </text>
    );
  };
}

// amortize baseline schedule (no extras) — returns { months, totalInterest }
function amortizeBaseline(principal: number, r: number, payment: number) {
  let bal = principal;
  let months = 0;
  let interestPaid = 0;

  if (payment <= bal * r) {
    // payment too low; avoid infinite loop
    return { months: 3600, totalInterest: Number.NaN };
  }
  while (bal > 0 && months < 3600) {
    const interest = bal * r;
    interestPaid += interest;
    const principalPay = payment - interest;
    bal = Math.max(0, bal - principalPay);
    months++;
  }
  return { months, totalInterest: interestPaid };
}

// amortize with extras (monthly add + frequency factor + lump-sum cadence)
function amortizeWithExtras(
  principal: number,
  r: number,
  payment: number,
  extraMonthly: number,
  freqFactor: number, // 1 (monthly), 26/12 (biweekly), 52/12 (weekly)
  lumpSum: number,
  lumpFreq: "once" | "yearly" | "quarterly"
) {
  let bal = principal;
  let months = 0;
  let interestPaid = 0;

  if (payment <= bal * r) {
    return { months: 3600, totalInterest: Number.NaN };
  }

  while (bal > 0 && months < 3600) {
    const interest = bal * r;
    interestPaid += interest;
    let principalPay = payment - interest;

    // extra payment (frequency-adjusted)
    principalPay += extraMonthly * freqFactor;

    // lump sum cadence
    if (lumpSum > 0) {
      if (
        (lumpFreq === "once" && months === 0) ||
        (lumpFreq === "yearly" && (months + 1) % 12 === 1) ||
        (lumpFreq === "quarterly" && (months + 1) % 3 === 1)
      ) {
        principalPay += lumpSum;
      }
    }

    bal = Math.max(0, bal - principalPay);
    months++;
  }

  return { months, totalInterest: interestPaid };
}

/* -------------------------------------------------------
   Component
------------------------------------------------------- */

export default function VAPurchaseCalculator() {
  /* ---------- LEFT PANEL (14 rows) ---------- */

  // 1. Home Value
  const [homeValue, setHomeValue] = useState<number>(200000);

  // 2. Down Payment ($/%)
  const [downMode, setDownMode] = useState<"amount" | "percent">("amount");
  const [downValue, setDownValue] = useState<number>(0);

  // 3. Base Mortgage Amount (derived)
  const downPayment = useMemo(
    () => (downMode === "percent" ? (homeValue * (downValue || 0)) / 100 : (downValue || 0)),
    [homeValue, downMode, downValue]
  );
  const baseLoan = Math.max(0, homeValue - downPayment);

  // 4. Loan Terms (Year/Month)
  const [termMode, setTermMode] = useState<"years" | "months">("years");
  const [loanYears, setLoanYears] = useState<number>(30);
  const [loanMonths, setLoanMonths] = useState<number>(360);

  // 5. Payment Frequency toggle (Year / Month) — display only
  const [payFreq, setPayFreq] = useState<"year" | "month">("year");

  // 6. Interest Rate
  const [rate, setRate] = useState<number>(5);

  // 7. “This is my…” dropdown (simplified VA options)
  const [vaUse, setVaUse] = useState<"first" | "subsequent" | "exempt">("first");

  // 8. VA Funding Fee (calculated)
  const downPct = homeValue > 0 ? (downPayment / homeValue) * 100 : 0;
  // VA fee table (most common)
  const feeRate = useMemo(() => {
    if (vaUse === "exempt") return 0;
    const bandsFirst = (pct: number) => (pct >= 10 ? 1.25 : pct >= 5 ? 1.5 : 2.15);
    const bandsSub  = (pct: number) => (pct >= 10 ? 1.25 : pct >= 5 ? 1.5 : 3.3);
    return vaUse === "first" ? bandsFirst(downPct) : bandsSub(downPct);
  }, [vaUse, downPct]);
  const vaFundingFee = baseLoan * (feeRate / 100);

  // 9. Final Mortgage Amount (derived)
  const finalLoan = Math.max(0, baseLoan + vaFundingFee);

  // 10. Property Tax (Yearly, $/%)
  const [taxMode, setTaxMode] = useState<"amount" | "percent">("percent");
  const [taxValue, setTaxValue] = useState<number>(0.6); // %
  const yearlyTax = taxMode === "percent" ? homeValue * (taxValue || 0) / 100 : (taxValue || 0);
  const monthlyTax = yearlyTax / 12;

  // 11. Homeowners Insurance (Yearly, $/%)
  const [insMode, setInsMode] = useState<"amount" | "percent">("amount");
  const [insValue, setInsValue] = useState<number>(1200); // $
  const yearlyIns = insMode === "amount" ? (insValue || 0) : homeValue * (insValue || 0) / 100;
  const monthlyIns = yearlyIns / 12;

  // 12. HOA dues per month
  const [hoa, setHoa] = useState<number>(0);

  // 13. First Payment Date
  const [firstPaymentDate, setFirstPaymentDate] = useState<string>(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  });

  // 14. Extra payment per month
  const [extraMonthly, setExtraMonthly] = useState<number>(0);

  // Early payoff / Lump sum (right sidebar controls)
  const [increaseFreq, setIncreaseFreq] = useState<"monthly" | "biweekly" | "weekly">("monthly");
  const [lumpSum, setLumpSum] = useState<number>(0);
  const [lumpFreq, setLumpFreq] = useState<"once" | "yearly" | "quarterly">("once");

  /* ---------- Derived monthly payment ---------- */

  const n = termMode === "years" ? loanYears * 12 : loanMonths;
  const r = rate / 100 / 12;

  const monthlyPI = r
    ? finalLoan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    : (n > 0 ? finalLoan / n : 0);

  const totalMonthly = monthlyPI + monthlyTax + monthlyIns + (hoa || 0) + (extraMonthly || 0);

  /* ---------- Donut data ---------- */

  const paymentBreakdown = [
    { name: "Principal & Interest", value: monthlyPI,    color: "#f39c12" },
    { name: "Taxes",                value: monthlyTax,   color: "#2ecc71" },
    { name: "Insurance",            value: monthlyIns,   color: "#e91e63" },
    { name: "HOA Dues",             value: hoa,          color: "#3b82f6" },
    { name: "Extra Payment",        value: extraMonthly, color: "#8b5cf6" },
  ].filter(x => x.value > 0);

  /* ---------- Baseline totals (green strip) ---------- */

  const baselineTotals = useMemo(() => {
    const { totalInterest } = amortizeBaseline(finalLoan, r, monthlyPI);
    const addOnsForTerm = (monthlyTax + monthlyIns + (hoa || 0)) * n;
    const allPayment = finalLoan + totalInterest + addOnsForTerm;
    return {
      allPayment,
      totalInterest,
      totalLoanAmount: finalLoan,
    };
  }, [finalLoan, r, monthlyPI, monthlyTax, monthlyIns, hoa, n]);

  /* ---------- Savings / shorten term (pink strip) ---------- */

  const payoffStats = useMemo(() => {
    const freqFactor =
      increaseFreq === "monthly" ? 1 :
      increaseFreq === "biweekly" ? (26 / 12) :
      (52 / 12);

    const base = amortizeBaseline(finalLoan, r, monthlyPI);

    const withExtra = amortizeWithExtras(
      finalLoan, r, monthlyPI, (extraMonthly || 0), freqFactor, (lumpSum || 0), lumpFreq
    );

    const shortenByMonths = isFinite(withExtra.months) ? Math.max(0, base.months - withExtra.months) : 0;
    const savings = isFinite(withExtra.totalInterest) ? Math.max(0, base.totalInterest - withExtra.totalInterest) : 0;

    return {
      savings,
      paymentAmount: totalMonthly,
      shortenText: shortenByMonths > 0 ? `${shortenByMonths} mo` : "-",
    };
  }, [increaseFreq, extraMonthly, lumpSum, lumpFreq, finalLoan, r, monthlyPI, totalMonthly]);

  /* ---------- Small UI helpers ---------- */

  const Seg = ({
    value, onChange, left, right, className = "",
  }: { value: string; onChange: (v: string) => void; left: string; right: string; className?: string }) => (
    <div className={`fs-segment ${className}`}>
      <button type="button" className="fs-segbtn" aria-pressed={value === left} onClick={() => onChange(left)}>{left}</button>
      <button type="button" className="fs-segbtn" aria-pressed={value === right} onClick={() => onChange(right)}>{right}</button>
    </div>
  );

  /* ---------- UI ---------- */

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "430px 1fr 430px" }}>
      {/* LEFT SIDEBAR PANEL */}
      <div className="fs-panel fs-fixed">
        <h2 className="fs-title">VA Purchase Calculator</h2>

        <div className="fs-body mt-2">
          {/* 1: Home Value */}
          <div className="fs-field">
            <label className="fs-label">Home Value</label>
            <Input
              type="text"
              inputMode="numeric"
              value={homeValue}
              onChange={(e)=>setHomeValue(Number(e.target.value || 0))}
              className="fs-input"
            />
          </div>

          {/* 2: Down Payment ($ / %) */}
          <div className="fs-field mt-4">
            <label className="fs-label">Down Payment</label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Input
                type="text"
                inputMode="decimal"
                value={downValue}
                onChange={(e)=>setDownValue(Number(e.target.value || 0))}
                className="fs-input"
              />
              <Seg
                value={downMode === "percent" ? "%" : "$"}
                onChange={(v)=> setDownMode(v === "%" ? "percent" : "amount")}
                left="$"
                right="%"
                className="w-[100px]"
              />
            </div>
          </div>

          {/* 3: Base Mortgage Amount (readonly) */}
          <div className="fs-field mt-4">
            <label className="fs-label">Base Mortgage Amount</label>
            <div className="fs-readonly">
              {baseLoan.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}
            </div>
          </div>

          {/* 4: Loan Terms (Year / Month) */}
          <div className="fs-field mt-4">
            <label className="fs-label">Loan Terms</label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              {termMode === "years" ? (
                <Input
                  type="text"
                  inputMode="numeric"
                  value={loanYears}
                  onChange={(e)=>{ const v = Number(e.target.value || 0); setLoanYears(v); setLoanMonths(Math.max(0, Math.round(v*12))); }}
                  className="fs-input"
                />
              ) : (
                <Input
                  type="text"
                  inputMode="numeric"
                  value={loanMonths}
                  onChange={(e)=>{ const v = Number(e.target.value || 0); setLoanMonths(v); setLoanYears(Math.max(0, Math.round(v/12))); }}
                  className="fs-input"
                />
              )}
              <Seg
                value={termMode === "years" ? "Year" : "Month"}
                onChange={(v)=> setTermMode(v === "Year" ? "years" : "months")}
                left="Year"
                right="Month"
                className="w-[160px]"
              />
            </div>
          </div>

          {/* 5: Payment Frequency (display toggle) */}
          <div className="fs-field mt-4">
            <label className="fs-label">Payment Frequency</label>
            <div className="grid grid-cols-[1fr]">
              <Seg
                value={payFreq === "year" ? "Year" : "Month"}
                onChange={(v)=> setPayFreq(v === "Year" ? "year" : "month")}
                left="Year"
                right="Month"
                className="w-[220px]"
              />
            </div>
          </div>

          {/* 6: Interest Rate */}
          <div className="fs-field mt-4">
            <label className="fs-label">Interest Rate</label>
            <Input
              type="text"
              inputMode="decimal"
              value={rate}
              onChange={(e)=>setRate(Number(e.target.value || 0))}
              className="fs-input"
            />
          </div>

          {/* 7: This is my... */}
          <div className="fs-field mt-4">
            <label className="fs-label">This is my...</label>
            <select
              className="fs-input"
              value={vaUse}
              onChange={(e)=>setVaUse(e.target.value as any)}
            >
              <option value="first">First-time VA use</option>
              <option value="subsequent">Subsequent VA use</option>
              <option value="exempt">VA Disability (Funding Fee Exempt)</option>
            </select>
          </div>

          {/* 8: VA Funding Fee (readonly + rate chip) */}
          <div className="fs-field mt-4">
            <label className="fs-label">VA Funding Fee <span className="text-xs text-neutral-500">({feeRate}% applied)</span></label>
            <div className="fs-readonly">
              {vaFundingFee.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}
            </div>
          </div>

          {/* 9: Final Mortgage Amount (readonly) */}
          <div className="fs-field mt-4">
            <label className="fs-label">Final Mortgage Amount</label>
            <div className="fs-readonly">
              {finalLoan.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}
            </div>
          </div>

          {/* 10: Property Tax (Yearly) $/% */}
          <div className="fs-field mt-4">
            <label className="fs-label">Property Tax (Yearly)</label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Input
                type="text"
                inputMode="decimal"
                value={taxValue}
                onChange={(e)=>setTaxValue(Number(e.target.value || 0))}
                className="fs-input"
              />
              <Seg
                value={taxMode === "percent" ? "%" : "$"}
                onChange={(v)=> setTaxMode(v === "%" ? "percent" : "amount")}
                left="$"
                right="%"
                className="w-[100px]"
              />
            </div>
          </div>

          {/* 11: Homeowners Insurance (Yearly) $/% */}
          <div className="fs-field mt-4">
            <label className="fs-label">Homeowners Insurance (Yearly)</label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Input
                type="text"
                inputMode="decimal"
                value={insValue}
                onChange={(e)=>setInsValue(Number(e.target.value || 0))}
                className="fs-input"
              />
              <Seg
                value={insMode === "amount" ? "$" : "%"}
                onChange={(v)=> setInsMode(v === "$" ? "amount" : "percent")}
                left="$"
                right="%"
                className="w-[100px]"
              />
            </div>
          </div>

          {/* 12: HOA dues per month */}
          <div className="fs-field mt-4">
            <label className="fs-label">HOA Dues Per Month</label>
            <Input
              type="text"
              inputMode="decimal"
              value={hoa}
              onChange={(e)=>setHoa(Number(e.target.value || 0))}
              className="fs-input"
            />
          </div>

          {/* 13: First Payment Date */}
          <div className="fs-field mt-4">
            <label className="fs-label">First Payment Date</label>
            <Input
              type="date"
              value={firstPaymentDate}
              onChange={(e)=>setFirstPaymentDate(e.target.value)}
              className="fs-input"
            />
          </div>

          {/* 14: Extra payment per month */}
          <div className="fs-field mt-4">
            <label className="fs-label">Extra Payment Per Month</label>
            <Input
              type="text"
              inputMode="decimal"
              value={extraMonthly}
              onChange={(e)=>setExtraMonthly(Number(e.target.value || 0))}
              className="fs-input"
            />
          </div>

          <button className="fs-cta mt-5 w-full">GET A QUOTE</button>
        </div>
      </div>

      {/* MIDDLE COLUMN */}
      <div className="grid gap-4">
        {/* KPI Strips — Top (Green) */}
        <div className="pc-strip pc-strip--green">
          <div className="pc-strip__item">
            <div className="pc-strip__label">All Payment</div>
            <div className="pc-strip__value">${baselineTotals.allPayment.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
          </div>
          <div className="pc-strip__item">
            <div className="pc-strip__label">Total Loan Amount</div>
            <div className="pc-strip__value">${baselineTotals.totalLoanAmount.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
          </div>
          <div className="pc-strip__item">
            <div className="pc-strip__label">Total Interest Paid</div>
            <div className="pc-strip__value">${baselineTotals.totalInterest.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
          </div>
        </div>

        {/* KPI Strips — Second (Pink) */}
        <div className="pc-strip pc-strip--pink">
          <div className="pc-strip__item">
            <div className="pc-strip__label">Savings</div>
            <div className="pc-strip__value">${payoffStats.savings.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
          </div>
          <div className="pc-strip__item">
            <div className="pc-strip__label">Payment Amount</div>
            <div className="pc-strip__value">${payoffStats.paymentAmount.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
          </div>
          <div className="pc-strip__item">
            <div className="pc-strip__label">Shorten Loan Term By</div>
            <div className="pc-strip__value">{payoffStats.shortenText}</div>
          </div>
        </div>

        {/* Payment Breakdown Card */}
        <Card className="pc-card">
          <CardHeader className="pc-card__header">
            <CardTitle className="pc-card__title">Payment Breakdown</CardTitle>
            <span
              className="pc-info"
              title="Payment Breakdown: A breakdown of your total payment so you can see where the money is allocated."
            >
              <Info size={16} />
            </span>
          </CardHeader>
          <CardContent className="pc-card__body">
            {/* Donut + Legend */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip formatter={(v)=>`$${Number(v).toLocaleString(undefined,{maximumFractionDigits:2})}`} />
                    <Pie
                      data={paymentBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={84}
                      paddingAngle={2}
                    >
                      {paymentBreakdown.map((s, i) => (
                        <Cell key={i} fill={s.color} />
                      ))}
                      <Label position="center" content={renderCenterMonthlyLabel(totalMonthly)} />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                {paymentBreakdown.map((item) => (
                  <div key={item.name} className="pc-row text-sm">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ background: item.color }} />
                      <span>{item.name}</span>
                    </div>
                    <span className="pc-val">${item.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs INSIDE the same card */}
            <div className="mt-6">
              <div className="border-b">
                <div className="bg-transparent p-0 h-auto gap-6 flex">
                  <button className="pb-2 border-b-2 border-green-600 font-medium">Monthly Payment</button>
                  <button className="pb-2 opacity-60 hover:opacity-100">Total Payment</button>
                </div>
              </div>

              {/* “Monthly Payment” table (static like your Purchase) */}
              <div className="pt-4">
                <div className="grid grid-cols-2 gap-6 text-sm">
                  <div>
                    <div className="text-neutral-500">Home Value:</div>
                    <div className="font-semibold">${homeValue.toLocaleString()}</div>

                    <div className="mt-3 text-neutral-500">Principal & Interest:</div>
                    <div className="font-semibold">${monthlyPI.toLocaleString(undefined,{maximumFractionDigits:2})}</div>

                    <div className="mt-3 text-neutral-500">Monthly Property Tax:</div>
                    <div className="font-semibold">${monthlyTax.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
                  </div>

                  <div>
                    <div className="text-neutral-500">Mortgage Amount:</div>
                    <div className="font-semibold">${finalLoan.toLocaleString(undefined,{maximumFractionDigits:2})}</div>

                    <div className="mt-3 text-neutral-500">Monthly Home Insurance:</div>
                    <div className="font-semibold">${monthlyIns.toLocaleString(undefined,{maximumFractionDigits:2})}</div>

                    <div className="mt-3 text-neutral-500">HOA / Extra:</div>
                    <div className="font-semibold">
                      ${Number(hoa||0).toLocaleString(undefined,{maximumFractionDigits:2})} / ${Number(extraMonthly||0).toLocaleString(undefined,{maximumFractionDigits:2})}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="grid gap-4">
        {/* Early Payoff Strategy */}
        <Card className="pc-card">
          <CardHeader className="pc-card__header">
            <CardTitle className="pc-card__title">Early Payoff Strategy</CardTitle>
            <span
              className="pc-info"
              title="Early Payoff Strategy: Add an extra payment and see how many months you can eliminate on the back end of the loan."
            >
              <Info size={16} />
            </span>
          </CardHeader>
          <CardContent className="pc-card__body">
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">Additional Monthly</div>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={extraMonthly}
                  onChange={(e)=>setExtraMonthly(Number(e.target.value || 0))}
                  className="fs-input"
                />
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Increase Frequency</div>
                <div className="flex gap-3">
                  <Button
                    className={buttonVariants({ variant: increaseFreq === "monthly" ? "default" : "secondary" })}
                    onClick={()=>setIncreaseFreq("monthly")}
                  >
                    Monthly
                  </Button>
                  <Button
                    className={buttonVariants({ variant: increaseFreq === "biweekly" ? "default" : "secondary" })}
                    onClick={()=>setIncreaseFreq("biweekly")}
                  >
                    Bi weekly
                  </Button>
                  <Button
                    className={buttonVariants({ variant: increaseFreq === "weekly" ? "default" : "secondary" })}
                    onClick={()=>setIncreaseFreq("weekly")}
                  >
                    Weekly
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lump Sum Payment */}
        <Card className="pc-card">
          <CardHeader className="pc-card__header">
            <CardTitle className="pc-card__title">Lump Sum Payment</CardTitle>
            <span
              className="pc-info"
              title="Lump Sum Payment: Shorten your loan term by paying a lump sum all to principal."
            >
              <Info size={16} />
            </span>
          </CardHeader>
          <CardContent className="pc-card__body">
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">Lump Sum Addition</div>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={lumpSum}
                  onChange={(e)=>setLumpSum(Number(e.target.value || 0))}
                  className="fs-input"
                />
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Frequency</div>
                <div className="flex gap-3">
                  <Button
                    className={buttonVariants({ variant: lumpFreq === "once" ? "default" : "secondary" })}
                    onClick={()=>setLumpFreq("once")}
                  >
                    One time
                  </Button>
                  <Button
                    className={buttonVariants({ variant: lumpFreq === "yearly" ? "default" : "secondary" })}
                    onClick={()=>setLumpFreq("yearly")}
                  >
                    Yearly
                  </Button>
                  <Button
                    className={buttonVariants({ variant: lumpFreq === "quarterly" ? "default" : "secondary" })}
                    onClick={()=>setLumpFreq("quarterly")}
                  >
                    Quarterly
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

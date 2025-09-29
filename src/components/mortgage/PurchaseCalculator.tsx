import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  // guard
  if (payment <= bal * r) {
    // payment too low, avoid infinite loops
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

// amortize with extras (monthly add + payment frequency factor + lump sum schedule)
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

    // base principal part from normal payment
    let principalPay = payment - interest;

    // apply extra monthly as equivalent monthly amount (freqFactor)
    const extraThisMonth = extraMonthly * freqFactor;
    principalPay += extraThisMonth;

    // apply lump sum this month if schedule says so
    if (lumpSum > 0) {
      if (
        (lumpFreq === "once" && months === 0) ||
        (lumpFreq === "yearly" && (months + 1) % 12 === 1) || // month 1, 13, 25...
        (lumpFreq === "quarterly" && (months + 1) % 3 === 1)  // month 1, 4, 7...
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

export default function PurchaseCalculator() {
  // Left sidebar (rows 1–11)
  const [homeValue, setHomeValue] = useState<number>(200000);

  const [downMode, setDownMode] = useState<"amount" | "percent">("amount");
  const [downValue, setDownValue] = useState<number>(0);

  const [termMode, setTermMode] = useState<"years" | "months">("years");
  const [loanYears, setLoanYears] = useState<number>(30);
  const [loanMonths, setLoanMonths] = useState<number>(360);

  const [rate, setRate] = useState<number>(5);

  const [pmiMode, setPmiMode] = useState<"amount" | "percent">("amount");
  const [pmiValue, setPmiValue] = useState<number>(0);

  const [taxMode, setTaxMode] = useState<"amount" | "percent">("percent");
  const [taxValue, setTaxValue] = useState<number>(0.6);

  const [insMode, setInsMode] = useState<"amount" | "percent">("amount");
  const [insValue, setInsValue] = useState<number>(1200);

  const [hoa, setHoa] = useState<number>(0);
  const [firstPaymentDate, setFirstPaymentDate] = useState<string>(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  });
  const [extraMonthly, setExtraMonthly] = useState<number>(0);

  // Right-side payoff strategy
  const [increaseFreq, setIncreaseFreq] = useState<"monthly" | "biweekly" | "weekly">("monthly");
  const [lumpSum, setLumpSum] = useState<number>(0);
  const [lumpFreq, setLumpFreq] = useState<"once" | "yearly" | "quarterly">("once");

  // Derived basics
  const downPayment = useMemo(
    () => (downMode === "percent" ? (homeValue * (downValue || 0)) / 100 : (downValue || 0)),
    [homeValue, downMode, downValue]
  );
  const baseLoan = Math.max(0, homeValue - downPayment);

  const n = termMode === "years" ? loanYears * 12 : loanMonths;
  const r = rate / 100 / 12;

  const monthlyPI = r
    ? baseLoan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    : (n > 0 ? baseLoan / n : 0);

  // Yearly → monthly add-ons
  const yearlyTax = taxMode === "percent" ? (homeValue * (taxValue || 0) / 100) : (taxValue || 0);
  const monthlyTax = yearlyTax / 12;

  const yearlyIns = insMode === "amount" ? (insValue || 0) : (homeValue * (insValue || 0) / 100);
  const monthlyIns = yearlyIns / 12;

  const yearlyPMI = pmiMode === "amount" ? (pmiValue || 0) : (homeValue * (pmiValue || 0) / 100);
  const monthlyPMI = yearlyPMI / 12;

  const totalMonthly = monthlyPI + monthlyTax + monthlyIns + monthlyPMI + (hoa || 0) + (extraMonthly || 0);

  // Donut data
  const paymentBreakdown = [
    { name: "Principal & Interest", value: monthlyPI,          color: "#f39c12" },
    { name: "Taxes",                value: monthlyTax,         color: "#2ecc71" },
    { name: "Insurance",            value: monthlyIns,         color: "#e91e63" },
    { name: "PMI",                  value: monthlyPMI,         color: "#10b981" },
    { name: "HOA Dues",             value: hoa,                color: "#3b82f6" },
    { name: "Extra Payment",        value: extraMonthly,       color: "#8b5cf6" },
  ].filter(x => x.value > 0);

  // Totals (green strip)
  const baselineTotals = useMemo(() => {
    const { totalInterest } = amortizeBaseline(baseLoan, r, monthlyPI);
    const addOnsForTerm = (monthlyTax + monthlyIns + monthlyPMI + (hoa || 0)) * n;
    const allPayment = baseLoan + totalInterest + addOnsForTerm;
    return {
      allPayment,
      totalInterest,
      totalLoanAmount: baseLoan,
    };
  }, [baseLoan, r, monthlyPI, monthlyTax, monthlyIns, monthlyPMI, hoa, n]);

  // Savings / shorten term with extras (pink strip)
  const payoffStats = useMemo(() => {
    const freqFactor =
      increaseFreq === "monthly" ? 1 :
      increaseFreq === "biweekly" ? (26 / 12) :
      (52 / 12);

    // baseline (interest only) for savings comparison
    const base = amortizeBaseline(baseLoan, r, monthlyPI);

    // extra amortization (apply extraMonthly + lump sum)
    const withExtra = amortizeWithExtras(
      baseLoan, r, monthlyPI, (extraMonthly || 0), freqFactor, (lumpSum || 0), lumpFreq
    );

    const shortenByMonths = isFinite(withExtra.months) ? Math.max(0, base.months - withExtra.months) : 0;
    const savings = isFinite(withExtra.totalInterest) ? Math.max(0, base.totalInterest - withExtra.totalInterest) : 0;

    return {
      savings,
      paymentAmount: totalMonthly, // show current total payment
      shortenText: shortenByMonths > 0 ? `${shortenByMonths} mo` : "-",
    };
  }, [increaseFreq, extraMonthly, lumpSum, lumpFreq, baseLoan, r, monthlyPI, totalMonthly]);

  // Segmented toggle UI
  const Seg = ({
    value, onChange, left, right, className = "",
  }: { value: string; onChange: (v: string) => void; left: string; right: string; className?: string }) => (
    <div className={`fs-segment ${className}`}>
      <button type="button" className="fs-segbtn" aria-pressed={value === left} onClick={() => onChange(left)}>{left}</button>
      <button type="button" className="fs-segbtn" aria-pressed={value === right} onClick={() => onChange(right)}>{right}</button>
    </div>
  );

  return (
    <>
    {/* OUTER GRID: left sidebar + the combined (middle+right) area */}
    <div className="grid gap-6" style={{ gridTemplateColumns: "550px 1fr" }}>
      {/* LEFT SIDEBAR PANEL */}
      <div className="fs-panel fs-fixed">
        <h2 className="fs-title">Purchase Calculator</h2>

        <div className="fs-body mt-2">
          {/* Row 1: Home Value */}
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

          {/* Row 2: Down Payment ($ / %) */}
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

          {/* Row 3: Mortgage Amount (readonly) */}
          <div className="fs-field mt-4">
            <label className="fs-label">Mortgage Amount</label>
            <div className="fs-readonly">
              {baseLoan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Row 4: Loan Terms (Year / Month) */}
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

          {/* Row 5: Interest Rate */}
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

          {/* Row 6: PMI (Yearly) with $/% */}
          <div className="fs-field mt-4">
            <label className="fs-label">PMI (Yearly)</label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Input
                type="text"
                inputMode="decimal"
                value={pmiValue}
                onChange={(e)=>setPmiValue(Number(e.target.value || 0))}
                className="fs-input"
              />
              <Seg
                value={pmiMode === "percent" ? "%" : "$"}
                onChange={(v)=> setPmiMode(v === "%" ? "percent" : "amount")}
                left="$"
                right="%"
                className="w-[100px]"
              />
            </div>
          </div>

          {/* Row 7: Property Tax (Yearly) with $/% */}
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

          {/* Row 8: Homeowners Insurance (Yearly) with $/% */}
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

          {/* Row 9: HOA Dues Per Month */}
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

          {/* Row 10: First Payment Date */}
          <div className="fs-field mt-4">
            <label className="fs-label">First Payment Date</label>
            <Input
              type="date"
              value={firstPaymentDate}
              onChange={(e)=>setFirstPaymentDate(e.target.value)}
              className="fs-input"
            />
          </div>

          {/* Row 11: Extra Payment Per Month */}
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

      {/* COMBINED AREA: middle (content) + right (two cards) */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 430px" }}>
        {/* KPI Strips — Top (Green) — span both columns */}
        <div className="col-span-2">
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
        </div>

        {/* KPI Strips — Second (Pink) — span both columns */}
        <div className="col-span-2">
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
        </div>

        {/* LEFT of the combined area: Payment Breakdown Card (with tabs below) */}
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
            <Tabs defaultValue="monthly" className="mt-6">
              <div className="border-b">
                <TabsList className="bg-transparent p-0 h-auto gap-6">
                  <TabsTrigger
                    value="monthly"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-green-600 rounded-none pb-2"
                  >
                    Monthly Payment
                  </TabsTrigger>
                  <TabsTrigger
                    value="total"
                    className="data-[state=active]:border-b-2 data-[state=active]:border-green-600 rounded-none pb-2"
                  >
                    Total Payment
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="monthly" className="pt-4">
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
                    <div className="font-semibold">${baseLoan.toLocaleString(undefined,{maximumFractionDigits:2})}</div>

                    <div className="mt-3 text-neutral-500">Monthly Home Insurance:</div>
                    <div className="font-semibold">${monthlyIns.toLocaleString(undefined,{maximumFractionDigits:2})}</div>

                    <div className="mt-3 text-neutral-500">PMI / HOA / Extra:</div>
                    <div className="font-semibold">
                      ${monthlyPMI.toLocaleString(undefined,{maximumFractionDigits:2})} / ${Number(hoa||0).toLocaleString(undefined,{maximumFractionDigits:2})} / ${Number(extraMonthly||0).toLocaleString(undefined,{maximumFractionDigits:2})}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="total" className="pt-4">
                <div className="grid grid-cols-2 gap-6 text-sm">
                  <div>
                    <div className="text-neutral-500">Total # Of Payments:</div>
                    <div className="font-semibold">{n.toLocaleString()}</div>

                    <div className="mt-3 text-neutral-500">Principal:</div>
                    <div className="font-semibold">${baseLoan.toLocaleString(undefined,{maximumFractionDigits:2})}</div>

                    <div className="mt-3 text-neutral-500">Total Interest Paid:</div>
                    <div className="font-semibold">${baselineTotals.totalInterest.toLocaleString(undefined,{maximumFractionDigits:2})}</div>

                    <div className="mt-3 text-neutral-500">Total of all Payments:</div>
                    <div className="font-semibold">${baselineTotals.allPayment.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
                  </div>

                  <div>
                    <div className="text-neutral-500">Down Payment:</div>
                    <div className="font-semibold">${downPayment.toLocaleString(undefined,{maximumFractionDigits:2})}</div>

                    <div className="mt-3 text-neutral-500">Total Extra Payment:</div>
                    <div className="font-semibold">${(extraMonthly * n).toLocaleString(undefined,{maximumFractionDigits:2})}</div>

                    <div className="mt-3 text-neutral-500">Total Tax, Insurance, PMI and Fees:</div>
                    <div className="font-semibold">
                      ${((monthlyTax + monthlyIns + monthlyPMI + (hoa || 0)) * n).toLocaleString(undefined,{maximumFractionDigits:2})}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* RIGHT of the combined area: two soft cards stacked (same as before) */}
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
    </div>
    </>
  );
}

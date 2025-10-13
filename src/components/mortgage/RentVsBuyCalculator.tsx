import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Info, CheckCircle2, ChevronDown } from "lucide-react";
import {
  Tooltip as UiTooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

/* ------------------------------------------------------------
   Helpers
------------------------------------------------------------ */
const currency = (n: number) =>
  (isFinite(n) ? n : 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

function pmt(rate: number, nper: number, pv: number) {
  if (rate === 0) return -(pv / nper);
  const r1 = Math.pow(1 + rate, nper);
  return -(rate * pv * r1) / (r1 - 1);
}

function remainingBalance(
  principal: number,
  rateMonthly: number,
  payment: number,
  months: number
) {
  if (rateMonthly === 0) return Math.max(0, principal + payment * months);
  let bal = principal;
  for (let i = 0; i < months; i++) {
    const interest = bal * rateMonthly;
    const principalPay = payment - interest;
    bal = Math.max(0, bal - principalPay);
    if (bal === 0) break;
  }
  return bal;
}

/* ------------------------------------------------------------
   Small Accordion Section
------------------------------------------------------------ */
function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rvb-acc">
      <button type="button" className="rvb-acc__header" onClick={onToggle}>
        <div className="rvb-acc__left">
          <CheckCircle2 size={16} className="text-emerald-500" />
          <span>{title}</span>
        </div>
        <ChevronDown
          size={16}
          className={`rvb-acc__chev ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="rvb-acc__body">{children}</div>}
      <div className="rvb-acc__divider" />
    </div>
  );
}

/* ------------------------------------------------------------
   Component
------------------------------------------------------------ */
export default function RentVsBuyCalculator() {
  /* Left: Mortgage Information */
  const [homePrice, setHomePrice] = useState(500000);
  const [downMode, setDownMode] = useState<"$" | "%">("$");
  const [downValue, setDownValue] = useState(50000);
  const [loanAmountManual, setLoanAmountManual] = useState(450000);
  const [interestRate, setInterestRate] = useState(7.5);
  const [termMode, setTermMode] = useState<"year" | "month">("year");
  const [termYears, setTermYears] = useState(30);
  const [termMonths, setTermMonths] = useState(360);
  const [startDate, setStartDate] = useState("2021-03-01");
  const [pmiYearly, setPmiYearly] = useState(0);

  /* Optional (still in Mortgage Info group, per your list) */
  const [insYearly, setInsYearly] = useState(0);
  const [taxYearly, setTaxYearly] = useState(0);
  const [hoaMonthly, setHoaMonthly] = useState(0);

  /* Buying Assumptions */
  const [marginalTax, setMarginalTax] = useState(25);
  const [annualCostsPct, setAnnualCostsPct] = useState(1.0);
  const [sellingCostsPct, setSellingCostsPct] = useState(6.0);
  const [annualAppreciationPct, setAnnualAppreciationPct] = useState(3.0);

  /* Renting Assumptions */
  const [monthlyRent, setMonthlyRent] = useState(2000);
  const [rentersInsMonthly, setRentersInsMonthly] = useState(1.3);
  const [rentAppreciationPct, setRentAppreciationPct] = useState(2.0);

  /* Accordion open states */
  const [openMortgage, setOpenMortgage] = useState(true);
  const [openBuying, setOpenBuying] = useState(true);
  const [openRenting, setOpenRenting] = useState(true);

  /* Years slider */
  const [years, setYears] = useState(8);

  /* Derived values */
  const nTotal = termMode === "year" ? termYears * 12 : termMonths;
  const downPayment =
    downMode === "$" ? downValue : (homePrice * (downValue || 0)) / 100;
  const derivedLoanAmount = Math.max(0, homePrice - downPayment);
  const loanAmount = loanAmountManual > 0 ? loanAmountManual : derivedLoanAmount;

  const rMonthly = interestRate / 100 / 12;
  const monthlyPI = -pmt(rMonthly, nTotal, loanAmount);

  const monthlyTax = (taxYearly || 0) / 12;
  const monthlyIns = (insYearly || 0) / 12;
  const monthlyPMI = (pmiYearly || 0) / 12;
  const totalMonthlyBuy =
    monthlyPI + monthlyTax + monthlyIns + monthlyPMI + (hoaMonthly || 0);

  const monthsElapsed = Math.min(years * 12, nTotal);
  const balanceAfterYears = useMemo(
    () => remainingBalance(loanAmount, rMonthly, monthlyPI, monthsElapsed),
    [loanAmount, rMonthly, monthlyPI, monthsElapsed]
  );

  const appreciatedValue = useMemo(
    () => Math.round(homePrice * Math.pow(1 + annualAppreciationPct / 100, years)),
    [homePrice, annualAppreciationPct, years]
  );

  const equity = Math.max(0, appreciatedValue - balanceAfterYears);
  const closingCosts = (sellingCostsPct / 100) * homePrice;

  // Cash spent (simplified)
  const cashSpentBuying =
    totalMonthlyBuy * monthsElapsed +
    (annualCostsPct / 100) * homePrice * years +
    downPayment;

  const rentPerMonthOverTime = useMemo(() => {
    const arr: number[] = [];
    let current = monthlyRent;
    for (let i = 0; i < monthsElapsed; i++) {
      if (i > 0 && i % 12 === 0) current = current * (1 + rentAppreciationPct / 100);
      arr.push(current);
    }
    return arr;
  }, [monthlyRent, rentAppreciationPct, monthsElapsed]);

  const cashSpentRenting =
    rentPerMonthOverTime.reduce((a, b) => a + b, 0) + rentersInsMonthly * monthsElapsed;

  const adjustedNetCashSavingsBuy = Math.max(0, equity - closingCosts);
  const adjustedNetCashSavingsRent = Math.max(0, cashSpentRenting);
  const buyGain = adjustedNetCashSavingsBuy - adjustedNetCashSavingsRent;

  const maxBar = Math.max(adjustedNetCashSavingsBuy, adjustedNetCashSavingsRent, 1);
  const rentBarPct = Math.round((adjustedNetCashSavingsRent / maxBar) * 100);
  const buyBarPct = Math.round((adjustedNetCashSavingsBuy / maxBar) * 100);

  /* --- slider position % for the custom thumb --- */
  const minYears = 1;
  const maxYears = 40;
  const pct = ((years - minYears) / (maxYears - minYears)) * 100;

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "500px 1fr" }}>
      {/* LEFT SIDEBAR WITH THREE DROPDOWNS */}
      <div className="fs-panel fs-fixed">
        <h2 className="fs-title">Rent vs Buy Calculator</h2>

        <div className="fs-body mt-2">
          {/* Mortgage Information */}
          <Section
            title="Mortgage Information"
            open={openMortgage}
            onToggle={() => setOpenMortgage((o) => !o)}
          >
            <div className="fs-field">
              <label className="fs-label">
                Home Price
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none" aria-label="Home Price">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                    <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                      <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                      <div className="font-bold mb-1">Home Price</div>
                      <p className="text-sm leading-5">Estimated purchase price of the property.</p>
                    </div>
                  </TooltipContent>
                </UiTooltip>
              </label>
              <Input
                type="text"
                inputMode="numeric"
                value={homePrice}
                onChange={(e) => setHomePrice(Number(e.target.value || 0))}
                className="fs-input"
              />
            </div>

            <div className="fs-field mt-4">
              <label className="fs-label">
                Down Payment
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none" aria-label="Down Payment">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                    <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                      <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                      <div className="font-bold mb-1">Down Payment</div>
                      <p className="text-sm leading-5">Amount you’ll pay upfront (enter dollars or percent).</p>
                    </div>
                  </TooltipContent>
                </UiTooltip>
              </label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={downValue}
                  onChange={(e) => setDownValue(Number(e.target.value || 0))}
                  className="fs-input"
                />
                <div className="fs-segment">
                  <button
                    type="button"
                    className="fs-segbtn"
                    aria-pressed={downMode === "$"}
                    onClick={() => setDownMode("$")}
                  >
                    $
                  </button>
                  <button
                    type="button"
                    className="fs-segbtn"
                    aria-pressed={downMode === "%"}
                    onClick={() => setDownMode("%")}
                  >
                    %
                  </button>
                </div>
              </div>
            </div>

            <div className="fs-field mt-4">
              <label className="fs-label">
                Loan Amount
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none" aria-label="Loan Amount">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                    <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                      <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                      <div className="font-bold mb-1">Loan Amount</div>
                      <p className="text-sm leading-5">Your expected starting principal.</p>
                    </div>
                  </TooltipContent>
                </UiTooltip>
              </label>
              <Input
                type="text"
                inputMode="numeric"
                value={loanAmountManual}
                onChange={(e) => setLoanAmountManual(Number(e.target.value || 0))}
                className="fs-input"
              />
            </div>

            <div className="fs-field mt-4">
              <label className="fs-label">
                Interest Rate
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none" aria-label="Interest Rate">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                    <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                      <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                      <div className="font-bold mb-1">Interest Rate</div>
                      <p className="text-sm leading-5">Annual percentage rate (APR) for the mortgage.</p>
                    </div>
                  </TooltipContent>
                </UiTooltip>
              </label>
              <Input
                type="text"
                inputMode="decimal"
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value || 0))}
                className="fs-input"
              />
            </div>

            <div className="fs-field mt-4">
              <label className="fs-label">
                Loan Term
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none" aria-label="Loan Term">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                    <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                      <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                      <div className="font-bold mb-1">Loan Term</div>
                      <p className="text-sm leading-5">Length of the mortgage in years or months.</p>
                    </div>
                  </TooltipContent>
                </UiTooltip>
              </label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                {termMode === "year" ? (
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={termYears}
                    onChange={(e) => {
                      const v = Number(e.target.value || 0);
                      setTermYears(v);
                      setTermMonths(Math.round(v * 12));
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
                      setTermYears(Math.round(v / 12));
                    }}
                    className="fs-input"
                  />
                )}
                <div className="fs-segment">
                  <button
                    type="button"
                    className="fs-segbtn"
                    aria-pressed={termMode === "year"}
                    onClick={() => setTermMode("year")}
                  >
                    Year
                  </button>
                  <button
                    type="button"
                    className="fs-segbtn"
                    aria-pressed={termMode === "month"}
                    onClick={() => setTermMode("month")}
                  >
                    Month
                  </button>
                </div>
              </div>
            </div>

            <div className="fs-field mt-4">
              <label className="fs-label">
                Start Date
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none" aria-label="Start Date">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                    <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                      <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                      <div className="font-bold mb-1">Start Date</div>
                      <p className="text-sm leading-5">First payment month for the loan.</p>
                    </div>
                  </TooltipContent>
                </UiTooltip>
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="fs-input"
              />
            </div>

            <div className="fs-field mt-4">
              <label className="fs-label">
                PMI (Yearly)
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none" aria-label="PMI">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                    <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                      <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                      <div className="font-bold mb-1">PMI</div>
                      <p className="text-sm leading-5">Private Mortgage Insurance paid annually.</p>
                    </div>
                  </TooltipContent>
                </UiTooltip>
              </label>
              <Input
                type="text"
                inputMode="decimal"
                value={pmiYearly}
                onChange={(e) => setPmiYearly(Number(e.target.value || 0))}
                className="fs-input"
              />
            </div>

            {/* Optional info inside Mortgage block */}
            <div className="fs-field mt-6">
              <label className="fs-label">
                Home Insurance (Yearly)
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none" aria-label="Home Insurance">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                    <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                      <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                      <div className="font-bold mb-1">Home Insurance</div>
                      <p className="text-sm leading-5">Annual homeowners insurance premium.</p>
                    </div>
                  </TooltipContent>
                </UiTooltip>
              </label>
              <Input
                type="text"
                inputMode="decimal"
                value={insYearly}
                onChange={(e) => setInsYearly(Number(e.target.value || 0))}
                className="fs-input"
              />
            </div>

            <div className="fs-field mt-4">
              <label className="fs-label">
                Taxes (Yearly)
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none" aria-label="Property Taxes">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                    <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                      <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                      <div className="font-bold mb-1">Property Taxes</div>
                      <p className="text-sm leading-5">Annual property tax estimate.</p>
                    </div>
                  </TooltipContent>
                </UiTooltip>
              </label>
              <Input
                type="text"
                inputMode="decimal"
                value={taxYearly}
                onChange={(e) => setTaxYearly(Number(e.target.value || 0))}
                className="fs-input"
              />
            </div>

            <div className="fs-field mt-4">
              <label className="fs-label">
                HOA Dues (Monthly)
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none" aria-label="HOA Dues">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                    <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                      <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                      <div className="font-bold mb-1">HOA Dues</div>
                      <p className="text-sm leading-5">Monthly homeowners association fees.</p>
                    </div>
                  </TooltipContent>
                </UiTooltip>
              </label>
              <Input
                type="text"
                inputMode="decimal"
                value={hoaMonthly}
                onChange={(e) => setHoaMonthly(Number(e.target.value || 0))}
                className="fs-input"
              />
            </div>
          </Section>

          {/* Buying Assumptions */}
          <Section
            title="Buying Assumptions"
            open={openBuying}
            onToggle={() => setOpenBuying((o) => !o)}
          >
            <div className="fs-field">
              <label className="fs-label">
                Marginal Tax Bracket (%)
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none" aria-label="Tax Bracket">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                    <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                      <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                      <div className="font-bold mb-1">Tax Bracket</div>
                      <p className="text-sm leading-5">Your marginal federal/state tax rate.</p>
                    </div>
                  </TooltipContent>
                </UiTooltip>
              </label>
              <Input
                type="text"
                inputMode="decimal"
                value={marginalTax}
                onChange={(e) => setMarginalTax(Number(e.target.value || 0))}
                className="fs-input"
              />
            </div>

            <div className="fs-field mt-4">
              <label className="fs-label">
                Annual Costs (%)
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none" aria-label="Annual Costs">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                    <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                      <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                      <div className="font-bold mb-1">Annual Costs</div>
                      <p className="text-sm leading-5">Maintenance and other yearly ownership costs.</p>
                    </div>
                  </TooltipContent>
                </UiTooltip>
              </label>
              <Input
                type="text"
                inputMode="decimal"
                value={annualCostsPct}
                onChange={(e) => setAnnualCostsPct(Number(e.target.value || 0))}
                className="fs-input"
              />
            </div>

            <div className="fs-field mt-4">
              <label className="fs-label">
                Selling Costs (%)
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none" aria-label="Selling Costs">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                    <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                      <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                      <div className="font-bold mb-1">Selling Costs</div>
                      <p className="text-sm leading-5">Agent commissions + typical closing costs when selling.</p>
                    </div>
                  </TooltipContent>
                </UiTooltip>
              </label>
              <Input
                type="text"
                inputMode="decimal"
                value={sellingCostsPct}
                onChange={(e) => setSellingCostsPct(Number(e.target.value || 0))}
                className="fs-input"
              />
            </div>

            <div className="fs-field mt-4">
              <label className="fs-label">
                Annual Appreciation (%)
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none" aria-label="Appreciation">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                    <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                      <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                      <div className="font-bold mb-1">Appreciation</div>
                      <p className="text-sm leading-5">Expected yearly growth rate of the home value.</p>
                    </div>
                  </TooltipContent>
                </UiTooltip>
              </label>
              <Input
                type="text"
                inputMode="decimal"
                value={annualAppreciationPct}
                onChange={(e) =>
                  setAnnualAppreciationPct(Number(e.target.value || 0))
                }
                className="fs-input"
              />
            </div>
          </Section>

          {/* Renting Assumptions */}
          <Section
            title="Renting Assumptions"
            open={openRenting}
            onToggle={() => setOpenRenting((o) => !o)}
          >
            <div className="fs-field">
              <label className="fs-label">
                Monthly Rent
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none" aria-label="Monthly Rent">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                    <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                      <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                      <div className="font-bold mb-1">Monthly Rent</div>
                      <p className="text-sm leading-5">Your current rent payment.</p>
                    </div>
                  </TooltipContent>
                </UiTooltip>
              </label>
              <Input
                type="text"
                inputMode="decimal"
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(Number(e.target.value || 0))}
                className="fs-input"
              />
            </div>

            <div className="fs-field mt-4">
              <label className="fs-label">
                Renters Insurance (Monthly)
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none" aria-label="Renters Insurance">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                    <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                      <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                      <div className="font-bold mb-1">Renters Insurance</div>
                      <p className="text-sm leading-5">Average monthly renters policy premium.</p>
                    </div>
                  </TooltipContent>
                </UiTooltip>
              </label>
              <Input
                type="text"
                inputMode="decimal"
                value={rentersInsMonthly}
                onChange={(e) =>
                  setRentersInsMonthly(Number(e.target.value || 0))
                }
                className="fs-input"
              />
            </div>

            <div className="fs-field mt-4">
              <label className="fs-label">
                Rent Appreciation (%)
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button className="inline-flex items-center ml-1 text-[#FFFFFF] focus:outline-none" aria-label="Rent Appreciation">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                    <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                      <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                      <div className="font-bold mb-1">Rent Growth</div>
                      <p className="text-sm leading-5">Expected annual increase in rent.</p>
                    </div>
                  </TooltipContent>
                </UiTooltip>
              </label>
              <Input
                type="text"
                inputMode="decimal"
                value={rentAppreciationPct}
                onChange={(e) =>
                  setRentAppreciationPct(Number(e.target.value || 0))
                }
                className="fs-input"
              />
            </div>
          </Section>

          <Button asChild className="fs-cta w-full mt-5">
  <a href="https://creomortgage.com/#form" target="_blank" rel="noopener noreferrer">
    GET A QUOTE
  </a>
</Button>

        </div>
      </div>

      {/* CENTER + RIGHT */}
      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 420px" }}>
        {/* Top row: Years + KPI tiles */}
        <div className="rounded-xl border border-green-200 bg-green-50">
          <div className="px-4 py-3">
            <div className="text-sm font-semibold opacity-80 mb-2">Years</div>

            {/* ======= CUSTOM THUMB WITH NUMBER ON IT ======= */}
            <div
              className="rvb-slider rvb-slider--thumbnum"
              style={
                {
                  ["--_p" as any]: `${pct}%`, // filled portion
                  ["--v" as any]: pct,        // thumb position 0..100
                } as React.CSSProperties
              }
            >
              <input
                type="range"
                min={minYears}
                max={maxYears}
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
              />
              <div className="rvb-slider__thumb">{years}</div>
            </div>

            <div className="text-right text-sm font-semibold opacity-80 mt-1">
              {years} years
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 self-start h-auto">
          <div className="rounded-xl border border-green-200 bg-green-100 text-center py-6">
            <div className="text-xs font-semibold tracking-wide opacity-70">YEAR</div>
            <div className="text-[28px] font-extrabold mt-2">{years}</div>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-100 text-center py-6">
            <div className="text-xs font-semibold tracking-wide opacity-70">BUY GAIN</div>
            <div className="text-[28px] font-extrabold mt-2" style={{ color: Math.max(0, buyGain) > 0 ? "rgb(93, 199, 111)" : "rgb(93, 199, 111)" }}>${currency(Math.max(0, buyGain))}</div>
          </div>
        </div>

        {/* Second row: Results Summary (left) */}
        <Card className="pc-card self-start h-auto">
          <CardHeader className="pc-card__header">
            <CardTitle className="pc-card__title flex items-center">
              Results Summary
              <UiTooltip>
                <TooltipTrigger asChild>
                  <button aria-label="Results Summary Info" className="inline-flex items-center ml-2 text-black focus:outline-none">
                    <Info size={16} className="opacity-70" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                  <div className="relative w-72 rounded-xl bg-[#44C264] text-white p-4">
                    <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
                    <div className="font-bold mb-1">Results Summary</div>
                    <p className="text-sm leading-5">
                      Quick comparison of cumulative costs and savings for buying vs renting over the selected years.
                    </p>
                  </div>
                </TooltipContent>
              </UiTooltip>
            </CardTitle>
          </CardHeader>
          <CardContent className="pc-card__body">
            <div className="text-sm font-semibold mb-3 grid grid-cols-3">
              <span className="opacity-60">&nbsp;</span>
              <span className="opacity-60">Buying</span>
              <span className="opacity-60">Renting</span>
            </div>

            <div className="rvb-row">
              <span className="rvb-row__label">Cash Spent</span>
              <span className="rvb-row__val">${currency(cashSpentBuying)}</span>
              <span className="rvb-row__val">${currency(cashSpentRenting)}</span>
            </div>

            <div className="rvb-row">
              <span className="rvb-row__label">Home value</span>
              <span className="rvb-row__val">
                -${currency(Math.max(0, homePrice - appreciatedValue))}
              </span>
              <span className="rvb-row__val">--</span>
            </div>

            <div className="rvb-row">
              <span className="rvb-row__label">Balance on Loan</span>
              <span className="rvb-row__val">${currency(balanceAfterYears)}</span>
              <span className="rvb-row__val">--</span>
            </div>

            <div className="rvb-row">
              <span className="rvb-row__label">Closing costs on sale</span>
              <span className="rvb-row__val">${currency(closingCosts)}</span>
              <span className="rvb-row__val">--</span>
            </div>

            <div className="rvb-row">
              <span className="rvb-row__label font-semibold">Adjusted Net Cash Savings</span>
              <span className="rvb-row__val text-green-700 font-semibold">
                ${currency(adjustedNetCashSavingsBuy)}
              </span>
              <span className="rvb-row__val">${currency(adjustedNetCashSavingsRent)}</span>
            </div>

            <hr className="my-4 border-green-200" />

            <div className="text-sm font-semibold mb-2 flex items-center justify-between">
              <span>Rent</span>
              <span>${currency(adjustedNetCashSavingsRent)}</span>
            </div>
            <div className="w-full h-6 rounded-md bg-neutral-200/80 overflow-hidden">
              <div className="h-full bg-neutral-800/90" style={{ width: `${rentBarPct}%` }} />
            </div>

            <div className="text-sm font-semibold mt-4 mb-2 flex items-center justify-between">
              <span>Buy</span>
              <span>${currency(adjustedNetCashSavingsBuy)}</span>
            </div>
            <div className="w-full h-6 rounded-md bg-green-100 overflow-hidden">
              <div className="h-full bg-green-500/80" style={{ width: `${buyBarPct}%` }} />
            </div>
          </CardContent>
        </Card>

        {/* Right: BUY/RENT tiles + narrative cards */}
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-green-200 bg-green-100 text-center py-8">
              <div className="text-xs font-semibold tracking-wide opacity-70">BUY</div>
              <div className="text-[28px] font-extrabold mt-2">${currency(adjustedNetCashSavingsBuy)}</div>
            </div>
            <div className="rounded-xl border border-green-200 bg-green-100 text-center py-8">
              <div className="text-xs font-semibold tracking-wide opacity-70">RENT</div>
              <div className="text-[28px] font-extrabold mt-2">${currency(adjustedNetCashSavingsRent)}</div>
            </div>
          </div>

          <div className="rounded-xl border border-rose-200 bg-rose-100 p-4">
            <div className="font-semibold text-lg mb-1">Out of Pocket Cost:</div>
            <p className="text-sm leading-6">
              If you opt for homeownership of a property valued at <b>${currency(homePrice)}</b>, your
              total expenses out of pocket for <b>{years} years</b> would add up to{" "}
              <b>${currency(cashSpentBuying)}</b>. However, if you choose to rent instead, your overall
              expenditure would come to <b>${currency(cashSpentRenting)}</b>, thus saving you{" "}
              <b>${currency(Math.max(0, cashSpentRenting - cashSpentBuying))}</b> (which also covers the
              down payment you would have otherwise made).
            </p>
          </div>

          <div className="rounded-xl border border-rose-200 bg-rose-100 p-4">
            <div className="font-semibold text-lg mb-1">Financial Gain:</div>
            <p className="text-sm leading-6">
              After <b>{years} years</b>, if you choose to purchase the property, the value of equity in
              your home would be <b>${currency(equity)}</b>, which you can access upon selling it.
            </p>
          </div>

          <div className="rounded-xl border border-rose-200 bg-rose-100 p-4">
            <div className="font-semibold text-lg mb-1">Summary:</div>
            <p className="text-sm leading-6">
              Based on the overall expenses incurred and the equity gained, it would be more advantageous
              for you to buy the property instead of renting, provided you intend to reside in the house
              for more than <b>{years}</b> years.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

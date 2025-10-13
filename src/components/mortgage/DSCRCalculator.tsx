import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Info, ChevronDown } from "lucide-react";
import {
  Tooltip as UiTooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

/* ------------------------------- helpers ------------------------------- */

const fmt = (n: number, frac: number = 2) =>
  n.toLocaleString(undefined, { minimumFractionDigits: frac, maximumFractionDigits: frac });

const pct = (n: number, frac: number = 2) =>
  `${(n * 100).toLocaleString(undefined, { minimumFractionDigits: frac, maximumFractionDigits: frac })} %`;

function monthlyPI(principal: number, yearlyRatePct: number, years: number) {
  const r = yearlyRatePct / 100 / 12;
  const n = years * 12;
  if (principal <= 0 || n <= 0) return 0;
  if (r === 0) return principal / n;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

const rangeInt = (start: number, end: number, step = 1) =>
  Array.from({ length: Math.floor((end - start) / step) + 1 }, (_, i) => start + i * step);
const rangeMoney = (start: number, end: number, step: number) =>
  rangeInt(0, Math.floor((end - start) / step)).map(i => start + i * step);

/* shared tooltip bubble (green) */
function Bubble({
  title,
  body,
  widthClass = "w-72",
}: {
  title: string;
  body: string;
  widthClass?: string;
}) {
  return (
    <div className={`relative ${widthClass} rounded-xl bg-[#44C264] text-white p-4`}>
      <span className="absolute -left-1.5 top-4 h-3 w-3 rotate-45 bg-[#44C264]" />
      <div className="font-bold mb-1">{title}</div>
      <p className="text-sm leading-5">{body}</p>
    </div>
  );
}

/* --------------------------------- UI ---------------------------------- */

export default function DSCRCalculator() {
  /* top selectors */
  const [mode, setMode] = useState<"purchase" | "refinance">("purchase");
  const [units, setUnits] = useState<number>(1);
  const [purchasePrice, setPurchasePrice] = useState<number>(500000);

  /* inputs */
  const [unitRent, setUnitRent] = useState(2500);
  const [annualTaxes, setAnnualTaxes] = useState(4000);
  const [annualInsurance, setAnnualInsurance] = useState(3000);
  const [monthlyHOA, setMonthlyHOA] = useState(0);
  const [vacancyPct, setVacancyPct] = useState(5);
  const [annualRepairs, setAnnualRepairs] = useState(500);
  const [annualUtilities, setAnnualUtilities] = useState(5000);
  const [ltvPct, setLtvPct] = useState(80);
  const [interestPct, setInterestPct] = useState(8);
  const [originationPct, setOriginationPct] = useState(2);
  const [closingCosts, setClosingCosts] = useState(6500);

  /* derived */
  const loanAmount = useMemo(() => purchasePrice * (ltvPct / 100), [purchasePrice, ltvPct]);
  const downPayment = purchasePrice - loanAmount;

  const pi = useMemo(() => monthlyPI(loanAmount, interestPct, 30), [loanAmount, interestPct]);
  const annualDebtService = pi * 12;

  const monthlyTaxes = annualTaxes / 12;
  const monthlyIns = annualInsurance / 12;
  const monthlyEscrowedPayment = pi + monthlyTaxes + monthlyIns;

  const grossRentAnnual = unitRent * units * 12;
  const vacancyExpense = (vacancyPct / 100) * grossRentAnnual;

  const operatingExpenses =
    annualTaxes + annualInsurance + monthlyHOA * 12 + annualRepairs + annualUtilities + vacancyExpense;

  const noi = grossRentAnnual - operatingExpenses;

  const cashFlowAnnual = noi - annualDebtService;
  const capRate = noi / purchasePrice;
  const originationFeeAmt = loanAmount * (originationPct / 100);
  const totalClosingCosts = closingCosts + originationFeeAmt;
  const cashNeededToClose = downPayment + totalClosingCosts;

  const cashOnCash = cashFlowAnnual / cashNeededToClose;
  const dscr = noi / annualDebtService;

  const kpiColor = (v: number, positiveGood = true) =>
    v >= 0 ? (positiveGood ? "dscr-kpi--green" : "dscr-kpi--red") : (positiveGood ? "dscr-kpi--red" : "dscr-kpi--green");

  /* accordions */
  const [open, setOpen] = useState<Record<string, boolean>>({ cf: true, cr: true, coc: true, dscr: true });
  const toggle = (key: string) => setOpen((p) => ({ ...p, [key]: !p[key] }));

  /* dropdown sets (your specs) */
  const unitOptions = [1, 2, 3, 4];
  const vacancyOptions = rangeInt(3, 20);
  const repairsOptions = rangeMoney(300, 10000, 100);
  const ltvOptions = [80, 70, 60, 50, 40, 30, 20, 10, 0];

  const interestSteps: number[] = [];
  for (let v = 6; v <= 9.0001; v += 1.25) interestSteps.push(Number(v.toFixed(3)));
  if (!interestSteps.includes(8)) interestSteps.push(8);
  interestSteps.sort((a, b) => a - b);

  const originationOptions: number[] = [];
  for (let v = 0; v <= 3.0001; v += 0.25) originationOptions.push(Number(v.toFixed(2)));

  return (
    <TooltipProvider>
      <div className="grid gap-6" style={{ gridTemplateColumns: "500px 1fr" }}>
        {/* LEFT input panel */}
        <div className="fs-panel fs-fixed">
          <h2 className="fs-title">Debt–Service (DSCR)</h2>

          <div className="fs-body mt-2">
            {/* top row: units / mode / price */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="fs-field">
                <label className="fs-label flex items-center gap-2">
                  Number of Units
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="Number of Units" className="inline-flex items-center text-[#FFFFFF]">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <Bubble title="Number of Units" body="How many rental units the property has. Rent is per unit." />
                    </TooltipContent>
                  </UiTooltip>
                </label>
                <select className="fs-input fs-select" value={units} onChange={(e)=>setUnits(Number(e.target.value))}>
                  {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              <div className="fs-field">
                <label className="fs-label flex items-center gap-2">
                  Purchase or Refinance
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="Scenario" className="inline-flex items-center text-[#FFFFFF]">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <Bubble title="Scenario" body="Choose Purchase for a new acquisition or Refinance for an existing property." />
                    </TooltipContent>
                  </UiTooltip>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant={mode === "purchase" ? "default" : "secondary"} onClick={()=>setMode("purchase")} style={{ color: mode === "purchase" ? "#0F2C4C" : "#71737A" }}>Purchase</Button>
                  <Button variant={mode === "refinance" ? "default" : "secondary"} onClick={()=>setMode("refinance")} style={{ color: mode === "refinance" ? "#0F2C4C" : "#71737A" }}>Refinance</Button>
                </div>
              </div>

              <div className="fs-field md:col-span-2">
                <label className="fs-label flex items-center gap-2">
                  Property Value or Purchase Price
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="Price/Value" className="inline-flex items-center text-[#FFFFFF]">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <Bubble title="Price or Value" body="Use the contract price for purchases or the current appraised value for refinances." />
                    </TooltipContent>
                  </UiTooltip>
                </label>
                <Input className="fs-input" inputMode="numeric" value={purchasePrice} onChange={(e)=>setPurchasePrice(Number(e.target.value||0))} />
              </div>
            </div>

            {/* main grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="fs-field">
                <label className="fs-label flex items-center gap-2">
                  Unit 1 Monthly Rent
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="Monthly Rent per Unit" className="inline-flex items-center text-[#FFFFFF]">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <Bubble title="Monthly Rent" body="Enter rent per unit. Total rent scales with the number of units." />
                    </TooltipContent>
                  </UiTooltip>
                </label>
                <Input className="fs-input" inputMode="numeric" value={unitRent} onChange={(e)=>setUnitRent(Number(e.target.value||0))} />
              </div>

              <div className="fs-field">
                <label className="fs-label flex items-center gap-2">
                  Annual Property Taxes
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="Annual Property Taxes" className="inline-flex items-center text-[#FFFFFF]">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <Bubble title="Property Taxes" body="Yearly real estate taxes for the property." />
                    </TooltipContent>
                  </UiTooltip>
                </label>
                <Input className="fs-input" inputMode="numeric" value={annualTaxes} onChange={(e)=>setAnnualTaxes(Number(e.target.value||0))} />
              </div>

              <div className="fs-field">
                <label className="fs-label flex items-center gap-2">
                  Annual Insurance
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="Annual Insurance" className="inline-flex items-center text-[#FFFFFF]">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <Bubble title="Insurance" body="Annual hazard/landlord insurance premium." />
                    </TooltipContent>
                  </UiTooltip>
                </label>
                <Input className="fs-input" inputMode="numeric" value={annualInsurance} onChange={(e)=>setAnnualInsurance(Number(e.target.value||0))} />
              </div>

              <div className="fs-field">
                <label className="fs-label flex items-center gap-2">
                  Monthly HOA Fee
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="Monthly HOA" className="inline-flex items-center text-[#FFFFFF]">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <Bubble title="HOA Dues" body="Monthly homeowners association dues, if any." />
                    </TooltipContent>
                  </UiTooltip>
                </label>
                <Input className="fs-input" inputMode="numeric" value={monthlyHOA} onChange={(e)=>setMonthlyHOA(Number(e.target.value||0))} />
              </div>

              <div className="fs-field">
                <label className="fs-label flex items-center gap-2">
                  Vacancy Rate
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="Vacancy Rate" className="inline-flex items-center text-[#FFFFFF]">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <Bubble title="Vacancy" body="Percent of time units are expected to be unoccupied." />
                    </TooltipContent>
                  </UiTooltip>
                </label>
                <select className="fs-input fs-select" value={vacancyPct} onChange={(e)=>setVacancyPct(Number(e.target.value))}>
                  {vacancyOptions.map(v => <option key={v} value={v}>{v}%</option>)}
                </select>
              </div>

              <div className="fs-field">
                <label className="fs-label flex items-center gap-2">
                  Repairs & Maintenance
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="Repairs & Maintenance" className="inline-flex items-center text-[#FFFFFF]">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <Bubble title="Repairs & Maintenance" body="Yearly allowance for repairs, turns, and upkeep." />
                    </TooltipContent>
                  </UiTooltip>
                </label>
                <select className="fs-input fs-select" value={annualRepairs} onChange={(e)=>setAnnualRepairs(Number(e.target.value))}>
                  {repairsOptions.map(v => <option key={v} value={v}>${fmt(v,0)}</option>)}
                </select>
              </div>

              <div className="fs-field">
                <label className="fs-label flex items-center gap-2">
                  Annual Utilities
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="Annual Utilities" className="inline-flex items-center text-[#FFFFFF]">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <Bubble title="Utilities" body="Any utilities paid by you as the owner (water, trash, etc.)." />
                    </TooltipContent>
                  </UiTooltip>
                </label>
                <Input className="fs-input" inputMode="numeric" value={annualUtilities} onChange={(e)=>setAnnualUtilities(Number(e.target.value||0))} />
              </div>

              <div className="fs-field">
                <label className="fs-label flex items-center gap-2">
                  Loan to Value
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="LTV" className="inline-flex items-center text-[#FFFFFF]">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <Bubble title="LTV" body="Percent of price/value financed. 80% means 20% down." />
                    </TooltipContent>
                  </UiTooltip>
                </label>
                <select className="fs-input fs-select" value={ltvPct} onChange={(e)=>setLtvPct(Number(e.target.value))}>
                  {ltvOptions.map(v => <option key={v} value={v}>{v}%</option>)}
                </select>
              </div>

              <div className="fs-field">
                <label className="fs-label flex items-center gap-2">
                  Interest Rate
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="Interest Rate" className="inline-flex items-center text-[#FFFFFF]">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <Bubble title="Interest Rate" body="Annual percentage rate (APR) used for the new mortgage payment." />
                    </TooltipContent>
                  </UiTooltip>
                </label>
                <select className="fs-input fs-select" value={interestPct} onChange={(e)=>setInterestPct(Number(e.target.value))}>
                  {interestSteps.map(v => <option key={v} value={v}>{v.toFixed(3)}%</option>)}
                </select>
              </div>

              <div className="fs-field">
                <label className="fs-label flex items-center gap-2">
                  Origination Fee
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="Origination Fee" className="inline-flex items-center text-[#FFFFFF]">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <Bubble title="Origination" body="Points charged by the lender, as a percent of the loan amount." />
                    </TooltipContent>
                  </UiTooltip>
                </label>
                <select className="fs-input fs-select" value={originationPct} onChange={(e)=>setOriginationPct(Number(e.target.value))}>
                  {originationOptions.map(v => <option key={v} value={v}>{v.toFixed(2)}%</option>)}
                </select>
                
              </div>

              <div className="fs-field md:col-span-2">
                <label className="fs-label flex items-center gap-2">
                  Closing Costs
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="Closing Costs" className="inline-flex items-center text-[#FFFFFF]">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <Bubble title="Closing Costs" body="Third-party fees such as appraisal, title, and recording." />
                    </TooltipContent>
                  </UiTooltip>
                </label>
                <Input className="fs-input" inputMode="numeric" value={closingCosts} onChange={(e)=>setClosingCosts(Number(e.target.value||0))} />
                <div className="fs-sublabel">Total closing costs (incl. origination): ${fmt(totalClosingCosts,0)}</div>
              </div>
            </div>

            <Button asChild className="fs-cta w-full mt-5">
  <a href="https://creomortgage.com/#form" target="_blank" rel="noopener noreferrer">
    GET A QUOTE
  </a>
</Button>

          </div>
        </div>

        {/* RIGHT content */}
        <div className="grid gap-6">
          {/* KPI row */}
          <div className="grid grid-cols-4 gap-6">
            <div className={`dscr-kpi ${kpiColor(cashFlowAnnual, false)}`}>
              <div className="dscr-kpi__label">Cash Flow</div>
              <div className="dscr-kpi__value">{cashFlowAnnual >= 0 ? "$" : "- $"}{fmt(Math.abs(cashFlowAnnual), 1)}</div>
            </div>
            <div className={`dscr-kpi ${kpiColor(capRate, true)}`}>
              <div className="dscr-kpi__label">Cap Rate</div>
              <div className="dscr-kpi__value">{pct(capRate, 1)}</div>
            </div>
            <div className={`dscr-kpi ${kpiColor(cashOnCash, true)}`}>
              <div className="dscr-kpi__label">Cash on Cash Return</div>
              <div className="dscr-kpi__value">{cashOnCash >= 0 ? "" : "- "}{pct(Math.abs(cashOnCash), 2)}</div>
            </div>
            <div className={`dscr-kpi ${kpiColor(dscr, true)}`}>
              <div className="dscr-kpi__label">DSCR</div>
              <div className="dscr-kpi__value">{fmt(dscr, 2)}</div>
            </div>
          </div>

          {/* Breakdown + Metrics / Return Metrics */}
          <div className="grid grid-cols-2 gap-6 items-start">
            <div className="grid gap-6">
              <Card className="dscr-card">
                <CardHeader className="dscr-card__header">
                  <CardTitle className="dscr-card__title">Deal Breakdown</CardTitle>
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="Deal Breakdown" className="pc-info flex justify-between">
                        <Info size={16} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <Bubble title="Deal Breakdown" body="Key monthly payment pieces and your cash to close." />
                    </TooltipContent>
                  </UiTooltip>
                </CardHeader>
                <CardContent className="dscr-card__body">
                  <div className="ds-row"><span>Loan Amount:</span><b>${fmt(loanAmount)}</b></div>
                  <div className="ds-row"><span>Down Payment:</span><b>${fmt(downPayment)}</b></div>
                  <div className="ds-row mt-3"><span>Mortgage Payment:</span><b>${fmt(pi)}</b></div>
                  <div className="ds-row"><span>Monthly Payment:</span><b>${fmt(monthlyEscrowedPayment)}</b></div>
                  <div className="ds-row mt-3"><span>Origination Fee Amount:</span><b>${fmt(originationFeeAmt)}</b></div>
                </CardContent>
              </Card>

              <Card className="dscr-card">
                <CardHeader className="dscr-card__header">
                  <CardTitle className="dscr-card__title">Deal Metrics</CardTitle>
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="Deal Metrics" className="pc-info inline-flex items-center">
                        <Info size={16} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                      <Bubble title="Deal Metrics" body="Helpful roll-ups like NOI, Cap Rate, and Cash Needed to Close." />
                    </TooltipContent>
                  </UiTooltip>
                </CardHeader>
                <CardContent className="dscr-card__body dscr-grid">
                  <div className="ds-row"><span>Total Closing Costs:</span><b>${fmt(totalClosingCosts)}</b></div>
                  <div className="ds-row"><span>Cash Needed to Close:</span><b>${fmt(cashNeededToClose)}</b></div>
                  <div className="ds-row"><span>Price Per Unit:</span><b>${fmt(purchasePrice / Math.max(1, units))}</b></div>
                  <div className="ds-row"><span>Gross Rental Income:</span><b>${fmt(grossRentAnnual)}</b></div>
                  <div className="ds-row"><span>Operating Expenses:</span><b>${fmt(operatingExpenses)}</b></div>
                  <div className="ds-row"><span>Net Operating Income:</span><b>${fmt(noi)}</b></div>
                </CardContent>
              </Card>
            </div>

            <Card className="dscr-card h-full">
              <CardHeader className="dscr-card__header">
                <CardTitle className="dscr-card__title">Return Metrics</CardTitle>
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="Return Metrics" className="pc-info inline-flex items-center">
                      <Info size={16} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" sideOffset={8} className="p-0 bg-transparent border-0 shadow-none">
                    <Bubble title="Return Metrics" body="Click a row to read what each metric means." />
                  </TooltipContent>
                </UiTooltip>
              </CardHeader>
              <CardContent className="dscr-card__body space-y-3">
                <div className="rm-item">
                  <button className="rm-head" onClick={()=>toggle("cf")} aria-expanded={open.cf}>
                    <span>Cash Flow:</span>
                    <div className={`rm-val ${cashFlowAnnual >= 0 ? "ok" : "bad"}`}>
                      {cashFlowAnnual >= 0 ? "" : "-"}${fmt(Math.abs(cashFlowAnnual))}
                      <ChevronDown className={`rm-chevron ${open.cf ? "open":""}`} size={16}/>
                    </div>
                  </button>
                  {open.cf && (
                    <div className="rm-body">
                      Annual cash flow after all expenses and mortgage are paid.
                    </div>
                  )}
                </div>

                <div className="rm-item">
                  <button className="rm-head" onClick={()=>toggle("cr")} aria-expanded={open.cr}>
                    <span>Cap Rate:</span>
                    <div className="rm-val">
                      {pct(capRate, 2)}
                      <ChevronDown className={`rm-chevron ${open.cr ? "open":""}`} size={16}/>
                    </div>
                  </button>
                  {open.cr && (
                    <div className="rm-body">
                      NOI ÷ price/value. A quick way to compare income properties.
                    </div>
                  )}
                </div>

                <div className="rm-item">
                  <button className="rm-head" onClick={()=>toggle("coc")} aria-expanded={open.coc}>
                    <span>Cash on Cash Return:</span>
                    <div className={`rm-val ${cashOnCash >= 0 ? "ok":"bad"}`}>
                      {cashOnCash >= 0 ? "" : "-"}{pct(Math.abs(cashOnCash), 2)}
                      <ChevronDown className={`rm-chevron ${open.coc ? "open":""}`} size={16}/>
                    </div>
                  </button>
                  {open.coc && (
                    <div className="rm-body">
                      Annual cash flow divided by your total cash invested (down payment + closing).
                    </div>
                  )}
                </div>

                <div className="rm-item">
                  <button className="rm-head" onClick={()=>toggle("dscr")} aria-expanded={open.dscr}>
                    <span>DSCR:</span>
                    <div className="rm-val">
                      {fmt(dscr, 2)}
                      <ChevronDown className={`rm-chevron ${open.dscr ? "open":""}`} size={16}/>
                    </div>
                  </button>
                  {open.dscr && (
                    <div className="rm-body">
                      Debt Service Coverage Ratio = NOI ÷ Annual Debt Service. Lenders usually want 1.0+.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Info, ChevronDown } from "lucide-react";

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

/* --------------------------------- UI ---------------------------------- */

export default function DSCRCalculator() {
  /* Left panel state (matches your screenshot defaults) */
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

  // Price is constant in the screenshot (keeps all outputs pixel-identical)
  const purchasePrice = 500000;

  /* Derived numbers (same math you saw earlier) */
  const loanAmount = useMemo(() => purchasePrice * (ltvPct / 100), [purchasePrice, ltvPct]);
  const downPayment = purchasePrice - loanAmount;

  const pi = useMemo(() => monthlyPI(loanAmount, interestPct, 30), [loanAmount, interestPct]);
  const annualDebtService = pi * 12;

  const monthlyTaxes = annualTaxes / 12;
  const monthlyIns = annualInsurance / 12;
  const monthlyEscrowedPayment = pi + monthlyTaxes + monthlyIns;

  const grossRentAnnual = unitRent * 12;
  const vacancyExpense = (vacancyPct / 100) * grossRentAnnual;

  const operatingExpenses =
    annualTaxes + annualInsurance + monthlyHOA * 12 + annualRepairs + annualUtilities + vacancyExpense;

  const noi = grossRentAnnual - operatingExpenses;

  const cashFlowAnnual = noi - annualDebtService;
  const capRate = noi / purchasePrice;
  const originationFeeAmt = loanAmount * (originationPct / 100);
  const totalClosingCosts = closingCosts + originationFeeAmt;
  const cashNeededToClose = downPayment + totalClosingCosts;

  // Cash-on-cash uses total cash invested (down + closing)
  const cashOnCash = cashFlowAnnual / cashNeededToClose;
  const dscr = noi / annualDebtService;

  const kpiColor = (v: number, positiveGood = true) =>
    v >= 0 ? (positiveGood ? "dscr-kpi--green" : "dscr-kpi--red") : (positiveGood ? "dscr-kpi--red" : "dscr-kpi--green");

  /* Return Metrics accordion state */
  const [open, setOpen] = useState<Record<string, boolean>>({
    cf: true, cr: true, coc: true, dscr: true,
  });
  const toggle = (key: string) => setOpen((p) => ({ ...p, [key]: !p[key] }));

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "430px 1fr" }}>
      {/* LEFT input panel */}
      <div className="fs-panel fs-fixed">
        <h2 className="fs-title">Debt–Service (DSCR)</h2>
        <div className="fs-body mt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="fs-field">
              <label className="fs-label">Unit 1 Monthly Rent <i className="fs-i" title="Lorem ipsum">?</i></label>
              <Input className="fs-input" inputMode="numeric" value={unitRent} onChange={(e)=>setUnitRent(Number(e.target.value||0))} />
            </div>
            <div className="fs-field">
              <label className="fs-label">Annual Property Taxes <i className="fs-i" title="Lorem ipsum">?</i></label>
              <Input className="fs-input" inputMode="numeric" value={annualTaxes} onChange={(e)=>setAnnualTaxes(Number(e.target.value||0))} />
            </div>
            <div className="fs-field">
              <label className="fs-label">Annual Insurance <i className="fs-i" title="Lorem ipsum">?</i></label>
              <Input className="fs-input" inputMode="numeric" value={annualInsurance} onChange={(e)=>setAnnualInsurance(Number(e.target.value||0))} />
            </div>
            <div className="fs-field">
              <label className="fs-label">Monthly HOA Fee <i className="fs-i" title="Lorem ipsum">?</i></label>
              <Input className="fs-input" inputMode="numeric" value={monthlyHOA} onChange={(e)=>setMonthlyHOA(Number(e.target.value||0))} />
            </div>
            <div className="fs-field">
              <label className="fs-label">Vacancy Rate <i className="fs-i" title="Lorem ipsum">?</i></label>
              <Select value={String(vacancyPct)} onValueChange={(v)=>setVacancyPct(Number(v))}>
                <SelectTrigger className="fs-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0,5,8,10,12].map(v=><SelectItem key={v} value={String(v)}>{v}%</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="fs-field">
              <label className="fs-label">Annual Repairs & Maintenance <i className="fs-i" title="Lorem ipsum">?</i></label>
              <Input className="fs-input" inputMode="numeric" value={annualRepairs} onChange={(e)=>setAnnualRepairs(Number(e.target.value||0))} />
            </div>
            <div className="fs-field">
              <label className="fs-label">Annual Utilities <i className="fs-i" title="Lorem ipsum">?</i></label>
              <Input className="fs-input" inputMode="numeric" value={annualUtilities} onChange={(e)=>setAnnualUtilities(Number(e.target.value||0))} />
            </div>
            <div className="fs-field">
              <label className="fs-label">Loan to Value <i className="fs-i" title="Lorem ipsum">?</i></label>
              <Select value={String(ltvPct)} onValueChange={(v)=>setLtvPct(Number(v))}>
                <SelectTrigger className="fs-input"><SelectValue/></SelectTrigger>
                <SelectContent>
                  {[50,60,70,75,80,85,90].map(v=><SelectItem key={v} value={String(v)}>{v}%</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="fs-field">
              <label className="fs-label">Interest Rate <i className="fs-i" title="Lorem ipsum">?</i></label>
              <Select value={String(interestPct)} onValueChange={(v)=>setInterestPct(Number(v))}>
                <SelectTrigger className="fs-input"><SelectValue/></SelectTrigger>
                <SelectContent>
                  {[6,6.5,7,7.5,8,8.5,9].map(v=><SelectItem key={v} value={String(v)}>{v.toFixed(3)}%</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="fs-field">
              <label className="fs-label">Origination Fee <i className="fs-i" title="Lorem ipsum">?</i></label>
              <Select value={String(originationPct)} onValueChange={(v)=>setOriginationPct(Number(v))}>
                <SelectTrigger className="fs-input"><SelectValue/></SelectTrigger>
                <SelectContent>
                  {[0,0.5,1,1.5,2,2.5,3].map(v=><SelectItem key={v} value={String(v)}>{v.toFixed(2)}%</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="fs-field md:col-span-2">
              <label className="fs-label">Closing Costs <i className="fs-i" title="Lorem ipsum">?</i></label>
              <Input className="fs-input" inputMode="numeric" value={closingCosts} onChange={(e)=>setClosingCosts(Number(e.target.value||0))} />
            </div>
          </div>

          <Button className="fs-cta w-full mt-5">GET A QUOTE</Button>
        </div>
      </div>

      {/* RIGHT content */}
      <div className="grid gap-6">
        {/* KPI row */}
        <div className="grid grid-cols-4 gap-6">
          <div className={`dscr-kpi ${kpiColor(cashFlowAnnual, false)}`}>
            <div className="dscr-kpi__label">Cash Flow</div>
            <div className="dscr-kpi__value">{cashFlowAnnual >= 0 ? "$" : "- $"}{fmt(Math.abs(cashFlowAnnual), 2)}</div>
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

        {/* Two columns: left = Breakdown + Deal Metrics (stacked), right = Return Metrics (accordion) */}
        <div className="grid grid-cols-2 gap-6 items-start">
          <div className="grid gap-6">
            <Card className="dscr-card">
              <CardHeader className="dscr-card__header">
                <CardTitle className="dscr-card__title">Deal Breakdown</CardTitle>
                <span className="pc-info" title="Lorem ipsum dolor sit amet."><Info size={16} /></span>
              </CardHeader>
              <CardContent className="dscr-card__body">
                <div className="ds-row"><span>Loan Amount:</span><b>${fmt(loanAmount)}</b></div>
                <div className="ds-row"><span>Down Payment:</span><b>${fmt(purchasePrice - loanAmount)}</b></div>
                <div className="ds-row mt-3"><span>Mortgage Payment:</span><b>${fmt(pi)}</b></div>
                <div className="ds-row"><span>Monthly Payment:</span><b>${fmt(monthlyEscrowedPayment)}</b></div>
                <div className="ds-row mt-3"><span>Origination Fee Amount:</span><b>${fmt(originationFeeAmt)}</b></div>
              </CardContent>
            </Card>

            <Card className="dscr-card">
              <CardHeader className="dscr-card__header">
                <CardTitle className="dscr-card__title">Deal Metrics</CardTitle>
                <span className="pc-info" title="Lorem ipsum dolor sit amet."><Info size={16} /></span>
              </CardHeader>
              <CardContent className="dscr-card__body dscr-grid">
                <div className="ds-row"><span>Total Closing Costs:</span><b>${fmt(totalClosingCosts)}</b></div>
                <div className="ds-row"><span>Cash Needed to Close:</span><b>${fmt(cashNeededToClose)}</b></div>
                <div className="ds-row"><span>Price Per Unit:</span><b>${fmt(purchasePrice)}</b></div>
                <div className="ds-row"><span>Gross Rental Income:</span><b>${fmt(grossRentAnnual)}</b></div>
                <div className="ds-row"><span>Operating Expenses:</span><b>${fmt(operatingExpenses)}</b></div>
                <div className="ds-row"><span>Net Operating Income:</span><b>${fmt(noi)}</b></div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT column: Return Metrics (accordion per row, fixed column so expanding never shifts layout) */}
          <Card className="dscr-card h-full">
            <CardHeader className="dscr-card__header">
              <CardTitle className="dscr-card__title">Return Metrics</CardTitle>
              <span className="pc-info" title="Lorem ipsum dolor sit amet."><Info size={16} /></span>
            </CardHeader>
            <CardContent className="dscr-card__body space-y-3">
              {/* Row: Cash Flow */}
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

              {/* Row: Cap Rate */}
              <div className="rm-item">
                <button className="rm-head" onClick={()=>toggle("cr")} aria-expanded={open.cr}>
                  <span>Cap Rate:</span>
                  <div className="rm-val">{pct(capRate, 2)}<ChevronDown className={`rm-chevron ${open.cr ? "open":""}`} size={16}/></div>
                </button>
                {open.cr && (
                  <div className="rm-body">
                    Cap rate (capitalization rate) divides Net Operating Income by the purchase price or value.
                    It’s most useful when comparing multifamily properties.
                  </div>
                )}
              </div>

              {/* Row: Cash on Cash Return */}
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
                    Measures annual cash flow divided by your total cash invested in the deal.
                  </div>
                )}
              </div>

              {/* Row: DSCR */}
              <div className="rm-item">
                <button className="rm-head" onClick={()=>toggle("dscr")} aria-expanded={open.dscr}>
                  <span>DSCR:</span>
                  <div className="rm-val">{fmt(dscr, 2)}<ChevronDown className={`rm-chevron ${open.dscr ? "open":""}`} size={16}/></div>
                </button>
                {open.dscr && (
                  <div className="rm-body">
                    DSCR (Debt Service Coverage Ratio) = NOI ÷ Annual Debt Service. Lenders generally want 1.0 or higher.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

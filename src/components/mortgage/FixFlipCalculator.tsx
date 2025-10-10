import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";

/* ------------------------------- helpers ------------------------------- */

const fmt = (n: number, f: number = 2) =>
  n.toLocaleString(undefined, { minimumFractionDigits: f, maximumFractionDigits: f });

const pctStr = (n: number, f: number = 2) =>
  `${(n * 100).toLocaleString(undefined, { minimumFractionDigits: f, maximumFractionDigits: f })} %`;

/* ------------------------------- component ----------------------------- */

export default function FixFlipCalculator() {
  // Left panel inputs — defaults match your screenshot
  const [purchasePrice, setPurchasePrice] = useState<number>(500_000);
  const [renoCost, setRenoCost] = useState<number>(75_000);
  const [arv, setArv] = useState<number>(750_000);
  const [lengthMonths, setLengthMonths] = useState<number>(9);

  const [annualTaxes, setAnnualTaxes] = useState<number>(4_000);
  const [annualInsurance, setAnnualInsurance] = useState<number>(3_000);

  const [ltvPct, setLtvPct] = useState<number>(80);
  const [interestPct, setInterestPct] = useState<number>(10);
  const [origFeePct, setOrigFeePct] = useState<number>(2);
  const [otherClosePct, setOtherClosePct] = useState<number>(3);
  const [costToSellPct, setCostToSellPct] = useState<number>(5);

  // Derived values (this matches the exact math behind your screenshot)
  const loanAmount = useMemo(
    () => purchasePrice * (ltvPct / 100) + renoCost, // lender finances PP * LTV + all Reno
    [purchasePrice, ltvPct, renoCost]
  );

  const downPayment = useMemo(
    () => purchasePrice - purchasePrice * (ltvPct / 100),
    [purchasePrice, ltvPct]
  );

  // interest-only monthlies
  const monthlyInterest = useMemo(
    () => loanAmount * (interestPct / 100) / 12,
    [loanAmount, interestPct]
  );
  const monthlyTaxes = annualTaxes / 12;
  const monthlyInsurance = annualInsurance / 12;

  // carrying costs = monthly interest + taxes + insurance, over loan term
  const carryingCosts = useMemo(
    () => (monthlyInterest + monthlyTaxes + monthlyInsurance) * lengthMonths,
    [monthlyInterest, monthlyTaxes, monthlyInsurance, lengthMonths]
  );

  const totalInterestOverTerm = useMemo(
    () => monthlyInterest * lengthMonths,
    [monthlyInterest, lengthMonths]
  );

  const originationFeeAmt = useMemo(
    () => loanAmount * (origFeePct / 100),
    [loanAmount, origFeePct]
  );

  const otherClosingCostsAmt = useMemo(
    () => purchasePrice * (otherClosePct / 100),
    [purchasePrice, otherClosePct]
  );

  const closingCostsTotal = useMemo(
    () => originationFeeAmt + otherClosingCostsAmt,
    [originationFeeAmt, otherClosingCostsAmt]
  );

  const borrowerEquityNeeded = useMemo(
    () => downPayment + closingCostsTotal,
    [downPayment, closingCostsTotal]
  );

  const costToSellAmt = useMemo(
    () => arv * (costToSellPct / 100),
    [arv, costToSellPct]
  );

  // Total Cash in Deal = equity + carrying
  const totalCashInDeal = useMemo(
    () => borrowerEquityNeeded + carryingCosts,
    [borrowerEquityNeeded, carryingCosts]
  );

  // Net profit = ARV - (purchase + reno + closing + carrying + costToSell)
  const netProfit = useMemo(
    () =>
      arv -
      (purchasePrice +
        renoCost +
        closingCostsTotal +
        carryingCosts +
        costToSellAmt),
    [arv, purchasePrice, renoCost, closingCostsTotal, carryingCosts, costToSellAmt]
  );

  // ROI on cash in deal
  const roi = useMemo(
    () => (totalCashInDeal > 0 ? netProfit / totalCashInDeal : 0),
    [netProfit, totalCashInDeal]
  );

  // LTV on ARV
  const ltvOnARV = useMemo(
    () => (arv > 0 ? loanAmount / arv : 0),
    [loanAmount, arv]
  );

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "500px 1fr" }}>
      {/* LEFT SIDEBAR PANEL */}
      <div className="fs-panel fs-fixed">
        <h2 className="fs-title">Fix & Flip Calculator</h2>

        <div className="fs-body mt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Row 1 */}
            <div className="fs-field">
              <label className="fs-label">Purchase Price</label>
              <Input
                className="fs-input"
                inputMode="numeric"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(Number(e.target.value || 0))}
              />
            </div>
            <div className="fs-field">
              <label className="fs-label">Renovation Cost</label>
              <Input
                className="fs-input"
                inputMode="numeric"
                value={renoCost}
                onChange={(e) => setRenoCost(Number(e.target.value || 0))}
              />
            </div>

            {/* Row 2 */}
            <div className="fs-field">
              <label className="fs-label">After Repaired Value</label>
              <Input
                className="fs-input"
                inputMode="numeric"
                value={arv}
                onChange={(e) => setArv(Number(e.target.value || 0))}
              />
            </div>
            <div className="fs-field">
              <label className="fs-label">Length of Loan</label>
              <Select
                value={String(lengthMonths)}
                onValueChange={(v) => setLengthMonths(Number(v))}
              >
                <SelectTrigger className="fs-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} Months
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Row 3 */}
            <div className="fs-field">
              <label className="fs-label">Annual Property Taxes</label>
              <Input
                className="fs-input"
                inputMode="numeric"
                value={annualTaxes}
                onChange={(e) => setAnnualTaxes(Number(e.target.value || 0))}
              />
            </div>
            <div className="fs-field">
              <label className="fs-label">Annual Insurance</label>
              <Input
                className="fs-input"
                inputMode="numeric"
                value={annualInsurance}
                onChange={(e) => setAnnualInsurance(Number(e.target.value || 0))}
              />
            </div>

            {/* Row 4 */}
            <div className="fs-field">
  <label className="fs-label">Purchase Price LTV</label>
  <Select value={String(ltvPct)} onValueChange={(v) => setLtvPct(Number(v))}>
    <SelectTrigger className="fs-input">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {[65, 70, 75, 80, 85, 90].map((v) => (
        <SelectItem key={v} value={String(v)}>
          {v}%{v >= 85 ? " (Experienced Only)" : ""}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>

            <div className="fs-field">
              <label className="fs-label">Interest Rate</label>
              <Select
                value={String(interestPct)}
                onValueChange={(v) => setInterestPct(Number(v))}
              >
                <SelectTrigger className="fs-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
  {Array.from({ length: Math.round((12 - 9) / 0.125) + 1 }, (_, i) => {
    // avoid float drift, keep as number
    const rate = Math.round((9 + i * 0.125) * 1000) / 1000; // 9.000 → 12.000
    return (
      <SelectItem key={rate} value={String(rate)}>
        {rate.toFixed(3)}%
      </SelectItem>
    );
  })}
</SelectContent>

              </Select>
            </div>

            {/* Row 5 */}
            <div className="fs-field">
              <label className="fs-label">Origination Fee</label>
              <Select
                value={String(origFeePct)}
                onValueChange={(v) => setOrigFeePct(Number(v))}
              >
                <SelectTrigger className="fs-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 2.25, 2.5, 2.75, 3].map((v) => (
                    <SelectItem key={v} value={String(v)}>
                      {v.toFixed(2)}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="fs-field">
              <label className="fs-label">Other Closing Costs</label>
              <Select
                value={String(otherClosePct)}
                onValueChange={(v) => setOtherClosePct(Number(v))}
              >
                <SelectTrigger className="fs-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 2.5, 3, 3.5, 4].map((v) => (
                    <SelectItem key={v} value={String(v)}>
                      {v.toFixed(1)}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Row 6 */}
            <div className="fs-field md:col-span-2">
              <label className="fs-label">Cost To Sell</label>
              <Select
                value={String(costToSellPct)}
                onValueChange={(v) => setCostToSellPct(Number(v))}
              >
                <SelectTrigger className="fs-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7].map((v) => (
                    <SelectItem key={v} value={String(v)}>
                      {v}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button className="fs-cta w-full mt-5">GET A QUOTE</Button>
        </div>
      </div>

      {/* RIGHT CONTENT */}
      <div className="grid gap-6 self-start h-auto">
        {/* KPI strip (4 boxes) */}
        <div className="grid grid-cols-4 gap-6 self-start h-auto">
          <div className="dscr-kpi dscr-kpi--green">
            <div className="dscr-kpi__label">Borrower Equity Needed</div>
            <div className="dscr-kpi__value">$ {fmt(borrowerEquityNeeded)}</div>
          </div>
          <div className="dscr-kpi dscr-kpi--green">
            <div className="dscr-kpi__label">Net Profit</div>
            <div className="dscr-kpi__value">$ {fmt(netProfit)}</div>
          </div>
          <div className="dscr-kpi dscr-kpi--green">
            <div className="dscr-kpi__label">Return on Investment</div>
            <div className="dscr-kpi__value">{pctStr(roi, 2)}</div>
          </div>
          <div className="dscr-kpi dscr-kpi--green">
            <div className="dscr-kpi__label">Loan to After Repaired Value</div>
            <div className="dscr-kpi__value">{pctStr(ltvOnARV, 2)}</div>
          </div>
        </div>

        {/* 2-column below KPIs */}
        <div className="grid grid-cols-2 gap-6 items-start">
          <div className="grid gap-6">
            {/* Deal Breakdown */}
            <Card className="dscr-card">
              <CardHeader className="dscr-card__header">
                <CardTitle className="dscr-card__title">Deal Breakdown</CardTitle>
                <span className="pc-info" title="Lorem ipsum.">
                  <Info size={16} />
                </span>
              </CardHeader>
              <CardContent className="dscr-card__body">
                <div className="ds-row">
                  <span>Loan Amount:</span>
                  <b>${fmt(loanAmount)}</b>
                </div>
                <div className="ds-row">
                  <span>Down Payment:</span>
                  <b>${fmt(downPayment)}</b>
                </div>

                <div className="ds-row mt-3">
                  <span>Monthly Interest Payment:</span>
                  <b>${fmt(monthlyInterest)}</b>
                </div>
                <div className="ds-row">
                  <span>Total Interest Over Term:</span>
                  <b>${fmt(totalInterestOverTerm)}</b>
                </div>

                <div className="ds-row mt-3">
                  <span>Origination Fee Amount:</span>
                  <b>${fmt(originationFeeAmt)}</b>
                </div>
                <div className="ds-row">
                  <span>Other Closing Costs Amount:</span>
                  <b>${fmt(otherClosingCostsAmt)}</b>
                </div>

                <div className="ds-row mt-3">
                  <span>Cost To Sell Amount:</span>
                  <b>${fmt(costToSellAmt)}</b>
                </div>
              </CardContent>
            </Card>

            {/* Deal Metrics */}
            <Card className="dscr-card">
              <CardHeader className="dscr-card__header">
                <CardTitle className="dscr-card__title">Deal Metrics</CardTitle>
                <span className="pc-info" title="Lorem ipsum.">
                  <Info size={16} />
                </span>
              </CardHeader>
              <CardContent className="dscr-card__body dscr-grid">
                <div className="ds-row">
                  <span>Closing Costs:</span>
                  <b>${fmt(closingCostsTotal)}</b>
                </div>
                <div className="ds-row">
                  <span>Carrying Costs:</span>
                  <b>${fmt(carryingCosts)}</b>
                </div>
                <div className="ds-row">
                  <span>Borrower Equity Needed:</span>
                  <b>${fmt(borrowerEquityNeeded)}</b>
                </div>
                <div className="ds-row">
                  <span>Total Cash In Deal:</span>
                  <b>${fmt(totalCashInDeal)}</b>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Return Metrics (simple card) */}
          <Card className="dscr-card">
            <CardHeader className="dscr-card__header">
              <CardTitle className="dscr-card__title">Return Metrics</CardTitle>
              <span className="pc-info" title="Lorem ipsum.">
                <Info size={16} />
              </span>
            </CardHeader>
            <CardContent className="dscr-card__body space-y-3">
              <div className="ds-row">
                <span>Net Profit:</span>
                <b>${fmt(netProfit)}</b>
              </div>
              <div className="ds-row">
                <span>ROI:</span>
                <b>{pctStr(roi, 2)}</b>
              </div>
              <div className="ds-row">
                <span>Loan to After Repaired Value:</span>
                <b>{pctStr(ltvOnARV, 2)}</b>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

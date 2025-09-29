import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label } from "recharts";
import { RefreshCw, Info } from "lucide-react";
import { useMortgageRates } from "@/hooks/useMortgageRates";

type ProgramId = "conventional" | "fha" | "va" | "usda" | "jumbo";
type Mode = "amount" | "percent";
type TermMode = "years" | "months";
type PayFreq = "year" | "month";

const PROGRAMS: { id: ProgramId; name: string; maxDTI: number }[] = [
  { id: "conventional", name: "Conventional", maxDTI: 50 },
  { id: "fha",          name: "FHA",          maxDTI: 57 },
  { id: "va",           name: "VA",           maxDTI: 65 },
  { id: "usda",         name: "USDA",         maxDTI: 41 }, // back-end cap only; UI shows 29/41
  { id: "jumbo",        name: "Jumbo",        maxDTI: 43 },
];

const DEBTS_TOOLTIP =
  "Monthly Debts: Monthly debt includes the payments you make each month on auto loans, and credit cards (minimum payment) and student loans. Exclude Rent and Utilities.";

const toNum = (s: string) => {
  if (s.trim() === "" || s === "-" || s === ".") return 0;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// Center label inside donut
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

export const AffordabilityCalculator = () => {
  const { rates, loading: ratesLoading, error: ratesError, refreshRates } = useMortgageRates();

  // Program
  const [program, setProgram] = useState<ProgramId>("conventional");

  // Row 1 (strings)
  const [grossIncome, setGrossIncome] = useState<string>("5000");
  const [monthlyDebts, setMonthlyDebts] = useState<string>("1500");

  // Row 2 (Down payment with mode)
  const [homePrice, setHomePrice] = useState<string>("200000");
  const [downMode, setDownMode] = useState<Mode>("percent");
  const [downValue, setDownValue] = useState<string>("0"); // % or $

  // Row 3 (Loan term + unit)
  const [termMode, setTermMode] = useState<TermMode>("years");
  const [loanTermYears, setLoanTermYears] = useState<string>("30");
  const [loanTermMonths, setLoanTermMonths] = useState<string>("360");

  // Shared
  const [creditScore, setCreditScore] = useState<string>("620-639");
  const [interestRate, setInterestRate] = useState<string>("5");

  // Prop tax + HOI with $/% toggles
  const [propTaxMode, setPropTaxMode] = useState<Mode>("percent");
  const [propTaxValue, setPropTaxValue] = useState<string>("0.6");   // yearly
  const [insMode, setInsMode] = useState<Mode>("amount");
  const [insValue, setInsValue] = useState<string>("1200");          // yearly

  // Conventional-only
  const [pmiYearly, setPMIYearly] = useState<string>("3000");
  const [hoaDues, setHoaDues] = useState<string>("0");

  // FHA-only
  const [upfrontMIPPct, setUpfrontMIPPct] = useState<string>("1.75");
  const [annualMIPPct, setAnnualMIPPct] = useState<string>("0.55");
  const [fhaDurationYears, setFhaDurationYears] = useState<string>("11");

  // VA-only
  const [payFreq, setPayFreq] = useState<PayFreq>("month");
  const [vaUseType, setVaUseType] = useState<string>("first");
  const [vaFundingFeePct, setVaFundingFeePct] = useState<string>("2.15");
  const [firstPaymentDate, setFirstPaymentDate] = useState<string>(todayISO());

  // USDA-only (constants per your screenshot)
  const USDA_GUARANTEE_FEE_PCT = 1.0;   // financed upfront
  const USDA_ANNUAL_FEE_PCT    = 0.35;  // paid monthly off base loan

  // Parsed numbers (derived from strings)
  const grossIncomeN      = toNum(grossIncome);
  const monthlyDebtsN     = toNum(monthlyDebts);
  const homePriceN        = toNum(homePrice);
  const downValueN        = toNum(downValue);
  const loanTermYearsN    = toNum(loanTermYears);
  const loanTermMonthsN   = toNum(loanTermMonths);
  const interestRateN     = toNum(interestRate);
  const propTaxValueN     = toNum(propTaxValue);
  const insValueN         = toNum(insValue);
  const pmiYearlyN        = toNum(pmiYearly);
  const hoaDuesN          = toNum(hoaDues);
  const upfrontMIPPctN    = toNum(upfrontMIPPct);
  const annualMIPPctN     = toNum(annualMIPPct);
  const fhaDurationYearsN = toNum(fhaDurationYears);
  const vaFundingFeePctN  = toNum(vaFundingFeePct);

  // Derived basics
  const downPayment = useMemo(() => {
    return downMode === "percent"
      ? Math.round((homePriceN * (downValueN || 0)) / 100)
      : Math.round(downValueN || 0);
  }, [downMode, downValueN, homePriceN]);

  const baseLoanAmount = Math.max(0, homePriceN - downPayment);

  // FHA financing
  const upfrontMIPAmount = program === "fha" ? (baseLoanAmount * (upfrontMIPPctN || 0)) / 100 : 0;
  const fhaFinancedLoanAmount = program === "fha" ? baseLoanAmount + upfrontMIPAmount : baseLoanAmount;

  // VA financing
  const effectiveFundingFeePct = vaUseType === "waived" ? 0 : vaFundingFeePctN;
  const vaFundingFeeAmount = program === "va" ? (baseLoanAmount * (effectiveFundingFeePct || 0)) / 100 : 0;
  const vaFinalMortgageAmount = program === "va" ? baseLoanAmount + vaFundingFeeAmount : baseLoanAmount;

  // USDA financing
  const usdaGuaranteeFeeAmount = program === "usda" ? (baseLoanAmount * USDA_GUARANTEE_FEE_PCT) / 100 : 0;
  const usdaFinancedLoanAmount = program === "usda" ? baseLoanAmount + usdaGuaranteeFeeAmount : baseLoanAmount;

  // Term/Rate
  const n = termMode === "years" ? loanTermYearsN * 12 : loanTermMonthsN;
  const r = (interestRateN / 100) / 12;

  // PI principal by program
  const principalForPI =
    program === "fha"  ? fhaFinancedLoanAmount :
    program === "va"   ? vaFinalMortgageAmount :
    program === "usda" ? usdaFinancedLoanAmount :
    baseLoanAmount;

  const monthlyPI = r > 0
    ? principalForPI * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    : (n > 0 ? principalForPI / n : 0);

  // Yearly → monthly add-ons
  const yearlyPropertyTax = propTaxMode === "percent" ? (homePriceN * (propTaxValueN || 0) / 100) : (propTaxValueN || 0);
  const monthlyPropertyTax = yearlyPropertyTax / 12;

  const yearlyInsurance = insMode === "amount" ? (insValueN || 0) : (homePriceN * (insValueN || 0) / 100);
  const monthlyInsurance = yearlyInsurance / 12;

  // PMI / MIP / USDA fee
  const monthlyPMI = program === "conventional" && homePriceN > 0 && downPayment / homePriceN < 0.20 ? (pmiYearlyN || 0) / 12 : 0;
  const monthlyMIP = program === "fha" ? ((baseLoanAmount * (annualMIPPctN || 0)) / 100) / 12 : 0;
  const monthlyUSDAFee = program === "usda" ? ((baseLoanAmount * USDA_ANNUAL_FEE_PCT) / 100) / 12 : 0;

  const totalMonthlyPayment =
    monthlyPI
    + monthlyPropertyTax
    + monthlyInsurance
    + (program === "fha"  ? monthlyMIP      : 0)
    + (program === "usda" ? monthlyUSDAFee  : 0)
    + (program === "conventional" ? monthlyPMI : 0)
    + (hoaDuesN || 0);

  const frontEndDTI = grossIncomeN > 0 ? (totalMonthlyPayment / grossIncomeN) * 100 : 0;
  const backEndDTI  = grossIncomeN > 0 ? ((totalMonthlyPayment + monthlyDebtsN) / grossIncomeN) * 100 : 0;

  // Allowable DTI display
  const allowableDTI =
    program === "usda" ? { fe: 29, be: 41 } :
    { fe: PROGRAMS.find(p => p.id === program)?.maxDTI ?? 50, be: PROGRAMS.find(p => p.id === program)?.maxDTI ?? 50 };

  // Live conventional 30Y rate
  useEffect(() => {
    if (!ratesError && rates && program === "conventional" && Number(rates.thirtyYear)) {
      setInterestRate(String(rates.thirtyYear));
    }
  }, [ratesError, rates, program]);

  // Donut data
  const paymentBreakdown = [
    { name: "Principal & Interest", value: monthlyPI,          color: "#f39c12" },
    { name: "Taxes",                value: monthlyPropertyTax, color: "#2ecc71" },
    { name: "Insurance",            value: monthlyInsurance,   color: "#e91e63" },
    ...(program === "fha"  ? [{ name: "MIP",       value: monthlyMIP,      color: "#f1c40f" as const }] : []),
    ...(program === "usda" ? [{ name: "USDA MIP",  value: monthlyUSDAFee,  color: "#f1c40f" as const }] : []),
    { name: "HOA Dues",             value: hoaDuesN,           color: "#3b82f6" },
    ...(program === "conventional" ? [{ name: "PMI", value: monthlyPMI, color: "#10b981" as const }] : []),
  ].filter(x => x.value > 0);

  // Segmented helper
  const Seg = ({
    value, onChange, left, right, className = "",
  }: { value: string; onChange: (v: string) => void; left: string; right: string; className?: string }) => (
    <div className={`fs-segment ${className}`}>
      <button type="button" className="fs-segbtn" aria-pressed={value === left} onClick={() => onChange(left)}>{left}</button>
      <button type="button" className="fs-segbtn" aria-pressed={value === right} onClick={() => onChange(right)}>{right}</button>
    </div>
  );

  // ---------- LEFT SIDEBAR FIELDS (by program) ----------
  const SidebarFields = () => {
    // Shared first three rows
    const Row1_3 = (
      <>
        {/* Row 1 */}
        <div className="fs-grid2">
          <div className="fs-field">
            <label className="fs-label">Gross Income (Monthly)</label>
            <Input
              type="text"
              inputMode="decimal"
              value={grossIncome}
              onChange={(e)=>setGrossIncome(e.target.value)}
              className="fs-input"
            />
          </div>
          <div className="fs-field">
            <label className="fs-label">
              Monthly Debts
              <span title={DEBTS_TOOLTIP} className="inline-flex items-center text-[#9fb0cc]"><Info className="h-4 w-4 ml-1" /></span>
            </label>
            <Input
              type="text"
              inputMode="decimal"
              value={monthlyDebts}
              onChange={(e)=>setMonthlyDebts(e.target.value)}
              className="fs-input"
            />
          </div>
        </div>

        {/* Row 2 */}
        <div className="fs-grid2 mt-4">
          <div className="fs-field">
            <label className="fs-label">{program === "va" ? "Home Value" : "Home Price"}</label>
            <Input
              type="text"
              inputMode="decimal"
              value={homePrice}
              onChange={(e)=>setHomePrice(e.target.value)}
              className="fs-input"
            />
          </div>

          <div className="fs-field">
            <label className="fs-label">Down Payment</label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Input
                type="text"
                inputMode="decimal"
                value={downValue}
                onChange={(e)=>setDownValue(e.target.value)}
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
        </div>

        {/* Row 3 */}
        <div className="fs-grid2 mt-4">
          <div className="fs-field">
            <label className="fs-label">{program === "va" ? "Base Mortgage Amount" : "Loan Amount"}</label>
            <div className="fs-readonly">
              {baseLoanAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="fs-field">
            <label className="fs-label">{program === "va" ? "Loan Terms" : "Loan Term"}</label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              {termMode === "years" ? (
                <Input
                  type="text"
                  inputMode="numeric"
                  value={loanTermYears}
                  onChange={(e)=>{ const v = e.target.value; setLoanTermYears(v); setLoanTermMonths(String(Math.max(0, Math.round(toNum(v) * 12)))); }}
                  className="fs-input"
                />
              ) : (
                <Input
                  type="text"
                  inputMode="numeric"
                  value={loanTermMonths}
                  onChange={(e)=>{ const v = e.target.value; setLoanTermMonths(v); setLoanTermYears(String(Math.max(0, Math.round(toNum(v) / 12)))); }}
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
        </div>
      </>
    );

    if (program === "usda") {
      return (
        <>
          {Row1_3}

          {/* Row 4 (Prop Tax / HOI) */}
          <div className="fs-grid2 mt-4">
            <div className="fs-field">
              <label className="fs-label">Prop Tax <span className="fs-sublabel">(Yearly)</span></label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={propTaxValue}
                  onChange={(e)=>setPropTaxValue(e.target.value)}
                  className="fs-input"
                />
                <Seg value={propTaxMode === "percent" ? "%" : "$"} onChange={(v)=> setPropTaxMode(v === "%" ? "percent" : "amount")} left="$" right="%" className="w-[100px]" />
              </div>
            </div>
            <div className="fs-field">
              <label className="fs-label">Homeowners Insurance <span className="fs-sublabel">(Yearly)</span></label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={insValue}
                  onChange={(e)=>setInsValue(e.target.value)}
                  className="fs-input"
                />
                <Seg value={insMode === "amount" ? "$" : "%"} onChange={(v)=> setInsMode(v === "$" ? "amount" : "percent")} left="$" right="%" className="w-[100px]" />
              </div>
            </div>
          </div>

          {/* Row 5 (Interest Rate / HOA) */}
          <div className="fs-grid2 mt-4">
            <div className="fs-field">
              <label className="fs-label">
                Interest Rate
                <span className="fs-pill fs-pill--warn ml-2">Estimated</span>
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={interestRate}
                  onChange={(e)=>setInterestRate(e.target.value)}
                  className="fs-input"
                />
                <Button onClick={refreshRates} disabled={ratesLoading} className={`${buttonVariants({ size: "icon", variant: "ghost" })} h-9 w-9 text-white/90`}>
                  <RefreshCw className={`h-4 w-4 ${ratesLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
            <div className="fs-field">
              <label className="fs-label">HOA Dues <span className="fs-sublabel">(Monthly)</span></label>
              <Input
                type="text"
                inputMode="decimal"
                value={hoaDues}
                onChange={(e)=>setHoaDues(e.target.value)}
                className="fs-input"
              />
            </div>
          </div>
        </>
      );
    }

    if (program === "fha") {
      return (
        <>
          {Row1_3}
          <div className="fs-grid2 mt-4">
            <div className="fs-field">
              <label className="fs-label">Prop Tax <span className="fs-sublabel">(Yearly)</span></label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={propTaxValue}
                  onChange={(e)=>setPropTaxValue(e.target.value)}
                  className="fs-input"
                />
                <Seg value={propTaxMode === "percent" ? "%" : "$"} onChange={(v)=> setPropTaxMode(v === "%" ? "percent" : "amount")} left="$" right="%" className="w-[100px]" />
              </div>
            </div>
            <div className="fs-field">
              <label className="fs-label">Homeowners Insurance <span className="fs-sublabel">(Yearly)</span></label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={insValue}
                  onChange={(e)=>setInsValue(e.target.value)}
                  className="fs-input"
                />
                <Seg value={insMode === "amount" ? "$" : "%"} onChange={(v)=> setInsMode(v === "$" ? "amount" : "percent")} left="$" right="%" className="w-[100px]" />
              </div>
            </div>
          </div>
          <div className="fs-grid2 mt-4">
            <div className="fs-field">
              <label className="fs-label">Interest Rate <span className="fs-pill fs-pill--warn ml-2">Estimated</span></label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={interestRate}
                  onChange={(e)=>setInterestRate(e.target.value)}
                  className="fs-input"
                />
                <Button onClick={refreshRates} disabled={ratesLoading} className={`${buttonVariants({ size: "icon", variant: "ghost" })} h-9 w-9 text-white/90`}>
                  <RefreshCw className={`h-4 w-4 ${ratesLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
            <div className="fs-field">
              <label className="fs-label">HOA Dues <span className="fs-sublabel">(Monthly)</span></label>
              <Input
                type="text"
                inputMode="decimal"
                value={hoaDues}
                onChange={(e)=>setHoaDues(e.target.value)}
                className="fs-input"
              />
            </div>
          </div>
          <div className="fs-grid2 mt-4">
            <div className="fs-field">
              <label className="fs-label">Upfront MIP (%)</label>
              <Input
                type="text"
                inputMode="decimal"
                value={upfrontMIPPct}
                onChange={(e)=>setUpfrontMIPPct(e.target.value)}
                className="fs-input"
              />
            </div>
            <div className="fs-field">
              <label className="fs-label">Annual MIP (%)</label>
              <Input
                type="text"
                inputMode="decimal"
                value={annualMIPPct}
                onChange={(e)=>setAnnualMIPPct(e.target.value)}
                className="fs-input"
              />
            </div>
          </div>
          <div className="fs-grid2 mt-4">
            <div className="fs-field">
              <label className="fs-label">Annual FHA Duration (Years)</label>
              <Input
                type="text"
                inputMode="numeric"
                value={fhaDurationYears}
                onChange={(e)=>setFhaDurationYears(e.target.value)}
                className="fs-input"
              />
            </div>
            <div />
          </div>
        </>
      );
    }

    if (program === "va") {
      return (
        <>
          {Row1_3}
          <div className="fs-grid2 mt-4">
            <div className="fs-field">
              <label className="fs-label">Payment Frequency</label>
              <div className="fs-segment w-full" style={{ padding: 4 }}>
                <button type="button" className="fs-segbtn" aria-pressed={payFreq === "year"} onClick={()=>setPayFreq("year")}>Year</button>
                <button type="button" className="fs-segbtn" aria-pressed={payFreq === "month"} onClick={()=>setPayFreq("month")}>Month</button>
              </div>
            </div>
            <div className="fs-field">
              <label className="fs-label">Interest Rate <span className="fs-pill fs-pill--warn ml-2">Estimated</span></label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={interestRate}
                  onChange={(e)=>setInterestRate(e.target.value)}
                  className="fs-input"
                />
                <Button onClick={refreshRates} disabled={ratesLoading} className={`${buttonVariants({ size: "icon", variant: "ghost" })} h-9 w-9 text-white/90`}>
                  <RefreshCw className={`h-4 w-4 ${ratesLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </div>
          <div className="fs-grid2 mt-4">
            <div className="fs-field">
              <label className="fs-label">This is my...</label>
              <Select
                value={vaUseType}
                onValueChange={(v)=>{
                  setVaUseType(v);
                  if (v === "first") setVaFundingFeePct("2.15");
                  if (v === "subsequent") setVaFundingFeePct("3.30");
                  if (v === "waived") setVaFundingFeePct("0");
                }}
              >
                <SelectTrigger className="fs-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="first">First Time Use of a VA Loan</SelectItem>
                  <SelectItem value="subsequent">Subsequent Use of a VA Loan</SelectItem>
                  <SelectItem value="waived">Disabled Veteran (Funding Fee Waived)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="fs-field">
              <label className="fs-label">VA Funding Fee (%)</label>
              <Input
                type="text"
                inputMode="decimal"
                value={vaFundingFeePct}
                onChange={(e)=>setVaFundingFeePct(e.target.value)}
                className="fs-input"
              />
            </div>
          </div>
          <div className="fs-grid2 mt-4">
            <div className="fs-field">
              <label className="fs-label">Property Tax <span className="fs-sublabel">(Yearly)</span></label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={propTaxValue}
                  onChange={(e)=>setPropTaxValue(e.target.value)}
                  className="fs-input"
                />
                <Seg value={propTaxMode === "percent" ? "%" : "$"} onChange={(v)=> setPropTaxMode(v === "%" ? "percent" : "amount")} left="$" right="%" className="w-[100px]" />
              </div>
            </div>
            <div className="fs-field">
              <label className="fs-label">Homeowners Insurance (Yearly)</label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={insValue}
                  onChange={(e)=>setInsValue(e.target.value)}
                  className="fs-input"
                />
                <Seg value={insMode === "amount" ? "$" : "%"} onChange={(v)=> setInsMode(v === "$" ? "amount" : "percent")} left="$" right="%" className="w-[100px]" />
              </div>
            </div>
          </div>
          <div className="fs-grid2 mt-4">
            <div className="fs-field">
              <label className="fs-label">Final Mortgage Amount</label>
              <div className="fs-readonly">
                {(vaFinalMortgageAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="fs-field">
              <label className="fs-label">HOA Dues <span className="fs-sublabel">(Monthly)</span></label>
              <Input
                type="text"
                inputMode="decimal"
                value={hoaDues}
                onChange={(e)=>setHoaDues(e.target.value)}
                className="fs-input"
              />
            </div>
          </div>
          <div className="fs-grid2 mt-4">
            <div className="fs-field">
              <label className="fs-label">First Payment Date</label>
              <Input
                type="date"
                value={firstPaymentDate}
                onChange={(e)=>setFirstPaymentDate(e.target.value)}
                className="fs-input"
              />
            </div>
            <div />
          </div>
        </>
      );
    }

    // Conventional (baseline)
    return (
      <>
        {Row1_3}
        <div className="fs-grid2 mt-4">
          <div className="fs-field">
            <label className="fs-label">
              Interest Rate
              {ratesError ? (<span className="fs-pill fs-pill--warn ml-2">Estimated</span>) : (<span className="fs-pill fs-pill--ok ml-2">Live Rate</span>)}
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                inputMode="decimal"
                value={interestRate}
                onChange={(e)=>setInterestRate(e.target.value)}
                className="fs-input"
              />
              <Button onClick={refreshRates} disabled={ratesLoading} className={`${buttonVariants({ size: "icon", variant: "ghost" })} h-9 w-9 text-white/90`}>
                <RefreshCw className={`h-4 w-4 ${ratesLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
          <div className="fs-field">
            <label className="fs-label">Credit Score</label>
            <Select value={creditScore} onValueChange={setCreditScore}>
              <SelectTrigger className="fs-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["620-639","640-659","660-679","680-699","700-719","720+"].map(cs =>
                  <SelectItem key={cs} value={cs}>{cs}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="fs-grid2 mt-4">
          <div className="fs-field">
            <label className="fs-label">Prop Tax <span className="fs-sublabel">(Yearly)</span></label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Input
                type="text"
                inputMode="decimal"
                value={propTaxValue}
                onChange={(e)=>setPropTaxValue(e.target.value)}
                className="fs-input"
              />
              <Seg value={propTaxMode === "percent" ? "%" : "$"} onChange={(v)=> setPropTaxMode(v === "%" ? "percent" : "amount")} left="$" right="%" className="w-[100px]" />
            </div>
          </div>
          <div className="fs-field">
            <label className="fs-label">Homeowners Insurance <span className="fs-sublabel">(Yearly)</span></label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Input
                type="text"
                inputMode="decimal"
                value={insValue}
                onChange={(e)=>setInsValue(e.target.value)}
                className="fs-input"
              />
              <Seg value={insMode === "amount" ? "$" : "%"} onChange={(v)=> setInsMode(v === "$" ? "amount" : "percent")} left="$" right="%" className="w-[100px]" />
            </div>
          </div>
        </div>
        <div className="fs-grid2 mt-4">
          <div className="fs-field">
            <label className="fs-label">PMI <span className="fs-sublabel">(Yearly)</span></label>
            <Input
              type="text"
              inputMode="decimal"
              value={pmiYearly}
              onChange={(e)=>setPMIYearly(e.target.value)}
              className="fs-input"
            />
          </div>
          <div className="fs-field">
            <label className="fs-label">HOA Dues <span className="fs-sublabel">(Monthly)</span></label>
            <Input
              type="text"
              inputMode="decimal"
              value={hoaDues}
              onChange={(e)=>setHoaDues(e.target.value)}
              className="fs-input"
            />
          </div>
        </div>
      </>
    );
  };

  const loanAmountTile =
    program === "fha"  ? fhaFinancedLoanAmount :
    program === "va"   ? vaFinalMortgageAmount :
    program === "usda" ? usdaFinancedLoanAmount :
    baseLoanAmount;

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "550px 1fr 400px" }}>
      {/* LEFT */}
      <div className={`fs-panel ${program === "usda" ? "" : "fs-fixed"}`}>
        <h2 className="fs-title">Affordability Calculator</h2>

        <Tabs value={program} onValueChange={(v)=>setProgram(v as ProgramId)} className="fs-tabs">
          <TabsList className="bg-transparent grid grid-cols-5 h-auto p-0 gap-3">
            {PROGRAMS.map(p => (
              <TabsTrigger key={p.id} value={p.id} className="tab">{p.name}</TabsTrigger>
            ))}
          </TabsList>
          {PROGRAMS.map(p => <TabsContent key={p.id} value={p.id} />)}
        </Tabs>

        <div className="fs-body mt-2">
          <SidebarFields />
          <button className="fs-cta mt-5 w-full">GET A QUOTE</button>
        </div>
      </div>

      {/* MIDDLE */}
      <div className="grid gap-4">
        <Card className="rounded-[14px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[18px]">Payment Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
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
                      <Label position="center" content={renderCenterMonthlyLabel(totalMonthlyPayment)} />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                {paymentBreakdown.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ background: item.color }} />
                      <span>{item.name}</span>
                    </div>
                    <span>${item.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[14px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[18px]">Loan Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-neutral-500 text-sm">Home Value:</div>
                <div className="text-[18px] font-semibold">${homePriceN.toLocaleString()}</div>

                <div className="mt-4 text-neutral-500 text-sm">
                  {program === "fha" ? "Monthly FHA Payment:" : program === "va" ? "Monthly VA Payment:" : program === "usda" ? "Monthly USDA Payment:" : "Monthly Conventional Payment:"}
                </div>
                <div className="text-[18px] font-semibold">${monthlyPI.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>

                {program === "fha" && (
                  <>
                    <div className="mt-4 text-neutral-500 text-sm">Monthly MIP:</div>
                    <div className="text-[18px] font-semibold">${monthlyMIP.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  </>
                )}
                {program === "usda" && (
                  <>
                    <div className="mt-4 text-neutral-500 text-sm">Monthly USDA MIP:</div>
                    <div className="text-[18px] font-semibold">${monthlyUSDAFee.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  </>
                )}
              </div>

              <div>
                <div className="text-neutral-500 text-sm">Base Loan Amount:</div>
                <div className="text-[18px] font-semibold">${baseLoanAmount.toLocaleString(undefined,{maximumFractionDigits:2})}</div>

                <div className="mt-4 text-neutral-500 text-sm">Down Payment:</div>
                <div className="text-[18px] font-semibold">${downPayment.toLocaleString()}</div>

                {program === "fha" && (
                  <>
                    <div className="mt-4 text-neutral-500 text-sm">Upfront MIP:</div>
                    <div className="text-[18px] font-semibold">${upfrontMIPAmount.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
                    <div className="mt-4 text-neutral-500 text-sm">FHA Loan Amount:</div>
                    <div className="text-[18px] font-semibold">${fhaFinancedLoanAmount.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
                  </>
                )}

                {program === "va" && (
                  <>
                    <div className="mt-4 text-neutral-500 text-sm">VA Funding Fee:</div>
                    <div className="text-[18px] font-semibold">${vaFundingFeeAmount.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
                    <div className="mt-4 text-neutral-500 text-sm">VA Loan Amount:</div>
                    <div className="text-[18px] font-semibold">${vaFinalMortgageAmount.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
                  </>
                )}

                {program === "usda" && (
                  <>
                    <div className="mt-4 text-neutral-500 text-sm">USDA Guarantee Fee:</div>
                    <div className="text-[18px] font-semibold">${usdaGuaranteeFeeAmount.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
                    <div className="mt-4 text-neutral-500 text-sm">USDA Loan Amount:</div>
                    <div className="text-[18px] font-semibold">${usdaFinancedLoanAmount.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RIGHT */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="kpi-tile">
            <div className="kpi-label">Monthly Mortgage Payment</div>
            <div className="kpi-value">${monthlyPI.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
          <div className="kpi-tile kpi-alt">
            <div className="kpi-label">Loan Amount</div>
            <div className="kpi-value">${(
              program === "fha"  ? fhaFinancedLoanAmount :
              program === "va"   ? vaFinalMortgageAmount :
              program === "usda" ? usdaFinancedLoanAmount :
              baseLoanAmount
            ).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="kpi-tile">
            <div className="kpi-label">Your Debt to Income Ratio</div>
            <div className="kpi-value">{frontEndDTI.toFixed(2)}%/ {backEndDTI.toFixed(2)}%</div>
          </div>
          <div className="kpi-tile kpi-alt">
            <div className="kpi-label">Allowable Debt to Income Ratio</div>
            <div className="kpi-value">
              {allowableDTI.fe}%/ {allowableDTI.be}%
            </div>
          </div>
        </div>

        <div className="white-pane">
          <div className="flex items-center justify-between text-sm font-medium mb-2">
            <span>Purchase Price</span>
            <span className="text-neutral-500">${homePriceN.toLocaleString()}</span>
          </div>
          <Slider
            value={[homePriceN]}
            min={50000}
            max={1500000}
            step={5000}
            onValueChange={([v]) => setHomePrice(String(v))}
          />
        </div>

        <div className="white-pane">
          <div className="flex items-center justify-between text-sm font-medium mb-2">
            <span>Down Payment</span>
            <span className="text-neutral-500">${downPayment.toLocaleString()}</span>
          </div>
          <Slider
            value={[downMode === "percent" ? (isFinite(downValueN) ? downValueN : 0) : (homePriceN ? (downValueN / homePriceN) * 100 : 0)]}
            min={0} max={40} step={1}
            onValueChange={([pct]) => {
              if (downMode === "percent") setDownValue(String(pct));
              else setDownValue(String(Math.round((pct/100)*homePriceN)));
            }}
          />
        </div>

        <div className="summary-box">
          <div className="font-bold mb-1">Summary:</div>
          <p className="text-sm leading-6">
            Based on what you input into today your Total Payment would be{" "}
            <b>${totalMonthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b> on a{" "}
            <b>{program === "fha" ? "FHA" : program === "va" ? "VA" : program === "usda" ? "USDA" : "Conventional"}</b> Loan with a{" "}
            <b>{(downPayment / Math.max(1, homePriceN) * 100).toFixed(1)}% Down Payment</b>. Your Debt-to-Income Ratio is{" "}
            <b>{frontEndDTI.toFixed(2)}%/ {backEndDTI.toFixed(2)}%</b> and the <b>
              maximum allowable on this program type is {allowableDTI.fe}%/{allowableDTI.be}%</b>.
          </p>
        </div>
      </div>
    </div>
  );
};

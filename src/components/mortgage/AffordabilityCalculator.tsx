import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, Label } from "recharts";
import { RefreshCw, Info } from "lucide-react";
import { useMortgageRates } from "@/hooks/useMortgageRates";
import { Tooltip as UiTooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

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

/** ---- HOISTED: stable segmented control (no remounts) ---- */
const Seg = ({
  value, onChange, left, right, className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  left: string;
  right: string;
  className?: string;
}) => (
  <div className={`fs-segment ${className}`}>
    <button type="button" className="fs-segbtn" aria-pressed={value === left} onClick={() => onChange(left)}>{left}</button>
    <button type="button" className="fs-segbtn" aria-pressed={value === right} onClick={() => onChange(right)}>{right}</button>
  </div>
);

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
    { name: "Principal & Interest", value: monthlyPI,          color: "#FA9D39" },
    { name: "Taxes",                value: monthlyPropertyTax, color: "#59C2C0" },
    { name: "Insurance",            value: monthlyInsurance,   color: "#F85A85" },
    ...(program === "fha"  ? [{ name: "MIP",       value: monthlyMIP,      color: "#f1c40f" as const }] : []),
    ...(program === "usda" ? [{ name: "USDA MIP",  value: monthlyUSDAFee,  color: "#f1c40f" as const }] : []),
    { name: "HOA Dues",             value: hoaDuesN,           color: "#41A2ED" },
    ...(program === "conventional" ? [{ name: "PMI", value: monthlyPMI, color: "#EEEE22" as const }] : []),
  ].filter(x => x.value > 0);

  // Typing helper (kept if you want to extend later)
  const [isTyping, setIsTyping] = useState(false);

  // ===== Helpers for $ ↔ % toggles (convert current value to new representation) =====
  const toFixedStr = (n: number, digits = 2) =>
    Number.isFinite(n) ? String(Number(n.toFixed(digits))) : "0";

  // Down Payment: % is percent of homePrice; $ is absolute amount
  function toggleDownMode(to: Mode) {
    if (to === "percent") {
      const pct = homePriceN ? (toNum(downValue) / homePriceN) * 100 : 0;
      setDownValue(toFixedStr(pct, 2));
      setDownMode("percent");
    } else {
      const amt = Math.round((toNum(downValue) / 100) * homePriceN);
      setDownValue(String(amt));
      setDownMode("amount");
    }
  }

  // Property Tax: % of homePrice (yearly) vs absolute yearly $
  function togglePropTaxMode(to: Mode) {
    if (to === "percent") {
      const pct = homePriceN ? (propTaxValueN / homePriceN) * 100 : 0;
      setPropTaxValue(toFixedStr(pct, 3));
      setPropTaxMode("percent");
    } else {
      const amt = Math.round((propTaxValueN / 100) * homePriceN);
      setPropTaxValue(String(amt));
      setPropTaxMode("amount");
    }
  }

  // Homeowners Insurance: % of homePrice (yearly) vs absolute yearly $
  function toggleInsMode(to: Mode) {
    if (to === "percent") {
      const pct = homePriceN ? (insValueN / homePriceN) * 100 : 0;
      setInsValue(toFixedStr(pct, 3));
      setInsMode("percent");
    } else {
      const amt = Math.round((insValueN / 100) * homePriceN);
      setInsValue(String(amt));
      setInsMode("amount");
    }
  }

  // ---- UI ----
  const loanAmountTile =
    program === "fha"  ? fhaFinancedLoanAmount :
    program === "va"   ? vaFinalMortgageAmount :
    program === "usda" ? usdaFinancedLoanAmount :
    baseLoanAmount;

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "500px 1fr 450px" }}>
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
          {/* ==== INLINED SIDEBAR (no nested component = no remounts) ==== */}

          {/* Row 1 */}
          <div className="fs-grid2">
            <div className="fs-field">
              <label className="fs-label">Gross Income (Monthly)</label>
              <Input
                type="number"
                inputMode="decimal"
                value={grossIncome}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                onChange={(e)=>setGrossIncome(e.target.value)}
                className="fs-input no-arrows"
              />
            </div>
            <div className="fs-field">
              <label className="fs-label">
                Monthly Debts
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="What counts as monthly debts?"
                      className="inline-flex items-center ml-1 text-[#9fb0cc] focus:outline-none"
                    >
                      <Info className="h-4 w-4"/>
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
                      <div className="font-bold mb-1">Monthly Debts</div>
                      <p className="text-sm font-normal leading-5">
                        Monthly Debt includes the payments you make each month on auto loans,
                        and credit cards (minimum payment) and student loans. Exclude Rent and
                        Utilities.
                      </p>
                    </div>
                  </TooltipContent>
                </UiTooltip>
              </label>
              <Input
                type="number"
                inputMode="decimal"
                value={monthlyDebts}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                onChange={(e)=>setMonthlyDebts(e.target.value)}
                className="fs-input no-arrows"
              />
            </div>
          </div>

          {/* Row 2 */}
          <div className="fs-grid2 mt-4">
            <div className="fs-field">
              <label className="fs-label">{program === "va" ? "Home Value" : "Home Price"}</label>
              <Input
                type="number"
                inputMode="decimal"
                value={homePrice}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                onChange={(e)=>setHomePrice(e.target.value)}
                className="fs-input no-arrows"
              />
            </div>

            <div className="fs-field">
              <label className="fs-label">Down Payment</label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={downValue}
                  onFocus={() => setIsTyping(true)}
                  onBlur={() => setIsTyping(false)}
                  onChange={(e)=>setDownValue(e.target.value)}
                  className="fs-input no-arrows"
                />
                <Seg
                  value={downMode === "percent" ? "%" : "$"}
                  onChange={(v)=> toggleDownMode(v === "%" ? "percent" : "amount")}
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
                    type="number"
                    inputMode="numeric"
                    value={loanTermYears}
                    onFocus={() => setIsTyping(true)}
                    onBlur={() => setIsTyping(false)}
                    onChange={(e)=>{ const v = e.target.value; setLoanTermYears(v); setLoanTermMonths(String(Math.max(0, Math.round(toNum(v) * 12)))); }}
                    className="fs-input no-arrows"
                  />
                ) : (
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={loanTermMonths}
                    onFocus={() => setIsTyping(true)}
                    onBlur={() => setIsTyping(false)}
                    onChange={(e)=>{ const v = e.target.value; setLoanTermMonths(v); setLoanTermYears(String(Math.max(0, Math.round(toNum(v) / 12)))); }}
                    className="fs-input no-arrows"
                  />
                )}
                <Seg
                  value={termMode === "years" ? "Year" : "Month"}
                  onChange={(v)=> setTermMode(v === "Year" ? "years" : "months")}
                  left="Year"
                  right="Month"
                  
                />
              </div>
            </div>
          </div>

          {/* Program-specific blocks */}
          {program === "usda" && (
            <>
              {/* Row 4 (Prop Tax / HOI) */}
              <div className="fs-grid2 mt-4">
                <div className="fs-field">
                  <label className="fs-label">Prop Tax <span className="fs-sublabel">(Yearly)</span></label>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={propTaxValue}
                      onFocus={() => setIsTyping(true)}
                      onBlur={() => setIsTyping(false)}
                      onChange={(e)=>setPropTaxValue(e.target.value)}
                      className="fs-input no-arrows"
                    />
                    <Seg value={propTaxMode === "percent" ? "%" : "$"} onChange={(v)=> togglePropTaxMode(v === "%" ? "percent" : "amount")} left="$" right="%" className="w-[100px]" />
                  </div>
                </div>
                <div className="fs-field">
                  <label className="fs-label">Homeowners Insurance <span className="fs-sublabel">(Yearly)</span></label>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={insValue}
                      onFocus={() => setIsTyping(true)}
                      onBlur={() => setIsTyping(false)}
                      onChange={(e)=>setInsValue(e.target.value)}
                      className="fs-input no-arrows"
                    />
                    <Seg value={insMode === "amount" ? "$" : "%"} onChange={(v)=> toggleInsMode(v === "$" ? "amount" : "percent")} left="$" right="%" className="w-[100px]" />
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
                      type="number"
                      inputMode="decimal"
                      value={interestRate}
                      onFocus={() => setIsTyping(true)}
                      onBlur={() => setIsTyping(false)}
                      onChange={(e)=>setInterestRate(e.target.value)}
                      className="fs-input no-arrows"
                    />
                    <Button onClick={refreshRates} disabled={ratesLoading} className={`${buttonVariants({ size: "icon", variant: "ghost" })} h-9 w-9 text-white/90`}>
                      <RefreshCw className={`h-4 w-4 ${ratesLoading ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                </div>
                <div className="fs-field">
                  <label className="fs-label">HOA Dues <span className="fs-sublabel">(Monthly)</span></label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={hoaDues}
                    onFocus={() => setIsTyping(true)}
                    onBlur={() => setIsTyping(false)}
                    onChange={(e)=>setHoaDues(e.target.value)}
                    className="fs-input no-arrows"
                  />
                </div>
              </div>
            </>
          )}

          {program === "fha" && (
            <>
              <div className="fs-grid2 mt-4">
                <div className="fs-field">
                  <label className="fs-label">Prop Tax <span className="fs-sublabel">(Yearly)</span></label>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={propTaxValue}
                      onFocus={() => setIsTyping(true)}
                      onBlur={() => setIsTyping(false)}
                      onChange={(e)=>setPropTaxValue(e.target.value)}
                      className="fs-input no-arrows"
                    />
                    <Seg value={propTaxMode === "percent" ? "%" : "$"} onChange={(v)=> togglePropTaxMode(v === "%" ? "percent" : "amount")} left="$" right="%" className="w-[100px]" />
                  </div>
                </div>
                <div className="fs-field">
                  <label className="fs-label">Homeowners Insurance <span className="fs-sublabel">(Yearly)</span></label>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={insValue}
                      onFocus={() => setIsTyping(true)}
                      onBlur={() => setIsTyping(false)}
                      onChange={(e)=>setInsValue(e.target.value)}
                      className="fs-input no-arrows"
                    />
                    <Seg value={insMode === "amount" ? "$" : "%"} onChange={(v)=> toggleInsMode(v === "$" ? "amount" : "percent")} left="$" right="%" className="w-[100px]" />
                  </div>
                </div>
              </div>
              <div className="fs-grid2 mt-4">
                <div className="fs-field">
                  <label className="fs-label">Interest Rate <span className="fs-pill fs-pill--warn ml-2">Estimated</span></label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={interestRate}
                      onFocus={() => setIsTyping(true)}
                      onBlur={() => setIsTyping(false)}
                      onChange={(e)=>setInterestRate(e.target.value)}
                      className="fs-input no-arrows"
                    />
                    <Button onClick={refreshRates} disabled={ratesLoading} className={`${buttonVariants({ size: "icon", variant: "ghost" })} h-9 w-9 text-white/90`}>
                      <RefreshCw className={`h-4 w-4 ${ratesLoading ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                </div>
                <div className="fs-field">
                  <label className="fs-label">HOA Dues <span className="fs-sublabel">(Monthly)</span></label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={hoaDues}
                    onFocus={() => setIsTyping(true)}
                    onBlur={() => setIsTyping(false)}
                    onChange={(e)=>setHoaDues(e.target.value)}
                    className="fs-input no-arrows"
                  />
                </div>
              </div>
              <div className="fs-grid2 mt-4">
                <div className="fs-field">
                  <label className="fs-label">Upfront MIP (%)</label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={upfrontMIPPct}
                    onFocus={() => setIsTyping(true)}
                    onBlur={() => setIsTyping(false)}
                    onChange={(e)=>setUpfrontMIPPct(e.target.value)}
                    className="fs-input no-arrows"
                  />
                </div>
                <div className="fs-field">
                  <label className="fs-label">Annual MIP (%)</label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={annualMIPPct}
                    onFocus={() => setIsTyping(true)}
                    onBlur={() => setIsTyping(false)}
                    onChange={(e)=>setAnnualMIPPct(e.target.value)}
                    className="fs-input no-arrows"
                  />
                </div>
              </div>
              <div className="fs-grid2 mt-4">
                <div className="fs-field">
                  <label className="fs-label">Annual FHA Duration (Years)</label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={fhaDurationYears}
                    onFocus={() => setIsTyping(true)}
                    onBlur={() => setIsTyping(false)}
                    onChange={(e)=>setFhaDurationYears(e.target.value)}
                    className="fs-input no-arrows"
                  />
                </div>
                <div />
              </div>
            </>
          )}

          {program === "va" && (
            <>
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
                      type="number"
                      inputMode="decimal"
                      value={interestRate}
                      onFocus={() => setIsTyping(true)}
                      onBlur={() => setIsTyping(false)}
                      onChange={(e)=>setInterestRate(e.target.value)}
                      className="fs-input no-arrows"
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
                    type="number"
                    inputMode="decimal"
                    value={vaFundingFeePct}
                    onFocus={() => setIsTyping(true)}
                    onBlur={() => setIsTyping(false)}
                    onChange={(e)=>setVaFundingFeePct(e.target.value)}
                    className="fs-input no-arrows"
                  />
                </div>
              </div>
              <div className="fs-grid2 mt-4">
                <div className="fs-field">
                  <label className="fs-label">Property Tax <span className="fs-sublabel">(Yearly)</span></label>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={propTaxValue}
                      onFocus={() => setIsTyping(true)}
                      onBlur={() => setIsTyping(false)}
                      onChange={(e)=>setPropTaxValue(e.target.value)}
                      className="fs-input no-arrows"
                    />
                    <Seg value={propTaxMode === "percent" ? "%" : "$"} onChange={(v)=> togglePropTaxMode(v === "%" ? "percent" : "amount")} left="$" right="%" className="w-[100px]" />
                  </div>
                </div>
                <div className="fs-field">
                  <label className="fs-label">Homeowners Insurance (Yearly)</label>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={insValue}
                      onFocus={() => setIsTyping(true)}
                      onBlur={() => setIsTyping(false)}
                      onChange={(e)=>setInsValue(e.target.value)}
                      className="fs-input no-arrows"
                    />
                    <Seg value={insMode === "amount" ? "$" : "%"} onChange={(v)=> toggleInsMode(v === "$" ? "amount" : "percent")} left="$" right="%" className="w-[100px]" />
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
                    type="number"
                    inputMode="decimal"
                    value={hoaDues}
                    onFocus={() => setIsTyping(true)}
                    onBlur={() => setIsTyping(false)}
                    onChange={(e)=>setHoaDues(e.target.value)}
                    className="fs-input no-arrows"
                  />
                </div>
              </div>
              <div className="fs-grid2 mt-4">
                <div className="fs-field">
                  <label className="fs-label">First Payment Date</label>
                  <Input
                    type="date"
                    value={firstPaymentDate}
                    onFocus={() => setIsTyping(true)}
                    onBlur={() => setIsTyping(false)}
                    onChange={(e)=>setFirstPaymentDate(e.target.value)}
                    className="fs-input no-arrows"
                  />
                </div>
                <div />
              </div>
            </>
          )}

          {program !== "usda" && program !== "fha" && program !== "va" && (
            <>
              <div className="fs-grid2 mt-4">
                <div className="fs-field">
                  <label className="fs-label">
                    Interest Rate
                    {ratesError ? (<span className="fs-pill fs-pill--warn ml-2">Estimated</span>) : (<span className="fs-pill fs-pill--ok ml-2">Live Rate</span>)}
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={interestRate}
                      onFocus={() => setIsTyping(true)}
                      onBlur={() => setIsTyping(false)}
                      onChange={(e)=>setInterestRate(e.target.value)}
                      className="fs-input no-arrows"
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
                      type="number"
                      inputMode="decimal"
                      value={propTaxValue}
                      onFocus={() => setIsTyping(true)}
                      onBlur={() => setIsTyping(false)}
                      onChange={(e)=>setPropTaxValue(e.target.value)}
                      className="fs-input no-arrows"
                    />
                    <Seg value={propTaxMode === "percent" ? "%" : "$"} onChange={(v)=> togglePropTaxMode(v === "%" ? "percent" : "amount")} left="$" right="%" className="w-[100px]" />
                  </div>
                </div>
                <div className="fs-field">
                  <label className="fs-label">Homeowners Insurance <span className="fs-sublabel">(Yearly)</span></label>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={insValue}
                      onFocus={() => setIsTyping(true)}
                      onBlur={() => setIsTyping(false)}
                      onChange={(e)=>setInsValue(e.target.value)}
                      className="fs-input no-arrows"
                    />
                    <Seg value={insMode === "amount" ? "$" : "%"} onChange={(v)=> toggleInsMode(v === "$" ? "amount" : "percent")} left="$" right="%" className="w-[100px]" />
                  </div>
                </div>
              </div>
              <div className="fs-grid2 mt-4">
                <div className="fs-field">
                  <label className="fs-label">PMI <span className="fs-sublabel">(Yearly)</span></label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={pmiYearly}
                    onFocus={() => setIsTyping(true)}
                    onBlur={() => setIsTyping(false)}
                    onChange={(e)=>setPMIYearly(e.target.value)}
                    className="fs-input no-arrows"
                  />
                </div>
                <div className="fs-field">
                  <label className="fs-label">HOA Dues <span className="fs-sublabel">(Monthly)</span></label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={hoaDues}
                    onFocus={() => setIsTyping(true)}
                    onBlur={() => setIsTyping(false)}
                    onChange={(e)=>setHoaDues(e.target.value)}
                    className="fs-input no-arrows"
                  />
                </div>
              </div>
            </>
          )}

          <button className="fs-cta mt-5 w-full">GET A QUOTE</button>
        </div>
      </div>

      {/* MIDDLE */}
      <div className="flex flex-col gap-4">
        <Card className="rounded-[14px] h-[280px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[18px]">Payment Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-row gap-6">
              <div className="h-48 w-[200px] flex flex-row items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <ReTooltip formatter={(v)=>`$${Number(v).toLocaleString(undefined,{maximumFractionDigits:2})}`} />
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

              <div className="space-y-3 flex flex-col justify-center">
                {paymentBreakdown.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ background: item.color }} />
                      <span style={{ fontWeight: "bold", fontSize: "13px" }}>{item.name}</span>
                    </div>
                    <span style={{ color: "#6C8971", fontWeight: "bold", marginLeft: "10px" }}>${item.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[14px] h-[auto]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[18px]">Loan Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-neutral-500 text-sm">Home Value:</div>
                <div className="text-[18px] font-semibold mt-2">${homePriceN.toLocaleString()}</div>

                <div className="mt-4 text-neutral-500 text-sm">
                  {program === "fha" ? "Monthly FHA Payment:" : program === "va" ? "Monthly VA Payment:" : program === "usda" ? "Monthly USDA Payment:" : "Monthly Conventional Payment:"}
                </div>
                <div className="text-[18px] font-semibold mt-2">${monthlyPI.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>

                {program === "fha" && (
                  <>
                    <div className="mt-4 text-neutral-500 text-sm">Monthly MIP:</div>
                    <div className="text-[18px] font-semibold mt-2">${monthlyMIP.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  </>
                )}
                {program === "usda" && (
                  <>
                    <div className="mt-4 text-neutral-500 text-sm">Monthly USDA MIP:</div>
                    <div className="text-[18px] font-semibold mt-2">${monthlyUSDAFee.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  </>
                )}
                {program === "conventional" && monthlyPMI > 0 && (
                  <>
                    <div className="mt-4 text-neutral-500 text-sm">Monthly Estimated PMI:</div>
                    <div className="text-[18px] font-semibold mt-2">${monthlyPMI.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  </>
                )}
              </div>

              <div>
                <div className="text-neutral-500 text-sm">Base Loan Amount:</div>
                <div className="text-[18px] font-semibold mt-2">${baseLoanAmount.toLocaleString(undefined,{maximumFractionDigits:2})}</div>

                <div className="mt-4 text-neutral-500 text-sm">Down Payment:</div>
                <div className="text-[18px] font-semibold mt-2">${downPayment.toLocaleString()}</div>

                {program === "fha" && (
                  <>
                    <div className="mt-4 text-neutral-500 text-sm">Upfront MIP:</div>
                    <div className="text-[18px] font-semibold mt-2">${upfrontMIPAmount.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
                    <div className="mt-4 text-neutral-500 text-sm">FHA Loan Amount:</div>
                    <div className="text-[18px] font-semibold mt-2">${fhaFinancedLoanAmount.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
                  </>
                )}

                {program === "va" && (
                  <>
                    <div className="mt-4 text-neutral-500 text-sm">VA Funding Fee:</div>
                    <div className="text-[18px] font-semibold mt-2">${vaFundingFeeAmount.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
                    <div className="mt-4 text-neutral-500 text-sm">VA Loan Amount:</div>
                    <div className="text-[18px] font-semibold mt-2">${vaFinalMortgageAmount.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
                  </>
                )}

                {program === "usda" && (
                  <>
                    <div className="mt-4 text-neutral-500 text-sm">USDA Guarantee Fee:</div>
                    <div className="text-[18px] font-semibold mt-2">${usdaGuaranteeFeeAmount.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
                    <div className="mt-4 text-neutral-500 text-sm">USDA Loan Amount:</div>
                    <div className="text-[18px] font-semibold mt-2">${usdaFinancedLoanAmount.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
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
            <div className="kpi-value">${loanAmountTile.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
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
            <span style={{ color: "hsl(var(--primary))", fontWeight: "bold" }}>${homePriceN.toLocaleString()}</span>
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
            <span style={{ color: "hsl(var(--primary))", fontWeight: "bold" }}>${downPayment.toLocaleString()}</span>
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
            <b style={{ color: "hsl(var(--primary))" }}>${totalMonthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b> on a{" "}
            <b style={{ color: "hsl(var(--primary))" }}>{program === "fha" ? "FHA" : program === "va" ? "VA" : program === "usda" ? "USDA" : "Conventional"}</b> Loan with a{" "}
            <b style={{ color: "hsl(var(--primary))" }}>{(downPayment / Math.max(1, homePriceN) * 100).toFixed(1)}% Down Payment</b>. Your Debt-to-Income Ratio is{" "}
            <b style={{ color: "hsl(var(--primary))" }}>{frontEndDTI.toFixed(2)}%/ {backEndDTI.toFixed(2)}%</b> and the <b style={{ color: "hsl(var(--primary))" }}>
              maximum allowable on this program type is {allowableDTI.fe}%/{allowableDTI.be}%</b>. Please confirm all these numbers for accuracy with your loan officer. The Monthly Debts Calculation is often where we see errors.
          </p>
        </div>
      </div>
    </div>
  );
};

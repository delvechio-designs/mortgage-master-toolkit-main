import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { AffordabilityCalculator } from "./AffordabilityCalculator";
import PurchaseCalculator from "./PurchaseCalculator";
import RefinanceCalculator from "./RefinanceCalculator";
import RentVsBuyCalculator from "./RentVsBuyCalculator";
import VACalculator from "./VACalculator";
import VARefinanceCalculator from "./VARefinanceCalculator";
import DSCRCalculator from "./DSCRCalculator";
import FixFlipCalculator from "./FixFlipCalculator";

export const MortgageCalculatorHub = () => {
  const [activeTab, setActiveTab] = useState("affordability");

  const calculators = [
    { id: "affordability", label: "Affordability Calculator", component: AffordabilityCalculator },
    { id: "purchase", label: "Purchase", component: PurchaseCalculator },
    { id: "refinance", label: "Refinance", component: RefinanceCalculator },
    { id: "rent-vs-buy", label: "Rent vs Buy", component: RentVsBuyCalculator },
    { id: "va-purchase", label: "VA Purchase", component: VACalculator },
    { id: "va-refinance", label: "VA Refinance", component: VARefinanceCalculator },
    { id: "dscr", label: "Debt-Service (DSCR)", component: DSCRCalculator },
    { id: "fix-flip", label: "Fix & Flip", component: FixFlipCalculator },
  ];

  return (
    <div className="min-h-screen calc-page p-6">
      <div className="max-w-7xl mx-auto space-y-8">


        <Card className="calculator-card">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 h-auto p-1 bg-secondary/30">
              {calculators.map((calc) => (
                <TabsTrigger
                  key={calc.id}
                  value={calc.id}
                  className="calculator-tab text-xs lg:text-sm px-2 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {calc.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {calculators.map((calc) => (
              <TabsContent key={calc.id} value={calc.id} className="mt-6">
                <calc.component />
              </TabsContent>
            ))}
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

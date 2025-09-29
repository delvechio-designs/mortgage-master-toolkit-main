import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle } from "lucide-react";

interface RateNotificationProps {
  hasError: boolean;
  isLoading: boolean;
  currentRate: number;
  lastKnownRate?: number;
}

export const RateNotification = ({ 
  hasError, 
  isLoading, 
  currentRate, 
  lastKnownRate 
}: RateNotificationProps) => {
  if (isLoading) {
    return (
      <Alert className="border-primary/20 bg-primary/5">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Updating mortgage rates...
        </AlertDescription>
      </Alert>
    );
  }

  if (hasError) {
    return (
      <Alert className="border-warning/20 bg-warning/5">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Using estimated rates. Live data unavailable - consider adding an API key for real-time rates.
        </AlertDescription>
      </Alert>
    );
  }

  const rateChange = lastKnownRate ? currentRate - lastKnownRate : 0;
  
  return (
    <Alert className="border-success/20 bg-success/5">
      <CheckCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center gap-2">
        <span>Live mortgage rates loaded</span>
        {Math.abs(rateChange) > 0.125 && (
          <span className="flex items-center gap-1">
            {rateChange > 0 ? (
              <>
                <TrendingUp className="h-3 w-3 text-destructive" />
                <span className="text-destructive">+{rateChange.toFixed(2)}%</span>
              </>
            ) : (
              <>
                <TrendingDown className="h-3 w-3 text-success" />
                <span className="text-success">{rateChange.toFixed(2)}%</span>
              </>
            )}
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
};
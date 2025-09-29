import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface RateIndicatorProps {
  isLoading: boolean;
  hasError: boolean;
  onRefresh: () => void;
  lastUpdated?: string;
}

export const RateIndicator = ({ 
  isLoading, 
  hasError, 
  onRefresh, 
  lastUpdated 
}: RateIndicatorProps) => {
  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2">
        {hasError && (
          <span className="text-xs text-warning">Estimated Rate</span>
        )}
        {!hasError && (
          <span className="text-xs text-success">Live Market Rate</span>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-6 w-6 p-0"
          title="Refresh mortgage rates"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      {lastUpdated && !hasError && (
        <span className="text-xs text-muted-foreground">
          Updated: {new Date(lastUpdated).toLocaleDateString()}
        </span>
      )}
    </div>
  );
};
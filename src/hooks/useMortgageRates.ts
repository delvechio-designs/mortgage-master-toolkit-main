import { useState, useEffect } from 'react';

interface MortgageRates {
  thirtyYear: number;
  fifteenYear: number;
  lastUpdated: string;
}

interface MortgageRateResponse {
  week: string;
  frm_30: number;
  frm_15: number;
}

const FALLBACK_RATES = {
  thirtyYear: 7.25,
  fifteenYear: 6.75,
  lastUpdated: new Date().toISOString()
};

export const useMortgageRates = () => {
  const [rates, setRates] = useState<MortgageRates>(FALLBACK_RATES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRates = async () => {
    try {
      setLoading(true);
      setError(null);

      // Try API Ninjas first (requires API key)
      const response = await fetch('https://api.api-ninjas.com/v1/mortgagerate', {
        headers: {
          'X-Api-Key': process.env.REACT_APP_API_NINJAS_KEY || ''
        }
      });

      if (response.ok && process.env.REACT_APP_API_NINJAS_KEY) {
        const data: MortgageRateResponse[] = await response.json();
        if (data && data.length > 0) {
          const latestRates = data[0];
          setRates({
            thirtyYear: latestRates.frm_30,
            fifteenYear: latestRates.frm_15,
            lastUpdated: latestRates.week
          });
          return;
        }
      }

      // Fallback to Freddie Mac data scraping (simplified approach)
      // In a real implementation, you'd want a more reliable API
      throw new Error('API key required or service unavailable');
      
    } catch (err) {
      console.warn('Failed to fetch live mortgage rates, using fallback rates:', err);
      setError('Using estimated rates - live data unavailable');
      setRates(FALLBACK_RATES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
    
    // Refresh rates every hour
    const interval = setInterval(fetchRates, 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const refreshRates = () => {
    fetchRates();
  };

  return {
    rates,
    loading,
    error,
    refreshRates
  };
};
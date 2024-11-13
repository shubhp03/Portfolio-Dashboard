"use client"

import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Alert, Snackbar } from '@mui/material';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { 
  Box, 
  Card, 
  CardContent, 
  Container, 
  Grid, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Typography,
  useTheme
} from '@mui/material';
import {
  AccountBalanceWallet,
  TrendingUp,
  PieChart,
  ArrowUpward,
  ArrowDownward
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Configuration
const CONFIG = {
  POLLING_INTERVAL: 5 * 60 * 1000, // 5 minutes
  HISTORY_DAYS: 90, // 90 days of historical data
  API_BASE_URL: 'https://api.polygon.io/v2',
};

// Interfaces
interface StockData {
  symbol: string;
  shares: number;
  price: number;
  change: number;
  previousClose: number;
}

interface PortfolioHistoryData {
  date: string;
  value: number;
}

interface ErrorState {
  show: boolean;
  message: string;
}

// Create the theme
const theme = createTheme({
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        }
      }
    }
  },
  palette: {
    primary: {
      main: '#8884d8',
    },
    secondary: {
      main: '#82ca9d',
    },
  },
});

const PortfolioDashboard = () => {
  const [holdings, setHoldings] = useState<StockData[]>([]);
  const [portfolioHistory, setPortfolioHistory] = useState<PortfolioHistoryData[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [dailyChange, setDailyChange] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ErrorState>({ show: false, message: '' });
  const [dataTimestamp, setDataTimestamp] = useState<Date | null>(null);

  // Your portfolio holdings - could be moved to a database or config file
  const portfolioSymbols = [
    { symbol: 'AAPL', shares: 10 },
    { symbol: 'MSFT', shares: 15 },
    { symbol: 'GOOGL', shares: 8 },
    { symbol: 'META', shares: 12 },
    { symbol: 'AMZN', shares: 9 },
    { symbol: 'TSLA', shares: 7 }, 
    { symbol: 'NVDA', shares: 11 },
    { symbol: 'PLTR', shares: 13 },
    { symbol: 'CSCO', shares: 14 },
    { symbol: 'PEP', shares: 16 },
    { symbol: 'QQQ', shares: 17 },
  ];

  const handleError = (message: string) => {
    setError({ show: true, message });
    setIsLoading(false);
  };

  const closeError = () => {
    setError({ show: false, message: '' });
  };

  const fetchStockData = async () => {
    try {
      setIsLoading(true);
      
      const apiKey = process.env.NEXT_PUBLIC_POLYGON_API_KEY;
      if (!apiKey) {
        throw new Error('API key not found');
      }

      const stockPromises = portfolioSymbols.map(async (holding) => {
        try {
          const priceResponse = await axios.get(
            `${CONFIG.API_BASE_URL}/aggs/ticker/${holding.symbol}/prev?adjusted=true&apiKey=${apiKey}`
          );

          if (!priceResponse.data.results?.length) {
            console.warn(`No data available for ${holding.symbol}`);
            return {
              symbol: holding.symbol,
              shares: holding.shares,
              price: 0,
              change: 0,
              previousClose: 0
            };
          }

          const previousClose = priceResponse.data.results[0].c;
          const currentPrice = priceResponse.data.results[0].c;
          const priceChange = ((currentPrice - previousClose) / previousClose) * 100;

          return {
            symbol: holding.symbol,
            shares: holding.shares,
            price: currentPrice,
            change: priceChange,
            previousClose: previousClose
          };
        } catch (error) {
          console.error(`Error fetching data for ${holding.symbol}:`, error);
          return {
            symbol: holding.symbol,
            shares: holding.shares,
            price: 0,
            change: 0,
            previousClose: 0
          };
        }
      });

      const stockData = await Promise.all(stockPromises);
      setHoldings(stockData);

      // Calculate portfolio metrics
      const total = stockData.reduce((acc, stock) => acc + (stock.price * stock.shares), 0);
      const change = stockData.reduce((acc, stock) => {
        const dailyChangeAmount = stock.shares * stock.price * (stock.change / 100);
        return acc + dailyChangeAmount;
      }, 0);

      setTotalValue(total);
      setDailyChange(change);

      // Fetch historical data
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - CONFIG.HISTORY_DAYS);

      const historyPromises = portfolioSymbols.map(async (holding) => {
        const response = await axios.get(
          `${CONFIG.API_BASE_URL}/aggs/ticker/${holding.symbol}/range/1/day/${startDate.toISOString().split('T')[0]}/${endDate.toISOString().split('T')[0]}?adjusted=true&apiKey=${apiKey}`
        );

        if (!response.data.results?.length) {
          throw new Error(`No historical data available for ${holding.symbol}`);
        }

        return response.data.results.map((result: any) => ({
          date: new Date(result.t).toISOString().split('T')[0],
          value: result.c * holding.shares
        }));
      });

      const historicalData = await Promise.all(historyPromises);
      
      // Combine and process historical data
      const combinedHistory = historicalData.reduce((acc, stockHistory) => {
        stockHistory.forEach((dataPoint: PortfolioHistoryData) => {
          const existingPoint = acc.find((p: PortfolioHistoryData) => p.date === dataPoint.date);
          if (existingPoint) {
            existingPoint.value += dataPoint.value;
          } else {
            acc.push({ ...dataPoint });
          }
        });
        return acc;
      }, [] as PortfolioHistoryData[]);

      combinedHistory.sort((a: PortfolioHistoryData, b: PortfolioHistoryData) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setPortfolioHistory(combinedHistory);
      setDataTimestamp(new Date());

    } catch (error) {
      console.error('Error fetching stock data:', error);
      const errorMessage = error.response?.status === 429 
        ? 'API rate limit exceeded. Please try again in a few minutes.'
        : (error instanceof Error ? error.message : 'An error occurred while fetching data');
      handleError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStockData();
    const interval = setInterval(fetchStockData, CONFIG.POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  if (isLoading && !holdings.length) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        minHeight: '100vh',
        padding: '2rem 0'
      }}>
        <LoadingSpinner message="Loading portfolio data..." />
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      minHeight: '100vh',
      padding: '2rem 0'
    }}>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* Header with last update time */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
            Portfolio Dashboard
          </Typography>
          {dataTimestamp && (
            <Typography variant="body1" color="textSecondary">
              Last updated: {dataTimestamp.toLocaleString()}
            </Typography>
          )}
        </Box>
        
        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={4}>
            <Card elevation={3}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography color="textSecondary" variant="subtitle2">
                      Total Portfolio Value
                    </Typography>
                    <Typography variant="h5" component="h2" fontWeight="bold">
                      ${totalValue.toLocaleString()}
                    </Typography>
                  </Box>
                  <AccountBalanceWallet sx={{ fontSize: 40, color: theme.palette.primary.main }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card elevation={3}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography color="textSecondary" variant="subtitle2">
                      Daily Change
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography variant="h5" component="h2" fontWeight="bold"
                        color={dailyChange >= 0 ? 'success.main' : 'error.main'}>
                        ${Math.abs(dailyChange).toLocaleString()}
                      </Typography>
                      {dailyChange >= 0 ? 
                        <ArrowUpward sx={{ color: 'success.main', ml: 1 }} /> :
                        <ArrowDownward sx={{ color: 'error.main', ml: 1 }} />
                      }
                    </Box>
                  </Box>
                  <TrendingUp sx={{ fontSize: 40, color: theme.palette.success.main }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card elevation={3}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography color="textSecondary" variant="subtitle2">
                      Total Holdings
                    </Typography>
                    <Typography variant="h5" component="h2" fontWeight="bold">
                      {holdings.length}
                    </Typography>
                  </Box>
                  <PieChart sx={{ fontSize: 40, color: theme.palette.secondary.main }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Portfolio Chart */}
        <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" component="h2" gutterBottom>
            Portfolio Performance
          </Typography>
          <Box sx={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={portfolioHistory}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ccc" opacity={0.5} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: '#666' }}
                  axisLine={{ stroke: '#666' }}
                />
                <YAxis 
                  tick={{ fill: '#666' }}
                  axisLine={{ stroke: '#666' }}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    background: 'rgba(255, 255, 255, 0.9)',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                  formatter={(value) => [`$${value.toLocaleString()}`, 'Portfolio Value']}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#8884d8"
                  strokeWidth={3}
                  dot={{ stroke: '#8884d8', strokeWidth: 2, r: 4, fill: 'white' }}
                  activeDot={{ r: 8 }}
                  name="Portfolio Value"
                  fill="url(#colorValue)"
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Paper>

        {/* Holdings Table */}
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h6" component="h2" gutterBottom>
            Current Holdings
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Symbol</TableCell>
                  <TableCell>Shares</TableCell>
                  <TableCell>Price</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell>Daily Change</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {holdings.map((holding) => (
                  <TableRow key={holding.symbol}>
                    <TableCell component="th" scope="row">
                      <Typography fontWeight="medium">{holding.symbol}</Typography>
                    </TableCell>
                    <TableCell>{holding.shares}</TableCell>
                    <TableCell>${holding.price.toFixed(2)}</TableCell>
                    <TableCell>${(holding.shares * holding.price).toLocaleString()}</TableCell>
                    <TableCell>
                      <Typography color={holding.change >= 0 ? 'success.main' : 'error.main'}>
                        {holding.change > 0 ? '+' : ''}{holding.change}%
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Container>
    </div>
  );
};

// Wrap the export with ThemeProvider
export default function ThemedPortfolioDashboard() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <PortfolioDashboard />
    </ThemeProvider>
  );
}
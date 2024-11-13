import { CircularProgress, Box, Typography } from '@mui/material';

export const LoadingSpinner = ({ message = 'Loading...' }) => (
  <Box sx={{ 
    display: 'flex', 
    flexDirection: 'column',
    alignItems: 'center', 
    justifyContent: 'center',
    minHeight: '200px'
  }}>
    <CircularProgress size={40} />
    <Typography sx={{ mt: 2 }} color="text.secondary">
      {message}
    </Typography>
  </Box>
); 
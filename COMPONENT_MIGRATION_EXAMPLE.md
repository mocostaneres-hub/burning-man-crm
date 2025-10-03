# Component Migration Example

## Example: Migrating Login.tsx

Here's a practical example of how to migrate a MUI component to Tailwind CSS using our established patterns.

### Before (MUI)
```tsx
import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  TextField,
  Button,
  Alert,
  Paper,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Login
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Box component="form" sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            onClick={handleSubmit}
          >
            Sign In
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};
```

### After (Tailwind)
```tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Card } from '../components/ui';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  return (
    <div className="max-w-md mx-auto py-16 px-4 sm:px-6 lg:px-8">
      <Card padding="lg" className="shadow-medium">
        <h1 className="text-h1 font-lato font-bold text-custom-text text-center mb-8">
          Login
        </h1>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}
        
        <form className="space-y-6">
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />
          <Button
            variant="primary"
            size="lg"
            onClick={handleSubmit}
            className="w-full"
          >
            Sign In
          </Button>
        </form>
      </Card>
    </div>
  );
};
```

## Key Migration Patterns

### 1. Container → Responsive Div
```tsx
// MUI
<Container maxWidth="sm" sx={{ py: 8 }}>

// Tailwind
<div className="max-w-md mx-auto py-16 px-4 sm:px-6 lg:px-8">
```

### 2. Paper → Card Component
```tsx
// MUI
<Paper elevation={3} sx={{ p: 4 }}>

// Tailwind
<Card padding="lg" className="shadow-medium">
```

### 3. Typography → Semantic HTML
```tsx
// MUI
<Typography variant="h4" component="h1" gutterBottom align="center">

// Tailwind
<h1 className="text-h1 font-lato font-bold text-custom-text text-center mb-8">
```

### 4. TextField → Input Component
```tsx
// MUI
<TextField
  margin="normal"
  required
  fullWidth
  id="email"
  label="Email Address"
  name="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>

// Tailwind
<Input
  label="Email Address"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  placeholder="Enter your email"
  required
/>
```

### 5. Button → Custom Button Component
```tsx
// MUI
<Button
  type="submit"
  fullWidth
  variant="contained"
  sx={{ mt: 3, mb: 2 }}
>

// Tailwind
<Button
  variant="primary"
  size="lg"
  className="w-full"
>
```

### 6. Alert → Custom Error Display
```tsx
// MUI
<Alert severity="error" sx={{ mb: 2 }}>
  {error}
</Alert>

// Tailwind
<div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
  <p className="text-red-800">{error}</p>
</div>
```

## Benefits of Migration

1. **Smaller Bundle Size**: Removes MUI dependencies (~500KB+)
2. **Better Performance**: Tailwind CSS is highly optimized
3. **Consistent Design**: Custom design system ensures consistency
4. **Better Maintainability**: Simpler, more readable code
5. **Responsive Design**: Built-in responsive utilities
6. **Custom Styling**: Easy to customize and extend

## Migration Checklist

- [ ] Remove MUI imports
- [ ] Add custom component imports
- [ ] Replace Container with responsive div
- [ ] Replace Paper with Card component
- [ ] Replace Typography with semantic HTML
- [ ] Replace TextField with Input component
- [ ] Replace Button with custom Button component
- [ ] Replace Alert with custom error display
- [ ] Update styling to use Tailwind classes
- [ ] Test responsive design
- [ ] Verify functionality works correctly

This pattern can be applied to all remaining components in the migration.


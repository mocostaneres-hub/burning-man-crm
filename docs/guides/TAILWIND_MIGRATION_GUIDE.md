# Tailwind CSS Migration Guide

## Overview
This document outlines the complete migration from Material-UI (MUI) to Tailwind CSS for the Burning Man CRM application.

## Migration Status

### ✅ Completed
- [x] Tailwind CSS installation and configuration
- [x] Custom color palette and typography setup
- [x] Component library creation (Button, Input, Card, Modal, Table, Badge)
- [x] Navbar component migration
- [x] Dashboard component migration
- [x] MyTasks component migration
- [x] App.tsx MUI dependency removal

### 🔄 In Progress
- [ ] Remaining page components migration
- [ ] Form components migration
- [ ] Table components migration
- [ ] MUI dependencies removal

### 📋 Pending
- [ ] Responsive design testing
- [ ] Performance optimization
- [ ] Documentation updates

## Color Palette

The following custom colors have been configured in `tailwind.config.js`:

```javascript
colors: {
  'custom-bg': '#FAFAFA',        // Background
  'custom-primary': '#2ECC71',   // Green (primary)
  'custom-secondary': '#F39C12', // Orange (secondary)
  'custom-accent': '#3498DB',    // Blue (accent)
  'custom-text': '#2D3436',      // Charcoal (text)
}
```

## Typography System

### Fonts
- **Headings**: Lato Bold (700)
- **Body Text**: Work Sans Regular (400)

### Font Sizes
```javascript
fontSize: {
  'h1': ['2rem', { lineHeight: '1.4', fontWeight: '700' }],      // 32px
  'h1-sm': ['1.75rem', { lineHeight: '1.4', fontWeight: '700' }], // 28px
  'h2': ['1.625rem', { lineHeight: '1.4', fontWeight: '700' }],   // 26px
  'h2-sm': ['1.375rem', { lineHeight: '1.4', fontWeight: '700' }], // 22px
  'body': ['1rem', { lineHeight: '1.6', fontWeight: '400' }],      // 16px
  'body-sm': ['0.875rem', { lineHeight: '1.6', fontWeight: '400' }], // 14px
  'label': ['0.875rem', { lineHeight: '1.4', fontWeight: '500' }],  // 14px
  'label-sm': ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }], // 12px
}
```

## Component Library

### Button Component
```tsx
import { Button } from '../components/ui';

<Button variant="primary" size="md" loading={false}>
  Click me
</Button>
```

**Variants**: `primary`, `secondary`, `accent`, `outline`, `ghost`
**Sizes**: `sm`, `md`, `lg`

### Input Component
```tsx
import { Input } from '../components/ui';

<Input
  label="Email"
  placeholder="Enter your email"
  error="Email is required"
  helperText="We'll never share your email"
/>
```

### Card Component
```tsx
import { Card } from '../components/ui';

<Card hover padding="lg">
  Card content
</Card>
```

**Padding**: `sm`, `md`, `lg`
**Hover**: `true`, `false`

### Modal Component
```tsx
import { Modal } from '../components/ui';

<Modal
  isOpen={isOpen}
  onClose={onClose}
  title="Modal Title"
  size="md"
>
  Modal content
</Modal>
```

**Sizes**: `sm`, `md`, `lg`, `xl`

### Table Component
```tsx
import { Table, TableColumn } from '../components/ui';

const columns: TableColumn[] = [
  {
    key: 'name',
    title: 'Name',
    render: (value, record) => <span>{value}</span>
  }
];

<Table
  columns={columns}
  data={data}
  loading={false}
  onRowClick={(record) => console.log(record)}
/>
```

### Badge Component
```tsx
import { Badge } from '../components/ui';

<Badge variant="success">Success</Badge>
```

**Variants**: `success`, `warning`, `info`, `error`, `neutral`

## Migration Patterns

### 1. Container to Div
```tsx
// Before (MUI)
<Container maxWidth="lg" sx={{ py: 4 }}>
  Content
</Container>

// After (Tailwind)
<div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
  Content
</div>
```

### 2. Typography to HTML Elements
```tsx
// Before (MUI)
<Typography variant="h4" component="h1" gutterBottom>
  Title
</Typography>

// After (Tailwind)
<h1 className="text-h1 font-lato font-bold text-custom-text mb-2">
  Title
</h1>
```

### 3. Grid Layout
```tsx
// Before (MUI)
<Box sx={{ 
  display: 'grid', 
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, 
  gap: 2 
}}>
  Content
</Box>

// After (Tailwind)
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  Content
</div>
```

### 4. Flexbox Layout
```tsx
// Before (MUI)
<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
  Content
</Box>

// After (Tailwind)
<div className="flex justify-center items-center">
  Content
</div>
```

### 5. Spacing
```tsx
// Before (MUI)
<Box sx={{ mb: 4, mt: 2, p: 3 }}>
  Content
</Box>

// After (Tailwind)
<div className="mb-8 mt-4 p-6">
  Content
</div>
```

## Icon Migration

Replace MUI icons with Lucide React icons:

```tsx
// Before (MUI)
import { Assignment, CheckCircle } from '@mui/icons-material';

// After (Tailwind)
import { Assignment, CheckCircle } from 'lucide-react';
```

## Utility Classes

### Custom Classes Available
- `.btn-primary`, `.btn-secondary`, `.btn-accent`, `.btn-outline`, `.btn-ghost`
- `.input-primary`, `.input-error`
- `.card`, `.card-hover`
- `.modal-overlay`, `.modal-content`
- `.table-container`, `.table`, `.table-header`, `.table-body`, `.table-cell`
- `.form-group`, `.form-label`, `.form-error`
- `.nav-link`, `.nav-link-active`
- `.badge-success`, `.badge-warning`, `.badge-info`, `.badge-error`
- `.spinner`

### Responsive Design
- Use `sm:`, `md:`, `lg:`, `xl:` prefixes for responsive design
- Example: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

## File Structure

```
src/
├── components/
│   ├── ui/           # Reusable Tailwind components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   ├── Table.tsx
│   │   ├── Badge.tsx
│   │   └── index.ts
│   └── layout/
│       └── Navbar.tsx
├── pages/
│   ├── Dashboard.tsx
│   ├── tasks/
│   │   └── MyTasks.tsx
│   └── ...
├── index.css         # Tailwind directives and custom styles
└── App.tsx
```

## Next Steps

1. **Migrate remaining page components**:
   - ApplicationManagement.tsx
   - TaskManagement.tsx
   - MemberProfileEdit.tsx
   - CampProfile.tsx
   - And all other pages

2. **Migrate form components**:
   - Replace MUI form controls with custom Input components
   - Update validation styling

3. **Remove MUI dependencies**:
   - Remove from package.json
   - Clean up unused imports

4. **Test responsive design**:
   - Verify all breakpoints work correctly
   - Test on mobile devices

5. **Performance optimization**:
   - Purge unused Tailwind classes
   - Optimize bundle size

## Testing Checklist

- [ ] All pages render correctly
- [ ] Navigation works on mobile and desktop
- [ ] Forms are functional and styled
- [ ] Tables display data properly
- [ ] Modals open and close correctly
- [ ] Buttons have proper hover states
- [ ] Typography is consistent
- [ ] Colors match design requirements
- [ ] Icons display correctly
- [ ] Responsive design works across breakpoints

## Troubleshooting

### Common Issues

1. **Icons not displaying**: Ensure Lucide React is installed and imported correctly
2. **Styles not applying**: Check that Tailwind CSS is properly configured and imported
3. **Responsive issues**: Verify breakpoint classes are applied correctly
4. **Custom colors not working**: Ensure colors are defined in tailwind.config.js

### Debugging Tips

1. Use browser dev tools to inspect applied classes
2. Check Tailwind CSS documentation for class names
3. Verify component props are passed correctly
4. Test components in isolation

## Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Lucide React Icons](https://lucide.dev/)
- [Tailwind CSS Cheat Sheet](https://tailwindcomponents.com/cheatsheet/)

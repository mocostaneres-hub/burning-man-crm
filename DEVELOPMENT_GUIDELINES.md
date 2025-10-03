# Development Guidelines - G8Road CRM

## 🚨 Critical Rules to Prevent Page Loading Issues

### Before Making Any Changes:

1. **Always run syntax checks**:
   ```bash
   ./check-syntax.sh
   ```

2. **Test compilation**:
   ```bash
   cd client && npm run build
   ```

3. **Check for TypeScript errors**:
   ```bash
   cd client && npx tsc --noEmit
   ```

### Common Issues That Break Pages:

#### ❌ JSX Structure Issues:
- **Unclosed tags**: Always ensure every opening tag has a closing tag
- **Mismatched brackets**: `{` must have corresponding `}`
- **Improper nesting**: Check that components are properly nested
- **Missing keys**: Always provide `key` prop for mapped elements

#### ❌ TypeScript Issues:
- **Undefined variables**: Ensure all variables are declared and imported
- **Missing props**: Check that all required props are passed
- **Type mismatches**: Ensure types match between interfaces and usage
- **Missing imports**: Import all required components and functions

#### ❌ Grid Component Issues:
- **Incorrect props**: Use `item` prop with standard Grid, `size` with Grid2
- **Import mismatches**: Don't mix Grid imports (use consistent import style)
- **Missing container**: Wrap Grid items in Grid container

#### ❌ State Management Issues:
- **Missing useState**: Declare all state variables used in component
- **Missing useEffect dependencies**: Include all dependencies in dependency array
- **Async function issues**: Handle async operations properly with try/catch

### 🔧 Fixing Process:

1. **Identify the error**: Check browser console and terminal output
2. **Read the full error message**: Don't just look at the first line
3. **Check file structure**: Ensure proper JSX nesting
4. **Verify imports**: Make sure all required items are imported
5. **Test incrementally**: Make small changes and test frequently

### 🛡️ Prevention Checklist:

Before submitting any changes:
- [ ] No TypeScript compilation errors
- [ ] No ESLint errors (warnings are OK)
- [ ] All JSX tags properly closed
- [ ] All variables and functions defined
- [ ] Grid components using correct props
- [ ] All required imports present
- [ ] Page loads successfully in browser
- [ ] No console errors in browser

### 🚀 Quick Recovery:

If a page stops loading:
1. Check terminal for compilation errors
2. Look at browser console for JavaScript errors
3. Run `./check-syntax.sh` to identify issues
4. Fix errors one by one
5. Test page loading after each fix

### 📝 Best Practices:

- **Make small, incremental changes**
- **Test after each significant change**
- **Use TypeScript strict mode**
- **Keep components focused and small**
- **Use proper error boundaries**
- **Handle loading and error states**

Remember: **It's better to make small, safe changes than large, risky ones!**

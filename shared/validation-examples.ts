/**
 * Example usage of the enhanced validation utilities
 * Exemples d'utilisation des utilitaires de validation renforcés
 */

import { 
  strictEmailValidation, 
  strictAmountValidation, 
  strictDateValidation,
  TimezoneUtils,
  formatUtils 
} from '../validation-utils';

// Example 1: Email validation with domain checking
console.log('=== Example 1: Email Validation ===');
try {
  const validEmail = strictEmailValidation.parse('jean.dupont@company.fr');
  console.log('✓ Valid email:', validEmail);
} catch (error) {
  console.log('✗ Invalid email:', error);
}

try {
  const invalidEmail = strictEmailValidation.parse('test@example.com'); // Blocked domain
  console.log('✓ Email accepted:', invalidEmail);
} catch (error) {
  console.log('✗ Email rejected (suspicious domain):', error.message);
}

// Example 2: Amount validation and normalization
console.log('\n=== Example 2: Amount Validation ===');
const amountInputs = ['1000', '1000,50', '12 000.00', '1,234.56', '1.234,56'];
amountInputs.forEach(input => {
  try {
    const normalized = strictAmountValidation.parse(input);
    console.log(`${input} → ${normalized} → ${formatUtils.formatAmount(parseFloat(normalized))}`);
  } catch (error) {
    console.log(`✗ Invalid amount: ${input}`);
  }
});

// Example 3: Date validation and timezone handling
console.log('\n=== Example 3: Date Validation and Timezone Handling ===');
const dateInputs = ['2024-01-15', '15/01/2024', '15-01-2024', '15.01.2024'];
dateInputs.forEach(input => {
  try {
    const normalizedDate = strictDateValidation.parse(input);
    const formatted = formatUtils.formatDate(normalizedDate);
    console.log(`${input} → ${normalizedDate} → ${formatted}`);
  } catch (error) {
    console.log(`✗ Invalid date: ${input}`);
  }
});

// Example 4: Timezone utilities
console.log('\n=== Example 4: Timezone Management ===');
const now = new Date();
console.log('Current UTC time:', now.toISOString());
console.log('Paris time:', TimezoneUtils.formatFrench(now, 'dd/MM/yyyy HH:mm'));
console.log('Is current date past?', TimezoneUtils.isPastDate(now));
console.log('Is tomorrow future?', TimezoneUtils.isFutureDate(new Date(Date.now() + 24 * 60 * 60 * 1000)));

// Example 5: Parsing French dates with timezone awareness
console.log('\n=== Example 5: French Date Parsing ===');
try {
  const frenchDate = TimezoneUtils.parseFrenchDate('15/01/2024');
  console.log('Parsed French date (UTC):', frenchDate.toISOString());
  console.log('Formatted for display:', TimezoneUtils.formatFrench(frenchDate));
} catch (error) {
  console.log('✗ Error parsing French date:', error.message);
}

// Example 6: Currency formatting
console.log('\n=== Example 6: Currency Formatting ===');
const amounts = [0, 1234.56, 1000000.99, 0.01];
amounts.forEach(amount => {
  console.log(`${amount} → ${formatUtils.formatAmount(amount)}`);
});
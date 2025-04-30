// Simple script to test environment variables
import dotenv from 'dotenv';
dotenv.config();

console.log('Testing environment variables AFTER loading .env:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('SYNC_INSTANCES:', process.env.SYNC_INSTANCES);

// Debug all environment variables
console.log('\nAll environment variables:');
const environmentVars = { ...process.env };
// Remove very long values
Object.keys(environmentVars).forEach(key => {
  if (typeof environmentVars[key] === 'string' && environmentVars[key].length > 500) {
    environmentVars[key] = environmentVars[key].substring(0, 100) + '... [truncated]';
  }
});
console.log(JSON.stringify(environmentVars, null, 2));
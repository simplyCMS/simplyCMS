import type { Catalog } from '../../types';

/** Автентифікація — дзеркало `uk/auth.ts`. */
export const messages: Catalog = {
  'auth.setPassword.title': 'Set your password',
  'auth.setPassword.description':
    'You have accepted the invitation. Choose a password to sign in to the store.',
  'auth.setPassword.password': 'Password',
  'auth.setPassword.confirm': 'Repeat password',
  'auth.setPassword.submit': 'Save and continue',
  'auth.setPassword.mismatch': 'Passwords do not match',
  'auth.setPassword.tooShort': 'At least 8 characters',
  'auth.setPassword.noSession':
    'The link is invalid or has expired. Ask for a new invitation.',
  'auth.setPassword.backToAuth': 'Go to sign in',
  'auth.setPassword.error': 'Could not save the password. Please try again.',
};

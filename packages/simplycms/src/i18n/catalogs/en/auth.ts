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

  'auth.brand': 'SimplyCMS Store',
  'auth.tagline': 'Renewable energy for your home',
  'auth.login.title': 'Sign in',
  'auth.login.subtitle': 'Sign in to access your account',
  'auth.login.tab': 'Sign in',
  'auth.login.submit': 'Sign in',
  'auth.login.pending': 'Signing in...',
  'auth.login.failed': 'Could not sign in',
  'auth.login.badCredentials': 'Wrong email or password',
  'auth.login.success': 'Signed in',
  'auth.login.welcome': 'Welcome!',

  'auth.register.title': 'Sign up',
  'auth.register.subtitle': 'Create an account to shop and track your orders',
  'auth.register.submit': 'Sign up',
  'auth.register.pending': 'Signing up...',
  'auth.register.failed': 'Could not sign up',
  'auth.register.success': 'Registration complete',
  'auth.register.created': 'Your account has been created!',

  'auth.password': 'Password',
  'auth.passwordConfirm': 'Confirm password',
  'auth.firstNamePlaceholder': 'John',
  'auth.lastNamePlaceholder': 'Smith',
  'auth.google': 'Continue with Google',
  'auth.googleFailed': 'Google sign-in failed',
  'auth.backHome': 'Back to home page',
  'auth.genericError': 'Something went wrong. Please try again.',
};

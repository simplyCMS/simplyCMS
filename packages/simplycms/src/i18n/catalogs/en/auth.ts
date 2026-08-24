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

  'auth.invite.title': 'Owner invitation',
  'auth.invite.description':
    'Choose a password — you will be taken straight to the admin panel.',
  'auth.invite.badLink':
    'The link is incomplete: it has no email or token. Copy the whole link from the email, or ask for a new invitation.',
  'auth.invite.notFound':
    'This invitation has already been used or does not exist. Ask for a new one.',
  'auth.invite.expired': 'The invitation has expired. Ask for a new one.',
  'auth.invite.mismatch':
    'The token in the link does not match the invitation. Copy the whole link from the email.',
  'auth.invite.passwordRejected':
    'The password was rejected. Try a longer or stronger one.',
  'auth.invite.signInFailed':
    'The password was saved, but the automatic sign-in failed. Please sign in manually.',
  'auth.invite.backToAuth': 'Go to sign in',

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
  'auth.forgot.link': 'Forgot your password?',
  'auth.forgot.needEmail': 'Enter your email first — the link is sent there.',
  'auth.forgot.sent': 'If that email is in our system, we have sent a link.',
  'auth.backHome': 'Back to home page',
  'auth.genericError': 'Something went wrong. Please try again.',
};

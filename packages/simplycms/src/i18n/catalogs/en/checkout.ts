import type { Catalog } from '../../types';

/** Оформлення замовлення — дзеркало `uk/checkout.ts`. */
export const messages: Catalog = {
  'checkout.title': 'Checkout',

  'checkout.emptyCart': 'Your cart is empty',
  'checkout.emptyCartHint': 'Add products to the cart before checking out',
  'checkout.placed': 'Order placed!',
  'checkout.placedNumber': 'Order number: {number}',
  'checkout.failed': 'Could not place the order',
  'checkout.retry': 'Please try again',

  'checkout.shipping.pickup': 'Pickup',
  'checkout.shipping.novaPoshta': 'Nova Poshta',
  'checkout.shipping.courier': 'Courier',
  'checkout.payment.cash': 'Cash on delivery',
  'checkout.payment.cashDescription': 'Cash or card on delivery',
  'checkout.payment.online': 'Online payment',
  'checkout.payment.onlineDescription': 'Card payment (coming soon)',

  'checkout.success.title': 'Order placed',
  'checkout.success.thanks': 'Thank you for your order!',
  'checkout.success.sentTo': 'We have sent a confirmation to',
  'checkout.success.orderNumber': 'Order number',
  'checkout.success.copied': 'Copied',
  'checkout.success.copiedHint': 'Order number copied to clipboard',
  'checkout.success.notFound': 'Order not found',
  'checkout.success.notFoundHint':
    'The link may be invalid or the access period has expired',
  'checkout.success.toHome': 'Go to home page',
  'checkout.success.details': 'Order details',
  'checkout.success.recipient': 'Recipient',
  'checkout.success.payment': 'Payment',

  'checkout.auth.title': 'Customer details',
  'checkout.auth.subtitle':
    'Sign in for faster checkout, or continue as a guest',
  'checkout.auth.guestTab': 'Guest',
  'checkout.auth.guestHint':
    'Check out without an account. Just leave an email or phone number so we can reach you.',
  'checkout.auth.invalidCredentials': 'Incorrect email or password.',
  'checkout.auth.loginSuccess': "You're signed in!",
  'checkout.auth.genericError': 'Something went wrong.',
  'checkout.auth.emailAlreadyRegistered': 'This email is already registered.',
  'checkout.auth.registerSuccessCheckEmail':
    'Registration complete! Check your inbox to confirm.',
  'checkout.auth.checkEmailToast': 'Check your inbox!',
  'checkout.auth.registerSuccess': 'Registration complete!',

  'checkout.contactForm.title': 'Contact details',
  'checkout.contactForm.firstNameLabel': 'First name *',
  'checkout.contactForm.lastNameLabel': 'Last name *',
  'checkout.contactForm.contactHint':
    '* Provide an email or phone number so we can reach you',

  'checkout.cityLabel': 'City *',
  'checkout.cityPlaceholder': 'Enter city',
  'checkout.streetAddressPlaceholder': '1 Khreshchatyk St, Apt 10',
  'checkout.notFound': 'Nothing found',
  'checkout.saveDialog.updateTitle': 'Update "{name}"',
  'checkout.saveDialog.cancelChanges': 'Discard changes',

  'checkout.delivery.addressCreated': 'New address saved',
  'checkout.delivery.pickupPointLabel': 'Choose a pickup point *',
  'checkout.delivery.pickupPointPlaceholder': 'Choose a point',
  'checkout.delivery.savedAddresses': 'Saved addresses',
  'checkout.delivery.showAll': 'Show all ({count})',
  'checkout.delivery.addressLabel': 'Delivery address *',
  'checkout.delivery.saveAddress': 'Save address',

  'checkout.orderSummary.title': 'Your order',
  'checkout.orderSummary.itemsCount': 'Items ({count})',
  'checkout.orderSummary.notesPlaceholder': 'Any special requests...',
  'checkout.orderSummary.submitting': 'Placing order...',
  'checkout.orderSummary.submit': 'Place order',
  'checkout.orderSummary.terms':
    'By clicking the button, you agree to the terms of service',

  'checkout.recipientForm.created': 'New recipient saved',
  'checkout.recipientForm.differentRecipient': 'Different recipient',
  'checkout.recipientForm.differentRecipientHint':
    'Someone else will receive this order',
  'checkout.recipientForm.savedRecipients': 'Saved recipients',
  'checkout.recipientForm.showAll': 'Show all ({count})',
  'checkout.recipientForm.firstNameLabel': "Recipient's first name *",
  'checkout.recipientForm.lastNameLabel': "Recipient's last name *",
  'checkout.recipientForm.phoneLabel': "Recipient's phone *",
  'checkout.recipientForm.emailLabel': "Recipient's email",
  'checkout.recipientForm.addressLabel': 'Address *',
  'checkout.recipientForm.notesLabel': 'Notes',
  'checkout.recipientForm.notesPlaceholder': 'Any notes about the recipient...',
  'checkout.recipientForm.saveChanges': 'Save changes',

  'checkout.addressSaveDialog.title': 'Save this address?',
  'checkout.addressSaveDialog.description':
    'You changed the delivery address. Choose what to do:',
  'checkout.addressSaveDialog.updateDescription':
    'Save the changes to this existing address',
  'checkout.addressSaveDialog.createTitle': 'Create a new address',
  'checkout.addressSaveDialog.createDescription':
    'Save it as a new address in your address book',

  'checkout.addressSelector.title': 'Choose a delivery address',
  'checkout.addressSelector.searchPlaceholder':
    'Search by name, city, or address...',
  'checkout.addressSelector.sortByName': 'By name',
  'checkout.addressSelector.sortByCity': 'By city',
  'checkout.addressSelector.emptyState': 'No saved addresses yet',

  'checkout.recipientSaveDialog.title': "Save this recipient's details?",
  'checkout.recipientSaveDialog.description':
    "You changed the recipient's details. Choose what to do:",
  'checkout.recipientSaveDialog.updateDescription':
    'Save the changes to this existing contact',
  'checkout.recipientSaveDialog.createTitle': 'Create a new recipient',
  'checkout.recipientSaveDialog.createDescription':
    'Save it as a new contact in your address book',

  'checkout.recipientSelector.title': 'Choose a recipient',
  'checkout.recipientSelector.searchPlaceholder':
    'Search by name, phone, or city...',
  'checkout.recipientSelector.sortByName': 'By name',
  'checkout.recipientSelector.sortByDate': 'By date',
  'checkout.recipientSelector.emptyState': 'No saved recipients yet',
};

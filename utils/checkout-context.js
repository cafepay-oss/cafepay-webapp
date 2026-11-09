const storageKey = 'cafepay.checkout'

export function saveCheckoutContext(storage, context) {
  try {
    storage.setItem(storageKey, JSON.stringify(context))
  } catch (error) {}
}

export function readCheckoutContext(storage, invoice) {
  try {
    const context = JSON.parse(storage.getItem(storageKey))
    return context && String(context.invoice) === String(invoice) ? context : null
  } catch (error) {
    return null
  }
}

// Shared by the cart page, checkout and the order route, so they always agree.
// Change these to match your store.

export const FREE_SHIPPING_OVER = 2500; // free shipping once the total (after discounts) reaches this
export const SHIPPING_FEE = 50; // charged below that
export const TAX_RATE = 0; // for example 0.14 for 14%

export function shippingFor(netPrice: number): number {
  return netPrice >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FEE;
}

// Cash-on-delivery orders are confirmed and handed to Bosta the moment they're placed.
// Set to false to confirm and ship each one yourself from the admin Orders page.
export const AUTO_SHIP_COD = true;
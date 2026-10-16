

export function formatMoney(amount: number, currency = "EGP"): string {
  const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount);
  return `${number} ${currency}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}
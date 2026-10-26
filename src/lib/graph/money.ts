/** NUMERIC(16,2) values exceed safe JS integer precision; use bigint cents. */
export function minorUnits(amount: string): bigint {
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) throw new Error('Invalid monetary amount');
  const [whole, fraction = ''] = amount.split('.');
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, '0'));
}

export function decimalAmount(amount: bigint): string {
  return `${amount / BigInt(100)}.${String(amount % BigInt(100)).padStart(2, '0')}`;
}

export function atLeastPercent(value: bigint, base: bigint, percent: number) {
  return value * BigInt(10000) >= base * BigInt(Math.round(percent * 100));
}

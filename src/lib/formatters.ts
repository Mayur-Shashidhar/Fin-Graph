/**
 * Currency and Date formatters for FinGraph.
 * Formats financial amounts into Indian Rupee (INR - ₹) representation
 * preserving decimal string precision without floating-point errors.
 */

/**
 * Formats an amount into standard Indian Rupee notation (e.g. ₹1,23,45,678.00).
 * Handles string and number inputs without precision loss.
 */
export function formatINR(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === '') {
    return '₹0.00';
  }

  const str = typeof val === 'number' ? val.toFixed(2) : String(val).trim();
  if (str === 'NaN' || str === '') return '₹0.00';

  const isNegative = str.startsWith('-');
  const unsignedStr = isNegative ? str.slice(1) : str;

  const parts = unsignedStr.split('.');
  const intPart = parts[0] || '0';
  const decPart = (parts[1] || '00').padEnd(2, '0').slice(0, 2);

  let formattedInt = intPart;
  if (intPart.length > 3) {
    const lastThree = intPart.slice(-3);
    const remaining = intPart.slice(0, -3);
    const withCommas = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    formattedInt = `${withCommas},${lastThree}`;
  }

  return `${isNegative ? '-' : ''}₹${formattedInt}.${decPart}`;
}

/**
 * Formats an amount into compact Indian notation (Crores / Lakhs / Thousands)
 * for high-level summary cards.
 */
export function formatCompactINR(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === '') {
    return '₹0';
  }

  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num)) return '₹0';

  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (absNum >= 10000000) {
    // 1 Crore = 10,000,000
    const cr = absNum / 10000000;
    return `${sign}₹${cr.toFixed(2)} Cr`;
  } else if (absNum >= 100000) {
    // 1 Lakh = 100,000
    const lk = absNum / 100000;
    return `${sign}₹${lk.toFixed(2)} L`;
  } else if (absNum >= 1000) {
    const k = absNum / 1000;
    return `${sign}₹${k.toFixed(1)} K`;
  }

  return `${sign}₹${absNum.toFixed(2)}`;
}

/**
 * Formats ISO date/time into a clear, readable timestamp.
 */
export function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  return d.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Formats date only.
 */
export function formatDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

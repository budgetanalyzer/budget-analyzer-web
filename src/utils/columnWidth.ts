// CSP-compliant column width utility. Replaces inline style={{ width: '...px' }}
// props which produce DOM style="" attributes that violate strict style-src 'self'
// CSP. Do NOT use inline style props for column widths — add entries here instead.
//
// Static map so Tailwind JIT can scan the complete class strings.
const WIDTH_CLASSES: Record<number, string> = {
  40: 'w-[40px]',
  50: 'w-[50px]',
  60: 'w-[60px]',
  72: 'w-[72px]',
  100: 'w-[100px]',
  120: 'w-[120px]',
  150: 'w-[150px]',
  180: 'w-[180px]',
  220: 'w-[220px]',
  400: 'w-[400px]',
};

const MIN_WIDTH_CLASSES: Record<number, string> = {
  220: 'min-w-[220px]',
};

export function columnWidthClass(size: number): string {
  return WIDTH_CLASSES[size] ?? '';
}

export function columnMinWidthClass(size: number): string {
  return MIN_WIDTH_CLASSES[size] ?? '';
}

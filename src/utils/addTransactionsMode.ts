const ADD_TO_VIEW_PARAM = 'addToView';
const ADD_TO_VIEW_RETURN_TO_PARAM = 'addToViewReturnTo';

const transactionFilterParams = [
  'q',
  'dateFrom',
  'dateTo',
  'bankName',
  'bank',
  'accountId',
  'account',
  'type',
  'minAmount',
  'maxAmount',
  'amountCurrency',
] as const;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const internalOrigin = 'https://budgetanalyzer.invalid';

export interface AddTransactionsMode {
  viewId: string;
  returnTo: string;
}

function isValidViewId(viewId: string): boolean {
  return uuidPattern.test(viewId);
}

function isValidReturnTo(returnTo: string, viewId: string): boolean {
  if (!returnTo.startsWith('/') || returnTo.startsWith('//') || returnTo.startsWith('/\\')) {
    return false;
  }

  const parsed = new URL(returnTo, internalOrigin);
  if (parsed.origin !== internalOrigin || parsed.pathname !== `/views/${viewId}`) {
    return false;
  }

  return (
    !parsed.searchParams.has(ADD_TO_VIEW_PARAM) &&
    !parsed.searchParams.has(ADD_TO_VIEW_RETURN_TO_PARAM)
  );
}

export function hasAddTransactionsModeParams(searchParams: URLSearchParams): boolean {
  return searchParams.has(ADD_TO_VIEW_PARAM) || searchParams.has(ADD_TO_VIEW_RETURN_TO_PARAM);
}

export function parseAddTransactionsMode(
  searchParams: URLSearchParams,
): AddTransactionsMode | null {
  const viewId = searchParams.get(ADD_TO_VIEW_PARAM);
  const returnTo = searchParams.get(ADD_TO_VIEW_RETURN_TO_PARAM);

  if (!viewId || !returnTo || !isValidViewId(viewId) || !isValidReturnTo(returnTo, viewId)) {
    return null;
  }

  return { viewId, returnTo };
}

export function removeAddTransactionsModeParams(searchParams: URLSearchParams): URLSearchParams {
  const cleaned = new URLSearchParams(searchParams);
  cleaned.delete(ADD_TO_VIEW_PARAM);
  cleaned.delete(ADD_TO_VIEW_RETURN_TO_PARAM);
  return cleaned;
}

interface BuildAddTransactionsModeUrlOptions extends AddTransactionsMode {
  sourceSearchParams?: URLSearchParams;
}

export function buildAddTransactionsModeUrl({
  viewId,
  returnTo,
  sourceSearchParams = new URLSearchParams(),
}: BuildAddTransactionsModeUrlOptions): string | null {
  if (!isValidViewId(viewId) || !isValidReturnTo(returnTo, viewId)) {
    return null;
  }

  const params = new URLSearchParams();
  transactionFilterParams.forEach((name) => {
    sourceSearchParams.getAll(name).forEach((value) => params.append(name, value));
  });
  params.set(ADD_TO_VIEW_PARAM, viewId);
  params.set(ADD_TO_VIEW_RETURN_TO_PARAM, returnTo);

  return `/?${params.toString()}`;
}

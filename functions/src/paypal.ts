export type PayPalEnvironment = "SANDBOX" | "PRODUCTION";

export type PayPalOrderSummary = {
  id: string;
  status?: string;
  amount?: number;
  currency?: string;
};

export type PayPalTransactionInfo = {
  transactionId?: string;
  paypalReferenceId?: string;
  customId?: string;
  customField?: string;
  status?: string;
  initiatedAt?: string;
};

function envToBaseUrl(env: PayPalEnvironment): string {
  return env === "PRODUCTION"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  const raw = `${clientId}:${clientSecret}`;
  return `Basic ${Buffer.from(raw, "utf8").toString("base64")}`;
}

export async function fetchPayPalAccessToken(params: {
  env: PayPalEnvironment;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const { env, clientId, clientSecret } = params;
  const fetchImpl = params.fetchImpl ?? fetch;

  const url = `${envToBaseUrl(env)}/v1/oauth2/token`;
  const body = new URLSearchParams({ grant_type: "client_credentials" });

  const init: globalThis.RequestInit = {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  };

  const resp = await fetchImpl(url, init);
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `PayPal token request failed: ${resp.status} ${text}`.trim(),
    );
  }

  const json = (await resp.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("PayPal token missing access_token");
  return json.access_token;
}

export function parsePayPalOrderSummary(
  orderJson: unknown,
): PayPalOrderSummary {
  if (typeof orderJson !== "object" || orderJson === null) {
    throw new Error("Invalid PayPal order JSON");
  }

  const order = orderJson as Record<string, unknown>;
  const id = order.id;
  const status = typeof order.status === "string" ? order.status : undefined;

  let amount: number | undefined;
  let currency: string | undefined;

  const purchaseUnits = order.purchase_units;
  if (Array.isArray(purchaseUnits) && purchaseUnits.length > 0) {
    const pu0 = purchaseUnits[0] as Record<string, unknown>;
    const amt = pu0.amount as Record<string, unknown> | undefined;
    if (amt && typeof amt === "object") {
      const value = amt.value;
      const curr = amt.currency_code;
      if (typeof value === "string") {
        const n = Number(value);
        if (Number.isFinite(n)) amount = n;
      }
      if (typeof curr === "string") currency = curr;
    }

    if (amount === undefined) {
      const payments = pu0.payments as Record<string, unknown> | undefined;
      const captures = payments?.captures as unknown;
      if (Array.isArray(captures) && captures.length > 0) {
        const capture0 = captures[0] as Record<string, unknown>;
        const captureAmount = capture0.amount as
          | Record<string, unknown>
          | undefined;
        if (captureAmount && typeof captureAmount === "object") {
          const value = captureAmount.value;
          const curr = captureAmount.currency_code;
          if (typeof value === "string") {
            const n = Number(value);
            if (Number.isFinite(n)) amount = n;
          }
          if (typeof curr === "string") currency = curr;
        }
      }
    }
  }

  if (typeof id !== "string" || !id.trim()) {
    throw new Error("PayPal order missing id");
  }

  return {
    id: id.trim(),
    status,
    amount,
    currency,
  };
}

export async function fetchPayPalOrder(params: {
  env: PayPalEnvironment;
  accessToken: string;
  orderId: string;
  fetchImpl?: typeof fetch;
}): Promise<PayPalOrderSummary> {
  const { env, accessToken, orderId } = params;
  const fetchImpl = params.fetchImpl ?? fetch;

  const url = `${envToBaseUrl(env)}/v2/checkout/orders/${encodeURIComponent(orderId)}`;
  const resp = await fetchImpl(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`PayPal order fetch failed: ${resp.status} ${text}`.trim());
  }

  const json = (await resp.json()) as unknown;
  return parsePayPalOrderSummary(json);
}

function readString(
  value: Record<string, unknown>,
  key: string,
): string | undefined {
  const raw = value[key];
  return typeof raw === "string" ? raw : undefined;
}

function parseTransactionInfo(value: unknown): PayPalTransactionInfo | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const infoRaw = record.transaction_info;
  if (typeof infoRaw !== "object" || infoRaw === null) return null;
  const info = infoRaw as Record<string, unknown>;

  return {
    transactionId: readString(info, "transaction_id"),
    paypalReferenceId: readString(info, "paypal_reference_id"),
    customId: readString(info, "custom_id"),
    customField: readString(info, "custom_field"),
    status: readString(info, "transaction_status"),
    initiatedAt: readString(info, "transaction_initiation_date"),
  };
}

function parseTransactionsResponse(json: unknown): {
  transactions: PayPalTransactionInfo[];
  totalPages: number;
} {
  if (typeof json !== "object" || json === null) {
    return { transactions: [], totalPages: 1 };
  }

  const record = json as Record<string, unknown>;
  const details = record.transaction_details;
  const transactions: PayPalTransactionInfo[] = [];

  if (Array.isArray(details)) {
    for (const item of details) {
      const parsed = parseTransactionInfo(item);
      if (parsed) transactions.push(parsed);
    }
  }

  const totalPagesRaw = record.total_pages;
  const totalPages =
    typeof totalPagesRaw === "number" && Number.isFinite(totalPagesRaw)
      ? Math.max(1, Math.floor(totalPagesRaw))
      : 1;

  return { transactions, totalPages };
}

export async function fetchPayPalTransactions(params: {
  env: PayPalEnvironment;
  accessToken: string;
  startDate: string;
  endDate: string;
  pageSize?: number;
  fetchImpl?: typeof fetch;
}): Promise<PayPalTransactionInfo[]> {
  const { env, accessToken, startDate, endDate } = params;
  const fetchImpl = params.fetchImpl ?? fetch;
  const pageSize = params.pageSize ?? 100;
  const baseUrl = `${envToBaseUrl(env)}/v1/reporting/transactions`;

  const transactions: PayPalTransactionInfo[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const qs = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      fields: "all",
      page: String(page),
      page_size: String(pageSize),
    });
    const url = `${baseUrl}?${qs.toString()}`;
    const resp = await fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(
        `PayPal transactions fetch failed: ${resp.status} ${text}`.trim(),
      );
    }

    const json = (await resp.json()) as unknown;
    const parsed = parseTransactionsResponse(json);
    transactions.push(...parsed.transactions);
    totalPages = parsed.totalPages;
    page += 1;
  } while (page <= totalPages && page <= 100);

  return transactions;
}

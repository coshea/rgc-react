export type PayPalEnvironment = "SANDBOX" | "PRODUCTION";

export type PayPalOrderSummary = {
  id: string;
  status?: string;
  amount?: number;
  currency?: string;
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
      `PayPal token request failed: ${resp.status} ${text}`.trim()
    );
  }

  const json = (await resp.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("PayPal token missing access_token");
  return json.access_token;
}

export function parsePayPalOrderSummary(
  orderJson: unknown
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

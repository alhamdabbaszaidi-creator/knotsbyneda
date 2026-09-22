import { VercelRequest, VercelResponse } from "@vercel/web";

async function getPayPalToken(): Promise<string> {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
  ).toString("base64");

  const response = await fetch(`https://api.paypal.com/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await response.json();
  return data.access_token;
}

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { product, quantity, price } = req.body;

    if (!product || !quantity || !price) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const token = await getPayPalToken();
    const total = (price * quantity).toFixed(2);

    const orderData = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: total,
            breakdown: {
              item_total: { currency_code: "USD", value: total },
            },
          },
          items: [
            {
              name: product,
              quantity: quantity.toString(),
              unit_amount: { currency_code: "USD", value: price.toFixed(2) },
            },
          ],
        },
      ],
      application_context: {
        return_url: `https://${process.env.VERCEL_URL}/`,
        cancel_url: `https://${process.env.VERCEL_URL}/`,
      },
    };

    const response = await fetch(`https://api.paypal.com/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderData),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({
        error: data.message || "PayPal order creation failed",
      });
    }

    return res.status(200).json({ id: data.id });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

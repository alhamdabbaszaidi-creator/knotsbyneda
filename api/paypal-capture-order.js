async function getPayPalToken() {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64");
  const response = await fetch(`https://api.paypal.com/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const data = await response.json();
  return data.access_token;
}

export default async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { paypalOrderId, accessToken, order, total } = req.body;
    if (!paypalOrderId || !order || !accessToken) return res.status(400).json({ error: "Missing required fields" });
    const ppToken = await getPayPalToken();
    const captureResponse = await fetch(`https://api.paypal.com/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ppToken}`, "Content-Type": "application/json" },
    });
    const captureData = await captureResponse.json();
    if (captureData.status !== "COMPLETED") return res.status(400).json({ error: "Payment capture failed", success: false });
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const userData = await userRes.json();
    const saveResponse = await fetch(`${supabaseUrl}/rest/v1/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json", "Prefer": "return=representation" },
      body: JSON.stringify({ user_id: userData.id, product: order.product, color: order.color, size: order.size, quantity: order.quantity, notes: order.notes, customer_name: order.customerName, customer_email: order.customerEmail, payment_method: "paypal", status: "paid", total: total, paypal_order_id: paypalOrderId }),
    });
    const dbOrder = await saveResponse.json();
    if (!saveResponse.ok) return res.status(500).json({ error: "Payment captured but order save failed", success: false });
    return res.status(200).json({ success: true, order: dbOrder[0] });
  } catch (error) {
    return res.status(500).json({ error: error.message, success: false });
  }
};

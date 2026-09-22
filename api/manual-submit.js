export default async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { accessToken, method, reference, order, total } = req.body;
    if (!method || !reference || !order || !accessToken) return res.status(400).json({ error: "Missing required fields" });
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const userData = await userResponse.json();
    const userId = userData.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const saveResponse = await fetch(`${supabaseUrl}/rest/v1/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json", "Prefer": "return=representation" },
      body: JSON.stringify({ user_id: userId, product: order.product, color: order.color, size: order.size, quantity: order.quantity, notes: order.notes, customer_name: order.customerName, customer_email: order.customerEmail, payment_method: method, status: "pending_manual_verification", total: total, manual_reference: reference }),
    });
    const dbOrder = await saveResponse.json();
    if (!saveResponse.ok) return res.status(500).json({ error: "Order save failed", success: false });
    return res.status(200).json({ success: true, order: dbOrder[0] });
  } catch (error) {
    return res.status(500).json({ error: error.message, success: false });
  }
};

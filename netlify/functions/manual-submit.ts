import { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { accessToken, method, reference, order, total } = JSON.parse(
      event.body || "{}"
    );

    if (!method || !reference || !order || !accessToken) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const userData = await userResponse.json();
    const userId = userData.id;

    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    const saveResponse = await fetch(`${supabaseUrl}/rest/v1/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        user_id: userId,
        product: order.product,
        color: order.color,
        size: order.size,
        quantity: order.quantity,
        notes: order.notes,
        customer_name: order.customerName,
        customer_email: order.customerEmail,
        payment_method: method,
        status: "pending_manual_verification",
        total: total,
        manual_reference: reference,
      }),
    });

    const dbOrder = await saveResponse.json();

    if (!saveResponse.ok) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Order save failed",
          success: false,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        order: dbOrder[0],
      }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
        success: false,
      }),
    };
  }
};

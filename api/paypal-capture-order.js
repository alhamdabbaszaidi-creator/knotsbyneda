import {
    getUser,
    getPrice,
    supabaseAdmin,
    json
} from "./_shared.js";


export default async function handler(
    req,
    res
){

    if(req.method !== "POST"){

        return json(
            res,
            405,
            {
                error:"Method not allowed."
            }
        );

    }


    try{

        const user =
            await getUser(req);


        if(!user){

            return json(
                res,
                401,
                {
                    error:"You must be signed in."
                }
            );

        }


        const {
            paypalOrderId,
            order
        } =
            req.body || {};


        if(
            !paypalOrderId ||
            !order
        ){

            return json(
                res,
                400,
                {
                    error:"Missing order information."
                }
            );

        }


        const total =
            getPrice(
                order.product,
                order.quantity
            );


        const clientId =
            process.env.PAYPAL_CLIENT_ID;

        const clientSecret =
            process.env.PAYPAL_CLIENT_SECRET;


        const environment =
            process.env.PAYPAL_ENV === "live"
                ? "https://api-m.paypal.com"
                : "https://api-m.sandbox.paypal.com";


        const auth =
            Buffer
                .from(
                    clientId +
                    ":" +
                    clientSecret
                )
                .toString("base64");


        /* GET PAYPAL ACCESS TOKEN */

        const tokenResponse =
            await fetch(
                environment +
                "/v1/oauth2/token",
                {

                    method:"POST",

                    headers:{
                        "Authorization":
                            "Basic " + auth,

                        "Content-Type":
                            "application/x-www-form-urlencoded"
                    },

                    body:
                        "grant_type=client_credentials"
                }
            );


        const tokenData =
            await tokenResponse.json();


        if(
            !tokenResponse.ok ||
            !tokenData.access_token
        ){

            return json(
                res,
                500,
                {
                    error:
                    "Could not authenticate with PayPal."
                }
            );

        }


        /* CAPTURE PAYPAL PAYMENT */

        const captureResponse =
            await fetch(
                environment +
                "/v2/checkout/orders/" +
                encodeURIComponent(
                    paypalOrderId
                ) +
                "/capture",
                {

                    method:"POST",

                    headers:{
                        "Content-Type":
                            "application/json",

                        "Authorization":
                            "Bearer " +
                            tokenData.access_token
                    }

                }
            );


        const captureData =
            await captureResponse.json();


        if(!captureResponse.ok){

            console.error(
                "PayPal capture error:",
                captureData
            );

            return json(
                res,
                400,
                {
                    error:
                    captureData.message ||
                    "PayPal payment could not be captured."
                }
            );

        }


        if(
            captureData.status !==
            "COMPLETED"
        ){

            return json(
                res,
                400,
                {
                    error:
                    "PayPal did not mark the payment as completed."
                }
            );

        }


        const purchase =
            captureData
                .purchase_units?.[0];


        const paypalAmount =
            purchase
                ?.payments
                ?.captures?.[0]
                ?.amount;


        if(
            !paypalAmount ||
            paypalAmount.currency_code !== "USD" ||
            Number(paypalAmount.value).toFixed(2) !==
            total.toFixed(2)
        ){

            console.error(
                "PayPal amount mismatch:",
                paypalAmount,
                total
            );

            return json(
                res,
                400,
                {
                    error:
                    "Payment amount could not be verified."
                }
            );

        }


        /* SAVE ORDER */

        const admin =
            supabaseAdmin();


        const row = {

            user_id:user.id,

            product:order.product,

            color:order.color,

            size:order.size,

            quantity:Number(
                order.quantity
            ),

            notes:order.notes || "",

            customer_name:
                order.customerName,

            customer_email:
                order.customerEmail,

            total:total,

            payment_method:"PayPal",

            payment_reference:
                paypalOrderId,

            status:"paid"

        };


        const {
            data,
            error
        } =
            await admin
                .from("orders")
                .insert(row)
                .select()
                .single();


        if(error){

            console.error(
                "Supabase order error:",
                error
            );

            return json(
                res,
                500,
                {
                    error:
                    "Payment succeeded, but the order could not be saved. Contact the store owner."
                }
            );

        }


        /* SEND EMAIL */

        await sendOrderEmail(
            data,
            "New Paid Order"
        );


        return json(
            res,
            200,
            {
                success:true,
                total:total
            }
        );


    }catch(error){

        console.error(error);

        return json(
            res,
            500,
            {
                error:
                error.message ||
                "Server error."
            }
        );

    }
}


/* =========================================
   EMAIL
========================================= */

async function sendOrderEmail(
    order,
    subjectPrefix
){

    const apiKey =
        process.env.RESEND_API_KEY;

    const from =
        process.env.ORDER_FROM_EMAIL;


    if(!apiKey || !from){

        console.warn(
            "Resend is not configured. Order email was skipped."
        );

        return;
    }


    const text = `

KNots By Neda — New Paid Order

Customer:
${order.customer_name}

Email:
${order.customer_email}

Product:
${order.product}

Color:
${order.color}

Size:
${order.size}

Quantity:
${order.quantity}

Total:
$${Number(order.total).toFixed(2)}

Payment:
${order.payment_method}

PayPal Order ID:
${order.payment_reference}

Notes:
${order.notes || "None"}

Order ID:
${order.id}

Status:
${order.status}

`;


    const response =
        await fetch(
            "https://api.resend.com/emails",
            {

                method:"POST",

                headers:{
                    "Authorization":
                        "Bearer " + apiKey,

                    "Content-Type":
                        "application/json"
                },

                body:JSON.stringify({

                    from:from,

                    to:[
                        "snazaidi5@gmail.com"
                    ],

                    subject:
                        subjectPrefix +
                        " — " +
                        order.product,

                    text:text

                })

            }
        );


    if(!response.ok){

        const error =
            await response.text();

        console.error(
            "Email error:",
            error
        );

    }

}

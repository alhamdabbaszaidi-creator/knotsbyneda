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
            method,
            reference,
            order
        } =
            req.body || {};


        if(
            !["zelle","cashapp"]
                .includes(method)
        ){

            return json(
                res,
                400,
                {
                    error:"Invalid payment method."
                }
            );

        }


        if(!reference){

            return json(
                res,
                400,
                {
                    error:
                    "Payment reference is required."
                }
            );

        }


        const total =
            getPrice(
                order.product,
                order.quantity
            );


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

            payment_method:
                method === "zelle"
                    ? "Zelle"
                    : "CashApp",

            payment_reference:
                reference,

            status:
                "pending_manual_verification"

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

            console.error(error);

            return json(
                res,
                500,
                {
                    error:
                    "Could not save the order."
                }
            );

        }


        await sendEmail(data);


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


async function sendEmail(order){

    const apiKey =
        process.env.RESEND_API_KEY;

    const from =
        process.env.ORDER_FROM_EMAIL;


    if(!apiKey || !from){

        return;
    }


    const text = `

Knots By Neda — Payment Verification Needed

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

Payment Reference:
${order.payment_reference}

Notes:
${order.notes || "None"}

Order ID:
${order.id}

Status:
Pending Verification

`;


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
                    "Payment Verification Needed — " +
                    order.product,

                text:text

            })

        }
    );

}

import {
    getUser,
    getPrice,
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
            product,
            quantity
        } = req.body || {};


        const total =
            getPrice(
                product,
                quantity
            );


        const clientId =
            process.env.PAYPAL_CLIENT_ID;

        const clientSecret =
            process.env.PAYPAL_CLIENT_SECRET;

        if(
            !clientId ||
            !clientSecret
        ){

            return json(
                res,
                500,
                {
                    error:
                    "PayPal server credentials are missing."
                }
            );

        }


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

            console.error(
                "PayPal token error:",
                tokenData
            );

            return json(
                res,
                500,
                {
                    error:
                    "Could not connect to PayPal."
                }
            );

        }


        const paypalResponse =
            await fetch(
                environment +
                "/v2/checkout/orders",
                {

                    method:"POST",

                    headers:{

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            "Bearer " +
                            tokenData.access_token,

                        "PayPal-Request-Id":
                            crypto.randomUUID()

                    },

                    body:JSON.stringify({

                        intent:"CAPTURE",

                        purchase_units:[{

                            amount:{

                                currency_code:"USD",

                                value:
                                    total.toFixed(2)

                            }

                        }]

                    })

                }
            );


        const paypalData =
            await paypalResponse.json();


        if(
            !paypalResponse.ok ||
            !paypalData.id
        ){

            console.error(
                "PayPal create error:",
                paypalData
            );

            return json(
                res,
                500,
                {
                    error:
                    paypalData.message ||
                    "PayPal could not create the order."
                }
            );

        }


        return json(
            res,
            200,
            {
                id:paypalData.id
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

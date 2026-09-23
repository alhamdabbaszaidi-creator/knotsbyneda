import { createClient } from "@supabase/supabase-js";

export const PRODUCTS = {
    "Macrame Mirror": 45,
    "Macrame Keychains": 15,
    "Handmade Handbag": 55,
    "Macrame Chandeliers": 70
};

export function supabaseAdmin(){

    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
            auth:{
                autoRefreshToken:false,
                persistSession:false
            }
        }
    );
}


export async function getUser(req){

    const auth =
        req.headers.authorization || "";

    if(!auth.startsWith("Bearer ")){
        return null;
    }

    const token =
        auth.slice(7).trim();

    if(!token){
        return null;
    }

    const admin =
        supabaseAdmin();

    const {
        data,
        error
    } = await admin.auth.getUser(token);

    if(error || !data.user){
        return null;
    }

    return data.user;
}


export function getPrice(
    product,
    quantity
){

    if(!PRODUCTS[product]){
        throw new Error("Invalid product.");
    }

    const qty =
        Number(quantity);

    if(
        !Number.isInteger(qty) ||
        qty < 1 ||
        qty > 4
    ){

        throw new Error(
            "Quantity must be between 1 and 4."
        );
    }

    return Number(
        (PRODUCTS[product] * qty).toFixed(2)
    );
}


export function json(
    res,
    status,
    body
){

    res.status(status);

    res.setHeader(
        "Content-Type",
        "application/json"
    );

    return res.json(body);
}

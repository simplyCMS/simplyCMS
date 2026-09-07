import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, accessToken } = await req.json();

    // Validate required parameters
    if (!orderId || typeof orderId !== "string") {
      return new Response(
        JSON.stringify({ error: "Order ID is required and must be a string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!accessToken || typeof accessToken !== "string") {
      return new Response(
        JSON.stringify({ error: "Access token is required and must be a string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate UUID format for orderId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orderId)) {
      return new Response(
        JSON.stringify({ error: "Invalid order ID format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate access token format (64 character hex string)
    const hexRegex = /^[0-9a-f]{64}$/i;
    if (!hexRegex.test(accessToken)) {
      return new Response(
        JSON.stringify({ error: "Invalid access token format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to bypass RLS
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify access token and fetch order (only for guest orders with NULL user_id)
    const { data: order, error } = await supabaseClient
      .from("orders")
      .select(`
        id,
        order_number,
        first_name,
        last_name,
        email,
        phone,
        delivery_method,
        delivery_address,
        delivery_city,
        payment_method,
        subtotal,
        total,
        notes,
        created_at,
        updated_at,
        status_id,
        order_items (
          id,
          name,
          price,
          quantity,
          total,
          product_id,
          modification_id,
          service_id
        )
      `)
      .eq("id", orderId)
      .eq("access_token", accessToken)
      .is("user_id", null)
      .single();

    if (error || !order) {
      // Use generic error to avoid enumeration attacks
      return new Response(
        JSON.stringify({ error: "Order not found or invalid access token" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return order without exposing access_token
    return new Response(
      JSON.stringify(order),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error fetching guest order:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

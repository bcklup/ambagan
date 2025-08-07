-- Fix the calculate_member_balance function to handle type mismatch
-- Run this in your Supabase SQL editor

CREATE OR REPLACE FUNCTION calculate_member_balance(member_uuid UUID)
RETURNS TABLE (
    owed_to_member_id UUID,
    owed_to_member_name TEXT,
    amount_owed DECIMAL,
    order_details JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH member_payments AS (
        -- What this member paid for
        SELECT 
            op.order_id,
            op.amount_paid,
            o.name as order_name
        FROM order_payers op
        JOIN orders o ON op.order_id = o.id
        WHERE op.member_id = member_uuid
    ),
    member_consumption AS (
        -- What this member owes
        SELECT 
            oc.order_id,
            o.name as order_name,
            o.total_amount,
            oc.split_ratio,
            -- Calculate this member's share of the order
            (o.total_amount * oc.split_ratio / 
                (SELECT SUM(split_ratio) FROM order_consumers WHERE order_id = oc.order_id)
            ) as member_share
        FROM order_consumers oc
        JOIN orders o ON oc.order_id = o.id
        WHERE oc.member_id = member_uuid
    ),
    balance_calculation AS (
        SELECT 
            payer.member_id as payer_member_id,
            payer_member.name::TEXT as payer_name,
            consumer.order_id,
            consumer.order_name,
            consumer.member_share,
            -- Amount this member owes to the payer for this order
            (consumer.member_share * payer.amount_paid / consumer.total_amount) as amount_owed_to_payer
        FROM member_consumption consumer
        JOIN order_payers payer ON consumer.order_id = payer.order_id
        JOIN members payer_member ON payer.member_id = payer_member.id
        WHERE payer.member_id != member_uuid  -- Don't owe yourself
    )
    SELECT 
        bc.payer_member_id,
        bc.payer_name,
        SUM(bc.amount_owed_to_payer)::DECIMAL as total_owed,
        jsonb_agg(
            jsonb_build_object(
                'order_name', bc.order_name,
                'amount', bc.amount_owed_to_payer
            )
        ) as order_breakdown
    FROM balance_calculation bc
    GROUP BY bc.payer_member_id, bc.payer_name
    HAVING SUM(bc.amount_owed_to_payer) > 0.01  -- Only show debts > 1 cent
    ORDER BY total_owed DESC;
END;
$$ LANGUAGE plpgsql; 
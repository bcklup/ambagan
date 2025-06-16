-- Bill Splitting Calculator Database Schema for Supabase
-- Run this script in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types/enums
CREATE TYPE payment_method_type AS ENUM ('qr_code', 'cash', 'bank_transfer', 'gcash', 'paymaya', 'other');

-- Sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    qr_code_token VARCHAR(255) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User payment methods table (extends auth.users)
CREATE TABLE user_payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type payment_method_type NOT NULL DEFAULT 'qr_code',
    qr_image_url TEXT,
    notes TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session members table
CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- nullable for non-app users
    name VARCHAR(255) NOT NULL,
    payment_method_type payment_method_type DEFAULT 'qr_code',
    payment_qr_image_url TEXT,
    payment_notes TEXT,
    added_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount > 0),
    created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order payers table (who initially paid for the order)
CREATE TABLE order_payers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    amount_paid DECIMAL(10,2) NOT NULL CHECK (amount_paid > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(order_id, member_id)
);

-- Order consumers table (who will split the cost)
CREATE TABLE order_consumers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    split_ratio DECIMAL(5,2) DEFAULT 1.0 CHECK (split_ratio > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(order_id, member_id)
);

-- Create indexes for better performance
CREATE INDEX idx_sessions_creator ON sessions(creator_id);
CREATE INDEX idx_sessions_qr_token ON sessions(qr_code_token);
CREATE INDEX idx_sessions_active ON sessions(is_active);

CREATE INDEX idx_user_payment_methods_user ON user_payment_methods(user_id);
CREATE INDEX idx_user_payment_methods_default ON user_payment_methods(user_id, is_default);

CREATE INDEX idx_members_session ON members(session_id);
CREATE INDEX idx_members_user ON members(user_id);
CREATE INDEX idx_members_added_by ON members(added_by_user_id);

CREATE INDEX idx_orders_session ON orders(session_id);
CREATE INDEX idx_orders_created_by ON orders(created_by_user_id);

CREATE INDEX idx_order_payers_order ON order_payers(order_id);
CREATE INDEX idx_order_payers_member ON order_payers(member_id);

CREATE INDEX idx_order_consumers_order ON order_consumers(order_id);
CREATE INDEX idx_order_consumers_member ON order_consumers(member_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_payment_methods_updated_at BEFORE UPDATE ON user_payment_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_payers ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_consumers ENABLE ROW LEVEL SECURITY;

-- Sessions policies
CREATE POLICY "Users can view sessions they created or are members of" ON sessions
    FOR SELECT USING (
        creator_id = auth.uid() OR 
        id IN (SELECT session_id FROM members WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can create sessions" ON sessions
    FOR INSERT WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Session creators can update their sessions" ON sessions
    FOR UPDATE USING (creator_id = auth.uid());

CREATE POLICY "Session creators can delete their sessions" ON sessions
    FOR DELETE USING (creator_id = auth.uid());

-- User payment methods policies
CREATE POLICY "Users can manage their own payment methods" ON user_payment_methods
    FOR ALL USING (user_id = auth.uid());

-- Members policies
CREATE POLICY "Users can view members of sessions they created or are explicitly part of" ON members
    FOR SELECT USING (
        user_id = auth.uid() OR
        added_by_user_id = auth.uid() OR
        session_id IN (SELECT id FROM sessions WHERE creator_id = auth.uid())
    );

CREATE POLICY "Users can add members to sessions they created or are part of" ON members
    FOR INSERT WITH CHECK (
        added_by_user_id = auth.uid() AND
        session_id IN (SELECT id FROM sessions WHERE creator_id = auth.uid())
    );

CREATE POLICY "Users can update members they added or in sessions they created" ON members
    FOR UPDATE USING (
        added_by_user_id = auth.uid() OR
        session_id IN (SELECT id FROM sessions WHERE creator_id = auth.uid())
    );

CREATE POLICY "Users can delete members they added or in sessions they created" ON members
    FOR DELETE USING (
        added_by_user_id = auth.uid() OR
        session_id IN (SELECT id FROM sessions WHERE creator_id = auth.uid())
    );

-- Orders policies
CREATE POLICY "Users can view orders in sessions they're part of" ON orders
    FOR SELECT USING (
        session_id IN (
            SELECT id FROM sessions WHERE 
            creator_id = auth.uid() OR 
            id IN (SELECT session_id FROM members WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Users can create orders in sessions they're part of" ON orders
    FOR INSERT WITH CHECK (
        created_by_user_id = auth.uid() AND
        session_id IN (
            SELECT id FROM sessions WHERE 
            creator_id = auth.uid() OR 
            id IN (SELECT session_id FROM members WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Users can update orders they created" ON orders
    FOR UPDATE USING (created_by_user_id = auth.uid());

CREATE POLICY "Users can delete orders they created" ON orders
    FOR DELETE USING (created_by_user_id = auth.uid());

-- Order payers policies
CREATE POLICY "Users can view order payers in sessions they're part of" ON order_payers
    FOR SELECT USING (
        order_id IN (
            SELECT id FROM orders WHERE session_id IN (
                SELECT id FROM sessions WHERE 
                creator_id = auth.uid() OR 
                id IN (SELECT session_id FROM members WHERE user_id = auth.uid())
            )
        )
    );

CREATE POLICY "Users can manage order payers for orders in their sessions" ON order_payers
    FOR ALL USING (
        order_id IN (
            SELECT id FROM orders WHERE session_id IN (
                SELECT id FROM sessions WHERE 
                creator_id = auth.uid() OR 
                id IN (SELECT session_id FROM members WHERE user_id = auth.uid())
            )
        )
    );

-- Order consumers policies
CREATE POLICY "Users can view order consumers in sessions they're part of" ON order_consumers
    FOR SELECT USING (
        order_id IN (
            SELECT id FROM orders WHERE session_id IN (
                SELECT id FROM sessions WHERE 
                creator_id = auth.uid() OR 
                id IN (SELECT session_id FROM members WHERE user_id = auth.uid())
            )
        )
    );

CREATE POLICY "Users can manage order consumers for orders in their sessions" ON order_consumers
    FOR ALL USING (
        order_id IN (
            SELECT id FROM orders WHERE session_id IN (
                SELECT id FROM sessions WHERE 
                creator_id = auth.uid() OR 
                id IN (SELECT session_id FROM members WHERE user_id = auth.uid())
            )
        )
    );

-- Create a view for easy session access with member count
CREATE VIEW session_with_stats AS
SELECT 
    s.*,
    COUNT(DISTINCT m.id) as member_count,
    COUNT(DISTINCT o.id) as order_count,
    COALESCE(SUM(o.total_amount), 0) as total_amount
FROM sessions s
LEFT JOIN members m ON s.id = m.session_id
LEFT JOIN orders o ON s.id = o.session_id
GROUP BY s.id, s.name, s.creator_id, s.qr_code_token, s.is_active, s.created_at, s.updated_at;

-- Create a function to join session by QR code
CREATE OR REPLACE FUNCTION join_session_by_qr(qr_token TEXT, member_name TEXT)
RETURNS UUID AS $$
DECLARE
    session_uuid UUID;
    member_uuid UUID;
BEGIN
    -- Find the session by QR token
    SELECT id INTO session_uuid FROM sessions WHERE qr_code_token = qr_token AND is_active = true;
    
    IF session_uuid IS NULL THEN
        RAISE EXCEPTION 'Invalid or inactive session QR code';
    END IF;
    
    -- Check if user is already a member
    SELECT id INTO member_uuid FROM members 
    WHERE session_id = session_uuid AND user_id = auth.uid();
    
    IF member_uuid IS NOT NULL THEN
        RETURN member_uuid;
    END IF;
    
    -- Add user as a member
    INSERT INTO members (session_id, user_id, name, added_by_user_id)
    VALUES (session_uuid, auth.uid(), member_name, auth.uid())
    RETURNING id INTO member_uuid;
    
    RETURN member_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to calculate member balances
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
            payer_member.name as payer_name,
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

-- Insert some sample payment method types for reference
COMMENT ON TYPE payment_method_type IS 'Supported payment methods: qr_code, cash, bank_transfer, gcash, paymaya, other';

-- Add helpful comments
COMMENT ON TABLE sessions IS 'Main sessions where bill splitting happens';
COMMENT ON TABLE members IS 'All participants in a session (both app users and non-users)';
COMMENT ON TABLE orders IS 'Items/orders that need to be split';
COMMENT ON TABLE order_payers IS 'Who initially paid for each order';
COMMENT ON TABLE order_consumers IS 'Who will split the cost of each order';
COMMENT ON COLUMN members.user_id IS 'NULL for non-app users';
COMMENT ON COLUMN order_consumers.split_ratio IS 'Ratio for splitting (1.0 = normal share, 0.5 = half share, 2.0 = double share)'; 
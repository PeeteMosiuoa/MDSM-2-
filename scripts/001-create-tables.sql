-- MDSM (Maseru Digital Securities Market) Database Schema
-- PostgreSQL database: mdsm

-- Drop tables if they exist (in reverse dependency order)
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;
DROP TABLE IF EXISTS trades CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS securities CASCADE;
DROP TABLE IF EXISTS kyc_documents CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop custom types if they exist
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS kyc_status CASCADE;
DROP TYPE IF EXISTS security_status CASCADE;
DROP TYPE IF EXISTS order_type CASCADE;
DROP TYPE IF EXISTS order_status CASCADE;
DROP TYPE IF EXISTS payment_method CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;

-- Create ENUM types
CREATE TYPE user_role AS ENUM ('investor', 'broker', 'issuer', 'regulator', 'admin');
CREATE TYPE kyc_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE security_status AS ENUM ('pending', 'approved', 'rejected', 'listed', 'delisted');
CREATE TYPE order_type AS ENUM ('buy', 'sell');
CREATE TYPE order_status AS ENUM ('pending', 'matched', 'filled', 'partially_filled', 'cancelled');
CREATE TYPE payment_method AS ENUM ('mpesa', 'paypal', 'bank');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed');

-- 1. Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    national_id VARCHAR(50),
    role user_role NOT NULL DEFAULT 'investor',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. KYC Documents table
CREATE TABLE kyc_documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,
    document_number VARCHAR(100) NOT NULL,
    document_url VARCHAR(500),
    status kyc_status NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Securities table
CREATE TABLE securities (
    id SERIAL PRIMARY KEY,
    issuer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    symbol VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    security_type VARCHAR(50) NOT NULL DEFAULT 'equity',
    total_supply DECIMAL(20, 4) NOT NULL,
    available_supply DECIMAL(20, 4) NOT NULL,
    price_per_unit DECIMAL(20, 4) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'LSL',
    status security_status NOT NULL DEFAULT 'pending',
    listing_documents_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Orders table
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    security_id INTEGER NOT NULL REFERENCES securities(id) ON DELETE CASCADE,
    order_type order_type NOT NULL,
    quantity DECIMAL(20, 4) NOT NULL,
    price_per_unit DECIMAL(20, 4) NOT NULL,
    total_amount DECIMAL(20, 4) NOT NULL,
    filled_quantity DECIMAL(20, 4) NOT NULL DEFAULT 0,
    status order_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Trades table
CREATE TABLE trades (
    id SERIAL PRIMARY KEY,
    buy_order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    sell_order_id INTEGER REFERENCES orders(id),
    security_id INTEGER NOT NULL REFERENCES securities(id) ON DELETE CASCADE,
    buyer_id INTEGER NOT NULL REFERENCES users(id),
    seller_id INTEGER REFERENCES users(id),
    quantity DECIMAL(20, 4) NOT NULL,
    price_per_unit DECIMAL(20, 4) NOT NULL,
    total_amount DECIMAL(20, 4) NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Wallets (holdings) table
CREATE TABLE wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    security_id INTEGER NOT NULL REFERENCES securities(id) ON DELETE CASCADE,
    quantity DECIMAL(20, 4) NOT NULL DEFAULT 0,
    average_buy_price DECIMAL(20, 4) NOT NULL DEFAULT 0,
    UNIQUE(user_id, security_id)
);

-- 7. Payments table
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES orders(id),
    amount DECIMAL(20, 4) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'LSL',
    method payment_method NOT NULL,
    status payment_status NOT NULL DEFAULT 'pending',
    reference VARCHAR(255),
    provider_reference VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Audit Logs table
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Alerts table
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    alert_type VARCHAR(50) NOT NULL DEFAULT 'info',
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_kyc_user_id ON kyc_documents(user_id);
CREATE INDEX idx_kyc_status ON kyc_documents(status);
CREATE INDEX idx_securities_issuer ON securities(issuer_id);
CREATE INDEX idx_securities_status ON securities(status);
CREATE INDEX idx_securities_symbol ON securities(symbol);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_security_id ON orders(security_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_trades_buyer ON trades(buyer_id);
CREATE INDEX idx_trades_seller ON trades(seller_id);
CREATE INDEX idx_trades_security ON trades(security_id);
CREATE INDEX idx_trades_executed ON trades(executed_at);
CREATE INDEX idx_wallets_user ON wallets(user_id);
CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
CREATE INDEX idx_alerts_user ON alerts(user_id);
CREATE INDEX idx_alerts_read ON alerts(is_read);

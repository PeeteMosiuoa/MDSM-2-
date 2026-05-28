-- MDSM Seed Data
-- Default admin password: admin123 (bcrypt hash)
-- Default user password: password123 (bcrypt hash)

-- Admin user (password: admin123)
INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_active, is_verified)
VALUES (
    'admin@mdsm.co.ls',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'System',
    'Administrator',
    '+26622000001',
    'admin',
    true,
    true
);

-- Regulator user (password: password123)
INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_active, is_verified)
VALUES (
    'regulator@mdsm.co.ls',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'Central',
    'Regulator',
    '+26622000002',
    'regulator',
    true,
    true
);

-- Sample issuer (password: password123)
INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_active, is_verified)
VALUES (
    'issuer@vodacom.co.ls',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'Vodacom',
    'Lesotho',
    '+26622000003',
    'issuer',
    true,
    true
);

-- Sample broker (password: password123)
INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_active, is_verified)
VALUES (
    'broker@securities.co.ls',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'Lesotho',
    'Securities',
    '+26622000004',
    'broker',
    true,
    true
);

-- Sample investors (password: password123)
INSERT INTO users (email, password_hash, first_name, last_name, phone, national_id, role, is_active, is_verified)
VALUES
    ('thabo@gmail.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Thabo', 'Mokhesi', '+26658001001', 'LS-1234567', 'investor', true, true),
    ('mpho@gmail.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Mpho', 'Letsie', '+26658001002', 'LS-2345678', 'investor', true, true),
    ('lineo@gmail.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Lineo', 'Ramonotsi', '+26658001003', 'LS-3456789', 'investor', true, false);

-- KYC for verified investors
INSERT INTO kyc_documents (user_id, document_type, document_number, status, reviewed_by, reviewed_at)
VALUES
    (5, 'national_id', 'LS-1234567', 'approved', 1, NOW()),
    (6, 'national_id', 'LS-2345678', 'approved', 1, NOW()),
    (7, 'national_id', 'LS-3456789', 'pending', NULL, NULL);

-- Sample securities (all listed)
INSERT INTO securities (issuer_id, name, symbol, description, security_type, total_supply, available_supply, price_per_unit, currency, status)
VALUES
    (3, 'Vodacom Lesotho Shares', 'VCL', 'Vodacom Lesotho telecommunications equity shares', 'equity', 1000000, 750000, 45.50, 'LSL', 'listed'),
    (3, 'Lesotho National Bank Bond', 'LNB', 'Lesotho National Bank corporate bond - 5 year maturity', 'bond', 500000, 400000, 100.00, 'LSL', 'listed'),
    (3, 'Maluti Mountain Fund', 'MMF', 'Diversified investment fund focusing on Lesotho growth sectors', 'fund', 2000000, 1800000, 25.00, 'LSL', 'listed'),
    (3, 'LHDA Infrastructure Token', 'LHDA', 'Lesotho Highlands Development Authority infrastructure token', 'token', 5000000, 4500000, 10.00, 'LSL', 'listed'),
    (3, 'Maseru Tech Ventures', 'MTV', 'Technology venture capital fund token', 'equity', 300000, 300000, 75.00, 'LSL', 'pending');

-- Sample orders
INSERT INTO orders (user_id, security_id, order_type, quantity, price_per_unit, total_amount, filled_quantity, status)
VALUES
    (5, 1, 'buy', 100, 45.50, 4550.00, 100, 'filled'),
    (6, 1, 'buy', 50, 45.50, 2275.00, 50, 'filled'),
    (5, 2, 'buy', 200, 100.00, 20000.00, 200, 'filled'),
    (6, 3, 'buy', 500, 25.00, 12500.00, 500, 'filled'),
    (5, 4, 'buy', 1000, 10.00, 10000.00, 0, 'pending');

-- Sample trades
INSERT INTO trades (buy_order_id, sell_order_id, security_id, buyer_id, seller_id, quantity, price_per_unit, total_amount)
VALUES
    (1, NULL, 1, 5, 3, 100, 45.50, 4550.00),
    (2, NULL, 1, 6, 3, 50, 45.50, 2275.00),
    (3, NULL, 2, 5, 3, 200, 100.00, 20000.00),
    (4, NULL, 3, 6, 3, 500, 25.00, 12500.00);

-- Wallet holdings
INSERT INTO wallets (user_id, security_id, quantity, average_buy_price)
VALUES
    (5, 1, 100, 45.50),
    (6, 1, 50, 45.50),
    (5, 2, 200, 100.00),
    (6, 3, 500, 25.00);

-- Sample payments
INSERT INTO payments (user_id, order_id, amount, currency, method, status, reference)
VALUES
    (5, 1, 4550.00, 'LSL', 'mpesa', 'completed', 'MPESA-TXN-001'),
    (6, 2, 2275.00, 'LSL', 'bank', 'completed', 'BANK-TXN-001'),
    (5, 3, 20000.00, 'LSL', 'paypal', 'completed', 'PAYPAL-TXN-001'),
    (6, 4, 12500.00, 'LSL', 'mpesa', 'completed', 'MPESA-TXN-002');

-- Audit logs
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
VALUES
    (1, 'SYSTEM_INIT', 'system', NULL, '{"message": "MDSM system initialized"}'),
    (1, 'USER_CREATED', 'user', 5, '{"email": "thabo@gmail.com", "role": "investor"}'),
    (1, 'KYC_APPROVED', 'kyc', 1, '{"user_id": 5, "document_type": "national_id"}'),
    (1, 'SECURITY_LISTED', 'security', 1, '{"symbol": "VCL", "name": "Vodacom Lesotho Shares"}'),
    (5, 'ORDER_PLACED', 'order', 1, '{"type": "buy", "security": "VCL", "quantity": 100}'),
    (5, 'TRADE_EXECUTED', 'trade', 1, '{"security": "VCL", "quantity": 100, "price": 45.50}');

-- Sample alerts
INSERT INTO alerts (user_id, title, message, alert_type, is_read)
VALUES
    (5, 'Welcome to MDSM', 'Welcome to the Maseru Digital Securities Market. Your account has been verified.', 'info', true),
    (5, 'Order Filled', 'Your buy order for 100 VCL shares has been filled at M45.50 per unit.', 'success', true),
    (5, 'New Listing', 'A new security LHDA has been listed on the market.', 'info', false),
    (6, 'Welcome to MDSM', 'Welcome to the Maseru Digital Securities Market. Your account has been verified.', 'info', true),
    (6, 'Order Filled', 'Your buy order for 500 MMF units has been filled at M25.00 per unit.', 'success', false),
    (7, 'KYC Pending', 'Your KYC documents are being reviewed. You will be notified once approved.', 'warning', false);

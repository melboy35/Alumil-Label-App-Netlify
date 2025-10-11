-- Azure SQL Database Schema for Alumil Inventory System
-- This script creates all necessary tables for the inventory management system

-- Create Users table for authentication and role management
CREATE TABLE users (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    email NVARCHAR(255) NOT NULL UNIQUE,
    full_name NVARCHAR(255),
    role NVARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    azure_ad_object_id NVARCHAR(255) UNIQUE,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    last_login DATETIME2,
    is_active BIT DEFAULT 1
);

-- Create index on email for faster lookups
CREATE INDEX IX_users_email ON users(email);
CREATE INDEX IX_users_azure_ad_object_id ON users(azure_ad_object_id);

-- Create Inventory Profiles table
CREATE TABLE inventory_profiles (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    code NVARCHAR(100) NOT NULL UNIQUE,
    description NVARCHAR(500),
    length FLOAT,
    color NVARCHAR(100),
    alloy NVARCHAR(100),
    system NVARCHAR(100),
    warehouse_no NVARCHAR(50),
    rack_no NVARCHAR(50),
    quantity INT DEFAULT 0,
    unit NVARCHAR(20) DEFAULT 'pcs',
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    created_by UNIQUEIDENTIFIER FOREIGN KEY REFERENCES users(id),
    updated_by UNIQUEIDENTIFIER FOREIGN KEY REFERENCES users(id)
);

-- Create indexes for better query performance
CREATE INDEX IX_inventory_profiles_code ON inventory_profiles(code);
CREATE INDEX IX_inventory_profiles_warehouse_rack ON inventory_profiles(warehouse_no, rack_no);
CREATE INDEX IX_inventory_profiles_system ON inventory_profiles(system);

-- Create Inventory Accessories table
CREATE TABLE inventory_accessories (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    code NVARCHAR(100) NOT NULL UNIQUE,
    description NVARCHAR(500),
    unit NVARCHAR(20) DEFAULT 'pcs',
    category NVARCHAR(100),
    warehouse_no NVARCHAR(50),
    rack_no NVARCHAR(50),
    quantity INT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    created_by UNIQUEIDENTIFIER FOREIGN KEY REFERENCES users(id),
    updated_by UNIQUEIDENTIFIER FOREIGN KEY REFERENCES users(id)
);

-- Create indexes for accessories
CREATE INDEX IX_inventory_accessories_code ON inventory_accessories(code);
CREATE INDEX IX_inventory_accessories_category ON inventory_accessories(category);
CREATE INDEX IX_inventory_accessories_warehouse_rack ON inventory_accessories(warehouse_no, rack_no);

-- Create Print Logs table for tracking print activities
CREATE TABLE print_logs (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES users(id),
    item_type NVARCHAR(20) NOT NULL CHECK (item_type IN ('profile', 'accessory')),
    item_code NVARCHAR(100) NOT NULL,
    item_description NVARCHAR(500),
    quantity_printed INT DEFAULT 1,
    warehouse_no NVARCHAR(50),
    rack_no NVARCHAR(50),
    label_type NVARCHAR(50), -- 'profile', 'accessory', 'rack'
    print_timestamp DATETIME2 DEFAULT GETDATE(),
    session_id NVARCHAR(100), -- To group multiple prints in same session
    notes NVARCHAR(1000)
);

-- Create indexes for print logs
CREATE INDEX IX_print_logs_user_id ON print_logs(user_id);
CREATE INDEX IX_print_logs_item_code ON print_logs(item_code);
CREATE INDEX IX_print_logs_timestamp ON print_logs(print_timestamp);
CREATE INDEX IX_print_logs_session_id ON print_logs(session_id);

-- Create Upload History table for tracking file uploads
CREATE TABLE upload_history (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    uploaded_by UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES users(id),
    file_name NVARCHAR(255) NOT NULL,
    file_size BIGINT,
    blob_name NVARCHAR(255), -- Azure Blob Storage reference
    source_type NVARCHAR(50) CHECK (source_type IN ('direct_upload', 'sharepoint_graph', 'blob_link')),
    profiles_count INT DEFAULT 0,
    accessories_count INT DEFAULT 0,
    upload_status NVARCHAR(20) DEFAULT 'processing' CHECK (upload_status IN ('processing', 'completed', 'failed')),
    upload_timestamp DATETIME2 DEFAULT GETDATE(),
    processing_completed_at DATETIME2,
    error_message NVARCHAR(1000),
    notes NVARCHAR(1000)
);

-- Create indexes for upload history
CREATE INDEX IX_upload_history_uploaded_by ON upload_history(uploaded_by);
CREATE INDEX IX_upload_history_timestamp ON upload_history(upload_timestamp);
CREATE INDEX IX_upload_history_status ON upload_history(upload_status);

-- Create System Settings table for application configuration
CREATE TABLE system_settings (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    setting_key NVARCHAR(100) NOT NULL UNIQUE,
    setting_value NVARCHAR(MAX),
    setting_type NVARCHAR(50) DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
    description NVARCHAR(500),
    is_public BIT DEFAULT 0, -- Whether setting can be read by non-admin users
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    updated_by UNIQUEIDENTIFIER FOREIGN KEY REFERENCES users(id)
);

-- Create index on setting key
CREATE INDEX IX_system_settings_key ON system_settings(setting_key);

-- Create Warehouses table for better data organization
CREATE TABLE warehouses (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    code NVARCHAR(50) NOT NULL UNIQUE,
    name NVARCHAR(255) NOT NULL,
    location NVARCHAR(255),
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);

-- Create Racks table
CREATE TABLE racks (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    warehouse_id UNIQUEIDENTIFIER NOT NULL FOREIGN KEY REFERENCES warehouses(id),
    code NVARCHAR(50) NOT NULL,
    description NVARCHAR(255),
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    UNIQUE(warehouse_id, code)
);

-- Create indexes for warehouses and racks
CREATE INDEX IX_racks_warehouse_id ON racks(warehouse_id);

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public) VALUES
('app_name', 'Alumil Inventory System', 'string', 'Application name', 1),
('app_version', '2.0.0', 'string', 'Application version', 1),
('max_file_size_mb', '50', 'number', 'Maximum file upload size in MB', 0),
('auto_refresh_interval', '30', 'number', 'Auto refresh interval in seconds', 1),
('enable_real_time_updates', 'true', 'boolean', 'Enable real-time updates via SignalR', 1),
('default_warehouse', 'WH001', 'string', 'Default warehouse code', 1);

-- Insert default admin user (will be updated with actual Azure AD info)
INSERT INTO users (email, full_name, role, is_active) VALUES
('admin@alumil.com', 'System Administrator', 'admin', 1);

-- Insert sample warehouses
INSERT INTO warehouses (code, name, location) VALUES
('WH001', 'Main Warehouse', 'Dubai Main Facility'),
('WH002', 'Secondary Warehouse', 'Dubai Secondary Facility'),
('WH003', 'Storage Warehouse', 'Dubai Storage Facility');

-- Insert sample racks for main warehouse
INSERT INTO racks (warehouse_id, code, description) VALUES
((SELECT id FROM warehouses WHERE code = 'WH001'), 'R001', 'Rack 001 - Profiles Section A'),
((SELECT id FROM warehouses WHERE code = 'WH001'), 'R002', 'Rack 002 - Profiles Section B'),
((SELECT id FROM warehouses WHERE code = 'WH001'), 'R003', 'Rack 003 - Accessories Section'),
((SELECT id FROM warehouses WHERE code = 'WH001'), 'R004', 'Rack 004 - Mixed Items');

-- Create views for easier data access

-- View for inventory summary
CREATE VIEW vw_inventory_summary AS
SELECT 
    'profile' as item_type,
    code,
    description,
    warehouse_no,
    rack_no,
    quantity,
    unit,
    updated_at
FROM inventory_profiles
WHERE quantity > 0
UNION ALL
SELECT 
    'accessory' as item_type,
    code,
    description,
    warehouse_no,
    rack_no,
    quantity,
    unit,
    updated_at
FROM inventory_accessories
WHERE quantity > 0;

-- View for print activity summary
CREATE VIEW vw_print_activity AS
SELECT 
    u.full_name as user_name,
    u.email as user_email,
    pl.item_type,
    pl.item_code,
    pl.item_description,
    pl.quantity_printed,
    pl.warehouse_no,
    pl.rack_no,
    pl.label_type,
    pl.print_timestamp,
    pl.session_id
FROM print_logs pl
JOIN users u ON pl.user_id = u.id
WHERE u.is_active = 1;

-- Create stored procedures for common operations

-- Procedure to log print activity
CREATE PROCEDURE sp_log_print_activity
    @user_id UNIQUEIDENTIFIER,
    @item_type NVARCHAR(20),
    @item_code NVARCHAR(100),
    @item_description NVARCHAR(500) = NULL,
    @quantity_printed INT = 1,
    @warehouse_no NVARCHAR(50) = NULL,
    @rack_no NVARCHAR(50) = NULL,
    @label_type NVARCHAR(50) = NULL,
    @session_id NVARCHAR(100) = NULL,
    @notes NVARCHAR(1000) = NULL
AS
BEGIN
    INSERT INTO print_logs (
        user_id, item_type, item_code, item_description, 
        quantity_printed, warehouse_no, rack_no, label_type, 
        session_id, notes
    )
    VALUES (
        @user_id, @item_type, @item_code, @item_description,
        @quantity_printed, @warehouse_no, @rack_no, @label_type,
        @session_id, @notes
    );
END;

-- Procedure to get user by Azure AD object ID
CREATE PROCEDURE sp_get_user_by_azure_ad_id
    @azure_ad_object_id NVARCHAR(255)
AS
BEGIN
    SELECT 
        id, email, full_name, role, azure_ad_object_id,
        created_at, updated_at, last_login, is_active
    FROM users 
    WHERE azure_ad_object_id = @azure_ad_object_id 
    AND is_active = 1;
END;

-- Procedure to update user last login
CREATE PROCEDURE sp_update_user_last_login
    @user_id UNIQUEIDENTIFIER
AS
BEGIN
    UPDATE users 
    SET last_login = GETDATE(), updated_at = GETDATE()
    WHERE id = @user_id;
END;

-- Create triggers for automatic timestamp updates

-- Trigger for users table
CREATE TRIGGER tr_users_update_timestamp
ON users
AFTER UPDATE
AS
BEGIN
    UPDATE users
    SET updated_at = GETDATE()
    FROM users u
    INNER JOIN inserted i ON u.id = i.id;
END;

-- Trigger for inventory_profiles table
CREATE TRIGGER tr_inventory_profiles_update_timestamp
ON inventory_profiles
AFTER UPDATE
AS
BEGIN
    UPDATE inventory_profiles
    SET updated_at = GETDATE()
    FROM inventory_profiles ip
    INNER JOIN inserted i ON ip.id = i.id;
END;

-- Trigger for inventory_accessories table
CREATE TRIGGER tr_inventory_accessories_update_timestamp
ON inventory_accessories
AFTER UPDATE
AS
BEGIN
    UPDATE inventory_accessories
    SET updated_at = GETDATE()
    FROM inventory_accessories ia
    INNER JOIN inserted i ON ia.id = i.id;
END;
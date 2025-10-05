-- Alumil Inventory System Database Schema
-- This schema supports multi-tenant data with organization-based isolation

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table for user management
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default organization
INSERT INTO organizations (id, name) 
VALUES ('00000000-0000-0000-0000-000000000000', 'Default Organization')
ON CONFLICT (id) DO NOTHING;

-- Create profiles data table for aluminum profiles
CREATE TABLE IF NOT EXISTS inventory_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  code TEXT NOT NULL,
  description TEXT,
  length NUMERIC,
  color TEXT,
  alloy TEXT,
  system TEXT,
  warehouse_no TEXT,
  rack_no TEXT,
  quantity INTEGER DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  additional_data JSONB DEFAULT '{}', -- Store additional Excel columns
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, code)
);

-- Create accessories data table
CREATE TABLE IF NOT EXISTS inventory_accessories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  code TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  category TEXT,
  warehouse_no TEXT,
  rack_no TEXT,
  quantity INTEGER DEFAULT 0,
  additional_data JSONB DEFAULT '{}', -- Store additional Excel columns
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, code)
);

-- Create data upload history table
CREATE TABLE IF NOT EXISTS data_uploads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  profiles_count INTEGER DEFAULT 0,
  accessories_count INTEGER DEFAULT 0,
  upload_status TEXT DEFAULT 'completed',
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_accessories ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_uploads ENABLE ROW LEVEL SECURITY;

-- Profiles table policies
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Inventory profiles policies - all authenticated users can read
CREATE POLICY "Anyone can view inventory profiles" ON inventory_profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can insert profiles" ON inventory_profiles
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Only admins can update profiles" ON inventory_profiles
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Only admins can delete profiles" ON inventory_profiles
  FOR DELETE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Inventory accessories policies - all authenticated users can read
CREATE POLICY "Anyone can view inventory accessories" ON inventory_accessories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can insert accessories" ON inventory_accessories
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Only admins can update accessories" ON inventory_accessories
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Only admins can delete accessories" ON inventory_accessories
  FOR DELETE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Data uploads policies
CREATE POLICY "Anyone can view upload history" ON data_uploads
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can insert upload records" ON data_uploads
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_profiles_org_code ON inventory_profiles(organization_id, code);
CREATE INDEX IF NOT EXISTS idx_inventory_profiles_description ON inventory_profiles USING gin(to_tsvector('english', description));
CREATE INDEX IF NOT EXISTS idx_inventory_profiles_additional_data ON inventory_profiles USING gin(additional_data);
CREATE INDEX IF NOT EXISTS idx_inventory_accessories_org_code ON inventory_accessories(organization_id, code);
CREATE INDEX IF NOT EXISTS idx_inventory_accessories_description ON inventory_accessories USING gin(to_tsvector('english', description));
CREATE INDEX IF NOT EXISTS idx_inventory_accessories_additional_data ON inventory_accessories USING gin(additional_data);
CREATE INDEX IF NOT EXISTS idx_data_uploads_org_date ON data_uploads(organization_id, upload_date DESC);

-- Functions for data management

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, is_admin)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    false
  );
  RETURN new;
END;
$$ language plpgsql security definer;

-- Trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_inventory_profiles_updated_at BEFORE UPDATE ON inventory_profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_inventory_accessories_updated_at BEFORE UPDATE ON inventory_accessories FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
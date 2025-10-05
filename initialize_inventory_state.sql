-- Initialize inventory_state with the existing uploaded file
-- Replace '00000000-0000-0000-0000-000000000000' with your actual organization ID if different

INSERT INTO public.inventory_state (
  organization_id, 
  storage_path, 
  version, 
  updated_at
) 
VALUES (
  '00000000-0000-0000-0000-000000000000', -- Default organization ID
  'inventory/Inventory Data (masterfile) 30-09-25.xlsx', -- Path to your uploaded file
  1, -- Initial version
  now() -- Current timestamp
)
ON CONFLICT (organization_id) 
DO UPDATE SET 
  storage_path = EXCLUDED.storage_path,
  version = public.inventory_state.version + 1,
  updated_at = now();
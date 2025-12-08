
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view profiles in their company" ON public.profiles;

-- Create fixed policy using security definer function
CREATE POLICY "Users can view profiles in their company" 
ON public.profiles FOR SELECT
USING (
  id = auth.uid() 
  OR company_id = public.get_user_company_id(auth.uid())
);

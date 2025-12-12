-- Allow admins to view roles for users in their company
CREATE POLICY "Admins can view company user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT id FROM public.profiles 
    WHERE company_id = get_user_company_id(auth.uid())
  )
);

-- Allow admins to update roles for users in their company
CREATE POLICY "Admins can update company user roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin') AND
  user_id IN (
    SELECT id FROM public.profiles 
    WHERE company_id = get_user_company_id(auth.uid())
  )
);
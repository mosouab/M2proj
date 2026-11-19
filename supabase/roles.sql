-- Run AFTER creating the two accounts in Authentication → Users.
-- If you used other addresses than the defaults, change them here AND in .env / repo variables.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('m2proj_role', case email
       when 'team@m2proj.invalid' then 'team'
       when 'admin@m2proj.invalid' then 'admin'
     end)
where email in ('team@m2proj.invalid', 'admin@m2proj.invalid');

select email, raw_app_meta_data ->> 'm2proj_role' as role from auth.users order by email;

drop policy if exists "performance items managers write" on public.contract_performance_items;

create policy "performance items managers create"
  on public.contract_performance_items for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.active
        and p.role = any (array['admin'::text, 'management'::text, 'supervisor'::text])
    )
  );

create policy "performance items managers update"
  on public.contract_performance_items for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.active
        and p.role = any (array['admin'::text, 'management'::text, 'supervisor'::text])
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.active
        and p.role = any (array['admin'::text, 'management'::text, 'supervisor'::text])
    )
  );

create policy "performance items managers delete"
  on public.contract_performance_items for delete to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.active
        and p.role = any (array['admin'::text, 'management'::text, 'supervisor'::text])
    )
  );

drop policy if exists "report schedules managers write" on public.report_schedules;

create policy "report schedules managers create"
  on public.report_schedules for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.active
        and p.role = any (array['admin'::text, 'management'::text, 'supervisor'::text])
    )
  );

create policy "report schedules managers update"
  on public.report_schedules for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.active
        and p.role = any (array['admin'::text, 'management'::text, 'supervisor'::text])
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.active
        and p.role = any (array['admin'::text, 'management'::text, 'supervisor'::text])
    )
  );

create policy "report schedules managers delete"
  on public.report_schedules for delete to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.active
        and p.role = any (array['admin'::text, 'management'::text, 'supervisor'::text])
    )
  );

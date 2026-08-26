revoke all on function public.import_historical_data(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.import_historical_data(text, text, jsonb) to service_role;

create index if not exists contracts_contractor_id_idx on public.contracts (contractor_id);
create index if not exists contracts_created_by_idx on public.contracts (created_by);
create index if not exists contracts_manager_id_idx on public.contracts (contract_manager_id);

create index if not exists services_created_by_idx on public.services (created_by);
create index if not exists services_responsible_user_idx on public.services (responsible_user_id);

create index if not exists service_records_contract_id_idx on public.service_records (contract_id);
create index if not exists service_records_created_by_idx on public.service_records (created_by);

create index if not exists attachments_incident_idx on public.record_attachments (incident_id);
create index if not exists attachments_corrective_action_idx on public.record_attachments (corrective_action_id);
create index if not exists attachments_contract_idx on public.record_attachments (contract_id);
create index if not exists attachments_uploaded_by_idx on public.record_attachments (uploaded_by);

create index if not exists evaluations_service_idx on public.contract_performance_evaluations (service_id);
create index if not exists evaluations_evaluator_idx on public.contract_performance_evaluations (evaluator_id);
create index if not exists evaluations_approved_by_idx on public.contract_performance_evaluations (approved_by);

create index if not exists report_schedules_service_idx on public.report_schedules (service_id);
create index if not exists report_schedules_contract_idx on public.report_schedules (contract_id);
create index if not exists report_schedules_created_by_idx on public.report_schedules (created_by);

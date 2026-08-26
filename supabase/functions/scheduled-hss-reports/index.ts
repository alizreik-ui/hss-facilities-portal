import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.56.0";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

type Schedule = {
  id: string;
  name: string;
  report_type: string;
  service_id: string | null;
  contract_id: string | null;
  frequency: "daily" | "weekly" | "monthly";
  recipients: string[];
  output_format: "pdf" | "xls" | "xlsx" | "csv";
  filters: Record<string, string> | null;
  next_run_at: string | null;
  services?: { name_en?: string; name_ar?: string } | null;
  contracts?: { contract_no?: string; title?: string } | null;
};

type ServiceRecord = {
  record_no: string;
  record_type: string;
  title: string;
  building: string | null;
  location: string | null;
  status: string;
  priority: string;
  planned_at: string | null;
  due_at: string | null;
  completed_at: string | null;
  planned_quantity: number | string;
  actual_quantity: number | string;
};

const jsonHeaders = { "Content-Type": "application/json", "Connection": "keep-alive" };
const completedStatuses = new Set(["completed", "completed_late", "verified", "closed"]);

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function reportWindow(schedule: Schedule, now: Date) {
  const end = schedule.next_run_at ? new Date(schedule.next_run_at) : new Date(now);
  const start = new Date(end);
  if (schedule.frequency === "daily") start.setUTCDate(start.getUTCDate() - 1);
  if (schedule.frequency === "weekly") start.setUTCDate(start.getUTCDate() - 7);
  if (schedule.frequency === "monthly") start.setUTCMonth(start.getUTCMonth() - 1);
  return { start, end };
}

function nextRun(schedule: Schedule, now: Date) {
  const next = schedule.next_run_at ? new Date(schedule.next_run_at) : new Date(now);
  do {
    if (schedule.frequency === "daily") next.setUTCDate(next.getUTCDate() + 1);
    if (schedule.frequency === "weekly") next.setUTCDate(next.getUTCDate() + 7);
    if (schedule.frequency === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
  } while (next <= now);
  return next.toISOString();
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function makeCsv(records: ServiceRecord[]) {
  const headings = ["Record", "Type", "Title", "Building", "Location", "Status", "Priority", "Planned", "Actual", "Planned at", "Due at", "Completed at"];
  const rows = records.map((r) => [r.record_no, r.record_type, r.title, r.building, r.location, r.status, r.priority, r.planned_quantity, r.actual_quantity, r.planned_at, r.due_at, r.completed_at]);
  return [headings, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 0x8000, bytes.length)));
  }
  return btoa(binary);
}

function textToBase64(value: string) {
  return bytesToBase64(new TextEncoder().encode(value));
}

async function makePdf(title: string, lines: string[]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  let y = 800;
  page.drawText(title.replace(/[^\x20-\x7E]/g, ""), { x: 42, y, size: 16, font: bold, color: rgb(0.05, 0.24, 0.25) });
  y -= 30;
  for (const rawLine of lines) {
    const line = rawLine.replace(/[^\x20-\x7E]/g, "").slice(0, 105);
    if (y < 45) {
      page = pdf.addPage([595, 842]);
      y = 800;
    }
    page.drawText(line, { x: 42, y, size: 9, font, color: rgb(0.1, 0.14, 0.16) });
    y -= 14;
  }
  return await pdf.save();
}

function excelHtml(title: string, records: ServiceRecord[]) {
  const headers = ["Record", "Type", "Title", "Building", "Location", "Status", "Priority", "Planned", "Actual", "Planned at", "Due at", "Completed at"];
  const rows = records.map((r) => [r.record_no, r.record_type, r.title, r.building, r.location, r.status, r.priority, r.planned_quantity, r.actual_quantity, r.planned_at, r.due_at, r.completed_at]);
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><h1>${escapeHtml(title)}</h1><table border="1"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("HSS_REPORT_FROM_EMAIL") || "HSS Portal <onboarding@resend.dev>";
  if (!supabaseUrl || !serviceRoleKey) return new Response(JSON.stringify({ error: "Supabase runtime configuration is unavailable" }), { status: 503, headers: jsonHeaders });
  if (!resendKey) return new Response(JSON.stringify({ error: "RESEND_API_KEY is not configured", processed: 0 }), { status: 503, headers: jsonHeaders });

  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date();
  const { data: schedules, error: scheduleError } = await db
    .from("report_schedules")
    .select("*,services(name_en,name_ar),contracts(contract_no,title)")
    .eq("enabled", true)
    .lte("next_run_at", now.toISOString())
    .order("next_run_at")
    .limit(50);

  if (scheduleError) return new Response(JSON.stringify({ error: scheduleError.message }), { status: 500, headers: jsonHeaders });

  const results: Array<Record<string, unknown>> = [];
  for (const schedule of (schedules || []) as Schedule[]) {
    const { start, end } = reportWindow(schedule, now);
    const { data: existing } = await db
      .from("report_delivery_log")
      .select("id,status")
      .eq("schedule_id", schedule.id)
      .eq("period_start", start.toISOString())
      .eq("period_end", end.toISOString())
      .eq("status", "sent")
      .maybeSingle();
    if (existing) {
      await db.from("report_schedules").update({ next_run_at: nextRun(schedule, now), updated_at: now.toISOString() }).eq("id", schedule.id);
      results.push({ schedule_id: schedule.id, status: "already_sent" });
      continue;
    }

    let query = db
      .from("service_records")
      .select("record_no,record_type,title,building,location,status,priority,planned_at,due_at,completed_at,planned_quantity,actual_quantity")
      .gte("planned_at", start.toISOString())
      .lte("planned_at", end.toISOString())
      .order("planned_at", { ascending: true })
      .limit(1000);
    if (schedule.service_id) query = query.eq("service_id", schedule.service_id);
    if (schedule.contract_id) query = query.eq("contract_id", schedule.contract_id);
    if (schedule.filters?.type) query = query.eq("record_type", schedule.filters.type);
    if (schedule.filters?.status) query = query.eq("status", schedule.filters.status);
    const { data, error: recordError } = await query;
    const records = (data || []) as ServiceRecord[];
    if (recordError) {
      await db.from("report_delivery_log").insert({ schedule_id: schedule.id, period_start: start.toISOString(), period_end: end.toISOString(), recipients: schedule.recipients, status: "failed", error_message: recordError.message });
      results.push({ schedule_id: schedule.id, status: "failed", error: recordError.message });
      continue;
    }

    const planned = records.reduce((sum, row) => sum + Number(row.planned_quantity || 0), 0);
    const actual = records.reduce((sum, row) => sum + Number(row.actual_quantity || 0), 0);
    const completed = records.filter((row) => completedStatuses.has(row.status)).length;
    const overdue = records.filter((row) => row.due_at && !completedStatuses.has(row.status) && new Date(row.due_at) < now).length;
    const completion = planned ? Math.min(100, Math.round((actual / planned) * 1000) / 10) : 0;
    const serviceName = schedule.services?.name_en || schedule.contracts?.title || "All services";
    const title = `${schedule.name} — ${serviceName}`;
    const period = `${isoDate(start)} to ${isoDate(end)}`;
    const summaryLines = [
      `Period: ${period}`,
      `Planned volume: ${planned}`,
      `Actual volume: ${actual}`,
      `Completion: ${completion}%`,
      `Completed records: ${completed}`,
      `Overdue records: ${overdue}`,
      "",
      ...records.map((r) => `${r.record_no} | ${r.record_type} | ${r.title} | ${r.status} | planned ${r.planned_quantity} | actual ${r.actual_quantity}`),
    ];
    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#173438"><div style="max-width:720px;margin:auto"><div style="background:linear-gradient(135deg,#0d5d62,#f27a4a);padding:24px;color:white;border-radius:14px"><h1 style="margin:0">${escapeHtml(schedule.name)}</h1><p style="margin:8px 0 0">${escapeHtml(serviceName)} · ${escapeHtml(period)}</p></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0"><div style="padding:14px;background:#edf8f7;border-radius:10px">Planned<br><strong style="font-size:24px">${planned}</strong></div><div style="padding:14px;background:#fff2ea;border-radius:10px">Actual<br><strong style="font-size:24px">${actual}</strong></div><div style="padding:14px;background:#f1efff;border-radius:10px">Completion<br><strong style="font-size:24px">${completion}%</strong></div></div><p>Completed records: ${completed} · Overdue records: ${overdue}</p><table style="border-collapse:collapse;width:100%"><thead><tr><th style="text-align:left;border-bottom:2px solid #0d5d62;padding:8px">Record</th><th style="text-align:left;border-bottom:2px solid #0d5d62;padding:8px">Activity</th><th style="text-align:left;border-bottom:2px solid #0d5d62;padding:8px">Status</th><th style="text-align:right;border-bottom:2px solid #0d5d62;padding:8px">Actual / Planned</th></tr></thead><tbody>${records.slice(0, 30).map((r) => `<tr><td style="padding:8px;border-bottom:1px solid #dbe7e7">${escapeHtml(r.record_no)}</td><td style="padding:8px;border-bottom:1px solid #dbe7e7">${escapeHtml(r.title)}</td><td style="padding:8px;border-bottom:1px solid #dbe7e7">${escapeHtml(r.status)}</td><td style="padding:8px;border-bottom:1px solid #dbe7e7;text-align:right">${escapeHtml(r.actual_quantity)} / ${escapeHtml(r.planned_quantity)}</td></tr>`).join("")}</tbody></table><p style="color:#678;font-size:12px">Generated automatically by the HSS Centralized Portal.</p></div></body></html>`;

    let attachment: { filename: string; content: string };
    if (schedule.output_format === "pdf") {
      const bytes = await makePdf(title, summaryLines);
      attachment = { filename: `hss-report-${isoDate(end)}.pdf`, content: bytesToBase64(bytes) };
    } else if (schedule.output_format === "xls" || schedule.output_format === "xlsx") {
      attachment = { filename: `hss-report-${isoDate(end)}.xls`, content: textToBase64(excelHtml(title, records)) };
    } else {
      attachment = { filename: `hss-report-${isoDate(end)}.csv`, content: textToBase64(makeCsv(records)) };
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `hss-${schedule.id}-${isoDate(start)}` },
      body: JSON.stringify({ from: fromEmail, to: schedule.recipients, subject: `${schedule.name} | ${period}`, html, attachments: [attachment] }),
    });
    const provider = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = provider?.message || provider?.error || `Resend returned ${response.status}`;
      await db.from("report_delivery_log").insert({ schedule_id: schedule.id, period_start: start.toISOString(), period_end: end.toISOString(), recipients: schedule.recipients, status: "failed", error_message: String(message).slice(0, 1000) });
      results.push({ schedule_id: schedule.id, status: "failed", error: message });
      continue;
    }

    await db.from("report_delivery_log").insert({ schedule_id: schedule.id, period_start: start.toISOString(), period_end: end.toISOString(), recipients: schedule.recipients, status: "sent", provider_message_id: provider.id || null, sent_at: now.toISOString() });
    await db.from("report_schedules").update({ next_run_at: nextRun(schedule, now), updated_at: now.toISOString() }).eq("id", schedule.id);
    results.push({ schedule_id: schedule.id, status: "sent", provider_message_id: provider.id || null });
  }

  return new Response(JSON.stringify({ processed: results.length, results }), { status: 200, headers: jsonHeaders });
});

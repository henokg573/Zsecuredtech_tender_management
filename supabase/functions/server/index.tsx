import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";

const app = new Hono();

app.use("*", logger(console.log));
app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
}));

app.get("/make-server-e7ccbfc7/health", (c) => c.json({ status: "ok" }));

// ─── Admin Supabase client (uses service role, bypasses RLS) ────────────────
function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ─── Verify caller is admin ─────────────────────────────────────────────────
async function verifyAdmin(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const admin = adminClient();
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return null;
  return user;
}

// ─── GET /check-setup ───────────────────────────────────────────────────────
// Public — returns whether any admin accounts exist (used on first load)
app.get("/check-setup", async (c) => {
  try {
    const admin = adminClient();
    const { count } = await admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    return c.json({ needsSetup: (count || 0) === 0, hasAdmins: (count || 0) > 0 });
  } catch (err) {
    // If profiles table doesn't exist yet, needs setup
    return c.json({ needsSetup: true, hasAdmins: false });
  }
});

// ─── POST /setup/create-admin ───────────────────────────────────────────────
// Public — only works when zero admins exist (first-time bootstrap)
app.post("/setup/create-admin", async (c) => {
  const admin = adminClient();
  const { count } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");

  if ((count || 0) > 0) {
    return c.json({ success: false, error: "Admin already exists. Use login." }, 403);
  }

  const { name, email, password, telegram } = await c.req.json();
  if (!name || !email || !password) {
    return c.json({ success: false, error: "Name, email, and password are required." }, 400);
  }

  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) return c.json({ success: false, error: createError.message });

  const initials = name.split(" ").map((n: string) => n[0] || "").join("").slice(0, 2).toUpperCase();
  const { error: profileError } = await admin.from("profiles").insert({
    id: newUser.user.id,
    name,
    email,
    telegram: telegram || "",
    role: "admin",
    initials,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(newUser.user.id);
    return c.json({ success: false, error: profileError.message });
  }

  return c.json({ success: true });
});

// ─── POST /admin/create-user ────────────────────────────────────────────────
// Admin only — creates a new user account without email confirmation
app.post("/admin/create-user", async (c) => {
  const caller = await verifyAdmin(c.req.header("Authorization"));
  if (!caller) return c.json({ success: false, error: "Admin access required." }, 403);

  const { name, email, password, telegram, role } = await c.req.json();
  if (!name || !email || !password) {
    return c.json({ success: false, error: "Name, email, and password are required." }, 400);
  }
  if (!["admin", "manager", "staff"].includes(role)) {
    return c.json({ success: false, error: "Role must be admin, manager, or staff." }, 400);
  }

  const admin = adminClient();

  // Check for existing email
  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) return c.json({ success: false, error: "An account with this email already exists." });

  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) return c.json({ success: false, error: createError.message });

  const initials = name.split(" ").map((n: string) => n[0] || "").join("").slice(0, 2).toUpperCase();
  const { error: profileError } = await admin.from("profiles").insert({
    id: newUser.user.id,
    name,
    email,
    telegram: telegram || "",
    role,
    initials,
    is_active: true,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(newUser.user.id);
    return c.json({ success: false, error: profileError.message });
  }

  return c.json({ success: true, userId: newUser.user.id });
});

// ─── POST /admin/update-user ────────────────────────────────────────────────
app.post("/admin/update-user", async (c) => {
  const caller = await verifyAdmin(c.req.header("Authorization"));
  if (!caller) return c.json({ success: false, error: "Admin access required." }, 403);

  const { userId, updates } = await c.req.json();
  const admin = adminClient();
  const { error } = await admin.from("profiles").update(updates).eq("id", userId);
  if (error) return c.json({ success: false, error: error.message });
  return c.json({ success: true });
});

// ─── DELETE /admin/delete-user/:userId ──────────────────────────────────────
app.delete("/admin/delete-user/:userId", async (c) => {
  const caller = await verifyAdmin(c.req.header("Authorization"));
  if (!caller) return c.json({ success: false, error: "Admin access required." }, 403);

  const userId = c.req.param("userId");
  if (userId === caller.id) return c.json({ success: false, error: "Cannot delete your own account." }, 400);

  const admin = adminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return c.json({ success: false, error: error.message });
  return c.json({ success: true });
});

// ─── POST /send-email ────────────────────────────────────────────────────────
// Authenticated — sends email via Resend API
app.post("/send-email", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return c.json({
      success: false,
      error: "Email not configured. Add RESEND_API_KEY to Supabase Edge Function secrets.",
    }, 503);
  }

  const { to, subject, html, from_email } = await c.req.json();
  const fromAddress = from_email || "ZSecuredTech Bids <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    console.error("Resend error:", result);
    return c.json({ success: false, error: result.message || "Email failed" });
  }
  return c.json({ success: true, messageId: result.id });
});

// ─── POST /cron/send-reminders ─────────────────────────────────────────────
// Admin-only or scheduled job: find tasks due within next 48h (or overdue) and email assignees
app.post("/cron/send-reminders", async (c) => {
  const caller = await verifyAdmin(c.req.header("Authorization"));
  if (!caller) return c.json({ success: false, error: "Admin access required." }, 403);

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) return c.json({ success: false, error: "Email not configured." }, 503);

  const admin = adminClient();
  const now = new Date();
  const in48 = new Date(now.getTime() + 48 * 3600 * 1000);

  const { data: tasks, error } = await admin.from("tasks").select("*").or(`and(due_date.gte.${now.toISOString()},due_date.lte.${in48.toISOString()})`).neq('status','Completed');
  if (error) return c.json({ success: false, error: error.message }, 500);

  const sent: any[] = [];
  for (const t of tasks || []) {
    if (!t.assignedTo) continue;
    const { data: profile } = await admin.from("profiles").select("email,name").eq("id", t.assignedTo).single();
    if (!profile || !profile.email) continue;

    const subject = `Task reminder: ${t.title}`;
    const html = `<p>Hi ${profile.name || ''},</p><p>This is a reminder for the task <b>${t.title}</b> assigned to you. Due date: ${t.due_date || '—'}.</p><p>Status: ${t.status || '—'}. Progress: ${t.progress || 0}%</p><p>Please update the task or submit when complete.</p><p>— ZSecuredTech</p>`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "ZSecuredTech <onboarding@resend.dev>", to: [profile.email], subject, html }),
    });
    const result = await response.json().catch(()=>null);
    sent.push({ taskId: t.id, to: profile.email, ok: response.ok, result });
  }

  return c.json({ success: true, sent });
});

Deno.serve(app.fetch);

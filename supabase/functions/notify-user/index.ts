import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    // Verify the caller is an admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Decode caller from JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!
    ).auth.getUser(token);

    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin
    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: caller.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, user_id, details } = await req.json();

    // Look up recipient email from auth.users
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(user_id);
    if (userError || !userData?.user?.email) {
      console.error("Could not find user email:", userError);
      return new Response(
        JSON.stringify({ error: "User email not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = userData.user.email;
    let subject = "";
    let html = "";

    if (type === "team_change_approved") {
      subject = "Team Change Request Approved";
      html = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #22c55e;">✅ Team Change Approved</h2>
          <p>Your request to change to team <strong>#${details.new_team}</strong> has been approved.</p>
          <p>Your profile has been updated. You can now view data for your new team.</p>
          <hr style="border: none; border-top: 1px solid #333; margin: 24px 0;" />
          <p style="color: #888; font-size: 12px;">2844 × 12841 Scouting App</p>
        </div>
      `;
    } else if (type === "team_change_rejected") {
      subject = "Team Change Request Denied";
      html = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #ef4444;">❌ Team Change Denied</h2>
          <p>Your request to change to team <strong>#${details.new_team}</strong> has been denied.</p>
          <p>If you believe this was a mistake, please contact your team admin.</p>
          <hr style="border: none; border-top: 1px solid #333; margin: 24px 0;" />
          <p style="color: #888; font-size: 12px;">2844 × 12841 Scouting App</p>
        </div>
      `;
    } else if (type === "bug_report") {
      // Look up admin emails to notify
      const { data: adminRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
      const adminEmails: string[] = [];
      if (adminRoles) {
        for (const role of adminRoles) {
          const { data: adminUser } = await supabase.auth.admin.getUserById(role.user_id);
          if (adminUser?.user?.email) adminEmails.push(adminUser.user.email);
        }
      }
      if (adminEmails.length === 0) {
        return new Response(JSON.stringify({ error: "No admin emails found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      subject = "🐛 New Bug Report Submitted";
      html = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #ef4444;">🐛 Bug Report</h2>
          <p><strong>Reporter:</strong> ${details.reporter_name || 'Unknown'}</p>
          <p><strong>Page:</strong> ${details.page_url || '—'}</p>
          <p><strong>Description:</strong></p>
          <blockquote style="background: #f5f5f5; padding: 12px; border-left: 3px solid #ef4444; margin: 8px 0;">${details.description || '—'}</blockquote>
          <p style="color: #888; font-size: 12px;">Submitted at ${new Date().toLocaleString()}</p>
          <hr style="border: none; border-top: 1px solid #333; margin: 24px 0;" />
          <p style="color: #888; font-size: 12px;">2844 × 12841 Scouting App</p>
        </div>
      `;
      // Send to all admins instead of the single user
      const adminRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "2844 × 12841 Scouting App <scouting@vcs-robotics.com>",
          to: adminEmails,
          subject,
          html,
        }),
      });
      const adminData = await adminRes.json();
      if (!adminRes.ok) {
        console.error("Resend error:", JSON.stringify(adminData));
        return new Response(JSON.stringify({ error: "Email send failed", details: adminData }), {
          status: adminRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, id: adminData.id }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      return new Response(
        JSON.stringify({ error: "Unknown notification type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "2844 × 12841 Scouting App <scouting@vcs-robotics.com>",
        to: [email],
        subject,
        html,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("Resend error:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "Email send failed", details: data }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("notify-user error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

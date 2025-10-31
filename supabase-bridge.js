
/*
 * Mentorship.AI — Supabase Bridge (Drop-in)
 * Add this file to your project and include it after you load supabase-js.
 *
 * <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 * <script src="./supabase-bridge.js"></script>
 *
 * Then configure:
 *   window.SUPABASE_URL = "https://YOURPROJECT.supabase.co";
 *   window.SUPABASE_ANON_KEY = "YOUR_ANON_KEY";
 * Call window.supa.init() once at startup.
 * You can continue using your localStorage demo while also writing to Supabase.
 */

(function () {
  const state = {
    client: null,
    url: null,
    anon: null,
  };

  function getClient() {
    if (!state.client) {
      if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
        console.warn("[supa] Missing SUPABASE_URL or SUPABASE_ANON_KEY");
        return null;
      }
      state.url = window.SUPABASE_URL;
      state.anon = window.SUPABASE_ANON_KEY;
      state.client = window.supabase.createClient(state.url, state.anon);
    }
    return state.client;
  }

  async function upsertUser({ email, name, role }) {
    const sb = getClient();
    if (!sb) return { error: "no_client" };
    const { data, error } = await sb
      .from("users")
      .upsert({ email, name, role }, { onConflict: "email" })
      .select()
      .single();
    if (error) console.error("[supa] upsertUser error", error);
    return { data, error };
  }

  async function upsertMentorProfile({
    email,
    timezone,
    availability = [],
    types = [],
    skills = [],
    topics = [],
    bio,
    meeting_link,
    linkedin,
    name, // optional: also ensure user row
  }) {
    const sb = getClient();
    if (!sb) return { error: "no_client" };
    if (name) await upsertUser({ email, name, role: "mentor" });

    const { data, error } = await sb
      .from("mentors")
      .upsert(
        {
          user_email: email,
          timezone,
          availability,
          types,
          skills,
          topics,
          bio,
          meeting_link,
          linkedin,
        },
        { onConflict: "user_email" }
      )
      .select()
      .single();
    if (error) console.error("[supa] upsertMentorProfile error", error);
    return { data, error };
  }

  async function createRequest({
    mentee_email,
    mentor_email,
    mentee_name,
    note,
    interests = [],
  }) {
    const sb = getClient();
    if (!sb) return { error: "no_client" };
    if (mentee_name) await upsertUser({ email: mentee_email, name: mentee_name, role: "mentee" });
    await upsertUser({ email: mentor_email, name: null, role: "mentor" });
    const { data, error } = await sb
      .from("requests")
      .insert({
        mentee_email,
        mentor_email,
        status: "pending",
        note,
        interests,
      })
      .select()
      .single();
    if (error) console.error("[supa] createRequest error", error);
    return { data, error };
  }

  async function fetchMentorInbox(mentor_email) {
    const sb = getClient();
    if (!sb) return { error: "no_client" };
    const { data, error } = await sb
      .from("v_requests_with_names")
      .select("*")
      .eq("mentor_email", mentor_email)
      .order("created_at", { ascending: false });
    if (error) console.error("[supa] fetchMentorInbox error", error);
    return { data, error };
  }

  async function updateRequestStatus(id, status) {
    const sb = getClient();
    if (!sb) return { error: "no_client" };
    const updates = { status };
    if (status === "accepted" || status === "declined") {
      updates.decided_at = new Date().toISOString();
    }
    const { data, error } = await sb
      .from("requests")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) console.error("[supa] updateRequestStatus error", error);
    return { data, error };
  }

  async function listActivePairs(email, role) {
    const sb = getClient();
    if (!sb) return { error: "no_client" };
    let query = sb.from("requests").select("*").eq("status", "accepted");
    if (role === "mentee") query = query.eq("mentee_email", email);
    if (role === "mentor") query = query.eq("mentor_email", email);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) console.error("[supa] listActivePairs error", error);
    return { data, error };
  }

  // Optional: sync goal to Supabase
  async function createGoal({
    mentee_email,
    mentor_email,
    title,
    notes,
    status = "open",
    progress = 0,
    start_date,
    target_date,
  }) {
    const sb = getClient();
    if (!sb) return { error: "no_client" };
    const { data, error } = await sb
      .from("goals")
      .insert({
        mentee_email,
        mentor_email,
        title,
        notes,
        status,
        progress,
        start_date,
        target_date,
      })
      .select()
      .single();
    if (error) console.error("[supa] createGoal error", error);
    return { data, error };
  }

  // Tiny init you can call after setting globals
  function init() {
    if (!getClient()) {
      console.warn("[supa] init: no client");
      return;
    }
    console.log("[supa] Supabase client ready");
  }

  // Expose minimal API
  window.supa = {
    init,
    upsertUser,
    upsertMentorProfile,
    createRequest,
    fetchMentorInbox,
    updateRequestStatus,
    listActivePairs,
    createGoal,
  };
})();

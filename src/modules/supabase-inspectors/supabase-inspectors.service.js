const { z } = require("zod");
const env = require("../../config/env");
const { HttpError } = require("../../shared/http");

const LIST_FIELDS = "id,full_name,email,human_id,phone,status";
const DETAIL_FIELDS = [
  "id",
  "full_name",
  "email",
  "human_id",
  "phone",
  "status",
  "address",
  "street",
  "city",
  "state",
  "zip",
  "county",
  "created_at",
  "must_reset_password",
  "is_contractor",
  "tenant_id",
].join(",");

function assertConfigured() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new HttpError(503, "Supabase is not configured");
  }
}

async function supabaseGet(url, accept) {
  let response;
  try {
    response = await fetch(url, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Accept: accept,
      },
    });
  } catch {
    throw new HttpError(502, "Could not reach Supabase");
  }

  if (response.status === 406) {
    throw new HttpError(404, "Inspector not found");
  }

  if (!response.ok) {
    throw new HttpError(502, "Could not load inspectors");
  }

  return response.json();
}

async function listInspectors() {
  assertConfigured();

  const url = new URL("/rest/v1/profiles", env.SUPABASE_URL);
  url.searchParams.set("role", "eq.inspector");
  url.searchParams.set("select", LIST_FIELDS);
  url.searchParams.set("order", "full_name.asc");

  const inspectors = await supabaseGet(url, "application/json");
  if (!Array.isArray(inspectors)) {
    throw new HttpError(502, "Could not load inspectors");
  }

  return { inspectors };
}

async function getInspector(id) {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) {
    throw new HttpError(404, "Inspector not found");
  }

  assertConfigured();

  const url = new URL("/rest/v1/profiles", env.SUPABASE_URL);
  url.searchParams.set("id", `eq.${parsed.data}`);
  url.searchParams.set("role", "eq.inspector");
  url.searchParams.set("select", DETAIL_FIELDS);

  const inspector = await supabaseGet(url, "application/vnd.pgrst.object+json");
  if (!inspector || Array.isArray(inspector)) {
    throw new HttpError(404, "Inspector not found");
  }

  return { inspector };
}

module.exports = { listInspectors, getInspector };

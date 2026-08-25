import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createSupabaseServerClient, getSupabaseAdminClient } from "@/lib/supabase";
import { isLocalDemoLoginAllowed, resolveRequestHostname } from "@/lib/demo-fixture-access";
import { ensureSupabaseDemoDataForUser, isSupabaseStoreConfigured } from "@/lib/supabase-store";

const DEMO_EMAIL = "demo@manu.local";
const DEMO_PASSWORD = process.env.MANU_DEMO_PASSWORD || "manu-local-demo-password";

export async function POST() {
  const requestHeaders = await headers();
  const hostname = resolveRequestHostname(requestHeaders);
  if (!isLocalDemoLoginAllowed(process.env, hostname)) {
    return NextResponse.json({ error: "demo_login_disabled" }, { status: 403 });
  }
  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: "/dashboard",
    },
  });

  if (isSupabaseStoreConfigured()) {
    const admin = getSupabaseAdminClient();
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient({
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    });

    if (!admin || !supabase) {
      return NextResponse.json({ error: "supabase_not_configured" }, { status: 500 });
    }

    const user = await findOrCreateDemoUser(admin);
    await ensureSupabaseDemoDataForUser(user.id);

    const signIn = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });

    if (signIn.error) {
      return NextResponse.json({ error: signIn.error.message }, { status: 401 });
    }

    return response;
  }

  response.cookies.set("manu_ai_demo_session", "active", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}

async function findOrCreateDemoUser(admin: NonNullable<ReturnType<typeof getSupabaseAdminClient>>) {
  const users = await admin.auth.admin.listUsers();
  if (users.error) {
    throw users.error;
  }

  const existing = users.data.users.find((user) => user.email === DEMO_EMAIL);
  if (existing) {
    const updated = await admin.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
    });
    if (updated.error) {
      throw updated.error;
    }
    return updated.data.user;
  }

  const created = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (created.error) {
    throw created.error;
  }
  return created.data.user;
}

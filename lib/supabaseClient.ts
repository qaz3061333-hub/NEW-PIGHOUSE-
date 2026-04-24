const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabaseEnvWarning =
  "Supabase 尚未設定環境變數，現在使用 mock data。請設定 NEXT_PUBLIC_SUPABASE_URL 與 NEXT_PUBLIC_SUPABASE_ANON_KEY。";

type SupabaseMethod = "GET" | "POST" | "PATCH";

type RequestOptions = {
  table: string;
  method?: SupabaseMethod;
  query?: string;
  body?: unknown;
  prefer?: string;
};

export async function supabaseRequest<T>({ table, method = "GET", query = "", body, prefer }: RequestOptions): Promise<T> {
  if (!isSupabaseConfigured || !supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase is not configured");
  }

  const url = `${supabaseUrl}/rest/v1/${table}${query ? `?${query}` : ""}`;
  const response = await fetch(url, {
    method,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${message}`);
  }

  if (response.status === 204) {
    return [] as T;
  }

  return (await response.json()) as T;
}

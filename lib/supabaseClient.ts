import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabaseEnvWarning =
  "Supabase 尚未設定環境變數，現在使用 mock data。請設定 NEXT_PUBLIC_SUPABASE_URL 與 NEXT_PUBLIC_SUPABASE_ANON_KEY。";

type SupabaseMethod = "GET" | "POST" | "PATCH" | "DELETE";

type RequestOptions = {
  table: string;
  method?: SupabaseMethod;
  query?: string;
  body?: unknown;
  prefer?: string;
};

type SupabaseClientLike = {
  from: (table: string) => any;
};

let client: SupabaseClientLike | null = null;

function getSupabaseClient(): SupabaseClientLike {
  if (!isSupabaseConfigured || !supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase is not configured");
  }

  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }) as SupabaseClientLike;
  }

  return client;
}

export async function supabaseRequest<T>({ table, method = "GET", query = "", body }: RequestOptions): Promise<T> {
  const supabase = getSupabaseClient();
  const params = new URLSearchParams(query);

  if (method === "GET") {
    let builder = supabase.from(table).select(params.get("select") ?? "*");

    const order = params.get("order");
    if (order) {
      const [column, direction] = order.split(".");
      builder = builder.order(column, { ascending: direction !== "desc" });
    }

    const { data, error } = await builder;
    if (error) throw new Error(error.message);
    return (data ?? []) as T;
  }

  if (method === "POST") {
    const { data, error } = await supabase.from(table).insert(body).select();
    if (error) throw new Error(error.message);
    return (data ?? []) as T;
  }

  if (method === "PATCH") {
    let builder = supabase.from(table).update(body);

    params.forEach((value, key) => {
      if (value.startsWith("eq.")) {
        builder = builder.eq(key, decodeURIComponent(value.slice(3)));
      }
    });

    const { data, error } = await builder.select();
    if (error) throw new Error(error.message);
    return (data ?? []) as T;
  }

  if (method === "DELETE") {
    let builder = supabase.from(table).delete();

    params.forEach((value, key) => {
      if (value.startsWith("eq.")) {
        builder = builder.eq(key, decodeURIComponent(value.slice(3)));
      }
    });

    const { data, error } = await builder.select();
    if (error) throw new Error(error.message);
    return (data ?? []) as T;
  }

  throw new Error(`Unsupported method: ${method}`);
}

export async function fetchKnowledgeArticles<T>() {
  return supabaseRequest<T>({ table: "knowledge_articles", query: "select=*&order=updated_at.desc" });
}

export async function insertKnowledgeArticle<T>(payload: unknown) {
  return supabaseRequest<T>({ table: "knowledge_articles", method: "POST", body: payload });
}

export async function updateKnowledgeArticle<T>(id: string, payload: unknown) {
  return supabaseRequest<T>({ table: "knowledge_articles", method: "PATCH", query: `id=eq.${encodeURIComponent(id)}`, body: payload });
}

export async function deleteKnowledgeArticle<T>(id: string) {
  return supabaseRequest<T>({ table: "knowledge_articles", method: "DELETE", query: `id=eq.${encodeURIComponent(id)}` });
}

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Missing Supabase env");

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: buckets, error: listError } = await supabase.storage.listBuckets();
if (listError) throw listError;

const exists = buckets?.some((b) => b.name === "artwork");
if (exists) {
  const { error } = await supabase.storage.updateBucket("artwork", {
    public: false,
  });
  if (error) throw error;
  console.log("bucket artwork exists -> set private");
} else {
  const { error } = await supabase.storage.createBucket("artwork", {
    public: false,
  });
  if (error) throw error;
  console.log("created bucket artwork (private)");
}

const after = await supabase.storage.listBuckets();
console.log("buckets:", after.data?.map((b) => b.name).join(", "));

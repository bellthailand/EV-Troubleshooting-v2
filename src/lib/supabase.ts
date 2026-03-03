import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://gblgzqccqbhpqcfiyhoc.supabase.co";
const supabaseKey = "sb_publishable_goHSzkpI7ciqRgq9vPm0yw_RMjvDVn0";

export const supabase = createClient(supabaseUrl, supabaseKey);
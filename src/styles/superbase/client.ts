import { createClient } from "@supabase/supabase-js";
import { projectUrl, publicAnonKey } from "./info";

export const supabase = createClient(projectUrl, publicAnonKey);
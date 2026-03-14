export interface Client {
  name: string;
  last_run: string | null;
  has_brief: boolean;
  crews_done: {
    branding: boolean;
    social: boolean;
    ads: boolean;
    proposal: boolean;
  };
}

export interface OutputFile {
  name: string;
  path: string;
  size: number;
  modified: string;
  crew: string;
}

export interface KnowledgeFile {
  name: string;
  size: number;
  modified: string;
  tags: string[];
}

export type CrewName = "branding" | "social" | "ads" | "proposal" | "research";

export interface BrandingBrief {
  brand_name: string;
  what_it_is: string;
  category: string;
  subcategory: string;
  location: string;
  target_geo: string;
  customer: string;
  problem_solved: string;
  competitors: string;
  founder_belief: string;
  stage: string;
  never_do: string;
}

export interface SocialBrief {
  brand_name: string;
  category: string;
  location: string;
  customer: string;
  platforms: string;
  competitors: string;
  personality: string;
  tone: string;
  goal: string;
  avoid: string;
  content_inspiration: string;
  visual_inspiration: string;
}

export interface AdsBrief {
  brand_name: string;
  product: string;
  product_url: string;
  what_it_is: string;
  category: string;
  location: string;
  customer: string;
  competitors: string;
  campaign_goal: string;
  budget: string;
  duration: string;
  platforms: string;
  offer: string;
  brand_voice: string;
}

export type AnyBrief = Record<string, string>;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface JobStatus {
  status: "running" | "done" | "error";
  line_count: number;
  output_path: string | null;
}

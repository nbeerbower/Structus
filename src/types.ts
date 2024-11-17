export interface TemplateData {
    topics: Record<string, string[]>
    roles: Record<string, string[]>
    characters: Record<string, string[]>
    concepts: Record<string, string[]>
  }
  
  export interface DPOExample {
    prompt: string
    chosen: string
    rejected: string
  }
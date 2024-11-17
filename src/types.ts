export interface TemplateData {
    topics: Record<string, string[]>
    roles: Record<string, string[]>
    characters: Record<string, string[]>
    concepts: Record<string, string[]>
  }
  
  export interface TaskData {
    writing_tasks: Record<string, string[]>
  }
  
  export interface FormatData {
    case: FormatRule[]
    separators: FormatRule[]
    bullets: FormatRule[]
    highlighting: FormatRule[]
    sections: FormatRule[]
  }
  
  export interface FormatRule {
    description: string
    type: string
    value?: string
    range?: [number, number]
  }
  
  export interface DPOExample {
    prompt: string
    chosen: string
    rejected: string
  }
import { load } from 'js-yaml'
import { readFileSync } from 'fs'
import { join } from 'path'
import { TemplateData, DPOExample } from './types'

export class StructusGenerator {
  private data: TemplateData
  
  constructor(yamlPath: string = 'data/templates.yaml') {
    this.data = load(
      readFileSync(join(__dirname, '..', yamlPath), 'utf8')
    ) as TemplateData
  }

  private getRandom<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)]
  }

  private getFromCategory(category: keyof TemplateData, subcategory?: string): string {
    const categoryData = this.data[category]
    
    if (subcategory) {
      const subcategoryData = categoryData[subcategory]
      if (!subcategoryData) {
        throw new Error(`Subcategory ${subcategory} not found in ${category}`)
      }
      return this.getRandom(subcategoryData)
    }

    // If no subcategory specified, pick from all items
    const allItems = Object.values(categoryData).flat()
    return this.getRandom(allItems)
  }

  private fillTemplate(template: string): string {
    const replacements: Record<string, () => string> = {
      '{topic}': () => this.getFromCategory('topics'),
      '{role}': () => this.getFromCategory('roles'),
      '{character}': () => this.getFromCategory('characters'),
      '{concept}': () => this.getFromCategory('concepts')
    }

    return Object.entries(replacements).reduce(
      (result, [key, getter]) => 
        result.includes(key) ? result.replace(key, getter()) : result,
      template
    )
  }

  generateExample(): DPOExample {
    const baseTask = this.getRandom([
      "Write a limerick about {topic}",
      "Create a job posting for {role}",
      "Write a blog post about {topic}",
      "Explain how {concept} works",
      "Write a story about {character}"
    ])

    const filledTask = this.fillTemplate(baseTask)
    
    // TODO: Add formatting requirements
    const formatReqs = [
      "Use only lowercase letters",
      "Separate sections with ***",
      "Include exactly 3 bullet points"
    ]

    const prompt = `${filledTask}\n\nRequirements:\n${formatReqs.join('\n')}`

    // TODO: Replace with actual LLM calls
    return {
      prompt,
      chosen: "/* Formatted response would go here */",
      rejected: "/* Unformatted response would go here */"
    }
  }

  generateDataset(count: number): DPOExample[] {
    return Array(count)
      .fill(null)
      .map(() => this.generateExample())
  }
}

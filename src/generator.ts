import { load } from 'js-yaml'
import { readFileSync } from 'fs'
import { join } from 'path'
import { TemplateData, TaskData, FormatData, DPOExample, FormatRule } from './types'

export class StructusGenerator {
  private templates: TemplateData
  private tasks: TaskData
  private formatting: FormatData
  
  constructor(
    templatesPath: string = 'data/templates.yaml',
    tasksPath: string = 'data/tasks.yaml',
    formattingPath: string = 'data/formatting.yaml'
  ) {
    try {
      console.log('Loading YAML files from:', join(__dirname, '..'))
      
      this.templates = load(
        readFileSync(join(__dirname, '..', templatesPath), 'utf8')
      ) as TemplateData
      console.log('Loaded templates:', Object.keys(this.templates))

      this.tasks = load(
        readFileSync(join(__dirname, '..', tasksPath), 'utf8')
      ) as TaskData
      console.log('Loaded tasks:', Object.keys(this.tasks))

      this.formatting = load(
        readFileSync(join(__dirname, '..', formattingPath), 'utf8')
      ) as FormatData
      console.log('Loaded formatting:', Object.keys(this.formatting))
    } catch (error) {
      console.error('Error loading YAML files:', error)
      throw error
    }
  }

  private getRandom<T>(array: T[]): T {
    if (!Array.isArray(array) || array.length === 0) {
      throw new Error('Cannot get random element from empty or non-array')
    }
    return array[Math.floor(Math.random() * array.length)]
  }

  private getRandomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  private getFromCategory(category: keyof TemplateData, subcategory?: string): string {
    if (!this.templates[category]) {
      throw new Error(`Category ${category} not found in templates`)
    }

    const categoryData = this.templates[category]
    
    if (subcategory) {
      const subcategoryData = categoryData[subcategory]
      if (!subcategoryData) {
        throw new Error(`Subcategory ${subcategory} not found in ${category}`)
      }
      return this.getRandom(subcategoryData)
    }

    // If no subcategory specified, pick from all items
    const allItems = Object.values(categoryData).flat()
    if (allItems.length === 0) {
      throw new Error(`No items found in category ${category}`)
    }
    return this.getRandom(allItems)
  }

  private getRandomTask(): string {
    if (!this.tasks.writing_tasks) {
      throw new Error('No writing tasks found')
    }

    const categories = Object.keys(this.tasks.writing_tasks)
    const category = this.getRandom(categories)
    const tasks = this.tasks.writing_tasks[category]
    return this.getRandom(tasks)
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

  private getRandomFormatRequirements(): string[] {
    const reqCount = this.getRandomNumber(2, 3)
    const formatTypes = Object.keys(this.formatting)
    const chosen = new Set<string>()
    const requirements: string[] = []

    while (requirements.length < reqCount && chosen.size < formatTypes.length) {
      const formatType = this.getRandom(formatTypes)
      if (!chosen.has(formatType)) {
        chosen.add(formatType)
        const formatRules = this.formatting[formatType as keyof FormatData]
        const rule = this.getRandom(formatRules)
        
        if (rule.range) {
          const n = this.getRandomNumber(...rule.range)
          requirements.push(rule.description.replace('{n}', n.toString()))
        } else {
          requirements.push(rule.description)
        }
      }
    }

    return requirements
  }

  generateExample(): DPOExample {
    try {
      const baseTask = this.getRandomTask()
      console.log('Selected base task:', baseTask)

      const filledTask = this.fillTemplate(baseTask)
      console.log('Filled task:', filledTask)

      const formatReqs = this.getRandomFormatRequirements()
      console.log('Format requirements:', formatReqs)

      const prompt = `${filledTask}\n\nRequirements:\n${formatReqs.join('\n')}`

      return {
        prompt,
        chosen: "/* Formatted response would go here */",
        rejected: "/* Unformatted response would go here */"
      }
    } catch (error) {
      console.error('Error generating example:', error)
      throw error
    }
  }

  generateDataset(count: number): DPOExample[] {
    return Array(count)
      .fill(null)
      .map(() => this.generateExample())
  }
}
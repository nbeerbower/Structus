import OpenAI from 'openai'
import { config } from 'dotenv'
import { load } from 'js-yaml'
import { readFileSync } from 'fs'
import { join } from 'path'
import { TemplateData, TaskData, FormatData, DPOExample, FormatRule } from './types'

// Load environment variables from .env file
config()

interface GenerationConfig {
    model: string
    temperature: number
    max_tokens: number
    chosen_system_prompt: string
    rejected_system_prompt: string
    retries: number
}

interface StructusConfig {
    generation: GenerationConfig
    output: {
        include_metadata: boolean
        save_failed: boolean
    }
}

export class StructusGenerator {
    private openai: OpenAI
    private config: StructusConfig
    private templates: TemplateData
    private tasks: TaskData
    private formatting: FormatData

    constructor(
        templatesPath: string = 'data/templates.yaml',
        tasksPath: string = 'data/tasks.yaml',
        formattingPath: string = 'data/formatting.yaml',
        configPath: string = 'data/config.yaml'
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

            const configData = load(readFileSync(join(__dirname, '..', configPath), 'utf8')) as StructusConfig
            this.config = configData

            this.openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            })
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

    private async generateResponse(
        prompt: string,
        systemPrompt: string
    ): Promise<string> {
        let lastError: Error | null = null

        for (let i = 0; i < this.config.generation.retries; i++) {
            try {
                const response = await this.openai.chat.completions.create({
                    model: this.config.generation.model,
                    temperature: this.config.generation.temperature,
                    max_tokens: this.config.generation.max_tokens,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt }
                    ]
                })

                return response.choices[0].message.content || ''
            } catch (error) {
                console.error(`Generation attempt ${i + 1} failed:`, error)
                lastError = error as Error
                // Wait briefly before retry
                await new Promise(resolve => setTimeout(resolve, 1000))
            }
        }

        throw new Error(`Failed to generate response after ${this.config.generation.retries} attempts: ${lastError?.message}`)
    }

    async generateExample(): Promise<DPOExample> {
        const baseTask = this.getRandomTask()
        const filledTask = this.fillTemplate(baseTask)
        const formatReqs = this.getRandomFormatRequirements()
        const prompt = `${filledTask}\n\nRequirements:\n${formatReqs.join('\n')}`

        // Generate both responses in parallel
        const [chosen, rejected] = await Promise.all([
            this.generateResponse(prompt, this.config.generation.chosen_system_prompt),
            this.generateResponse(prompt, this.config.generation.rejected_system_prompt)
        ])

        const example: DPOExample = {
            prompt,
            chosen,
            rejected,
        }

        if (this.config.output.include_metadata) {
            example.metadata = {
                timestamp: new Date().toISOString(),
                model: this.config.generation.model,
                temperature: this.config.generation.temperature,
                max_tokens: this.config.generation.max_tokens,
                formatRequirements: formatReqs
            }
        }

        return example
    }

    async generateDataset(count: number): Promise<DPOExample[]> {
        const examples: DPOExample[] = []

        for (let i = 0; i < count; i++) {
            try {
                const example = await this.generateExample()
                examples.push(example)
                console.log(`Generated example ${i + 1}/${count}`)
            } catch (error) {
                console.error(`Failed to generate example ${i + 1}:`, error)
                if (this.config.output.save_failed) {
                    // Save failed generation details
                    // Could write to separate file
                    console.warn('Saving failed example details not implemented yet')
                }
            }
        }

        return examples
    }
}
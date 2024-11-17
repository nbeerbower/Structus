// scripts/generate.ts
import { StructusGenerator } from '../src/generator'
import { writeFile } from 'fs/promises'

interface GenerateOptions {
  count: number
  output?: string
}

function parseArgs(): GenerateOptions {
  const args = process.argv.slice(2)
  const options: GenerateOptions = {
    count: 32 // default
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--count':
        options.count = parseInt(args[++i], 10)
        console.log('Setting count to: ', options.count)
        break
      case '--output':
        options.output = args[++i]
        console.log('Setting output to: ', options.output)
        break
      case '--help':
        console.log(`
Usage: npm run generate -- [options]

Options:
 --count <number>    Number of examples to generate (default: 10)
 --output <file>     Output file (default: prints to console)
 --help             Show this help message
       `)
        process.exit(0)
    }
  }

  return options
}

async function main() {
  const options = parseArgs()
  const generator = new StructusGenerator()
  const dataset = await generator.generateDataset(options.count)

  const output = JSON.stringify(dataset, null, 2)

  if (options.output) {
    await writeFile(options.output, output)
    console.log(`Generated ${options.count} examples to ${options.output}`)
  } else {
    console.log(output)
  }
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
#!/usr/bin/env node
// Offline English -> Icelandic pocket phrasebook generator.
// Runs entirely on-device via Tether's QVAC SDK: no API key, no server call,
// your phrase list never leaves this machine.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadModel, unloadModel, translate, BERGAMOT_EN_IS } from '@qvac/sdk'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_PHRASES = path.join(__dirname, '..', 'assets', 'phrases.txt')

async function main() {
  const inputPath = process.argv[2] || DEFAULT_PHRASES
  const outputPath = process.argv[3] || path.join(path.dirname(inputPath), 'phrasebook-is.md')

  const phrases = fs
    .readFileSync(inputPath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  console.log(`▸ Phrases: ${inputPath}${inputPath === DEFAULT_PHRASES ? ' (bundled sample)' : ''} — ${phrases.length} lines`)

  const modelId = await loadModel({
    modelSrc: BERGAMOT_EN_IS,
    modelConfig: { engine: 'Bergamot', from: 'en', to: 'is' },
    onProgress: (p) => {
      const line = `  loading EN -> IS model ${p.percentage.toFixed(0)}%`
      process.stderr.write(process.stderr.isTTY ? `\r${line}` : `${line}\n`)
      if (p.percentage >= 100) process.stderr.write('\n')
    }
  })

  try {
    console.log('▸ Translating on-device...\n')
    const rows = []
    for (const phrase of phrases) {
      const result = translate({ modelId, text: phrase, modelType: 'nmtcpp-translation', stream: false })
      const translated = await result.text
      rows.push({ en: phrase, is: translated })
      console.log(`EN: ${phrase}`)
      console.log(`IS: ${translated}\n`)
    }

    const md = [
      '# English -> Icelandic Pocket Phrasebook',
      '',
      '| English | Íslenska |',
      '| --- | --- |',
      ...rows.map((r) => `| ${r.en} | ${r.is} |`)
    ].join('\n')
    fs.writeFileSync(outputPath, md + '\n')
    console.log(`▸ Saved ${outputPath}`)
  } finally {
    await unloadModel({ modelId })
  }
}

main().catch((error) => {
  console.error('✖ Error:', error)
  process.exit(1)
})

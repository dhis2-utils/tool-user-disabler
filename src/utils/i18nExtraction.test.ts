import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// The DHIS2 translation extractor silently leaves out some i18n.t keys: ones
// with a colon (it reads the colon as a namespace separator) and ones that
// pass a `count` option (it expects plural forms). A left-out key never
// reaches translators, so check every key in src against i18n/en.pot.

const ROOT = join(__dirname, '..', '..')
const KEY_PATTERN =
    /i18n\.t\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*(,\s*\{[^}]*\})?/gu

const unescape = (text: string) => text.replaceAll(/\\(.)/gu, '$1')

const sourceFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) {
            return entry.name === 'locales' ? [] : sourceFiles(path)
        }
        return /\.tsx?$/u.test(entry.name) && !entry.name.includes('.test.')
            ? [path]
            : []
    })

const potMsgids = () => {
    const pot = readFileSync(join(ROOT, 'i18n', 'en.pot'), 'utf8')
    return new Set(
        [...pot.matchAll(/^msgid ((?:".*"\n?)+)/gmu)].map(([, quoted]) =>
            unescape(
                quoted
                    .trim()
                    .split('\n')
                    .map((line) => line.slice(1, -1))
                    .join('')
            )
        )
    )
}

const usages = sourceFiles(join(ROOT, 'src')).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(KEY_PATTERN)].map((match) => ({
        file: file.slice(ROOT.length + 1),
        key: unescape(match[2]),
        options: match[3] ?? '',
    }))
)

describe('i18n keys', () => {
    it('finds the keys in src', () => {
        expect(usages.length).toBeGreaterThan(50)
    })

    it('are all in i18n/en.pot (run `pnpm build` to regenerate it)', () => {
        const msgids = potMsgids()
        const missing = usages
            .filter(({ key }) => !msgids.has(key))
            .map(({ file, key }) => `${file}: ${key}`)
        expect(missing).toEqual([])
    })

    it('pass no `count` option', () => {
        const withCount = usages
            .filter(({ options }) => /\bcount\s*:/u.test(options))
            .map(({ file, key }) => `${file}: ${key}`)
        expect(withCount).toEqual([])
    })
})

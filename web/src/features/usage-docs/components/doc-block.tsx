/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Link } from '@tanstack/react-router'
import { ArrowRight, Info, TriangleAlert } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'

import { CopyButton } from '@/components/copy-button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import type { Block, DocLanguage } from '../types'
import { DocPageLink } from './doc-page-link'

type DocBlockProps = {
  block: Block
  language: DocLanguage
  /** Rendered for `contact` blocks; owned by the page so it can read status. */
  contact: ReactNode
}

/** Turn `backtick` spans into inline code; everything else stays text. */
function renderInline(text: string): ReactNode {
  const parts = text.split(/(`[^`]+`)/g)
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        // Parts are positional and never reorder, so the index is stable.
        // oxlint-disable-next-line react/no-array-index-key
        <code key={index} className='bg-muted rounded px-1 py-0.5 text-xs'>
          {part.slice(1, -1)}
        </code>
      )
    }
    // oxlint-disable-next-line react/no-array-index-key
    return <Fragment key={index}>{part}</Fragment>
  })
}

function CodeView(props: { code: string; label?: string }) {
  return (
    <div className='bg-muted relative rounded-md'>
      {props.label && (
        <div className='text-muted-foreground border-border/60 border-b px-4 py-2 text-xs'>
          {props.label}
        </div>
      )}
      <CopyButton value={props.code} className='absolute top-1 right-1' />
      <pre className='overflow-x-auto p-4 pr-12 text-xs leading-relaxed'>
        <code>{props.code}</code>
      </pre>
    </div>
  )
}

export function DocBlock(props: DocBlockProps) {
  const { block, language } = props

  switch (block.type) {
    case 'p':
      return (
        <p className='text-muted-foreground text-sm leading-7'>
          {renderInline(block.text[language])}
        </p>
      )
    case 'steps':
    case 'bullets': {
      const ListTag = block.type === 'steps' ? 'ol' : 'ul'
      return (
        <ListTag
          className={
            block.type === 'steps'
              ? 'text-muted-foreground list-decimal space-y-2 pl-6 text-sm leading-7'
              : 'text-muted-foreground list-disc space-y-2 pl-6 text-sm leading-7'
          }
        >
          {block.items.map((item) => (
            <li key={item.en}>{renderInline(item[language])}</li>
          ))}
        </ListTag>
      )
    }
    case 'code':
      return <CodeView code={block.code} label={block.label} />
    case 'tabs':
      return (
        <Tabs defaultValue={block.samples[0]?.label}>
          <TabsList className='max-w-full overflow-x-auto'>
            {block.samples.map((sample) => (
              <TabsTrigger key={sample.label} value={sample.label}>
                {sample.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {block.samples.map((sample) => (
            <TabsContent key={sample.label} value={sample.label}>
              <CodeView code={sample.code} />
            </TabsContent>
          ))}
        </Tabs>
      )
    case 'table':
      return (
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                {block.head.map((cell) => (
                  <TableHead key={cell.en}>{cell[language]}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {block.rows.map((row) => (
                <TableRow key={row.map((cell) => cell.en).join('|')}>
                  {row.map((cell, index) => (
                    <TableCell
                      // Columns are positional; a row may repeat a value.
                      // oxlint-disable-next-line react/no-array-index-key
                      key={index}
                      className='align-top whitespace-normal'
                    >
                      <span
                        className={
                          index === 0
                            ? 'break-words'
                            : 'text-muted-foreground font-normal break-words'
                        }
                      >
                        {renderInline(cell[language])}
                      </span>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )
    case 'note': {
      const Icon = block.tone === 'warning' ? TriangleAlert : Info
      return (
        <Alert role='note'>
          <Icon aria-hidden='true' />
          <AlertDescription className='leading-6'>
            {renderInline(block.text[language])}
          </AlertDescription>
        </Alert>
      )
    }
    case 'docLinks':
      return (
        <ul className='grid gap-2 sm:grid-cols-2'>
          {block.items.map((item) => (
            <li key={item.slug}>
              <DocPageLink
                slug={item.slug}
                className='hover:bg-muted flex h-full items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm transition-colors'
              >
                <span>{item.text[language]}</span>
                <ArrowRight
                  className='text-muted-foreground size-4 shrink-0'
                  aria-hidden='true'
                />
              </DocPageLink>
            </li>
          ))}
        </ul>
      )
    case 'appLinks':
      return (
        <div className='flex flex-wrap gap-x-4 gap-y-2 text-sm'>
          {block.items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className='text-primary inline-flex items-center gap-1 hover:underline'
            >
              {item.text[language]}
              <ArrowRight className='size-3.5' aria-hidden='true' />
            </Link>
          ))}
        </div>
      )
    case 'contact':
      return props.contact
  }
}

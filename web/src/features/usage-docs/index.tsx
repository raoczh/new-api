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
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { PublicLayout } from '@/components/layout'
import { ContactInformation } from '@/features/home/components/contact-information'
import { useStatus } from '@/hooks/use-status'

import { buildChapters } from './chapters'
import { resolveSiteUrl } from './site-address'
import { resolveDocLanguage, type Block } from './types'

function getBlockKey(block: Block): string {
  return block.code ?? block.text?.en ?? block.items?.[0]?.en ?? ''
}

export function UsageDocs() {
  const { i18n, t } = useTranslation()
  const language = resolveDocLanguage(i18n.resolvedLanguage || i18n.language)
  const { status } = useStatus()
  const siteUrl = resolveSiteUrl(status?.server_address)
  const apiUrl = `${siteUrl}/v1`
  const chapters = buildChapters(siteUrl)
  const hasContact = Boolean(
    status?.contact_email?.trim() ||
      status?.contact_wechat_qrcode?.trim() ||
      status?.contact_qq_group?.trim()
  )

  return (
    <PublicLayout>
      <div className='mx-auto grid max-w-7xl gap-10 lg:grid-cols-[16rem_minmax(0,1fr)]'>
        <aside
          className='lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto'
          aria-label={t('Usage Documentation')}
        >
          <nav
            className='flex gap-4 overflow-x-auto pb-3 lg:block lg:space-y-5'
            aria-label={t('Usage Documentation')}
          >
            {chapters.map((chapter) => (
              <div key={chapter.id} className='shrink-0'>
                <a
                  className='text-foreground text-sm font-semibold hover:underline'
                  href={`#${chapter.id}`}
                >
                  {chapter.title[language]}
                </a>
                <ul className='mt-2 space-y-1 lg:pl-3'>
                  {chapter.topics.map((topic) => (
                    <li key={topic.id}>
                      <a
                        className='text-muted-foreground hover:text-foreground block py-1 text-xs'
                        href={`#${topic.id}`}
                      >
                        {topic.title[language]}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {hasContact && (
              <a
                className='text-foreground shrink-0 text-sm font-semibold hover:underline'
                href='#contact'
              >
                {t('Contact Information')}
              </a>
            )}
          </nav>
        </aside>
        <article className='min-w-0 pb-20'>
          <h1 className='mb-3 text-3xl font-semibold'>
            {t('Usage Documentation')}
          </h1>
          <p className='text-muted-foreground mb-10 text-sm'>
            {t(
              'From account setup to your first request, one step at a time.'
            )}
          </p>
          <div className='mb-10 flex flex-wrap gap-3 text-sm'>
            <Link to='/keys' className='text-primary hover:underline'>
              {t('Create an API key')}
            </Link>
            <Link to='/wallet' className='text-primary hover:underline'>
              {t('Redeem and balance')}
            </Link>
            <Link to='/status-monitor' className='text-primary hover:underline'>
              {t('Status Monitor')}
            </Link>
            <Link to='/pricing' className='text-primary hover:underline'>
              {t('Browse Model Square')}
            </Link>
          </div>
          <div className='border-border mb-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-y py-4 text-sm'>
            <span className='text-muted-foreground'>{t('Base URL')}</span>
            <code className='min-w-0 break-all'>{apiUrl}</code>
            <CopyButton value={apiUrl} />
          </div>
          {chapters.map((chapter) => (
            <section
              key={chapter.id}
              id={chapter.id}
              className='mb-12 scroll-mt-24'
            >
              <h2 className='border-b pb-3 text-2xl font-semibold'>
                {chapter.title[language]}
              </h2>
              {chapter.topics.map((topic) => (
                <section
                  key={topic.id}
                  id={topic.id}
                  className='mt-8 scroll-mt-24 space-y-4'
                >
                  <h3 className='text-lg font-semibold'>
                    {topic.title[language]}
                  </h3>
                  {topic.blocks.map((block) => {
                    const blockKey = getBlockKey(block)
                    if (block.type === 'code') {
                      return (
                        <div
                          key={blockKey}
                          className='bg-muted relative rounded-sm'
                        >
                          <CopyButton
                            value={block.code ?? ''}
                            className='absolute top-2 right-2'
                          />
                          <pre className='overflow-x-auto p-4 pr-14 text-xs leading-relaxed'>
                            <code>{block.code}</code>
                          </pre>
                        </div>
                      )
                    }
                    if (block.type === 'list') {
                      return (
                        <ol
                          key={blockKey}
                          className='text-muted-foreground list-decimal space-y-2 pl-6 text-sm leading-7'
                        >
                          {block.items?.map((item) => (
                            <li key={item.en}>{item[language]}</li>
                          ))}
                        </ol>
                      )
                    }
                    return (
                      <p
                        key={blockKey}
                        className='text-muted-foreground text-sm leading-7'
                      >
                        {block.text?.[language]}
                      </p>
                    )
                  })}
                </section>
              ))}
            </section>
          ))}
          {hasContact && (
            <div id='contact' className='scroll-mt-24'>
              <ContactInformation />
            </div>
          )}
        </article>
      </div>
    </PublicLayout>
  )
}

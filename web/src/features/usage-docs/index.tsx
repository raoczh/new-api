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
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { EmptyState } from '@/components/empty-state'
import { PublicLayout } from '@/components/layout'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { ContactInformation } from '@/features/home/components/contact-information'
import { useStatus } from '@/hooks/use-status'

import { DocBlock } from './components/doc-block'
import { DocPageLink } from './components/doc-page-link'
import { DocSidebar } from './components/doc-sidebar'
import { buildDocGroups, locateDocPage } from './navigation'
import { FALLBACK_CONTACT_EMAIL, resolveSiteUrl } from './site-address'
import { resolveDocLanguage } from './types'

type UsageDocsProps = {
  /** Path after /docs/; empty for the introduction. */
  slug?: string
}

export function UsageDocs(props: UsageDocsProps) {
  const { i18n, t } = useTranslation()
  const language = resolveDocLanguage(i18n.resolvedLanguage || i18n.language)
  const { status } = useStatus()
  const siteUrl = resolveSiteUrl(status?.server_address)
  const apiUrl = `${siteUrl}/v1`
  const groups = buildDocGroups(siteUrl)
  const location = locateDocPage(groups, props.slug ?? '')
  const activeSlug = location?.page.slug ?? ''
  const hasContact = Boolean(
    status?.contact_email?.trim() ||
    status?.contact_wechat_qrcode?.trim() ||
    status?.contact_qq_group?.trim()
  )

  // Each page is its own route, so start at the top unless a hash targets a
  // section; the browser handles hash scrolling itself.
  useEffect(() => {
    if (!window.location.hash) window.scrollTo({ top: 0 })
  }, [activeSlug])

  const contact = hasContact ? (
    <ContactInformation />
  ) : (
    <div className='flex flex-wrap items-center gap-x-6 gap-y-2 text-sm'>
      <span className='text-muted-foreground'>
        {t('Contact Email')}
        {': '}
        <a
          href={`mailto:${FALLBACK_CONTACT_EMAIL}`}
          className='text-primary hover:underline'
        >
          {FALLBACK_CONTACT_EMAIL}
        </a>
      </span>
      <Link to='/tickets' className='text-primary hover:underline'>
        {t('Open a support ticket')}
      </Link>
    </div>
  )

  return (
    <PublicLayout>
      <div className='mx-auto grid max-w-7xl gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_13rem]'>
        <DocSidebar
          groups={groups}
          activeSlug={activeSlug}
          language={language}
        />
        {location ? (
          <>
            <article className='min-w-0 pb-20'>
              <Breadcrumb className='mb-4'>
                <BreadcrumbList>
                  <BreadcrumbItem>{t('Usage Documentation')}</BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {location.group.title[language]}
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {location.page.title[language]}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <h1 className='mb-3 text-3xl font-semibold'>
                {location.page.title[language]}
              </h1>
              <p className='text-muted-foreground mb-8 text-sm leading-7'>
                {location.page.summary[language]}
              </p>
              <div className='border-border mb-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-y py-3 text-sm'>
                <span className='text-muted-foreground'>{t('Base URL')}</span>
                <code className='min-w-0 break-all'>{apiUrl}</code>
                <CopyButton value={apiUrl} />
              </div>
              {location.page.sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className='mb-10 scroll-mt-24 space-y-4'
                >
                  <h2 className='text-xl font-semibold'>
                    <a href={`#${section.id}`} className='hover:underline'>
                      {section.title[language]}
                    </a>
                  </h2>
                  {section.blocks.map((block, index) => (
                    <DocBlock
                      // Blocks are authored in a fixed order and never reorder.
                      // oxlint-disable-next-line react/no-array-index-key
                      key={index}
                      block={block}
                      language={language}
                      contact={contact}
                    />
                  ))}
                </section>
              ))}
              <nav
                className='mt-14 grid gap-3 border-t pt-6 sm:grid-cols-2'
                aria-label={t('Pagination')}
              >
                {location.previous ? (
                  <DocPageLink
                    slug={location.previous.slug}
                    className='hover:bg-muted rounded-md border px-4 py-3 transition-colors'
                  >
                    <span className='text-muted-foreground flex items-center gap-1 text-xs'>
                      <ArrowLeft className='size-3.5' aria-hidden='true' />
                      {t('Previous page')}
                    </span>
                    <span className='mt-1 block text-sm font-medium'>
                      {location.previous.title[language]}
                    </span>
                  </DocPageLink>
                ) : (
                  <span />
                )}
                {location.next && (
                  <DocPageLink
                    slug={location.next.slug}
                    className='hover:bg-muted rounded-md border px-4 py-3 text-right transition-colors'
                  >
                    <span className='text-muted-foreground flex items-center justify-end gap-1 text-xs'>
                      {t('Next page')}
                      <ArrowRight className='size-3.5' aria-hidden='true' />
                    </span>
                    <span className='mt-1 block text-sm font-medium'>
                      {location.next.title[language]}
                    </span>
                  </DocPageLink>
                )}
              </nav>
            </article>
            <aside className='hidden xl:block'>
              <nav
                className='sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto'
                aria-label={t('On this page')}
              >
                <p className='text-foreground mb-3 text-xs font-semibold tracking-wide uppercase'>
                  {t('On this page')}
                </p>
                <ul className='space-y-2 border-l pl-3'>
                  {location.page.sections.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        className='text-muted-foreground hover:text-foreground block text-sm'
                      >
                        {section.title[language]}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>
          </>
        ) : (
          <div className='min-w-0 pb-20'>
            <EmptyState
              title={t('Documentation page not found')}
              description={t(
                'This page may have moved. Pick a page from the menu, or start from the introduction.'
              )}
              action={
                <DocPageLink slug='' className='text-primary hover:underline'>
                  {t('Back to the introduction')}
                </DocPageLink>
              }
              bordered
            />
          </div>
        )}
      </div>
    </PublicLayout>
  )
}

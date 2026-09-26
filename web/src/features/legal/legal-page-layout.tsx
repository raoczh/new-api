import { Link, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'

const policyPages = [
  { href: '/terms-of-service', label: 'Terms of Service' },
  { href: '/privacy-policy', label: 'Privacy Policy' },
  { href: '/acceptable-use', label: 'Acceptable Use Policy' },
  { href: '/disclaimer', label: 'Disclaimer' },
  { href: '/refund-policy', label: 'Refund Policy' },
  { href: '/data-processing-agreement', label: 'Data Processing Agreement' },
  { href: '/compliance', label: 'Compliance' },
  { href: '/supported-regions', label: 'Supported Regions' },
] as const

export function LegalPageLayout(props: { children: ReactNode }) {
  const { t } = useTranslation()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  return (
    <PublicLayout>
      <div className='mx-auto grid max-w-7xl gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]'>
        <aside
          className='lg:sticky lg:top-24 lg:self-start'
          aria-label={t('Policies')}
        >
          <h2 className='mb-3 px-3 text-sm font-semibold'>{t('Policies')}</h2>
          <nav
            className='flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible'
            aria-label={t('Policies')}
          >
            {policyPages.map((page) => (
              <Link
                key={page.href}
                to={page.href}
                aria-current={pathname === page.href ? 'page' : undefined}
                className='text-muted-foreground hover:bg-muted hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground shrink-0 rounded-sm px-3 py-2 text-sm whitespace-nowrap transition-colors lg:shrink'
              >
                {t(page.label)}
              </Link>
            ))}
          </nav>
        </aside>
        <article className='min-w-0 space-y-6 pb-16'>{props.children}</article>
      </div>
    </PublicLayout>
  )
}

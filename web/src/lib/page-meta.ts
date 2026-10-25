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
import { useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { useSystemConfig } from '@/hooks/use-system-config'

/** Routes that exist in the SPA but must never be indexed. */
const PRIVATE_PREFIXES = [
  '/dashboard',
  '/keys',
  '/wallet',
  '/usage-logs',
  '/models',
  '/channels',
  '/users',
  '/profile',
  '/playground',
  '/system-settings',
  '/system-info',
  '/tickets',
  '/ticket-management',
  '/redemption-codes',
  '/subscriptions',
  '/task-plugins',
  '/workbench',
  '/chat',
  '/chat2link',
  '/errors',
  '/console',
  '/oauth',
  '/user',
  '/setup',
  '/sign-in',
  '/sign-up',
  '/register',
  '/forgot-password',
  '/reset',
  '/otp',
  '/login',
  '/forbidden',
  '/401',
  '/403',
  '/404',
  '/500',
  '/503',
] as const

/** Translation keys for public static pages, matching the server's titles. */
const STATIC_TITLE_KEYS: Record<string, string> = {
  '/about': 'About',
  '/pricing': 'Model Square',
  '/status-monitor': 'Status Monitor',
  '/iq-monitor': 'IQ Monitor',
  '/terms-of-service': 'Terms of Service',
  '/privacy-policy': 'Privacy Policy',
  '/acceptable-use': 'Acceptable Use Policy',
  '/disclaimer': 'Disclaimer',
  '/refund-policy': 'Refund Policy',
  '/data-processing-agreement': 'Data Processing Agreement',
  '/compliance': 'Compliance',
  '/supported-regions': 'Supported Regions',
}

/** Documentation titles, duplicated from the docs content to keep the root
 * bundle from importing every documentation page. */
const DOC_TITLES: Record<string, { zh: string; en: string }> = {
  '': { zh: '介绍', en: 'Introduction' },
  apikey: { zh: 'API 密钥', en: 'API Key' },
  quickstart: { zh: '快速开始', en: 'Quick start' },
  models: { zh: '模型广场', en: 'Model Square' },
  'config/ccswitch': { zh: 'CC Switch（推荐）', en: 'CC Switch (recommended)' },
  'config/claude-code': {
    zh: '手动配置 Claude Code',
    en: 'Claude Code (manual)',
  },
  'config/codex': { zh: '手动配置 Codex', en: 'Codex (manual)' },
  'config/agents': { zh: '其他 AI 智能体', en: 'Other AI agents' },
  'config/ide': { zh: 'IDE 与编程工具', en: 'IDE and coding tools' },
  'config/office': {
    zh: '聊天、办公与翻译软件',
    en: 'Chat, office and translation apps',
  },
  'api/index': { zh: 'API 兼容协议', en: 'Compatible protocols' },
  'api/authentication': { zh: '鉴权', en: 'Authentication' },
  'api/chat': {
    zh: 'Chat Completions 与 Responses',
    en: 'Chat Completions & Responses',
  },
  'api/messages': { zh: 'Messages API', en: 'Messages API' },
  'api/gemini': { zh: 'Gemini API', en: 'Gemini API' },
  'api/media': { zh: '图像、音频与视频', en: 'Images, audio and video' },
  'api/models': { zh: '模型列表', en: 'Model list' },
  'api/errors': { zh: '错误码', en: 'Error codes' },
  'guides/streaming': { zh: '流式响应', en: 'Streaming' },
  'guides/error-handling': {
    zh: '错误处理与重试',
    en: 'Error handling and retries',
  },
  'guides/rate-limits': { zh: '速率限制与额度', en: 'Rate limits and quota' },
  'guides/billing': { zh: '计费与余额', en: 'Billing and balance' },
}

function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export function normalizePagePath(pathname: string): string {
  return pathname === '/' ? pathname : pathname.replace(/\/+$/, '')
}

export type PageMeta = { title: string; noindex: boolean }

/**
 * Resolve the browser title for a path.
 *
 * It mirrors the server-side rules in router/seo.go so a client-side
 * navigation lands on the same title the server would have rendered. The
 * documentation titles are duplicated rather than imported because importing
 * the docs content would pull every documentation page into the root bundle.
 */
export function resolvePageMeta(
  pathname: string,
  t: (key: string) => string,
  language: string
): PageMeta {
  const path = normalizePagePath(pathname)

  if (path === '/') {
    return { title: t('AI API Gateway'), noindex: false }
  }

  if (path === '/docs' || path.startsWith('/docs/')) {
    const slug = path === '/docs' ? '' : path.slice('/docs/'.length)
    const doc = DOC_TITLES[slug]
    if (!doc) {
      return { title: t('Documentation page not found'), noindex: true }
    }
    const title = language.toLowerCase().startsWith('zh') ? doc.zh : doc.en
    return {
      title: `${title} - ${t('Usage Documentation')}`,
      noindex: false,
    }
  }

  const staticKey = STATIC_TITLE_KEYS[path]
  if (staticKey) {
    return { title: t(staticKey), noindex: false }
  }

  if (isPrivatePath(path)) {
    return { title: t('Console'), noindex: true }
  }

  return { title: t('Oops! Page Not Found!'), noindex: true }
}

/**
 * Keeps the browser-tab head in sync with client-side navigation.
 *
 * The Go server renders the authoritative per-route head for the first request
 * (crawlers read that). This hook only updates what a tab and a history entry
 * need after the SPA takes over: the document title and the robots directive.
 */
export function usePageMeta() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const { t, i18n } = useTranslation()
  const { systemName, systemChineseName } = useSystemConfig()
  const language = i18n.resolvedLanguage || i18n.language

  useEffect(() => {
    const brand = [systemName, systemChineseName?.trim()]
      .filter((part): part is string => Boolean(part))
      .join(' · ')
    const { title, noindex } = resolvePageMeta(pathname, t, language)

    if (normalizePagePath(pathname) === '/') {
      document.title = `${brand} · ${title}`
    } else {
      document.title = title && brand ? `${title} - ${brand}` : brand
    }

    document
      .querySelector('meta[name="robots"]')
      ?.setAttribute('content', noindex ? 'noindex, nofollow' : 'index, follow')
  }, [pathname, t, language, systemName, systemChineseName])
}

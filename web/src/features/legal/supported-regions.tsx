// Copyright (C) 2024 QuantumNous. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'

import { LegalPageLayout } from './legal-page-layout'

export function SupportedRegions() {
  const { i18n } = useTranslation()
  const { status } = useStatus()
  const contactEmail = status?.contact_email || ''
  const contactWeChatQR = status?.contact_wechat_qrcode || ''
  const contactQQ = status?.contact_qq_group || ''
  const isEnglish = !i18n.language.startsWith('zh')

  return (
    <LegalPageLayout>
      <div className='space-y-6'>
        <h1 className='text-3xl font-semibold'>
          {isEnglish ? 'Supported Regions' : '支持的国家和地区'}
        </h1>

        {isEnglish ? (
          <EnglishContent
            contactEmail={contactEmail}
            contactWeChatQR={contactWeChatQR}
            contactQQ={contactQQ}
          />
        ) : (
          <ChineseContent
            contactEmail={contactEmail}
            contactWeChatQR={contactWeChatQR}
            contactQQ={contactQQ}
          />
        )}
      </div>
    </LegalPageLayout>
  )
}

interface ContentProps {
  contactEmail: string
  contactWeChatQR: string
  contactQQ: string
}

function ChineseContent({
  contactEmail,
  contactWeChatQR,
  contactQQ,
}: ContentProps) {
  return (
    <div className='prose dark:prose-invert max-w-none'>
      <p className='text-muted-foreground text-sm'>
        <strong>最后更新日期：2026 年 9 月 26 日</strong>
      </p>

      <p>
        本页说明服务的地域可用性，以及上游模型可能施加的地理或主体限制。它构成《服务条款》关于「受限模型」部分的补充。
      </p>

      <h2>1. 平台访问</h2>
      <p>
        本站网站和控制台可在大多数地区访问，但我们不保证任一国家或地区持续可访问。网络封锁、本地法律或基础设施限制可能导致无法使用。您须自行确保使用服务不违反您所在地法律。
      </p>

      <div className='my-4 border-l-4 border-yellow-500 bg-yellow-50 p-4 dark:bg-yellow-900/20'>
        <p className='mb-2 font-semibold'>重要声明：</p>
        <p>
          <strong>Token Come 不向中国大陆地区用户提供服务。</strong>
          如果您位于中国大陆地区，或您的通常居住地、注册地、主要经营地或实际使用地位于中国大陆地区，请勿使用本服务。详情请参阅《使用政策》。
        </p>
      </div>

      <h2>2. 模型与上游限制</h2>
      <p>
        部分模型提供方不允许特定国家、地区、行业或主体访问其模型。即使您能登录本站，对应模型仍可能被拒绝、降级或返回上游错误。可用性以控制台、模型列表和实际上游响应为准。
      </p>

      <h2>3. 禁止绕过</h2>
      <p>
        您不得使用
        VPN、代理、虚假定位或其他方式绕过本站或上游为地域、主体或用途设置的限制。一经发现，我们可限制模型、冻结账户并不予退还相关余额。
      </p>

      <h2>4. 您的责任</h2>
      <p>
        在把服务提供给您的客户或部署到特定市场前，请自行核对：当地对生成式 AI
        的监管、上游的地域条款、数据出境和内容审核要求。我们不因某模型曾在列表中出现，而保证其可在您的目标市场合法使用。
      </p>

      <h2>5. 变更</h2>
      <p>
        提供方名单、模型清单和地域策略可能随时变化。继续使用即视为接受当时有效的限制。问题请通过站内客服提交。
      </p>

      {(contactEmail || contactWeChatQR || contactQQ) && (
        <div className='bg-muted/50 mt-8 rounded-lg border p-6'>
          <h3 className='mb-4 text-lg font-semibold'>联系我们</h3>
          <div className='space-y-2'>
            {contactEmail && (
              <p>
                <strong>邮箱：</strong>
                <a
                  href={`mailto:${contactEmail}`}
                  className='text-primary ml-2 hover:underline'
                >
                  {contactEmail}
                </a>
              </p>
            )}
            {contactWeChatQR && (
              <div>
                <p className='mb-2'>
                  <strong>微信群：</strong>
                </p>
                <img
                  src={contactWeChatQR}
                  alt='微信群二维码'
                  className='max-w-xs'
                />
              </div>
            )}
            {contactQQ && (
              <p>
                <strong>QQ 群：</strong> {contactQQ}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function EnglishContent({
  contactEmail,
  contactWeChatQR,
  contactQQ,
}: ContentProps) {
  return (
    <div className='prose dark:prose-invert max-w-none'>
      <p className='text-muted-foreground text-sm'>
        <strong>Last Updated: September 26, 2026</strong>
      </p>

      <p>
        This page explains the regional availability of the Services and
        geographic or entity restrictions that upstream models may impose. It
        supplements the "Restricted Models" section of the Terms of Service.
      </p>

      <h2>1. Platform Access</h2>
      <p>
        Our website and console are accessible in most regions, but we do not
        guarantee continued accessibility in any country or region. Network
        blocks, local laws, or infrastructure limitations may prevent use. You
        must ensure that your use of the Services does not violate the laws of
        your jurisdiction.
      </p>

      <div className='my-4 border-l-4 border-yellow-500 bg-yellow-50 p-4 dark:bg-yellow-900/20'>
        <p className='mb-2 font-semibold'>Important Notice:</p>
        <p>
          <strong>
            Token Come does not provide services to users in Mainland China.
          </strong>{' '}
          If you are located in Mainland China, or if your usual residence,
          place of registration, primary place of business, or actual place of
          use is in Mainland China, please do not use this service. For details,
          see the Acceptable Use Policy.
        </p>
      </div>

      <h2>2. Models and Upstream Restrictions</h2>
      <p>
        Some model providers do not allow specific countries, regions,
        industries, or entities to access their models. Even if you can log in
        to this site, corresponding models may still be denied, degraded, or
        return upstream errors. Availability is determined by the console, model
        list, and actual upstream responses.
      </p>

      <h2>3. Prohibition on Circumvention</h2>
      <p>
        You may not use VPNs, proxies, false location information, or other
        means to circumvent restrictions set by this site or upstream providers
        for regions, entities, or purposes. If detected, we may restrict models,
        freeze your account, and not refund the related balance.
      </p>

      <h2>4. Your Responsibility</h2>
      <p>
        Before providing the Services to your customers or deploying in a
        specific market, please independently verify: local regulations on
        generative AI, upstream regional terms, data export requirements, and
        content moderation requirements. We do not guarantee that a model's
        appearance in the list means it can be legally used in your target
        market.
      </p>

      <h2>5. Changes</h2>
      <p>
        Provider lists, model catalogs, and regional policies may change at any
        time. Continued use constitutes acceptance of the restrictions in effect
        at that time. For questions, please submit through customer service.
      </p>

      {(contactEmail || contactWeChatQR || contactQQ) && (
        <div className='bg-muted/50 mt-8 rounded-lg border p-6'>
          <h3 className='mb-4 text-lg font-semibold'>Contact Us</h3>
          <div className='space-y-2'>
            {contactEmail && (
              <p>
                <strong>Email:</strong>
                <a
                  href={`mailto:${contactEmail}`}
                  className='text-primary ml-2 hover:underline'
                >
                  {contactEmail}
                </a>
              </p>
            )}
            {contactWeChatQR && (
              <div>
                <p className='mb-2'>
                  <strong>WeChat Group:</strong>
                </p>
                <img
                  src={contactWeChatQR}
                  alt='WeChat Group QR Code'
                  className='max-w-xs'
                />
              </div>
            )}
            {contactQQ && (
              <p>
                <strong>QQ Group:</strong> {contactQQ}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Copyright (C) 2024 QuantumNous. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'

import { LegalPageLayout } from './legal-page-layout'

export function Compliance() {
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
          {isEnglish ? 'Compliance and Business Description' : '合规与业务说明'}
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
        本说明用于公开 Token Come 的业务边界与风控理念，避免把「API
        中转」误解为模型提供、内容平台、账号代充或持牌金融机构。
      </p>

      <p>
        <strong>一句话：</strong>我们运营面向开发者的{' '}
        <strong>AI API 聚合 / 网关</strong>
        。客户预付余额，通过统一接口调用生成式模型。我们 <strong>
          不是
        </strong>{' '}
        第三方个人订阅或账号的转售方，也 <strong>不</strong>{' '}
        帮助任何人绕过上游政策。
      </p>

      <h2>1. 业务定位</h2>
      <p>
        我们提供授权范围内的 AI API 聚合与开发者平台：通过统一、兼容常见协议的
        API、控制台、文档和按量计费，方便开发者和企业接入、管理多种大模型。客户购买的是平台
        API 用量，不是实物，也不是第三方账号。
      </p>

      <h2>2. 运营与收款</h2>
      <p>
        提供服务并收款的主体以网站页脚、结算流程和站内展示为准，即 Token Come
        运营方。客户支付的是与账户关联的平台用量。联系方式以站内客服为准。
      </p>

      <h2>3. 模型来源与数据流</h2>
      <p>
        您发出的请求由本站接收，完成鉴权、计费和安全控制后，转发到相应模型提供方的官方或经授权上游接口，再把响应返回给您。平台上的模型来自或经由主要模型提供方及其授权分发渠道的官方
        API，可能包括但不限于
        OpenAI、Anthropic、Google、xAI、Meta、阿里（通义）、字节、DeepSeek
        等。具体提供方和模型会随时间变化。
      </p>

      <h2>4. 我们不提供的服务</h2>
      <p>为避免误解，本站明确不提供、并禁止将服务用于：</p>
      <ul>
        <li>
          <strong>账号共享</strong>：不出租、转售或共用第三方 AI
          账号，也不使用客户的个人 ChatGPT、Claude 等订阅来提供服务；
        </li>
        <li>
          <strong>代充订阅</strong>：不代理为客户充值或续费第三方个人订阅；
        </li>
        <li>
          <strong>绕过上游限制</strong>
          ：不协助绕过上游的地域限制、封禁、配额或速率限制；
        </li>
        <li>
          <strong>非官方访问</strong>
          ：不以非官方或未授权方式提供对受限服务的访问。
        </li>
      </ul>
      <p>客户须遵守各上游提供方的服务条款。禁止内容详见《可接受使用政策》。</p>

      <h2>5. 商标与授权</h2>
      <p>
        OpenAI、Anthropic、Google、xAI
        等名称及模型名仅用于标识可通过平台访问的能力。商标归各自权利人所有，使用不表示存在合作、赞助或背书。商业访问通过官方上游
        API
        和授权渠道进行。若某能力缺乏清晰的商业授权路径，我们可能调整展示或下架。
      </p>

      <h2>6. 风控理念</h2>
      <p>
        我们采取「默认拒绝高风险、可观测、可中断」的路线：分组与模型白名单、速率限制、余额预检、异常检测、可配置的内容安全策略，以及对滥用和拒付的冻结权。我们不承诺实时人工审看每一条请求。最终合规责任在使用方。
      </p>

      <h2>7. 联系</h2>
      <p>
        合规、商务或合作问询请通过站内客服提交。本说明不构成法律意见。若与正式条款冲突，以当时有效的《服务条款》及相关政策为准。
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
        This description clarifies Token Come's business boundaries and risk
        control philosophy to avoid misunderstanding "API gateway" as a model
        provider, content platform, account reseller, or licensed financial
        institution.
      </p>

      <p>
        <strong>In short:</strong> We operate an{' '}
        <strong>AI API aggregation/gateway</strong> for developers. Customers
        prepay balances and invoke generative models through a unified
        interface. We are <strong>not</strong> a reseller of third-party
        personal subscriptions or accounts, nor do we{' '}
        <strong>help anyone</strong> circumvent upstream policies.
      </p>

      <h2>1. Business Positioning</h2>
      <p>
        We provide AI API aggregation and a developer platform within our
        authorization scope: through unified APIs compatible with common
        protocols, console, documentation, and pay-as-you-go billing, making it
        convenient for developers and enterprises to access and manage multiple
        large language models. Customers purchase platform API usage, not
        physical goods or third-party accounts.
      </p>

      <h2>2. Operations and Payments</h2>
      <p>
        The entity providing the Services and collecting payments is as
        indicated in the website footer, settlement process, and on-site
        display: the Token Come operator. Customers pay for platform usage
        associated with their account. Contact channels are provided through
        on-site customer service.
      </p>

      <h2>3. Model Sources and Data Flow</h2>
      <p>
        Requests you issue are received by this site, then after authentication,
        billing, and security controls, forwarded to the official or authorized
        upstream interfaces of the corresponding model providers, and responses
        are returned to you. Models on the platform come from or via official
        APIs of major model providers and their authorized distribution
        channels, which may include but are not limited to OpenAI, Anthropic,
        Google, xAI, Meta, Alibaba (Tongyi), ByteDance, DeepSeek, etc. Specific
        providers and models may change over time.
      </p>

      <h2>4. Services We Do Not Provide</h2>
      <p>
        To avoid misunderstanding, this site explicitly does not provide and
        prohibits using the Services for:
      </p>
      <ul>
        <li>
          <strong>Account sharing</strong>: We do not rent, resell, or share
          third-party AI accounts, nor do we use customers' personal ChatGPT,
          Claude, or other subscriptions to provide the Services;
        </li>
        <li>
          <strong>Subscription top-up</strong>: We do not act as an agent to
          recharge or renew third-party personal subscriptions for customers;
        </li>
        <li>
          <strong>Circumventing upstream restrictions</strong>: We do not assist
          in bypassing upstream regional restrictions, bans, quotas, or rate
          limits;
        </li>
        <li>
          <strong>Unofficial access</strong>: We do not provide access to
          restricted services through unofficial or unauthorized means.
        </li>
      </ul>
      <p>
        Customers must comply with the terms of service of each upstream
        provider. Prohibited content is detailed in the Acceptable Use Policy.
      </p>

      <h2>5. Trademarks and Authorization</h2>
      <p>
        Names such as OpenAI, Anthropic, Google, xAI, and model names are used
        solely to identify capabilities accessible through the platform.
        Trademarks belong to their respective rights holders; use does not
        indicate partnership, sponsorship, or endorsement. Commercial access is
        conducted through official upstream APIs and authorized channels. If a
        capability lacks a clear commercial authorization path, we may adjust
        its display or remove it.
      </p>

      <h2>6. Risk Control Philosophy</h2>
      <p>
        We adopt a "default deny high-risk, observable, interruptible" approach:
        group and model whitelists, rate limiting, balance pre-checks, anomaly
        detection, configurable content security policies, and the right to
        freeze for abuse and chargebacks. We do not commit to real-time manual
        review of every request. Ultimate compliance responsibility rests with
        the user.
      </p>

      <h2>7. Contact</h2>
      <p>
        For compliance, business, or partnership inquiries, please submit
        through on-site customer service. This description does not constitute
        legal advice. In case of conflict with formal terms, the Terms of
        Service and related policies in effect at the time prevail.
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

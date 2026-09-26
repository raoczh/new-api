// Copyright (C) 2024 QuantumNous. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'

import { LegalPageLayout } from './legal-page-layout'

export function AcceptableUse() {
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
          {isEnglish ? 'Acceptable Use Policy' : '使用政策'}
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

      <h2>服务说明</h2>
      <p>
        本平台提供 AI API 网关、模型调用、接口转发、用量统计及相关技术服务。
      </p>
      <p>
        本服务为第三方技术服务，并非 OpenAI、Anthropic、Google、Microsoft
        或其他模型厂商的官方网站，也不代表上述厂商提供官方账号或官方售后服务。
      </p>
      <p>
        本服务主要用于内部测试与研发评估用途，不建议用于生产环境。用户应自行评估服务稳定性与适用性。
      </p>
      <p>
        <strong>数据隐私说明：</strong>
        本平台不会存储任何用户请求数据、响应内容及其他敏感数据。所有请求均实时转发至上游模型服务商，平台不做持久化存储、日志记录或缓存留存。数据传输仅用于完成本次调用所需的技术处理，调用完成后即刻释放相关内存及临时资源。
      </p>

      <h2>地区限制</h2>
      <p className='my-4 border-l-4 border-yellow-500 bg-yellow-50 p-4 dark:bg-yellow-900/20'>
        <strong>本服务不向中国大陆地区用户提供。</strong>
      </p>
      <p>中国大陆地区用户包括但不限于：</p>
      <ul>
        <li>当前位于中国大陆地区的个人或组织；</li>
        <li>
          通常居住地、注册地、主要经营地或实际使用地位于中国大陆地区的用户；
        </li>
        <li>
          以及代表、代理、转售、转发或以其他方式为中国大陆地区用户使用本服务的用户。
        </li>
      </ul>
      <p>
        <strong>
          如你属于上述范围，请立即停止访问、注册、登录或使用本服务。
        </strong>
      </p>
      <p>你不得通过以下方式规避本服务的地区限制：</p>
      <ul>
        <li>VPN、代理、VPS、远程桌面</li>
        <li>虚拟号码、共享账号、共享 API Key</li>
        <li>接口转发、反向代理或其他类似手段</li>
      </ul>

      <h2>用户确认</h2>
      <p>使用本服务即表示你声明并保证：</p>
      <ul>
        <li>你不是中国大陆地区用户；</li>
        <li>你当前不位于中国大陆地区；</li>
        <li>你不会代表中国大陆地区用户使用本服务；</li>
        <li>你不会将本服务转售、转发、开放或集成给中国大陆地区用户使用；</li>
        <li>
          你将自行承担因违反本协议、上游服务商规则或适用法律法规产生的全部责任。
        </li>
      </ul>

      <h2>使用规范</h2>
      <p>用户不得利用本服务从事以下行为：</p>
      <ul>
        <li>
          违法、欺诈、钓鱼、诈骗、仿冒官方网站，或诱导他人泄露账号、密码、验证码、API
          Key 等敏感信息；
        </li>
        <li>
          恶意软件、木马、病毒、漏洞利用、DDoS、撞库、批量注册、爬虫滥用、绕过风控等攻击或滥用行为；
        </li>
        <li>侵犯他人隐私、知识产权、商业秘密、名誉权或其他合法权益；</li>
        <li>垃圾信息、虚假广告、误导性营销；</li>
        <li>
          让用户误认为本服务属于 OpenAI、Anthropic、Google、Microsoft
          等官方平台；
        </li>
        <li>违反模型厂商、网络服务商、所在地法律法规或监管要求；</li>
        <li>
          将本服务用于公开 AI API
          中转、代理调用、接口聚合、转售或向第三方提供服务；
        </li>
        <li>
          通过本服务规避所在地法律法规、平台规则、网络访问限制、模型厂商政策或监管要求。
        </li>
      </ul>

      <h2>风控与处置</h2>
      <p>
        如发现或合理怀疑存在异常请求、违规账号、高风险密钥、疑似转售或滥用行为，平台有权立即采取以下措施，无需事先通知：
      </p>
      <ul>
        <li>限制访问；</li>
        <li>暂停服务；</li>
        <li>终止账户；</li>
        <li>禁用 API Key；</li>
        <li>拒绝后续服务。</li>
      </ul>
      <p>
        因用户自身原因导致的问题（包括但不限于官方封号、地区限制、模型不匹配等），均由用户自行承担。
      </p>

      <h2>免责声明</h2>
      <p>
        本服务按 "原样"
        提供，主要用于内部测试，不适用于生产环境。平台不对服务的稳定性、安全性、准确性或适用性作任何明示或暗示的保证。
      </p>
      <p>
        平台不保证服务永久可用。由于网络波动、上游限制、模型厂商策略、地区限制、风控规则或维护升级，服务可能出现延迟、失败、中断或不可用。
      </p>
      <p>
        因不可抗力、官方政策调整、网络故障、地区限制、系统升级等导致的服务异常，平台不承担责任。
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

      <h2>Service Description</h2>
      <p>
        This platform provides AI API gateway, model invocation, interface
        forwarding, usage statistics, and related technical services.
      </p>
      <p>
        This is a third-party technical service and is not the official website
        of OpenAI, Anthropic, Google, Microsoft, or other model providers, nor
        does it represent these providers in offering official accounts or
        official customer support.
      </p>
      <p>
        This service is primarily intended for internal testing and development
        evaluation purposes and is not recommended for production environments.
        Users should assess service stability and suitability themselves.
      </p>
      <p>
        <strong>Data Privacy Notice:</strong> This platform does not store any
        user request data, response content, or other sensitive data. All
        requests are forwarded in real-time to upstream model service providers.
        The platform does not perform persistent storage, logging, or caching.
        Data transmission is used solely for the technical processing required
        to complete the call, and related memory and temporary resources are
        released immediately after the call is completed.
      </p>

      <h2>Regional Restrictions</h2>
      <p className='my-4 border-l-4 border-yellow-500 bg-yellow-50 p-4 dark:bg-yellow-900/20'>
        <strong>
          This service is not provided to users in Mainland China.
        </strong>
      </p>
      <p>Users in Mainland China include but are not limited to:</p>
      <ul>
        <li>
          Individuals or organizations currently located in Mainland China;
        </li>
        <li>
          Users whose usual residence, place of registration, primary place of
          business, or actual place of use is in Mainland China;
        </li>
        <li>
          Users who represent, act as agents for, resell, forward, or otherwise
          use this service on behalf of users in Mainland China.
        </li>
      </ul>
      <p>
        <strong>
          If you fall into any of the above categories, please immediately cease
          accessing, registering, logging in, or using this service.
        </strong>
      </p>
      <p>
        You may not circumvent the regional restrictions of this service through
        the following means:
      </p>
      <ul>
        <li>VPN, proxy, VPS, remote desktop</li>
        <li>Virtual phone numbers, shared accounts, shared API Keys</li>
        <li>Interface forwarding, reverse proxy, or other similar methods</li>
      </ul>

      <h2>User Confirmation</h2>
      <p>By using this service, you declare and warrant that:</p>
      <ul>
        <li>You are not a user in Mainland China;</li>
        <li>You are not currently located in Mainland China;</li>
        <li>
          You will not use this service on behalf of users in Mainland China;
        </li>
        <li>
          You will not resell, forward, open, or integrate this service for use
          by users in Mainland China;
        </li>
        <li>
          You will assume full responsibility for any consequences arising from
          violations of this agreement, upstream service provider rules, or
          applicable laws and regulations.
        </li>
      </ul>

      <h2>Usage Standards</h2>
      <p>
        Users may not use this service to engage in the following activities:
      </p>
      <ul>
        <li>
          Illegal activities, fraud, phishing, scams, impersonating official
          websites, or inducing others to disclose sensitive information such as
          accounts, passwords, verification codes, or API Keys;
        </li>
        <li>
          Malware, trojans, viruses, exploit attempts, DDoS attacks, credential
          stuffing, batch registration, crawler abuse, bypassing risk controls,
          or other attack or abuse behaviors;
        </li>
        <li>
          Infringing on others' privacy, intellectual property, trade secrets,
          reputation rights, or other legitimate rights and interests;
        </li>
        <li>Spam, false advertising, misleading marketing;</li>
        <li>
          Causing users to mistakenly believe this service belongs to official
          platforms such as OpenAI, Anthropic, Google, or Microsoft;
        </li>
        <li>
          Violating model provider, network service provider, local laws and
          regulations, or regulatory requirements;
        </li>
        <li>
          Using this service for public AI API gateway, proxy invocation,
          interface aggregation, resale, or providing services to third parties;
        </li>
        <li>
          Using this service to circumvent local laws and regulations, platform
          rules, network access restrictions, model provider policies, or
          regulatory requirements.
        </li>
      </ul>

      <h2>Risk Control and Handling</h2>
      <p>
        If abnormal requests, violating accounts, high-risk keys, suspected
        resale, or abusive behavior are detected or reasonably suspected, the
        platform reserves the right to immediately take the following measures
        without prior notice:
      </p>
      <ul>
        <li>Restrict access;</li>
        <li>Suspend service;</li>
        <li>Terminate account;</li>
        <li>Disable API Key;</li>
        <li>Refuse subsequent service.</li>
      </ul>
      <p>
        Issues caused by the user's own reasons (including but not limited to
        official account bans, regional restrictions, model mismatches, etc.)
        shall be borne by the user.
      </p>

      <h2>Disclaimer</h2>
      <p>
        This service is provided "as is" and is primarily intended for internal
        testing, not for production environments. The platform makes no express
        or implied warranties regarding the stability, security, accuracy, or
        suitability of the service.
      </p>
      <p>
        The platform does not guarantee perpetual availability of the service.
        Due to network fluctuations, upstream limitations, model provider
        policies, regional restrictions, risk control rules, or maintenance
        upgrades, the service may experience delays, failures, interruptions, or
        unavailability.
      </p>
      <p>
        The platform is not responsible for service anomalies caused by force
        majeure, official policy adjustments, network failures, regional
        restrictions, system upgrades, etc.
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

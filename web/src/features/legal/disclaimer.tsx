// Copyright (C) 2024 QuantumNous. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'

import { LegalPageLayout } from './legal-page-layout'

export function Disclaimer() {
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
          {isEnglish ? 'Disclaimer' : '免责声明'}
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
        Token Come 提供的 API
        中转、控制台和相关技术支持仅供开发、研究与一般信息用途。使用服务前请完整阅读本免责条款。访问或使用即视为您已阅读、理解并同意全部内容。
      </p>

      <h2>1. 按「现状」提供，不作保证</h2>
      <blockquote>
        <p>
          服务及通过服务获得的一切材料、内容均按「现状」「可用」提供，不含任何明示或默示保证，包括适销性、特定用途适用性、权属、安静享用或不侵权。我们不保证服务不中断、安全、无错误或无有害组件，也不保证缺陷将被纠正。
        </p>
      </blockquote>

      <h2>2. 关于模型输出</h2>
      <p>
        我们是路由与计费层，不是模型提供方。输出由独立上游大模型生成，
        <strong>不代表本站立场、观点或政策</strong>。
      </p>
      <p>您理解并同意：</p>
      <ul>
        <li>我们不对输出的准确性、完整性、合法性或质量负责；</li>
        <li>您基于输出采取的任何行动及其后果由您自行承担；</li>
        <li>
          您须自行评估输出、设置人工审核，并判断模型、输入、输出及用例是否满足您的法律、安全、隐私与合规要求；
        </li>
        <li>
          我们不对上游的数据留存、训练、安全、可用性或知识产权实践作任何陈述。
        </li>
      </ul>

      <h2>3. 技术服务的固有风险</h2>
      <p>
        模型能力、错误率和可用性会随时间变化。使用服务、与其他用户交互、下载或依赖任何材料（含输出）的风险由您自行承担，包括设备损坏或数据丢失。
      </p>

      <h2>4. 责任限制</h2>
      <blockquote>
        <p>
          在法律允许的最大范围内，我们不对因访问、使用或无法使用服务或其中内容而产生的任何间接、附带、特殊、后果性或惩罚性损害（包括利润、商誉或其他无形损失）负责，无论基于保证、合同、侵权（含过失）或其他理论，即使已被告知可能发生损害。
        </p>
      </blockquote>
      <p>
        对我们的累计赔偿责任，以您在引起索赔的事件发生前十二（12）个月内就相关服务实际支付的金额与
        100
        美元中的较高者为上限。某些法域不允许限制附带或后果性损害，则上述限制在该范围内不适用。
      </p>

      <h2>5. 排除高风险场景</h2>
      <p>
        服务及所接入的接口 <strong>未经</strong> 高安全、高可靠或容错认证，
        <strong>在任何情况下均不适合</strong>{' '}
        用于要求绝对安全、容错或实时精度的极端高风险环境，包括但不限于：
      </p>
      <ul>
        <li>临床诊断、治疗决策或医疗设备控制；</li>
        <li>航空航天导航、飞控或空管；</li>
        <li>核设施或危险品管控；</li>
        <li>生命支持或应急指挥的实时系统；</li>
        <li>自动驾驶或武器控制；</li>
        <li>无人工审核的自动金融成交；</li>
        <li>其他一旦失败可能导致死亡、人身伤害或重大财产/环境损害的场景。</li>
      </ul>

      <h2>6. 第三方链接与服务</h2>
      <p>
        服务中的第三方链接、应用或模型不构成本站背书。我们不对其内容、隐私政策或实践负责。
      </p>

      <h2>7. 知识产权</h2>
      <p>
        输出的知识产权以相应模型条款为准；我们不对权属作保证，也不对因使用输出引起的知识产权争议负责。商业使用前请自行核对模型条款。
      </p>

      <h2>8. 变更</h2>
      <p>
        我们可随时修订本免责条款并在本页公布。继续使用即视为接受。依法不能排除的保证或责任，不受本文件影响。
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
        The API gateway, console, and related technical support provided by
        Token Come are for development, research, and general informational
        purposes only. Please read this disclaimer in full before using the
        Services. Access or use constitutes acknowledgment that you have read,
        understood, and agreed to all content herein.
      </p>

      <h2>1. Provided "As Is" Without Warranties</h2>
      <blockquote>
        <p>
          The Services and all materials and content obtained through the
          Services are provided "as is" and "as available" without any
          warranties of any kind, either express or implied, including
          warranties of merchantability, fitness for a particular purpose,
          title, quiet enjoyment, or non-infringement. We do not warrant that
          the Services will be uninterrupted, secure, error-free, or free of
          harmful components, nor do we warrant that defects will be corrected.
        </p>
      </blockquote>

      <h2>2. Regarding Model Output</h2>
      <p>
        We are a routing and billing layer, not a model provider. Output is
        generated by independent upstream large language models and{' '}
        <strong>does not represent our positions, views, or policies</strong>.
      </p>
      <p>You understand and agree that:</p>
      <ul>
        <li>
          We are not responsible for the accuracy, completeness, legality, or
          quality of Output;
        </li>
        <li>
          Any actions you take based on Output and their consequences are your
          sole responsibility;
        </li>
        <li>
          You must independently evaluate Output, implement human review, and
          determine whether the models, Input, Output, and use cases meet your
          legal, security, privacy, and compliance requirements;
        </li>
        <li>
          We make no representations regarding upstream data retention,
          training, security, availability, or intellectual property practices.
        </li>
      </ul>

      <h2>3. Inherent Risks of Technical Services</h2>
      <p>
        Model capabilities, error rates, and availability change over time. You
        assume all risks associated with using the Services, interacting with
        other users, downloading, or relying on any materials (including
        Output), including device damage or data loss.
      </p>

      <h2>4. Limitation of Liability</h2>
      <blockquote>
        <p>
          To the maximum extent permitted by law, we are not liable for any
          indirect, incidental, special, consequential, or punitive damages
          (including lost profits, goodwill, or other intangible losses) arising
          from access to, use of, or inability to use the Services or any
          content therein, whether based on warranty, contract, tort (including
          negligence), or any other legal theory, even if advised of the
          possibility of such damages.
        </p>
      </blockquote>
      <p>
        Our aggregate liability to you is limited to the greater of (i) the
        amount you actually paid for the relevant Services in the twelve (12)
        months preceding the event giving rise to the claim, or (ii) $100 USD.
        Some jurisdictions do not allow the limitation of incidental or
        consequential damages, so the above limitation may not apply to that
        extent.
      </p>

      <h2>5. Exclusion of High-Risk Scenarios</h2>
      <p>
        The Services and connected interfaces <strong>have not been</strong>{' '}
        certified for high security, high reliability, or fault tolerance and
        are <strong>not suitable under any circumstances</strong> for use in
        extreme high-risk environments requiring absolute safety, fault
        tolerance, or real-time precision, including but not limited to:
      </p>
      <ul>
        <li>
          Clinical diagnosis, treatment decisions, or medical device control;
        </li>
        <li>
          Aerospace navigation, flight control, or air traffic management;
        </li>
        <li>Nuclear facilities or hazardous materials control;</li>
        <li>Life support or emergency command real-time systems;</li>
        <li>Autonomous driving or weapons control;</li>
        <li>Automated financial transactions without human review;</li>
        <li>
          Other scenarios where failure could result in death, personal injury,
          or significant property/environmental damage.
        </li>
      </ul>

      <h2>6. Third-Party Links and Services</h2>
      <p>
        Third-party links, applications, or models in the Services do not
        constitute our endorsement. We are not responsible for their content,
        privacy policies, or practices.
      </p>

      <h2>7. Intellectual Property</h2>
      <p>
        Intellectual property rights in Output are governed by the applicable
        model terms; we make no warranties regarding ownership and are not
        responsible for intellectual property disputes arising from use of
        Output. Please review model terms before commercial use.
      </p>

      <h2>8. Changes</h2>
      <p>
        We may revise this disclaimer at any time and publish it on this page.
        Continued use constitutes acceptance. Warranties or liabilities that
        cannot be excluded by law are not affected by this document.
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

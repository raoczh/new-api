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
import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'

import { LegalPageLayout } from './legal-page-layout'

export function TermsOfService() {
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
          {isEnglish ? 'Terms of Service' : '服务条款'}
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
        欢迎使用本网站以及控制台、API
        和相关技术支持（合称「服务」）。本条款是您与本站运营方（「我们」）之间具有约束力的协议。
      </p>

      <blockquote>
        <p>
          点击同意、注册、登录或实际调用
          API，即表示您已阅读、理解并同意受本条款、《隐私政策》、《使用政策》、《免责声明》、《退款政策》和《数据处理协议》约束。若您不符合使用资格或不同意，请勿使用服务。
        </p>
      </blockquote>

      <h2>1. 服务概述</h2>
      <p>
        我们运营大模型 API 中转 /
        聚合平台：按您的请求，把流量转发到独立第三方模型提供方的接口，并提供计费、分组、限流、会话保持和风控。网站上架的生成式模型（「模型」）可能随时增加、下架或调整。我们不训练、不托管您所调用的基础模型。
      </p>

      <h2>2. 资格</h2>
      <p>
        您须年满 13 周岁。未满 18
        周岁须取得监护人同意。您保证：此前未被我们停用；注册与使用符合适用法律。若您代表组织使用，您保证有权使该组织受本条款约束。
      </p>

      <h2>3. 账户与注册</h2>
      <p>
        使用大部分功能需要注册账户。您保证所提供信息真实、完整并及时更新。您须对账户、密码和
        API Key
        的保密与项下全部活动负责。发现账户不安全，应立即通过站内客服通知我们并轮换密钥。
      </p>
      <p>
        组织账户可由管理员邀请授权用户，并配置日志、权限、模型范围等。授权用户的行为视为该组织的行为。
      </p>

      <h2>4. 费用与余额</h2>

      <h3>4.1 预付余额</h3>
      <p>
        访问服务或其部分功能，需要账户中的预付余额或套餐额度。价格、倍率、分组以控制台当时展示为准。支付前您有机会核对金额。
      </p>
      <ul>
        <li>已消耗的调用费用不予退还，无论输出是否符合预期；</li>
        <li>USDT 等加密资产充值在链上确认后原则上不予退款；</li>
        <li>未消耗余额的处理见《退款政策》；</li>
        <li>因违规、欺诈、拒付或上游拒付导致的损失，我们可冻结余额并追偿。</li>
      </ul>
      <p>
        您授权我们按您选择的支付方式收取相应款项。若使用加密资产支付，您保证资金来源合法。
      </p>

      <h3>4.2 自动充值</h3>
      <p>
        若控制台提供自动充值，您开启即授权我们在余额低于您设定阈值时按所选方式扣款。您可随时关闭，对关闭前已发起的扣款仍有效。
      </p>

      <h3>4.3 价格变更</h3>
      <p>
        我们可调整价格、倍率或增加费用，并在合理范围内公示。您不接受的，应停止使用；已消耗费用仍按变更前实际发生的调用结算。
      </p>

      <h2>5. 上游模型条款</h2>

      <h3>5.1 适用与接受</h3>
      <p>
        服务使您、您的授权用户和您的客户能够访问模型提供方的模型。使用任一模型，即视为您同意并应确保上述主体遵守该模型当时有效的提供方条款（「模型条款」）。使用前请自行审阅。
      </p>

      <h3>5.2 向下传导</h3>
      <p>
        您须要求授权用户和客户仅按本条款、网站文档和模型条款使用服务。其行为与不作为由您负责。
      </p>

      <h3>5.3 变更、可用性与中止</h3>
      <p>
        模型条款可能被提供方修改。继续使用即视为接受更新。我们不保证任一模型持续可用，访问按「现状」「可用」提供。若我们合理认为存在违约风险，或提供方要求，可限制、暂停或终止对该模型的访问，我们对此不承担责任。
      </p>

      <h3>5.4 配置与选择</h3>
      <p>
        您自行负责选择模型、配置权限，并判断该模型及其条款是否适合您的业务、合规、高风险或面向客户的场景。
      </p>

      <h3>5.5 受限模型</h3>
      <p>
        部分提供方不允许特定主体、地区或用途访问其模型（「受限模型」）。您不得允许任何人通过
        VPN、代理或其他方式绕过我们或上游为受限模型设置的限制。
      </p>

      <h2>6. 用户内容</h2>
      <p>
        您可向服务提供图像、数据、文本等（「输入」），并获得基于输入的结果（「输出」；合称「用户内容」）。您授予我们为运营和提供服务所必需的、非独占、可转授权、全球范围、免版税许可。输入的版权仍归您或其他权利人；输出权属以相应模型条款为准。
      </p>
      <p>
        部分模型可能存储或使用输入以改进自身模型，并可能提供退出训练选项，详见模型条款。我们自身不把输入用于训练自有模型，也无法代上游承诺已全部关闭训练。
      </p>
      <p>
        若您在设置中开启提示词或会话日志，即额外授权我们为提供服务及改进路由、排障和风控而存储和处理相关用户内容。
      </p>
      <p>
        您保证：您是输入的权利人或已获充分授权；输入及按本条款使用输入不侵犯第三方权利，不违反法律。
      </p>

      <h2>7. 禁止行为</h2>
      <p>您不得：</p>
      <ul>
        <li>将服务用于违法目的，或违反任何适用法律；</li>
        <li>使用犯罪所得的加密资产充值；</li>
        <li>伪造身份、冒充他人或为规避限额创建多个账户；</li>
        <li>为转售 API 访问或开发竞争性爬取/镜像服务而访问网站或服务；</li>
        <li>使用自动化手段抓取网站或服务上的信息，或绕过防抓取措施；</li>
        <li>侵犯知识产权，或上传不符合所用模型条款的内容；</li>
        <li>干扰安全功能、逆向工程服务的任何部分；</li>
        <li>未经书面允许对模型进行越狱、提示注入或其他对抗性「红队」行为；</li>
        <li>
          传播恶意代码、骚扰其他用户、未经同意收集他人个人信息或攻击相关网络；
        </li>
        <li>从事欺诈、盗用账户或转让本条款项下的访问权。</li>
      </ul>

      <h2>8. 终止与变更</h2>
      <p>
        您可随时通过客服申请终止账户，但须结清终止前已发生的费用。您违反本条款的，使用许可自动终止，已消耗费用和按《退款政策》不予退还的余额不予退还。
      </p>
      <p>
        我们可随时暂停或终止账户、修改或中止服务（包括限制或取消部分功能），并尽快在合理范围内提示。除法律强制规定外，我们不对服务变更或访问中止承担责任。
      </p>

      <h2>9. 其他政策与非本站服务</h2>
      <p>
        《隐私政策》和《数据处理协议》（在组织或商业使用场景下）以引用方式构成本条款的一部分。第三方产品、工具或与服务对接的软件由该第三方条款约束，我们不就其可用性、安全或合规适合性作保证。
      </p>

      <h2>10. 条款变更</h2>
      <p>
        对实质影响您权利义务的变更，我们将尽量通过站内通知或其他合理方式提示。继续使用即视为同意。其他变更自本页公布时生效。您不同意的，应停止使用。
      </p>

      <h2>11. 所有权</h2>
      <p>
        服务的界面、设计、代码、文档和其他材料受知识产权法保护，归我们或许可方所有。未经明确授权，您不得使用。本条款未授予的权利均予保留。
      </p>

      <h2>12. 反馈</h2>
      <p>
        您提供的建议、问题反馈或改进意见，您授予我们不受限制、永久、不可撤销、免版税的使用权利，包括用于改进服务和开发其他产品。
      </p>

      <h2>13. 按「现状」提供，不作保证</h2>
      <p>
        服务及通过服务获得的一切材料、内容均按「现状」「可用」提供，不含任何明示或默示保证，包括适销性、特定用途适用性、权属、安静享用或不侵权。我们不保证服务不中断、安全、无错误或无有害组件，也不保证缺陷将被纠正。某些法域不允许排除保证，则上述排除在该范围内不适用。
      </p>

      <h2>14. 责任限制</h2>
      <p>
        在法律允许的最大范围内，我们不对因访问、使用或无法使用服务或其中内容而产生的任何间接、附带、特殊、后果性或惩罚性损害（包括利润、商誉或其他无形损失）负责，无论基于保证、合同、侵权（含过失）或其他理论，即使已被告知可能发生损害。
      </p>
      <p>
        对我们的累计赔偿责任，以您在引起索赔的事件发生前十二（12）个月内就相关服务实际支付的金额与
        100
        美元中的较高者为上限。某些法域不允许限制附带或后果性损害，则上述限制在该范围内不适用。
      </p>

      <h2>15. 适用法律与争议</h2>
      <p>
        本条款适用服务提供地当时有效的法律；强制性规定优先。鼓励先通过协商解决争议；协商不成的，提交有管辖权的法院。本条款不构成将争议固定提交新加坡或其他特定境外仲裁机构的约定。
      </p>

      <h2>16. 一般条款</h2>
      <p>
        本条款连同以引用方式纳入的政策，构成双方就使用服务的完整协议。未经我们事先书面同意，您不得转让本条款。我们可以转让本条款。任何条款被认定无效的，其余部分继续有效。与费用、用户内容、责任限制、知识产权和争议解决有关的条款在终止后仍然有效。
      </p>

      <h2>17. 电子通信</h2>
      <p>
        使用服务即表示您同意接收我们按《隐私政策》发送的电子通信；电子形式的通知视为满足书面形式要求。
      </p>

      <h2>18. 联系</h2>
      <p>服务由 Token Come（渡康）提供。问题请通过站内客服提交。</p>
      {(contactEmail || contactWeChatQR || contactQQ) && (
        <div className='border-border mt-6 rounded-lg border p-4'>
          <h3 className='mb-3 text-base font-semibold'>联系方式</h3>
          {contactEmail && (
            <p className='text-sm'>
              <strong>邮箱：</strong>
              <a
                href={`mailto:${contactEmail}`}
                className='text-primary hover:underline'
              >
                {contactEmail}
              </a>
            </p>
          )}
          {contactWeChatQR && (
            <div className='mt-2'>
              <p className='text-sm font-medium'>微信群：</p>
              <img
                src={contactWeChatQR}
                alt='微信群二维码'
                className='mt-2 h-32 w-32'
              />
            </div>
          )}
          {contactQQ && (
            <p className='mt-2 text-sm'>
              <strong>QQ 群：</strong>
              {contactQQ}
            </p>
          )}
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
        Welcome to this website and the console, API, and related technical
        support (collectively, the "Service"). These Terms of Service are a
        binding agreement between you and the operator of this site ("we" or
        "us").
      </p>

      <blockquote>
        <p>
          By clicking agree, registering, logging in, or actually calling the
          API, you acknowledge that you have read, understood, and agree to be
          bound by these Terms, the Privacy Policy, Acceptable Use Policy,
          Disclaimer, Refund Policy, and Data Processing Agreement. If you do
          not meet the eligibility requirements or do not agree, please do not
          use the Service.
        </p>
      </blockquote>

      <h2>1. Service Overview</h2>
      <p>
        We operate a large model API relay/aggregation platform: upon your
        request, we forward traffic to the interfaces of independent third-party
        model providers and provide billing, grouping, rate limiting, session
        persistence, and risk control. Generative models ("Models") listed on
        the site may be added, removed, or adjusted at any time. We do not train
        or host the underlying models you call.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 13 years old. If you are under 18, you must obtain
        parental or guardian consent. You represent that: you have not been
        previously suspended by us; your registration and use comply with
        applicable law. If you are using the Service on behalf of an
        organization, you represent that you have the authority to bind that
        organization to these Terms.
      </p>

      <h2>3. Account and Registration</h2>
      <p>
        Most features require account registration. You warrant that the
        information you provide is accurate, complete, and promptly updated. You
        are responsible for the confidentiality of your account, password, and
        API Keys, and for all activities under your account. If you discover
        that your account is compromised, notify us immediately via customer
        service and rotate your keys.
      </p>
      <p>
        Organization accounts may be managed by administrators who invite
        authorized users and configure logs, permissions, model scope, etc.
        Actions by authorized users are deemed actions of the organization.
      </p>

      <h2>4. Fees and Balance</h2>

      <h3>4.1 Prepaid Balance</h3>
      <p>
        Access to the Service or certain features requires prepaid balance or
        package quotas in your account. Prices, multipliers, and groupings are
        as displayed in the console at the time. You have the opportunity to
        review amounts before payment.
      </p>
      <ul>
        <li>
          Consumed call fees are non-refundable, regardless of whether the
          output meets your expectations;
        </li>
        <li>
          USDT and other crypto-asset top-ups are generally non-refundable once
          confirmed on-chain;
        </li>
        <li>Unconsumed balance is handled per the Refund Policy;</li>
        <li>
          We may freeze balance and seek reimbursement for losses caused by
          violations, fraud, chargebacks, or upstream chargebacks.
        </li>
      </ul>
      <p>
        You authorize us to charge according to your selected payment method. If
        using crypto assets, you warrant that the source of funds is lawful.
      </p>

      <h3>4.2 Auto-Recharge</h3>
      <p>
        If the console offers auto-recharge and you enable it, you authorize us
        to charge via your selected method when your balance falls below your
        set threshold. You may disable it at any time; charges already initiated
        before disabling remain valid.
      </p>

      <h3>4.3 Price Changes</h3>
      <p>
        We may adjust prices, multipliers, or add fees, and will publish such
        changes within a reasonable scope. If you do not accept the changes,
        stop using the Service; consumed fees are still settled based on calls
        made before the change.
      </p>

      <h2>5. Upstream Model Terms</h2>

      <h3>5.1 Applicability and Acceptance</h3>
      <p>
        The Service enables you, your authorized users, and your customers to
        access models from model providers. Use of any model constitutes your
        agreement that you and such parties will comply with the provider's
        terms then in effect ("Model Terms"). Please review them before use.
      </p>

      <h3>5.2 Flow-Down</h3>
      <p>
        You must require authorized users and customers to use the Service only
        in accordance with these Terms, site documentation, and Model Terms. You
        are responsible for their acts and omissions.
      </p>

      <h3>5.3 Changes, Availability, and Suspension</h3>
      <p>
        Model Terms may be modified by providers. Continued use constitutes
        acceptance of updates. We do not guarantee that any model will remain
        available; access is provided "as is" and "as available." If we
        reasonably believe there is a risk of breach, or a provider requests, we
        may restrict, suspend, or terminate access to a model without liability.
      </p>

      <h3>5.4 Configuration and Selection</h3>
      <p>
        You are solely responsible for selecting models, configuring
        permissions, and determining whether a model and its terms suit your
        business, compliance, high-risk, or customer-facing scenarios.
      </p>

      <h3>5.5 Restricted Models</h3>
      <p>
        Some providers do not allow specific entities, regions, or use cases to
        access their models ("Restricted Models"). You must not allow anyone to
        bypass restrictions we or upstream providers set for Restricted Models
        via VPN, proxies, or other means.
      </p>

      <h2>6. User Content</h2>
      <p>
        You may provide images, data, text, etc. ("Input") to the Service and
        receive results based on Input ("Output"; collectively "User Content").
        You grant us a non-exclusive, sublicensable, worldwide, royalty-free
        license to the extent necessary to operate and provide the Service.
        Copyright in Input remains with you or other rights holders; Output
        ownership is governed by applicable Model Terms.
      </p>
      <p>
        Some models may store or use Input to improve their own models and may
        offer training opt-out options; see Model Terms. We do not use Input to
        train proprietary models, nor can we guarantee on behalf of upstream
        providers that training is fully disabled.
      </p>
      <p>
        If you enable prompt or session logging in settings, you additionally
        authorize us to store and process related User Content for providing the
        Service, improving routing, troubleshooting, and risk control.
      </p>
      <p>
        You warrant that: you are the rights holder of Input or have obtained
        sufficient authorization; Input and use of Input under these Terms do
        not infringe third-party rights and do not violate law.
      </p>

      <h2>7. Prohibited Conduct</h2>
      <p>You must not:</p>
      <ul>
        <li>
          Use the Service for illegal purposes or violate any applicable law;
        </li>
        <li>Top up with crypto assets derived from criminal proceeds;</li>
        <li>
          Falsify identity, impersonate others, or create multiple accounts to
          evade limits;
        </li>
        <li>
          Access the site or Service to resell API access or develop competitive
          scraping/mirroring services;
        </li>
        <li>
          Use automated means to scrape information from the site or Service, or
          bypass anti-scraping measures;
        </li>
        <li>
          Infringe intellectual property or upload content that violates
          applicable Model Terms;
        </li>
        <li>
          Interfere with security features or reverse-engineer any part of the
          Service;
        </li>
        <li>
          Jailbreak, prompt inject, or conduct other adversarial "red team"
          activities on models without written permission;
        </li>
        <li>
          Distribute malicious code, harass other users, collect others'
          personal information without consent, or attack related networks;
        </li>
        <li>
          Engage in fraud, account hijacking, or transfer access rights under
          these Terms.
        </li>
      </ul>

      <h2>8. Termination and Changes</h2>
      <p>
        You may request account termination via customer service at any time,
        but must settle fees incurred before termination. If you breach these
        Terms, the license automatically terminates, and consumed fees and
        balance non-refundable per the Refund Policy will not be returned.
      </p>
      <p>
        We may suspend or terminate accounts, modify or discontinue the Service
        (including restricting or removing certain features) at any time and
        will notify you as soon as reasonably practicable. Except as mandated by
        law, we are not liable for Service changes or access interruptions.
      </p>

      <h2>9. Other Policies and Third-Party Services</h2>
      <p>
        The Privacy Policy and Data Processing Agreement (in organizational or
        commercial use scenarios) are incorporated by reference. Third-party
        products, tools, or software interfacing with the Service are governed
        by their respective terms; we make no warranty as to their availability,
        security, or compliance suitability.
      </p>

      <h2>10. Changes to These Terms</h2>
      <p>
        For changes that materially affect your rights or obligations, we will
        endeavor to provide notice via the site or other reasonable means.
        Continued use constitutes consent. Other changes take effect upon
        publication on this page. If you do not agree, stop using the Service.
      </p>

      <h2>11. Ownership</h2>
      <p>
        The Service's interface, design, code, documentation, and other
        materials are protected by intellectual property law and owned by us or
        our licensors. You may not use them without express authorization. All
        rights not granted are reserved.
      </p>

      <h2>12. Feedback</h2>
      <p>
        You grant us unrestricted, perpetual, irrevocable, royalty-free rights
        to any suggestions, issue reports, or improvement ideas you provide,
        including to improve the Service and develop other products.
      </p>

      <h2>13. Provided "As Is," No Warranty</h2>
      <p>
        The Service and all materials and content obtained through the Service
        are provided "as is" and "as available" without any warranty of any
        kind, express or implied, including warranties of merchantability,
        fitness for a particular purpose, title, quiet enjoyment, or
        non-infringement. We do not warrant that the Service will be
        uninterrupted, secure, error-free, or free of harmful components, nor
        that defects will be corrected. Some jurisdictions do not allow the
        exclusion of warranties; in such cases, the above exclusion does not
        apply to the extent prohibited.
      </p>

      <h2>14. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, we are not liable for any
        indirect, incidental, special, consequential, or punitive damages
        (including loss of profits, goodwill, or other intangible losses)
        arising from access to, use of, or inability to use the Service or its
        content, regardless of whether based on warranty, contract, tort
        (including negligence), or other theory, even if we have been advised of
        the possibility of such damages.
      </p>
      <p>
        Our aggregate liability to you shall not exceed the greater of the
        amount you actually paid for the Service in the twelve (12) months
        preceding the event giving rise to the claim or $100. Some jurisdictions
        do not allow the limitation of incidental or consequential damages; in
        such cases, the above limitation does not apply to the extent
        prohibited.
      </p>

      <h2>15. Governing Law and Disputes</h2>
      <p>
        These Terms are governed by the law then in effect at the location where
        the Service is provided; mandatory provisions take precedence. Parties
        are encouraged to resolve disputes through negotiation first; failing
        that, disputes are submitted to a court of competent jurisdiction. These
        Terms do not constitute an agreement to submit disputes to Singapore or
        any other specific foreign arbitration institution.
      </p>

      <h2>16. General Provisions</h2>
      <p>
        These Terms, together with policies incorporated by reference,
        constitute the entire agreement between the parties regarding use of the
        Service. You may not assign these Terms without our prior written
        consent. We may assign these Terms. If any provision is found invalid,
        the remainder continues in effect. Provisions related to fees, User
        Content, limitation of liability, intellectual property, and dispute
        resolution survive termination.
      </p>

      <h2>17. Electronic Communications</h2>
      <p>
        By using the Service, you consent to receive electronic communications
        from us as described in the Privacy Policy; electronic notices satisfy
        any written notice requirement.
      </p>

      <h2>18. Contact</h2>
      <p>
        The Service is provided by Token Come. Please submit inquiries via
        customer service.
      </p>

      {(contactEmail || contactWeChatQR || contactQQ) && (
        <div className='border-border mt-6 rounded-lg border p-4'>
          <h3 className='mb-3 text-base font-semibold'>Contact Information</h3>
          {contactEmail && (
            <p className='text-sm'>
              <strong>Email:</strong>{' '}
              <a
                href={`mailto:${contactEmail}`}
                className='text-primary hover:underline'
              >
                {contactEmail}
              </a>
            </p>
          )}
          {contactWeChatQR && (
            <div className='mt-2'>
              <p className='text-sm font-medium'>WeChat Group:</p>
              <img
                src={contactWeChatQR}
                alt='WeChat Group QR Code'
                className='mt-2 h-32 w-32'
              />
            </div>
          )}
          {contactQQ && (
            <p className='mt-2 text-sm'>
              <strong>QQ Group:</strong> {contactQQ}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

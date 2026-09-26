// Copyright (C) 2024 QuantumNous. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'

import { LegalPageLayout } from './legal-page-layout'

export function PrivacyPolicy() {
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
          {isEnglish ? 'Privacy Policy' : '隐私政策'}
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
        Token
        Come（渡康）运营方（「我们」）重视您的隐私。本政策说明您使用本网站（含
        api.tokencome.org 及我们实际提供服务的相关域名，下称「网站」）和 API
        中转 /
        聚合服务（下称「服务」）时，我们如何收集、使用、保存和披露个人信息，以及您可以作出的选择。本政策未定义的用语，适用《服务条款》。
      </p>

      <p>本政策适用于通过下列途径收集的个人信息：</p>
      <ul>
        <li>您访问网站及所有关联页面；</li>
        <li>您与带有本政策链接的第三方应用或页面交互；</li>
        <li>您使用服务，包括控制台、API、充值与客服。</li>
      </ul>

      <p>
        使用网站或服务，即表示您同意按本政策和《服务条款》处理您的个人信息。若您不能接受，请停止访问和使用。
      </p>

      <blockquote>
        <p>
          我们可能不经单独通知修订本政策，修订可适用于已持有的数据以及此后收集的数据。修订文本将发布于本页并更新顶部日期。您继续使用或再次访问，即视为接受修订。
        </p>
      </blockquote>

      <h2>1. 我们收集的个人信息</h2>
      <p>
        个人信息指能够直接或间接识别您的信息，包括但不限于姓名、邮箱、电话、账户标识，以及您向服务提交的含个人信息的文本或文件（「输入」）。提示词与模型输入、输出的处理还受《服务条款》约束。我们无法控制、也不对上游大模型如何处理您的输入或输出负责，包括其是否用于模型训练。
      </p>

      <h3>您主动提供的信息</h3>
      <ul>
        <li>注册、登录、资料填写、使用服务和提交输入时提供的信息；</li>
        <li>与我们的通信记录（含邮箱和其他联系方式）；</li>
        <li>您自愿填写的问卷或反馈；</li>
        <li>
          充值、订单、退款申请、支付回执（含链上交易哈希等支付通道返回的必要字段）；
        </li>
        <li>您在网站上的搜索与查询。</li>
      </ul>

      <h3>自动收集的信息</h3>
      <ul>
        <li>
          访问详情：流量、粗略位置（由 IP
          推断）、日志、浏览记录、点击与浏览的页面及其他通信数据；
        </li>
        <li>设备与网络：IP、操作系统、浏览器、时区及其他在线标识；</li>
        <li>通过 Cookie / 本地存储记录的偏好，以便更顺畅地使用网站。</li>
      </ul>

      <h3>Cookie 与同类技术</h3>
      <p>
        我们可能使用
        Cookie、嵌入脚本及类似跟踪技术，以便识别您、定制内容和分析使用情况。Cookie
        是网站通过浏览器放到您设备上的小型文件。我们使用第一方和第三方
        Cookie，目的包括：使网站正常运行、改进服务、简化登录、在您返回时识别您、记录交互，以及提供更安全的浏览。
      </p>
      <ul>
        <li>
          <strong>严格必要 Cookie</strong>
          ：使您能够使用登录、会话、安全等区域，关闭后部分功能无法提供；
        </li>
        <li>
          <strong>功能 / 偏好 Cookie</strong>
          ：记住语言、主题等选择，提供个性化体验；
        </li>
        <li>
          <strong>性能 / 统计 Cookie</strong>
          ：收集您如何使用网站的被动信息，用于改进和优化。您可以在浏览器中拒绝非必要
          Cookie。
        </li>
      </ul>
      <p>
        浏览器通常允许拒绝或删除 Cookie。若禁用
        Cookie，您可能无法进入需登录的区域，其他部分也可能无法正常工作。
      </p>
      <p>
        我们可能使用第三方统计服务分析网站使用，并收集点击流数据（接入商域名、设备类型、IP、浏览器版本、操作系统、停留时间、浏览页面、搜索词及相关统计）。
      </p>

      <h2>2. 我们如何使用个人信息</h2>
      <p>仅用于本政策所述或在处理前已向您披露的目的，包括：</p>
      <ul>
        <li>提供、维护、计费和展示用量；</li>
        <li>就您注册的功能发送管理通知、账户与安全告警；</li>
        <li>告知网站、政策、条款或服务变更；</li>
        <li>在您未反对的情况下发送产品或活动通知（可退订）；</li>
        <li>回复您的问题或请求；</li>
        <li>让您参与网站和服务的交互功能；</li>
        <li>按偏好定制体验，保存账户与资料以免重复填写；</li>
        <li>记录回访与使用情况，编制统计并改进功能；</li>
        <li>反垃圾、反恶意软件、反欺诈和安全防护；</li>
        <li>遵守法律、执行《服务条款》与《可接受使用政策》、处理争议。</li>
      </ul>
      <p>
        我们 <strong>不出售</strong> 个人信息。我们自身{' '}
        <strong>不把您的输入用于训练自有模型</strong>
        。上游是否留存、审核或用于训练，以该上游当时有效的条款为准。
      </p>
      <p>
        经汇总或去标识后，我们可能用于分析服务效果、研究使用行为，或在不识别个人的前提下改进体验。处理反馈、生成分析报告时，我们会把输入/输出与用户标识分离。
      </p>

      <h2>3. 共享与披露</h2>
      <p>仅在下列情形共享或披露：</p>
      <ul>
        <li>
          <strong>服务提供商</strong>
          ：托管、CDN、支付、邮件、验证码等，仅为其完成受托任务，并不得挪作他用；
        </li>
        <li>
          <strong>关联方与业务合作方</strong>：仅为提供服务所必需；
        </li>
        <li>
          <strong>企业交易</strong>
          ：合并、分立、重组、解散或资产转让时，用户个人信息可能作为业务资产转移；
        </li>
        <li>
          <strong>经您同意</strong> 的其他目的；
        </li>
        <li>
          <strong>法律要求</strong>
          ：为遵守司法或行政机关的合法要求，执行条款，处理侵权主张，或保护本站、用户或公众的权利、财产与安全。
        </li>
      </ul>
      <p>为完成您发起的调用，我们必须向上游模型提供方转发输入并接收输出。</p>

      <h2>4. 您的权利与选择</h2>
      <p>
        营销通知可按邮件中的退订说明或通过站内客服关闭；退订可能需要合理处理时间。
      </p>
      <p>
        您可在控制台查阅和更正账户资料。若不再希望使用服务或不再希望我们处理个人信息，可通过站内客服申请删除账户（须完成身份验证）。删除一旦确认通常不可撤回；计费、反洗钱、税务、争议或法律强制留存的记录可能依法保留。
      </p>
      <p>
        在适用法律允许的范围内，您可以：知情、查阅与可携带、删除、更正、反对或限制非必要处理、撤回同意（不影响撤回前的合法处理）。请通过站内客服提交请求。
      </p>

      <h2>5. 数据安全</h2>
      <p>
        我们采取与风险相称的物理、技术和组织措施，包括访问控制、传输加密、最小权限和安全监控。您须妥善保管密码与
        API Key。互联网传输无法保证绝对安全，任何传输的风险由您自行承担。
      </p>

      <h2>6. 第三方平台</h2>
      <p>
        网站可能链接或集成第三方网站、应用或支付通道。我们不对其隐私实践负责。您离开本站后，应阅读对方的隐私政策。本政策仅适用于我们收集的信息。
      </p>

      <h2>7. 保存期限</h2>
      <p>
        我们将在业务、计费、风控和合规所需的期限内保存信息；不再需要时删除或匿名化。
      </p>

      <h2>8. 年龄</h2>
      <p>
        服务仅向年满 13 周岁的用户提供。未满 18
        周岁应在监护人同意下使用。不符合上述条件请勿使用。
      </p>

      <h2>9. 跨境传输</h2>
      <p>
        您的信息可能被传输到服务器所在地、支付通道所在地或上游模型所在地。我们将在可行范围内采取适当保护措施。
      </p>

      <h2>10. 适用法律</h2>
      <p>
        因本政策或使用服务产生的争议，适用服务提供地当时有效的法律；法律另有强制性规定的，从其规定。我们不因提供中转服务而自动成为任何特定法域的持牌金融机构、内容平台或模型开发者。
      </p>

      <h2>11. 个人信息类别说明</h2>
      <p>
        我们可能处理：标识符（账户、联系方式、IP
        与设备标识）；商业信息（订单与余额流水）；网络活动信息；通信信息；由 IP
        推断的粗略位置；账户凭证。用途见本政策：提供与分析服务、安全与防欺诈、沟通以及守法。
      </p>

      <p>
        隐私相关请求请通过本站客服渠道提交。本政策与《服务条款》冲突时，就个人信息处理以本政策为准。
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
        Token Come ("we," "us," or "our") values your privacy. This policy
        explains how we collect, use, store, and disclose personal information
        when you use our website (including api.tokencome.org and related
        domains where we provide services, "Website") and API
        gateway/aggregation services ("Services"), and the choices you can make.
        Terms not defined here have the meanings given in our Terms of Service.
      </p>

      <p>This policy applies to personal information collected through:</p>
      <ul>
        <li>Your visits to the Website and all associated pages;</li>
        <li>
          Your interactions with third-party applications or pages that link to
          this policy;
        </li>
        <li>
          Your use of the Services, including the console, API, billing, and
          customer support.
        </li>
      </ul>

      <p>
        By using the Website or Services, you consent to the processing of your
        personal information as described in this policy and our Terms of
        Service. If you do not agree, please discontinue access and use.
      </p>

      <blockquote>
        <p>
          We may revise this policy without separate notice. Revisions may apply
          to data already held as well as data collected thereafter. The revised
          text will be published on this page with an updated date at the top.
          Your continued use or return visit constitutes acceptance of the
          revision.
        </p>
      </blockquote>

      <h2>1. Personal Information We Collect</h2>
      <p>
        Personal information means information that can directly or indirectly
        identify you, including but not limited to name, email, phone number,
        account identifiers, and text or files containing personal information
        that you submit to the Services ("Input"). The processing of prompts,
        model inputs, and outputs is also governed by our Terms of Service. We
        have no control over, and are not responsible for, how upstream large
        language models process your Input or Output, including whether they use
        it for model training.
      </p>

      <h3>Information You Provide</h3>
      <ul>
        <li>
          Information provided when you register, log in, fill out your profile,
          use the Services, or submit Input;
        </li>
        <li>
          Communication records with us (including email and other contact
          methods);
        </li>
        <li>Surveys or feedback you voluntarily submit;</li>
        <li>
          Billing, orders, refund requests, payment receipts (including
          transaction hashes and other necessary fields returned by payment
          channels);
        </li>
        <li>Your searches and queries on the Website.</li>
      </ul>

      <h3>Automatically Collected Information</h3>
      <ul>
        <li>
          Access details: traffic, approximate location (inferred from IP),
          logs, browsing history, pages clicked and viewed, and other
          communication data;
        </li>
        <li>
          Device and network: IP address, operating system, browser, time zone,
          and other online identifiers;
        </li>
        <li>
          Preferences recorded via cookies/local storage to facilitate smoother
          use of the Website.
        </li>
      </ul>

      <h3>Cookies and Similar Technologies</h3>
      <p>
        We may use cookies, embedded scripts, and similar tracking technologies
        to recognize you, customize content, and analyze usage. Cookies are
        small files placed on your device by the Website through your browser.
        We use first-party and third-party cookies for purposes including:
        enabling the Website to function properly, improving the Services,
        simplifying login, recognizing you when you return, recording
        interactions, and providing a more secure browsing experience.
      </p>
      <ul>
        <li>
          <strong>Strictly Necessary Cookies</strong>: Enable you to use login,
          session, security, and other areas; disabling them may prevent some
          functionality from being provided;
        </li>
        <li>
          <strong>Functional/Preference Cookies</strong>: Remember choices like
          language and theme to provide a personalized experience;
        </li>
        <li>
          <strong>Performance/Analytics Cookies</strong>: Collect passive
          information about how you use the Website for improvement and
          optimization. You can refuse non-essential cookies in your browser.
        </li>
      </ul>
      <p>
        Browsers typically allow you to refuse or delete cookies. If you disable
        cookies, you may not be able to access areas requiring login, and other
        parts may not function properly.
      </p>
      <p>
        We may use third-party analytics services to analyze Website usage and
        collect clickstream data (ISP domain, device type, IP, browser version,
        operating system, time spent, pages viewed, search terms, and related
        statistics).
      </p>

      <h2>2. How We Use Personal Information</h2>
      <p>
        Only for purposes described in this policy or disclosed to you before
        processing, including:
      </p>
      <ul>
        <li>Providing, maintaining, billing, and displaying usage;</li>
        <li>
          Sending administrative notices, account and security alerts for
          features you registered for;
        </li>
        <li>
          Informing you of changes to the Website, policies, terms, or Services;
        </li>
        <li>
          Sending product or activity notices unless you object (you may
          unsubscribe);
        </li>
        <li>Responding to your questions or requests;</li>
        <li>
          Enabling you to participate in interactive features of the Website and
          Services;
        </li>
        <li>
          Customizing your experience and saving your account and profile to
          avoid re-entry;
        </li>
        <li>
          Recording return visits and usage, compiling statistics, and improving
          functionality;
        </li>
        <li>Anti-spam, anti-malware, anti-fraud, and security protection;</li>
        <li>
          Complying with laws, enforcing the Terms of Service and Acceptable Use
          Policy, and handling disputes.
        </li>
      </ul>
      <p>
        We <strong>do not sell</strong> personal information. We{' '}
        <strong>do not use your Input to train our own models</strong>. Whether
        upstream providers retain, review, or use it for training is governed by
        their terms in effect at the time.
      </p>
      <p>
        After aggregation or de-identification, we may use it to analyze service
        effectiveness, study usage behavior, or improve experience without
        identifying individuals. When processing feedback or generating analysis
        reports, we separate Input/Output from user identifiers.
      </p>

      <h2>3. Sharing and Disclosure</h2>
      <p>We only share or disclose in the following circumstances:</p>
      <ul>
        <li>
          <strong>Service Providers</strong>: Hosting, CDN, payment, email,
          verification codes, etc., solely to complete their assigned tasks and
          not for other purposes;
        </li>
        <li>
          <strong>Affiliates and Business Partners</strong>: Only as necessary
          to provide the Services;
        </li>
        <li>
          <strong>Corporate Transactions</strong>: In mergers, divisions,
          reorganizations, dissolutions, or asset transfers, user personal
          information may be transferred as a business asset;
        </li>
        <li>
          <strong>With Your Consent</strong> for other purposes;
        </li>
        <li>
          <strong>Legal Requirements</strong>: To comply with lawful requests
          from judicial or administrative authorities, enforce terms, handle
          infringement claims, or protect the rights, property, and safety of
          this site, users, or the public.
        </li>
      </ul>
      <p>
        To complete the calls you initiate, we must forward Input to upstream
        model providers and receive Output.
      </p>

      <h2>4. Your Rights and Choices</h2>
      <p>
        You may close marketing notices by following the unsubscribe
        instructions in the email or through customer service; unsubscribing may
        require reasonable processing time.
      </p>
      <p>
        You can view and correct your account information in the console. If you
        no longer wish to use the Services or no longer wish us to process your
        personal information, you may request account deletion through customer
        service (identity verification required). Deletion, once confirmed, is
        usually irreversible; records required for billing, anti-money
        laundering, tax, dispute resolution, or legal retention may be retained
        as required by law.
      </p>
      <p>
        To the extent permitted by applicable law, you may: be informed, access
        and port your data, delete, correct, object to or restrict non-essential
        processing, and withdraw consent (without affecting lawful processing
        before withdrawal). Please submit requests through customer service.
      </p>

      <h2>5. Data Security</h2>
      <p>
        We employ physical, technical, and organizational measures commensurate
        with risk, including access controls, transmission encryption, least
        privilege, and security monitoring. You must properly safeguard your
        password and API Key. Internet transmission cannot guarantee absolute
        security; you assume the risk of any transmission.
      </p>

      <h2>6. Third-Party Platforms</h2>
      <p>
        The Website may link to or integrate third-party websites, applications,
        or payment channels. We are not responsible for their privacy practices.
        After leaving this site, you should read their privacy policies. This
        policy applies only to information we collect.
      </p>

      <h2>7. Retention Period</h2>
      <p>
        We will retain information for the period required by business, billing,
        risk control, and compliance needs; when no longer needed, we delete or
        anonymize it.
      </p>

      <h2>8. Age</h2>
      <p>
        The Services are only provided to users aged 13 and above. Those under
        18 should use them with guardian consent. Do not use if you do not meet
        these conditions.
      </p>

      <h2>9. Cross-Border Transfer</h2>
      <p>
        Your information may be transferred to the location of our servers,
        payment channels, or upstream models. We will take appropriate
        safeguards to the extent feasible.
      </p>

      <h2>10. Applicable Law</h2>
      <p>
        Disputes arising from this policy or use of the Services are governed by
        the law in effect at the place where the Services are provided; where
        law mandates otherwise, that law applies. We do not automatically become
        a licensed financial institution, content platform, or model developer
        in any particular jurisdiction by providing gateway services.
      </p>

      <h2>11. Categories of Personal Information</h2>
      <p>
        We may process: identifiers (accounts, contact details, IP and device
        identifiers); commercial information (orders and balance transactions);
        network activity information; communication information; approximate
        location inferred from IP; account credentials. Purposes are described
        in this policy: providing and analyzing the Services, security and fraud
        prevention, communication, and legal compliance.
      </p>

      <p>
        For privacy-related requests, please submit through our customer service
        channels. In the event of a conflict between this policy and the Terms
        of Service regarding personal information processing, this policy
        prevails.
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

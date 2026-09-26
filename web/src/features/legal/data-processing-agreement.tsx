// Copyright (C) 2024 QuantumNous. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'

import { LegalPageLayout } from './legal-page-layout'

export function DataProcessingAgreement() {
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
          {isEnglish ? 'Data Processing Agreement' : '数据处理协议'}
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
        本协议由 Token Come
        运营方（「处理者」）与接受《服务条款》的客户（「客户」或「控制者」）订立，并以引用方式构成《服务条款》的一部分。
      </p>
      <p>
        本协议适用于您代表组织接受条款，或将服务用于商业、营利目的的情形。若您仅以个人身份使用，您的数据处理适用《隐私政策》。
      </p>

      <h2>1. 定义</h2>
      <p>
        「个人数据」指与已识别或可识别自然人有关的任何信息。「处理」包括收集、存储、使用、传输、公开、限制、删除等操作。「控制者」决定处理目的与方式；「处理者」受控制者委托处理；「再处理者」指处理者委托的第三方；「数据泄露」指导致个人数据意外或非法销毁、丢失、更改、未经授权披露或访问的安全事件。「适用数据保护法律」包括对本次处理适用的全部法律（在其适用范围内可包括
        GDPR 等）。
      </p>

      <h2>2. 范围与角色</h2>
      <p>本协议适用于我们受客户委托处理个人数据的情形：</p>
      <ul>
        <li>
          <strong>客户（控制者）</strong>：决定将哪些数据送入 API
          以及用于何种业务目的；
        </li>
        <li>
          <strong>本站（处理者）</strong>：仅按客户指示，为提供 API
          路由、计费和风控而传输、格式化和返回数据，不自行决定处理目的。
        </li>
      </ul>
      <p>
        账户注册、账单和安全日志中我们作为独立控制者处理的数据，适用《隐私政策》，不适用本
        DPA 的「仅按指示处理」条款。
      </p>

      <h2>3. 处理详情</h2>
      <ul>
        <li>
          <strong>处理性质</strong>：经 API 传输、路由、格式化并返回；
        </li>
        <li>
          <strong>目的</strong>：向客户提供大模型 API 聚合与路由；
        </li>
        <li>
          <strong>个人数据类别</strong>：客户通过 API
          提交的输入（可能含终端用户个人数据）、账户标识、API 用量元数据；
        </li>
        <li>
          <strong>数据主体</strong>：客户的终端用户、员工或授权用户；
        </li>
        <li>
          <strong>期限</strong>
          ：服务期间，或客户另行书面指示的期间，以及法律强制留存期间。
        </li>
      </ul>

      <h2>4. 我们的义务</h2>
      <p>作为处理者，我们承诺：</p>
      <ul>
        <li>
          仅按客户的书面指示（含通过 API
          发出的请求）以及本协议与《服务条款》处理；法律强制处理时，在法律允许范围内事先告知客户；
        </li>
        <li>确保授权人员负有保密义务；</li>
        <li>采取与风险相称的技术和组织措施；</li>
        <li>按第 6 条约束再处理者；</li>
        <li>
          在合理可行范围内，协助客户回应数据主体请求，以及履行安全、泄露通知、影响评估等义务；
        </li>
        <li>
          服务结束后按客户选择删除或返还处理者角色下的个人数据，法律要求保留的除外；
        </li>
        <li>
          应要求提供证明遵守本协议所合理必需的信息，并在合理通知下配合审计。
        </li>
      </ul>

      <h2>5. 安全措施</h2>
      <p>
        包括但不限于：API 通信使用
        TLS；对存储个人数据的系统实行最小权限访问控制；租户隔离；限制敏感凭证的读取和使用；持续安全监控；定期内部评估。
      </p>

      <h2>6. 再处理者</h2>
      <p>
        您授权我们使用为提供服务所必需的再处理者，包括上游模型提供方、支付通道、云主机、CDN、邮件与验证码服务。我们要求再处理者承担不低于本协议的保密与安全义务。因智能路由必须把加密后的
        API 载荷转发到您请求指定的上游接口。现行再处理者名单可通过站内客服查询。
      </p>
      <p>
        拟新增或更换再处理者时，我们将在合理期限内通过站内或其他书面方式提示，以便您提出合理异议。双方应善意协商解决方案。
      </p>

      <h2>7. 数据泄露通知</h2>
      <p>
        知悉影响您所托数据的泄露后，我们将在无不当迟延的情况下书面通知您（目标不超过
        72
        小时），并在可获得的范围内提供：泄露性质、受影响主体与记录的大致类别和数量、可能后果以及已采取或拟采取的措施。信息可分阶段补充。我们将在合理范围内协助您履行对监管机构和数据主体的通知义务。
      </p>

      <h2>8. 数据主体权利</h2>
      <p>
        我们将在合理可行范围内，通过适当措施协助客户回应查阅、更正、删除、限制处理、可携带和反对等请求。
      </p>

      <h2>9. 保存与删除</h2>
      <p>
        仅在提供服务或法律要求的期限内保存。默认在未开启提示词日志时，一次 API
        调用完成后我们不为训练目的保存输入/输出正文。服务关系结束或应您书面请求，我们将在合理期限（不超过三十日）内删除或按常用格式返还后删除；法律强制留存的将隔离且不再用于其他处理。
      </p>

      <h2>10. 跨境传输</h2>
      <p>
        个人数据可能被处理于服务器或上游所在国家/地区。跨境时，我们将在适用法律要求的范围内采用合理保障措施（例如标准合同条款、充分性认定或其他被承认的机制）。
      </p>

      <h2>11. 审计</h2>
      <p>
        经不少于三十日的事先通知，且原则上每年不超过一次，您可自行或通过负有保密义务的独立审计方，审计我们处理您所托个人数据的方式。审计费用由您承担，我们给予合理配合。
      </p>

      <h2>12. 效力、法律与期限</h2>
      <p>
        就处理者角色下的个人数据保护，本 DPA
        优于《服务条款》的冲突条款。本协议自您接受《服务条款》时生效，至服务关系终止；删除或返还义务在履行完毕前继续有效。争议解决方式与《服务条款》一致，不适用将争议固定提交特定境外仲裁机构的安排。
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
        This agreement is entered into by the Token Come operator ("Processor")
        and the customer accepting the Terms of Service ("Customer" or
        "Controller"), and is incorporated by reference into the Terms of
        Service.
      </p>
      <p>
        This agreement applies when you accept the terms on behalf of an
        organization or use the Services for commercial or profit-making
        purposes. If you use them solely in a personal capacity, your data
        processing is governed by the Privacy Policy.
      </p>

      <h2>1. Definitions</h2>
      <p>
        "Personal Data" means any information relating to an identified or
        identifiable natural person. "Processing" includes operations such as
        collection, storage, use, transmission, disclosure, restriction, and
        deletion. "Controller" determines the purposes and means of processing;
        "Processor" is commissioned by the Controller to process;
        "Sub-processor" means a third party engaged by the Processor; "Data
        Breach" means a security incident leading to accidental or unlawful
        destruction, loss, alteration, unauthorized disclosure, or access to
        Personal Data. "Applicable Data Protection Laws" includes all laws
        applicable to this processing (which may include GDPR within their
        scope).
      </p>

      <h2>2. Scope and Roles</h2>
      <p>
        This agreement applies when we process Personal Data on behalf of the
        Customer:
      </p>
      <ul>
        <li>
          <strong>Customer (Controller)</strong>: Decides what data to submit
          via API and for what business purposes;
        </li>
        <li>
          <strong>This site (Processor)</strong>: Only processes according to
          Customer instructions, transmits, formats, and returns data for the
          purpose of providing API routing, billing, and risk control; does not
          independently determine processing purposes.
        </li>
      </ul>
      <p>
        Data we process as an independent Controller in account registration,
        billing, and security logs is governed by the Privacy Policy and is not
        subject to the "processing only on instruction" clause of this DPA.
      </p>

      <h2>3. Processing Details</h2>
      <ul>
        <li>
          <strong>Nature of processing</strong>: Transmission, routing,
          formatting, and return via API;
        </li>
        <li>
          <strong>Purpose</strong>: Provide large language model API aggregation
          and routing to Customer;
        </li>
        <li>
          <strong>Categories of Personal Data</strong>: Input submitted by
          Customer via API (may contain end user Personal Data), account
          identifiers, API usage metadata;
        </li>
        <li>
          <strong>Data subjects</strong>: Customer's end users, employees, or
          authorized users;
        </li>
        <li>
          <strong>Duration</strong>: During the service period, or as otherwise
          instructed in writing by Customer, plus legally mandated retention
          periods.
        </li>
      </ul>

      <h2>4. Our Obligations</h2>
      <p>As Processor, we commit to:</p>
      <ul>
        <li>
          Process only according to Customer's written instructions (including
          requests issued via API), this agreement, and the Terms of Service;
          when legally compelled to process, inform Customer in advance to the
          extent permitted by law;
        </li>
        <li>
          Ensure authorized personnel are subject to confidentiality
          obligations;
        </li>
        <li>
          Implement technical and organizational measures commensurate with
          risk;
        </li>
        <li>Bind Sub-processors according to Section 6;</li>
        <li>
          Assist Customer, to the extent reasonably practicable, in responding
          to data subject requests and fulfilling security, breach notification,
          impact assessment, and other obligations;
        </li>
        <li>
          After service termination, delete or return Personal Data processed in
          the Processor role as chosen by Customer, except as legally required
          to retain;
        </li>
        <li>
          Provide information reasonably necessary to demonstrate compliance
          with this agreement upon request, and cooperate with audits on
          reasonable notice.
        </li>
      </ul>

      <h2>5. Security Measures</h2>
      <p>
        Including but not limited to: API communication uses TLS; systems
        storing Personal Data implement least privilege access control; tenant
        isolation; restricted access to and use of sensitive credentials;
        continuous security monitoring; regular internal assessment.
      </p>

      <h2>6. Sub-processors</h2>
      <p>
        You authorize us to use Sub-processors necessary to provide the
        Services, including upstream model providers, payment channels, cloud
        hosts, CDN, email, and verification code services. We require
        Sub-processors to assume confidentiality and security obligations no
        less than those in this agreement. Due to intelligent routing, encrypted
        API payloads must be forwarded to the upstream interface you request.
        The current Sub-processor list may be queried through customer service.
      </p>
      <p>
        When intending to add or replace a Sub-processor, we will notify you
        through on-site or other written means within a reasonable period so you
        may raise reasonable objections. Both parties shall negotiate a solution
        in good faith.
      </p>

      <h2>7. Data Breach Notification</h2>
      <p>
        After becoming aware of a breach affecting data you entrusted to us, we
        will notify you in writing without undue delay (target not exceeding 72
        hours), and provide to the extent available: the nature of the breach,
        approximate categories and numbers of affected subjects and records,
        likely consequences, and measures taken or to be taken. Information may
        be supplemented in phases. We will reasonably assist you in fulfilling
        notification obligations to regulatory authorities and data subjects.
      </p>

      <h2>8. Data Subject Rights</h2>
      <p>
        We will, to the extent reasonably practicable, assist Customer through
        appropriate measures in responding to requests for access, correction,
        deletion, restriction of processing, portability, and objection.
      </p>

      <h2>9. Retention and Deletion</h2>
      <p>
        We retain only for the period required to provide the Services or as
        required by law. By default, when prompt logging is not enabled, we do
        not save Input/Output body text for training purposes after an API call
        is completed. Upon termination of the service relationship or at your
        written request, we will delete or return then delete within a
        reasonable period (not exceeding thirty days); legally mandated
        retention will be isolated and no longer used for other processing.
      </p>

      <h2>10. Cross-Border Transfer</h2>
      <p>
        Personal Data may be processed in the countries/regions where servers or
        upstream providers are located. When transferred cross-border, we will
        adopt reasonable safeguards to the extent required by applicable law
        (e.g., standard contractual clauses, adequacy determinations, or other
        recognized mechanisms).
      </p>

      <h2>11. Audit</h2>
      <p>
        With at least thirty days' prior notice and in principle not more than
        once per year, you may audit, by yourself or through an independent
        auditor bound by confidentiality obligations, the manner in which we
        process Personal Data entrusted to us. Audit costs are borne by you; we
        will provide reasonable cooperation.
      </p>

      <h2>12. Effectiveness, Law, and Term</h2>
      <p>
        Regarding Personal Data protection in the Processor role, this DPA
        prevails over conflicting provisions in the Terms of Service. This
        agreement takes effect when you accept the Terms of Service and
        continues until service relationship termination; deletion or return
        obligations remain effective until fulfilled. Dispute resolution follows
        the Terms of Service and does not apply to arrangements fixing disputes
        to a specific foreign arbitration institution.
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

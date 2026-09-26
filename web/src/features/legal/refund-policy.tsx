// Copyright (C) 2024 QuantumNous. All rights reserved.
// SPDX-License-Identifier: AGPL-3.0-only

import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'

import { LegalPageLayout } from './legal-page-layout'

export function RefundPolicy() {
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
          {isEnglish ? 'Refund Policy' : '退款政策'}
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
        本政策说明预付余额、套餐额度与支付渠道相关的退款规则，并构成《服务条款》的一部分。充值或消耗前请仔细阅读。
      </p>

      <h2>1. 关于预付余额</h2>
      <p>
        访问服务或其部分功能，需要购买或持有与账户关联的预付余额或套餐额度，以便发起
        API
        调用。购买还可能产生支付通道手续费。支付前您有机会核对金额。具体最低/最高限额以充值页当时展示为准。
      </p>

      <h2>2. 已消耗费用</h2>
      <p>
        下列情形 <strong>不予退款</strong>：
      </p>
      <ul>
        <li>已成功转发并产生上游成本的调用，无论输出是否符合预期；</li>
        <li>
          因您的输入、模型选择、超时、客户端断开或您自身网络问题导致的失败（若上游仍计费）；
        </li>
        <li>
          因违反《可接受使用政策》或《服务条款》被限制、冻结或关闭账户时的已用额度。
        </li>
      </ul>

      <h2>3. 未消耗余额</h2>
      <p>
        尚未用于实际调用的余额，可在控制台提交退款申请（若该支付渠道已开放用户退款）。我们将核对：
      </p>
      <ul>
        <li>订单是否支付成功、是否已部分消耗；</li>
        <li>支付通道是否支持原路退回；</li>
        <li>是否存在拒付、滥用或争议。</li>
      </ul>
      <p>
        审核通过后，仅退尚未消耗部分。通道手续费、链上矿工费、汇率差价通常由您承担。到账时间取决于支付通道，我们无法保证即时到账。
      </p>

      <h2>4. USDT 与加密资产</h2>
      <blockquote>
        <p>
          USDT 等加密资产充值在链上确认后，<strong>原则上不予退款</strong>
          ，法律另有强制规定的除外。选择加密资产支付前，请确认您理解并接受本条。您保证用于充值的加密资产及资金来源合法，不构成犯罪所得。
        </p>
      </blockquote>
      <p>
        链上转错金额、转错网络或转错地址导致的损失由您自行承担。如因本站系统故障导致重复入账，我们可纠正账务，但不等于承诺链上原路退回。
      </p>

      <h2>5. 自动充值</h2>
      <p>
        若您开启自动充值，即授权我们在余额低于阈值时按所选方式扣款。自动充值取得的额度适用与手动充值相同的退款规则。您可随时在账户中关闭；关闭对已经发起的扣款不溯及。
      </p>

      <h2>6. 账户终止时的余额</h2>
      <ul>
        <li>
          <strong>您主动终止</strong>
          ：未消耗且支付通道支持退回的余额，可按本政策申请；加密资产原则上仍不予退款。
        </li>
        <li>
          <strong>因违约被终止</strong>：剩余与已用额度均不予退还。
        </li>
      </ul>

      <h2>7. 特定技术异常</h2>
      <p>在下列经系统日志核实的有限情形，我们可以做账务冲正或余额补回：</p>
      <ul>
        <li>
          <strong>系统重复扣费</strong>
          ：因本站服务器故障或路由异常导致同一笔费用被多次扣除；
        </li>
        <li>
          <strong>服务完全不可用</strong>
          ：因本站侧严重中断导致已购额度在有效期内完全无法使用，我们将视情况合理补偿；
        </li>
        <li>
          <strong>未经授权的充值</strong>
          ：支付账户被盗用充值的，请在知悉后尽快通过客服提交书面说明和证据，以便协助发起冲正。
        </li>
      </ul>

      <h2>8. 价格变更</h2>
      <p>
        价格或相关费用变更将通过站内或其他合理方式提示。您不接受的，可停止继续购买；未消耗余额仍按本政策处理。
      </p>

      <h2>9. 处理时间与联系</h2>
      <p>
        审核通过的退款退回原支付方式（通道支持时）。银行卡或其他通道的到账时间由通道决定。问题请通过站内客服提交，并提供订单号、支付方式和原因。
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
        This policy explains refund rules for prepaid balances, package quotas,
        and payment channels, and forms part of the Terms of Service. Please
        read carefully before recharging or consuming.
      </p>

      <h2>1. Regarding Prepaid Balances</h2>
      <p>
        Access to the Services or certain features requires purchasing or
        holding prepaid balances or package quotas associated with your account
        to initiate API calls. Purchases may also incur payment channel fees.
        You will have the opportunity to verify amounts before payment. Specific
        minimum/maximum limits are as displayed on the recharge page at the
        time.
      </p>

      <h2>2. Consumed Fees</h2>
      <p>
        The following circumstances are{' '}
        <strong>not eligible for refunds</strong>:
      </p>
      <ul>
        <li>
          Calls successfully forwarded and incurring upstream costs, regardless
          of whether Output meets expectations;
        </li>
        <li>
          Failures caused by your Input, model selection, timeouts, client
          disconnections, or your own network issues (if upstream still
          charges);
        </li>
        <li>
          Consumed quotas when your account is restricted, frozen, or closed for
          violating the Acceptable Use Policy or Terms of Service.
        </li>
      </ul>

      <h2>3. Unconsumed Balances</h2>
      <p>
        Balances not yet used for actual calls may be eligible for refund
        through the console (if the payment channel has enabled user refunds).
        We will verify:
      </p>
      <ul>
        <li>
          Whether the order was successfully paid and whether it has been
          partially consumed;
        </li>
        <li>
          Whether the payment channel supports refunds to the original method;
        </li>
        <li>Whether there are chargebacks, abuse, or disputes.</li>
      </ul>
      <p>
        After approval, only the unconsumed portion will be refunded. Channel
        fees, on-chain miner fees, and exchange rate differences are typically
        borne by you. Arrival time depends on the payment channel; we cannot
        guarantee immediate receipt.
      </p>

      <h2>4. USDT and Crypto Assets</h2>
      <blockquote>
        <p>
          After on-chain confirmation of USDT and other crypto asset recharges,{' '}
          <strong>refunds are generally not provided</strong>, except where
          required by applicable law. Before choosing crypto asset payment,
          please confirm that you understand and accept this clause. You warrant
          that the crypto assets and fund sources used for recharge are legal
          and do not constitute proceeds of crime.
        </p>
      </blockquote>
      <p>
        Losses from transferring the wrong amount, wrong network, or wrong
        address are your sole responsibility. If duplicate crediting occurs due
        to our system failure, we may correct the accounting, but this does not
        constitute a commitment to on-chain refund.
      </p>

      <h2>5. Auto-Recharge</h2>
      <p>
        If you enable auto-recharge, you authorize us to deduct funds via the
        selected method when your balance falls below the threshold. Quotas
        obtained through auto-recharge are subject to the same refund rules as
        manual recharges. You may disable it at any time in your account;
        disabling does not retroactively affect deductions already initiated.
      </p>

      <h2>6. Balance Upon Account Termination</h2>
      <ul>
        <li>
          <strong>Voluntary termination by you</strong>: Unconsumed balances
          that the payment channel supports refunding may be requested according
          to this policy; crypto assets are still generally not refundable.
        </li>
        <li>
          <strong>Termination for breach</strong>: Remaining and consumed quotas
          will not be refunded.
        </li>
      </ul>

      <h2>7. Specific Technical Anomalies</h2>
      <p>
        In the following limited circumstances verified by system logs, we may
        perform accounting corrections or balance reimbursements:
      </p>
      <ul>
        <li>
          <strong>Duplicate system charges</strong>: The same fee was deducted
          multiple times due to our server failure or routing anomaly;
        </li>
        <li>
          <strong>Complete service unavailability</strong>: Purchased quotas
          were completely unusable within their validity period due to a serious
          interruption on our side; we will provide reasonable compensation as
          appropriate;
        </li>
        <li>
          <strong>Unauthorized recharge</strong>: If a payment account was
          stolen for recharge, please submit a written explanation and evidence
          through customer service as soon as possible after becoming aware to
          assist in initiating a correction.
        </li>
      </ul>

      <h2>8. Price Changes</h2>
      <p>
        Price or fee changes will be indicated through on-site or other
        reasonable means. If you do not accept, you may stop making further
        purchases; unconsumed balances will still be handled according to this
        policy.
      </p>

      <h2>9. Processing Time and Contact</h2>
      <p>
        Approved refunds will be returned to the original payment method (when
        the channel supports it). Arrival time for bank cards or other channels
        is determined by the channel. For questions, please submit through
        customer service with order number, payment method, and reason.
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

/*
Copyright (C) 2025 QuantumNous

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

import React, { useContext, useEffect, useState } from 'react';
import { Button, Typography } from '@douyinfe/semi-ui';
import { API, showError, copy, showSuccess } from '../../helpers';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { StatusContext } from '../../context/Status';
import { useActualTheme } from '../../context/Theme';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import { IconCopy, IconArrowRight, IconExternalOpen } from '@douyinfe/semi-icons';
import { Link } from 'react-router-dom';
import NoticeModal from '../../components/layout/NoticeModal';

const { Title, Text, Paragraph } = Typography;

const CodeBlock = ({ children, onCopy }) => (
  <div className='relative group'>
    <pre className='bg-[#0d1117] text-[#e6edf3] rounded-lg p-4 pr-12 overflow-x-auto text-sm font-mono leading-relaxed border border-[#30363d]'>
      <code>{children}</code>
    </pre>
    <button
      onClick={onCopy}
      className='absolute top-3 right-3 p-1.5 rounded-md bg-[#21262d] text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#30363d] transition-colors opacity-0 group-hover:opacity-100'
      title='复制'
    >
      <IconCopy size='small' />
    </button>
  </div>
);

const StepCard = ({ number, title, description, children }) => (
  <div className='relative rounded-xl border border-semi-color-border bg-semi-color-bg-1/60 backdrop-blur-xl p-6 md:p-8 transition-all duration-300 hover:border-[#6366f1]/40 hover:shadow-lg hover:shadow-[#6366f1]/5'>
    <div className='flex items-start gap-4 md:gap-5'>
      <div className='flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-bold text-lg md:text-xl shadow-lg shadow-[#6366f1]/25'>
        {number}
      </div>
      <div className='flex-1 min-w-0'>
        <h3 className='text-lg md:text-xl font-semibold text-semi-color-text-0 mb-2'>
          {title}
        </h3>
        {description && (
          <p className='text-semi-color-text-2 text-sm md:text-base mb-4 leading-relaxed'>
            {description}
          </p>
        )}
        {children}
      </div>
    </div>
  </div>
);

const Home = () => {
  const { t, i18n } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const actualTheme = useActualTheme();
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContent, setHomePageContent] = useState('');
  const [noticeVisible, setNoticeVisible] = useState(false);
  const isMobile = useIsMobile();
  const serverAddress =
    statusState?.status?.server_address || `${window.location.origin}`;

  const displayHomePageContent = async () => {
    setHomePageContent(localStorage.getItem('home_page_content') || '');
    const res = await API.get('/api/home_page_content');
    const { success, message, data } = res.data;
    if (success) {
      let content = data;
      if (!data.startsWith('https://')) {
        content = marked.parse(data);
      }
      setHomePageContent(content);
      localStorage.setItem('home_page_content', content);

      if (data.startsWith('https://')) {
        const iframe = document.querySelector('iframe');
        if (iframe) {
          iframe.onload = () => {
            iframe.contentWindow.postMessage({ themeMode: actualTheme }, '*');
            iframe.contentWindow.postMessage({ lang: i18n.language }, '*');
          };
        }
      }
    } else {
      showError(message);
      setHomePageContent('加载首页内容失败...');
    }
    setHomePageContentLoaded(true);
  };

  const handleCopy = async (text) => {
    const ok = await copy(text);
    if (ok) {
      showSuccess(t('已复制到剪切板'));
    }
  };

  useEffect(() => {
    const checkNoticeAndShow = async () => {
      const lastCloseDate = localStorage.getItem('notice_close_date');
      const today = new Date().toDateString();
      if (lastCloseDate !== today) {
        try {
          const res = await API.get('/api/notice');
          const { success, data } = res.data;
          if (success && data && data.trim() !== '') {
            setNoticeVisible(true);
          }
        } catch (error) {
          console.error('获取公告失败:', error);
        }
      }
    };

    checkNoticeAndShow();
  }, []);

  useEffect(() => {
    displayHomePageContent().then();
  }, []);

  return (
    <div className='w-full overflow-x-hidden'>
      <NoticeModal
        visible={noticeVisible}
        onClose={() => setNoticeVisible(false)}
        isMobile={isMobile}
      />
      {homePageContentLoaded && homePageContent === '' ? (
        <div className='w-full overflow-x-hidden'>
          {/* Hero Section */}
          <div className='w-full relative overflow-hidden min-h-[420px] md:min-h-[480px]'>
            <div className='blur-ball blur-ball-indigo' />
            <div className='blur-ball blur-ball-teal' />

            <div className='relative z-10 flex flex-col items-center justify-center text-center px-4 pt-24 pb-16 md:pt-32 md:pb-20'>
              <div className='inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-semi-color-border bg-semi-color-bg-1/60 backdrop-blur-sm mb-6 md:mb-8'>
                <span className='w-2 h-2 rounded-full bg-green-400 animate-pulse' />
                <Text type='tertiary' size='small'>
                  AI Coding CLI 快速配置指南
                </Text>
              </div>

              <h1 className='text-3xl md:text-5xl lg:text-6xl font-bold text-semi-color-text-0 leading-tight mb-4 md:mb-6'>
                几分钟完成
                <br />
                <span className='shine-text'>AI 编程工具配置</span>
              </h1>

              <p className='text-semi-color-text-2 text-base md:text-lg max-w-2xl leading-relaxed mb-8'>
                配置 Claude Code、OpenAI Codex、Gemini CLI 连接到本站 API，
                <br className='hidden md:block' />
                通过 cc-switch 轻松管理和切换多个 AI 编程助手。
              </p>

              <Link to='/console'>
                <Button
                  theme='solid'
                  type='primary'
                  size={isMobile ? 'default' : 'large'}
                  className='!rounded-full !px-8'
                  iconPosition='right'
                  icon={<IconArrowRight />}
                >
                  前往控制台获取令牌
                </Button>
              </Link>
            </div>
          </div>

          {/* Steps Section */}
          <div className='max-w-3xl mx-auto px-4 pb-20 md:pb-28'>
            <div className='flex flex-col gap-6 md:gap-8'>
              {/* Step 1 */}
              <StepCard
                number={1}
                title='安装 Node.js 22'
                description='AI CLI 工具依赖 Node.js 运行时。前往官网下载并安装 Node.js 22 LTS 版本。'
              >
                <a
                  href='https://nodejs.org/'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='inline-flex items-center gap-1.5 text-[#6366f1] hover:text-[#818cf8] text-sm font-medium transition-colors'
                >
                  nodejs.org
                  <IconExternalOpen size='small' />
                </a>
                <div className='mt-4'>
                  <Text type='tertiary' size='small' className='mb-2 block'>
                    验证安装：
                  </Text>
                  <CodeBlock onCopy={() => handleCopy('node -v')}>
                    node -v
                  </CodeBlock>
                </div>
              </StepCard>

              {/* Step 2 */}
              <StepCard
                number={2}
                title='安装 AI CLI 工具'
                description='根据需要安装一个或多个 AI 编程命令行工具。'
              >
                <div className='flex flex-col gap-3'>
                  <div>
                    <Text type='tertiary' size='small' className='mb-1.5 block'>
                      Claude Code — Anthropic 官方 CLI
                    </Text>
                    <CodeBlock
                      onCopy={() =>
                        handleCopy(
                          'npm i -g @anthropic-ai/claude-code@latest',
                        )
                      }
                    >
                      npm i -g @anthropic-ai/claude-code@latest
                    </CodeBlock>
                  </div>
                  <div>
                    <Text type='tertiary' size='small' className='mb-1.5 block'>
                      Codex — OpenAI 官方 CLI
                    </Text>
                    <CodeBlock
                      onCopy={() =>
                        handleCopy('npm i -g @openai/codex@latest')
                      }
                    >
                      npm i -g @openai/codex@latest
                    </CodeBlock>
                  </div>
                  <div>
                    <Text type='tertiary' size='small' className='mb-1.5 block'>
                      Gemini CLI — Google 官方 CLI
                    </Text>
                    <CodeBlock
                      onCopy={() =>
                        handleCopy('npm i -g @google/gemini-cli@latest')
                      }
                    >
                      npm i -g @google/gemini-cli@latest
                    </CodeBlock>
                  </div>
                </div>
              </StepCard>

              {/* Step 3 */}
              <StepCard
                number={3}
                title='安装 cc-switch'
                description='cc-switch 是一个便捷的配置管理工具，可以帮你快速切换不同 AI CLI 的 API 配置。'
              >
                <a
                  href='https://github.com/farion1231/cc-switch/releases'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='inline-flex items-center gap-1.5 text-[#6366f1] hover:text-[#818cf8] text-sm font-medium transition-colors'
                >
                  前往 GitHub Releases 下载
                  <IconExternalOpen size='small' />
                </a>
              </StepCard>

              {/* Step 4 */}
              <StepCard
                number={4}
                title='配置 cc-switch'
                description='打开 cc-switch，填入以下信息即可完成配置。'
              >
                <div className='flex flex-col gap-4'>
                  <div className='rounded-lg border border-semi-color-border bg-semi-color-fill-0 p-4'>
                    <div className='flex flex-col gap-3'>
                      <div>
                        <Text
                          type='tertiary'
                          size='small'
                          className='block mb-1'
                        >
                          Base URL
                        </Text>
                        <div className='flex items-center gap-2'>
                          <code className='flex-1 text-sm font-mono text-semi-color-text-0 bg-[#0d1117] text-[#e6edf3] rounded px-3 py-1.5 border border-[#30363d]'>
                            {serverAddress}
                          </code>
                          <button
                            onClick={() => handleCopy(serverAddress)}
                            className='p-1.5 rounded-md text-semi-color-text-2 hover:text-semi-color-text-0 hover:bg-semi-color-fill-1 transition-colors'
                          >
                            <IconCopy size='small' />
                          </button>
                        </div>
                      </div>
                      <div>
                        <Text
                          type='tertiary'
                          size='small'
                          className='block mb-1'
                        >
                          API Key
                        </Text>
                        <Text type='secondary' size='small'>
                          填写在
                          <Link
                            to='/console/token'
                            className='text-[#6366f1] hover:text-[#818cf8] mx-1'
                          >
                            控制台 - 令牌管理
                          </Link>
                          中生成的令牌
                        </Text>
                      </div>
                    </div>
                  </div>
                </div>
              </StepCard>
            </div>

            {/* Bottom CTA */}
            <div className='mt-16 md:mt-20 text-center'>
              <div className='inline-block rounded-2xl border border-semi-color-border bg-semi-color-bg-1/60 backdrop-blur-xl p-8 md:p-10'>
                <Title heading={4} className='!mb-3'>
                  准备好了？
                </Title>
                <Paragraph type='tertiary' className='!mb-6 max-w-md'>
                  前往控制台创建令牌，即刻开始使用 AI 编程助手。
                </Paragraph>
                <Link to='/console/token'>
                  <Button
                    theme='solid'
                    type='primary'
                    size={isMobile ? 'default' : 'large'}
                    className='!rounded-full !px-8'
                    iconPosition='right'
                    icon={<IconArrowRight />}
                  >
                    获取 API Key
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className='overflow-x-hidden w-full'>
          {homePageContent.startsWith('https://') ? (
            <iframe
              src={homePageContent}
              className='w-full h-screen border-none'
            />
          ) : (
            <div
              className='mt-[60px]'
              dangerouslySetInnerHTML={{ __html: homePageContent }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Home;

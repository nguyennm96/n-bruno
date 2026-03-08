import MarkdownIt from 'markdown-it';
import { useTranslation } from 'react-i18next';
import * as MarkdownItReplaceLink from 'markdown-it-replace-link';
import StyledWrapper from './StyledWrapper';
import React, { useEffect, useRef } from 'react';
import { isValidUrl } from 'utils/url/index';

const Markdown = ({ collectionPath, onDoubleClick, content }) => {
  const { t } = useTranslation();
  const containerRef = useRef(null);

  const markdownItOptions = {
    html: true,
    breaks: true,
    linkify: true,
    replaceLink: function (link, env) {
      return link.replace(/^\./, collectionPath);
    }
  };

  const handleOnClick = (event) => {
    const target = event.target;
    if (target.tagName === 'A') {
      event.preventDefault();
      const href = target.getAttribute('href');
      if (href && isValidUrl(href)) {
        window.open(href, '_blank');
        return;
      }
    }
  };

  const handleOnDoubleClick = (event) => {
    if (event.detail === 2) {
      onDoubleClick?.();
    }
  };

  const md = new MarkdownIt(markdownItOptions).use(MarkdownItReplaceLink);
  const htmlFromMarkdown = md.render(content || '');

  // Render mermaid diagrams after mount
  useEffect(() => {
    if (!containerRef.current) return;
    const codeBlocks = containerRef.current.querySelectorAll('code.language-mermaid');
    if (codeBlocks.length === 0) return;

    import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: 'neutral' });
      codeBlocks.forEach((block, i) => {
        const graphDefinition = block.textContent;
        const id = `mermaid-${Date.now()}-${i}`;
        const container = document.createElement('div');
        container.className = 'mermaid-diagram';
        block.parentElement.replaceWith(container);
        mermaid.render(id, graphDefinition).then(({ svg }) => {
          container.innerHTML = svg;
        }).catch(() => {
          container.innerHTML = `<pre style="color:red">{t('COMMON.MERMAID_RENDER_ERROR')}</pre>`;
        });
      });
    });
  }, [content]);

  return (
    <StyledWrapper>
      <div
        ref={containerRef}
        className="markdown-body"
        dangerouslySetInnerHTML={{ __html: htmlFromMarkdown }}
        onClick={handleOnClick}
        onDoubleClick={handleOnDoubleClick}
      />
    </StyledWrapper>
  );
};

export default Markdown;

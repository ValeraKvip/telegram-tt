import type { ApiFormattedText, ApiMessageEntity } from '../api/types';
import { ApiMessageEntityTypes } from '../api/types';

import { RE_LINK_TEMPLATE } from '../config';
import { IS_EMOJI_SUPPORTED, IS_FIREFOX } from './windowEnvironment';

export const ENTITY_CLASS_BY_NODE_NAME: Record<string, ApiMessageEntityTypes> = {
  B: ApiMessageEntityTypes.Bold,
  STRONG: ApiMessageEntityTypes.Bold,
  I: ApiMessageEntityTypes.Italic,
  EM: ApiMessageEntityTypes.Italic,
  INS: ApiMessageEntityTypes.Underline,
  U: ApiMessageEntityTypes.Underline,
  S: ApiMessageEntityTypes.Strike,
  STRIKE: ApiMessageEntityTypes.Strike,
  DEL: ApiMessageEntityTypes.Strike,
  CODE: ApiMessageEntityTypes.Code,
  PRE: ApiMessageEntityTypes.Pre,
  BLOCKQUOTE: ApiMessageEntityTypes.Blockquote,
};

const MAX_TAG_DEEPNESS = 15;//TODO Any reasons for this limit?

export default function parseHtmlAsFormattedText(
  html: string, withMarkdownLinks = false, skipMarkdown = false,
): ApiFormattedText {
  const fragment = document.createElement('div');
  fragment.innerHTML = skipMarkdown ? html
    : withMarkdownLinks ? parseMarkdown(parseMarkdownLinks(html)) : parseMarkdown(html);
  fixImageContent(fragment);
  let text = '';

  if (fragment.innerHTML.length && fragment.innerHTML[0] === '<') {
    /**
     * BUG-FIX "Markdown is broken when whitespace at the start is trimmed". 
     * Steps to reproduce:
     *    Try to send: || ~~A~~|| || ~~A~~||  
     *    The First "A" - will be text, and the Second one will be a spoiler.
     * Reason: 
     *    Search for(parseHtmlAsFormattedText.ts):
     *    ```const rawIndex = rawText.indexOf(node.textContent, textIndex);```
     *    The problem occurs when the first spoiler " A" is searched. However, since it is trimmed, the second "A" is found instead.
     * Solution:
     *    Check if the first character of fragment.innerHTML is an HTML tag; if so (indicating it's Markdown), skip the trim.
     *    However, '.trimEnd()' is still required; otherwise:
     *    ```
     *      console.log('A');
     *    ```
     *    won't work as expected (it seems the problem is on the Telegram server).
     *    <pre>...</pre> - works
     *    <pre>...\n</pre> - doesn't work.
     *  */
    text = fragment.innerText.trimEnd().replace(/\u200b+/g, '');
  } else {
    text = fragment.innerText.trim().replace(/\u200b+/g, '');
  }

  const trimShift = fragment.innerText.indexOf(text[0]);
  let textIndex = -trimShift;
  let recursionDeepness = 0;
  const entities: ApiMessageEntity[] = [];

  function addEntity(node: ChildNode) {
    if (node.nodeType === Node.COMMENT_NODE) return;
    const { index, entity } = getEntityDataFromNode(node, text, textIndex);

    if (entity) {
      textIndex = index;
      entities.push(entity);
    } else if (node.textContent) {
      // Skip newlines on the beginning
      if (index === 0 && node.textContent.trim() === '') {
        return;
      }
      textIndex += node.textContent.length;
    }

    if (node.hasChildNodes() && recursionDeepness <= MAX_TAG_DEEPNESS) {
      recursionDeepness += 1;
      Array.from(node.childNodes).forEach(addEntity);
    }
  }

  Array.from(fragment.childNodes).forEach((node) => {
    recursionDeepness = 1;
    addEntity(node);
  });

  return {
    text,
    entities: entities.length ? entities : undefined,
  };
}

export function fixImageContent(fragment: HTMLDivElement) {
  fragment.querySelectorAll('img').forEach((node) => {
    if (node.dataset.documentId) { // Custom Emoji
      node.textContent = (node as HTMLImageElement).alt || '';
    } else { // Regular emoji with image fallback
      node.replaceWith(node.alt || '');
    }
  });
}

function parseMarkdown(html: string) {
  let parsedHtml = html.slice(0);
 
  // Strip redundant 'paste' tags.
  // <span data-p="..."></span> are deleted in Chrome but need to remain in Firefox to allow the undo functionality to work.
  if(IS_FIREFOX){
    parsedHtml = parsedHtml.replace(/<span data-p="[^"]*"><\/span>/g, '');
    parsedHtml = parsedHtml.replace(/<span data-p="[^"]*"><br><\/span>/g, '');
  }
  
  // Strip redundant nbsp's
  parsedHtml = parsedHtml.replace(/&nbsp;/g, ' ');

  // Replace <div><br></div> with newline (new line in Safari)
  parsedHtml = parsedHtml.replace(/<div><br([^>]*)?><\/div>/g, '\n');
  // Replace <br> with newline
  parsedHtml = parsedHtml.replace(/<br([^>]*)?>/g, '\n');

  // Strip redundant <div> tags

  /**
   * This line was a bug that removed all line breaks after a spoiler.
   * For example: write a line => add any number of 'Enter' => write another line => make the first line a spoiler => send.
   * All line breaks after the spoiler are removed.
   */
  //parsedHtml = parsedHtml.replace(/<\/div>(\s*)<div>/g, '\n');
  
  

  parsedHtml = parsedHtml.replace(/<div>/g, '\n');//<blockquote><div>xxx</div></blockquote> =>  <blockquote>\nxxx</blockquote> 
  parsedHtml = parsedHtml.replace(/<\/div>/g, '');


  // Custom Emoji markdown tag
  if (!IS_EMOJI_SUPPORTED) {
    // Prepare alt text for custom emoji
    parsedHtml = parsedHtml.replace(/\[<img[^>]+alt="([^"]+)"[^>]*>]/gm, '[$1]');
  }
  parsedHtml = parsedHtml.replace(
    /(?!<(?:code|pre)[^<]*|<\/)\[([^\]\n]+)\]\(customEmoji:(\d+)\)(?![^<]*<\/(?:code|pre)>)/g,
    '<img alt="$1" data-document-id="$2">',
  );

  const mdStack: Markdown[] = [];
  let str = "";
  for (let i = 0; i < parsedHtml.length;) {
    let isMarkdown = false;

    //Check slash escaping
    if (parsedHtml[i] === '\\' && (i + 1 !== parsedHtml.length)) {
      str += parsedHtml[i + 1];
      i += 2;
      continue;
    }


    //Skip all '>>' inside Expandable quote.
    if (MD_EXPANDABLE_QUOTE.opened && parsedHtml.substring(i, i + QUOT_MARK.length) === QUOT_MARK) {
      i += QUOT_MARK.length;
      continue;
    }

    for (const markdown of markdowns) {
      const { pattern, html, opened } = markdown;

      if (opened) {
        if (parsedHtml.substring(i, i + pattern.close.length) === pattern.close) {

          //A single line-quote ends with '\n', except when the next line starts with '>>'
          if (markdown === MD_SINGLE_QUOTE
            && (i + 1 + pattern.open.length) < parsedHtml.length
            && parsedHtml.substring(i + 1, i + 1 + pattern.open.length) === pattern.open) {
            str += '\n'
            i += pattern.open.length + pattern.close.length;
            isMarkdown = true;
            break;
          }

          //An expandable-quote ends with '||\n'; in other cases, it is a spoiler.
          if (markdown === MD_EXPANDABLE_QUOTE) {
            if (((i + pattern.close.length + 1 < parsedHtml.length) && parsedHtml[i + pattern.close.length + 1] !== '\n')) {
              continue;
            }
          }

          let top = mdStack[mdStack.length - 1];
          if (top.html.open === html.open) {
            mdStack.pop();
            str += html.close;
            markdown.opened = false;

            isMarkdown = true;
            i += pattern.close.length
            break;
          }
          else {
            const index = mdStack.indexOf(markdown);
            if (index !== -1) {
              for (let j = mdStack.length - 1; j > index; --j) {
                str += mdStack[j].html.close;
              }
              str += html.close;

              for (let j = index + 1; j < mdStack.length; ++j) {
                str += mdStack[j].html.open;
              }
              mdStack.splice(index, 1);

              markdown.opened = false;

              isMarkdown = true;
              i += pattern.close.length
              break;

            } else {
              // mdStack.push(markdown);
              // str += markdown.html.open;
            }
          }
        } else {
          for (const b of pattern.breaks) {
            if (parsedHtml.substring(i, i + b.length) === b) {
              const index = mdStack.indexOf(markdown);
              if (index !== -1) {
                mdStack.splice(index, 1);
                markdown.opened = false;
                const i = str.lastIndexOf(html.open);
                if (i !== -1) {
                  str = str.substring(0, i) + pattern.open + str.substring(i + html.open.length);
                }
              }
              break;
            }
          };
        }
      } else {
        if (parsedHtml.substring(i, i + pattern.open.length) === pattern.open) {
          if (!mdStack.length) {
            mdStack.push(markdown);
            str += markdown.html.open;
            markdown.opened = true;

            isMarkdown = true;
            i += pattern.open.length
            break;
          } else {
            let top = mdStack[mdStack.length - 1];
            if (top !== MD_CODE) {
              mdStack.push(markdown);
              str += markdown.html.open;
              markdown.opened = true;

              isMarkdown = true;
              i += pattern.open.length
              break;
            } else {
              //<code></code> cannot contain markdown inside.
            }
          }         
        }
      }
    }

    if (!isMarkdown) {
      str += parsedHtml[i];
      ++i;
    }
  }

  //Clear stack in case if markdown was unpaired. 
  while (mdStack.length > 0) {
    const md = mdStack.pop()!;

    if (md === MD_SINGLE_QUOTE) {
      str += md.html.close;
      continue;
    }

    const index = str.lastIndexOf(md.html.open);
    if (index !== -1) {
      str = str.substring(0, index) + md.pattern.open + str.substring(index + md.html.open.length);
    }
  }

  /**
   * replace defined codeblocks:
   * ```javascript
   * code
   * ```
   *  
   */ 
  parsedHtml = str.replace(/<pre>([a-zA-Z0-9+#]+)[\n\r]+(.+?)<\/pre>/gms, '<pre data-language="$1">$2</pre>');

  markdowns.forEach(m => m.opened = false);  

  return parsedHtml;
}

function parseMarkdownLinks(html: string) {
  return html.replace(new RegExp(`\\[([^\\]]+?)]\\((${RE_LINK_TEMPLATE}+?)\\)`, 'g'), (_, text, link) => {
    const url = link.includes('://') ? link : link.includes('@') ? `mailto:${link}` : `https://${link}`;
    return `<a href="${url}">${text}</a>`;
  });
}

function getEntityDataFromNode(
  node: ChildNode,
  rawText: string,
  textIndex: number,
): { index: number; entity?: ApiMessageEntity } {
  const type = getEntityTypeFromNode(node);

  if (!type || !node.textContent) {
    return {
      index: textIndex,
      entity: undefined,
    };
  }

  const rawIndex = rawText.indexOf(node.textContent, textIndex);
  // In some cases, last text entity ends with a newline (which gets trimmed from `rawText`).
  // In this case, `rawIndex` would return `-1`, so we use `textIndex` instead.
  const index = rawIndex >= 0 ? rawIndex : textIndex;
  const offset = rawText.substring(0, index).length;
  const { length } = rawText.substring(index, index + node.textContent.length);

  if (type === ApiMessageEntityTypes.TextUrl) {
    return {
      index,
      entity: {
        type,
        offset,
        length,
        url: (node as HTMLAnchorElement).href,
      },
    };
  }
  if (type === ApiMessageEntityTypes.MentionName) {
    return {
      index,
      entity: {
        type,
        offset,
        length,
        userId: (node as HTMLAnchorElement).dataset.userId!,
      },
    };
  }

  if (type === ApiMessageEntityTypes.Pre) {
    return {
      index,
      entity: {
        type,
        offset,
        length,
        language: (node as HTMLPreElement).dataset.language,
      },
    };
  }

  if (type === ApiMessageEntityTypes.CustomEmoji) {
    return {
      index,
      entity: {
        type,
        offset,
        length,
        documentId: (node as HTMLImageElement).dataset.documentId!,
      },
    };
  }

  if (type === ApiMessageEntityTypes.Blockquote) {
    return {
      index,
      entity: {
        type,
        offset,
        length,
        canCollapse: (node as HTMLQuoteElement).dataset.collapsable === '1'
      },
    };
  }

  return {
    index,
    entity: {
      type,
      offset,
      length,
    },
  };
}

function getEntityTypeFromNode(node: ChildNode): ApiMessageEntityTypes | undefined {
  if (node instanceof HTMLElement && node.dataset.entityType) {
    return node.dataset.entityType as ApiMessageEntityTypes;
  }

  if (ENTITY_CLASS_BY_NODE_NAME[node.nodeName]) {
    return ENTITY_CLASS_BY_NODE_NAME[node.nodeName];
  }

  if (node.nodeName === 'A') {
    const anchor = node as HTMLAnchorElement;
    if (anchor.dataset.entityType === ApiMessageEntityTypes.MentionName) {
      return ApiMessageEntityTypes.MentionName;
    }
    if (anchor.dataset.entityType === ApiMessageEntityTypes.Url) {
      return ApiMessageEntityTypes.Url;
    }
    if (anchor.href.startsWith('mailto:')) {
      return ApiMessageEntityTypes.Email;
    }
    if (anchor.href.startsWith('tel:')) {
      return ApiMessageEntityTypes.Phone;
    }
    if (anchor.href !== anchor.textContent) {
      return ApiMessageEntityTypes.TextUrl;
    }

    return ApiMessageEntityTypes.Url;
  }

  if (node.nodeName === 'SPAN') {
    return (node as HTMLElement).dataset.entityType as any;
  }

  if (node.nodeName === 'IMG') {
    if ((node as HTMLImageElement).dataset.documentId) {
      return ApiMessageEntityTypes.CustomEmoji;
    }
  }

  return undefined;
}



type Markdown = {
  pattern: {
    open: string,
    close: string,
    breaks: string[]
  },
  html: {
    open: string,
    close: string;
  },
  opened: boolean
}

const QUOT_MARK = '&gt;&gt;';

const MD_CODE = {
  pattern: {
    open: '`',
    close: '`',
    breaks: ['\n']
  },
  html: {
    open: `<code>`,
    close: '</code>'
  },
  opened: false
};

const MD_SINGLE_QUOTE = {
  pattern: {
    open: QUOT_MARK,//>>
    close: '\n',
    breaks: []
  },
  html: {
    open: `<blockquote data-entity-type="${ApiMessageEntityTypes.Blockquote}">`,
    close: '</blockquote>'
  },
  opened: false
};

const MD_EXPANDABLE_QUOTE = {
  pattern: {
    open: '**&gt;',
    close: '||',
    breaks: []
  },
  html: {
    open: `<blockquote data-collapsable="1" data-entity-type="${ApiMessageEntityTypes.Blockquote}">`,
    close: '</blockquote>'
  },
  opened: false
};

const MD_SPOILER = {
  pattern: {
    open: '||',
    close: '||',
    breaks: []
  },
  html: {
    open: `<span data-entity-type="${ApiMessageEntityTypes.Spoiler}">`,
    close: '</span>'
  },
  opened: false
};

const markdowns: Markdown[] = [
  MD_EXPANDABLE_QUOTE,
  MD_SPOILER,
  {
    pattern: {
      open: '**',
      close: '**',
      breaks: []
    },
    html: {
      open: `<b>`,
      close: '</b>'
    },
    opened: false
  },
  {
    pattern: {
      open: '__',
      close: '__',
      breaks: []
    },
    html: {
      open: `<i>`,
      close: '</i>'
    },
    opened: false
  },
  {
    pattern: {
      open: '~~',
      close: '~~',
      breaks: []
    },
    html: {
      open: `<s>`,
      close: '</s>'
    },
    opened: false
  },
  {
    pattern: {
      open: '```',
      close: '```',
      breaks: []
    },
    html: {
      open: `<pre>`,
      close: '</pre>'
    },
    opened: false
  },

  MD_CODE,
  MD_SINGLE_QUOTE,


];


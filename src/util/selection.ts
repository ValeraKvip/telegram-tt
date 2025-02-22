import generateUniqueId from "./generateUniqueId";
import { IS_FIREFOX } from "./windowEnvironment";

const extractorEl = document.createElement('div');

export function insertHtmlInSelection(html: string) {
  const selection = window.getSelection();

  if (selection?.getRangeAt && selection.rangeCount) {
    const range = selection.getRangeAt(0);

    const commonAncestor = range.commonAncestorContainer;
    let ancestorElement = (commonAncestor.nodeType === Node.ELEMENT_NODE ? commonAncestor : commonAncestor.parentNode);
    if (!ancestorElement || !(ancestorElement instanceof Element)) {
      ancestorElement = document;
    }


    const id = generateUniqueId();
    document.execCommand('insertHTML', false, `${html}<span data-p="${id}"></span>`);
    const span = (ancestorElement as Element).querySelector(`[data-p="${id}"]`);
    if (span) {
      setCaretPosition(span, html.length)
      range.collapse();
      if(!IS_FIREFOX){
        span.remove();
      }     
    }
  }
}

export function getHtmlBeforeSelection(container?: HTMLElement, useCommonAncestor?: boolean) {
  if (!container) {
    return '';
  }

  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) {
    return container.innerHTML;
  }

  const range = sel.getRangeAt(0).cloneRange();
  if (!range.intersectsNode(container)) {
    return container.innerHTML;
  }

  if (!useCommonAncestor && !container.contains(range.commonAncestorContainer)) {
    return '';
  }

  range.collapse(true);
  range.setStart(container, 0);

  extractorEl.innerHTML = '';
  extractorEl.appendChild(range.cloneContents());

  return extractorEl.innerHTML;
}

// https://stackoverflow.com/a/3976125
export function getCaretPosition(element: HTMLElement) {
  let caretPosition = 0;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return caretPosition;
  }

  const range = selection.getRangeAt(0);
  const caretRange = range.cloneRange();
  caretRange.selectNodeContents(element);
  caretRange.setEnd(range.endContainer, range.endOffset);
  caretPosition = caretRange.toString().length;

  const lineBreaks = caretRange.cloneContents().querySelectorAll('br');

  return caretPosition + lineBreaks.length
}

// https://stackoverflow.com/a/36953852
export function setCaretPosition(element: Node, position: number) {  
  if (element.nodeName === 'BR') {   
    position = position - 1;
    if(position === 0){
      const range = document.createRange();
      const selection = window.getSelection()!;
      range.setStartAfter(element);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      return -1;
    }

    return position;
  }

  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      if ((node as Text).length >= position) {
        const range = document.createRange();
        const selection = window.getSelection()!;
        range.setStart(node, position);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);

        return -1;
      } else {
        position -= 'length' in node ? node.length as number : 0;
      }
    } else {
      position = setCaretPosition(node, position);
      if (position === -1) {
        return -1;
      }
    }
  }

  return position;
}

export function removeAllSelections() {
  const selection = window.getSelection();
  selection?.removeAllRanges();
}

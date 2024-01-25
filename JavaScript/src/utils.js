/**
 * Joins in one paragraph the last paragraph of str1 with the first paragraph or str2
 * @param {string} str1 Requires str1 to have at least one hmtl paragraph
 * @param {string} str2 Requires str2 to have at least one html paragraph
 * @returns {string}
 */
function joinParagraphs(str1, str2) {
  if (!str1) return str2;
  if (!str2) return str1;
  const doc1 = new DOMParser().parseFromString(str1, 'text/html');
  const paragraphs = doc1.querySelectorAll('body p');
  const lastParagraph = paragraphs[paragraphs.length - 1];
  const doc2 = new DOMParser().parseFromString(str2, 'text/html');
  const firstParagraph = doc2.querySelector('body p');
  if (lastParagraph.innerHTML) {
    lastParagraph.innerHTML += ' ';
  }
  lastParagraph.innerHTML += firstParagraph.innerHTML;
  firstParagraph.remove();
  const result = doc1.body.innerHTML + doc2.body.innerHTML;
  return result;
}

/**
 * Joins the last paragraph of str1 with the first paragraph of str2 only if they
 * are of the same type ('BLOCKQUOTE' or 'P'). If they are not, it concatenates the
 * two strings
 * @param {*} str1
 * @param {*} str2
 * @returns {string}
 */
function joinSameTypes(str1, str2) {
  if (!str1) return str2;
  if (!str2) return str1;
  const doc1 = new DOMParser().parseFromString(str1, 'text/html');
  const doc2 = new DOMParser().parseFromString(str2, 'text/html');
  const { nodeName } = doc1.body.lastChild;
  if (nodeName === doc2.body.firstChild.nodeName) {
    let node1;
    let node2;
    if (nodeName === 'BLOCKQUOTE') {
      node1 = doc1.querySelector('body > blockquote:last-child > p:last-child');
      node2 = doc2.querySelector('body > blockquote > p');
    } else {
      node1 = doc1.querySelector('body > p:last-child');
      node2 = doc2.querySelector('body > p');
    }
    if (node2.innerHTML) {
      node1.innerHTML += ' ';
    }
    // Insert the node2 contents into node1
    node1.innerHTML += node2.innerHTML;
    if (nodeName === 'BLOCKQUOTE') {
      // Remove paragraph node2 from it's blockquote parent
      const parent = node2.parentNode;
      parent.removeChild(node2);
      // Insert the rest of the paragraphs of node2 parent after node1
      node1.parentNode.innerHTML += parent.innerHTML;
      parent.remove();
    } else {
      node2.remove();
    }
    return doc1.body.innerHTML + doc2.body.innerHTML;
  }
  return str1 + str2;
}

/**
 * Clears the style attribute for all blocks (paragraphs, blockquotes) in the given string
 * @param {string} str
 * @returns {string}
 */
function clearBlockStyle(str) {
  if (!str) return str;
  const doc = new DOMParser().parseFromString(str, 'text/html');
  const paragraphs = doc.querySelectorAll('body p, body blockquote');
  paragraphs.forEach(paragraph => paragraph.removeAttribute('style'));
  return doc.body.innerHTML;
}

export { joinParagraphs, clearBlockStyle, joinSameTypes };

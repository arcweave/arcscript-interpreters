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

export { joinParagraphs, clearBlockStyle };

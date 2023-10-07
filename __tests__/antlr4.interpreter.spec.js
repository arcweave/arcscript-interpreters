/* eslint-env jest */
import _ from 'lodash';
import { ParseError, RuntimeError } from '@/errors/ArcscriptErrors.js';
import Interpreter from '@/antlr4.interpreter.js';

// The project variables names, default values and types
const varObjects = {
  var1: { id: 'var1', name: 'x', type: 'integer', value: 14 },
  var2: { id: 'var2', name: 'y', type: 'integer', value: 15 },
  var3: { id: 'var3', name: 'z', type: 'integer', value: 0 },
  var4: { id: 'var4', name: 'w', type: 'string', value: 'Dummy text' },
  var5: { id: 'var5', name: '$c5', type: 'integer', value: 0 },
  var6: { id: 'var6', name: '_a', type: 'boolean', value: false },
  var7: { id: 'var7', name: 'xy', type: 'integer', value: -1 },
};

// Extract the initial values from these varObjects
const varValues = Object.fromEntries(
  Object.entries(varObjects)
    .filter(([k, v]) => !v.children)
    .map(([k, v]) => [k, v.value])
);

const cases = [
  [`<pre><code>x=5</code></pre>`, { var1: 5 }],
  [`<pre><code>x=-5</code></pre>`, { var1: -5 }],
  [`<pre><code>x=5.23</code></pre>`, { var1: 5.23 }],
  [
    `<pre><code>x=3</code></pre>
    <pre><code>y=2</code></pre>`,
    { var1: 3, var2: 2 },
  ],
  [`<pre><code>x="test"</code></pre>`, { var1: 'test' }],
  [`<pre><code>x=true</code></pre>`, { var1: true }],
  [`<pre><code>x = y</code></pre>`, { var1: 15 }],
  [`<pre><code>x = 5 + 3</code></pre>`, { var1: 8 }],
  [`<pre><code>x = sqr(2)</code></pre>`, { var1: 4 }],
  [`<pre><code>x = 3 > 2</code></pre>`, { var1: true }],
  [`<pre><code>x = 3 >= 2</code></pre>`, { var1: true }],
  [`<pre><code>x = 3 < 2</code></pre>`, { var1: false }],
  [`<pre><code>x = 3 <= 2</code></pre>`, { var1: false }],
  [`<pre><code>x = 3 == 2</code></pre>`, { var1: false }],
  [`<pre><code>x = 3 != 2</code></pre>`, { var1: true }],
  [`<pre><code>_a = !(3 == 2)</code></pre>`, { var6: true }],
  [`<pre><code>_a = not (3 == 2)</code></pre>`, { var6: true }],
  [`<pre><code>x = !0</code></pre>`, { var1: true }],
  [`<pre><code>x = true || false</code></pre>`, { var1: true }],
  [`<pre><code>x = true && false</code></pre>`, { var1: false }],
  [
    `<pre><code>x = -3</code></pre><pre><code>y = y + 3</code></pre><pre><code>z = sqr(x)</code></pre>`,
    { var1: -3, var2: 18, var3: 9 },
  ],
  [`<pre><code>x = sqrt(y + 3)</code></pre>`, { var1: Math.sqrt(18) }],
  [`<pre><code>x = z + 12 == 4 * 3</code></pre>`, { var1: true }],
  [`<pre><code>x = y == 15 && !(z == 1)</code></pre>`, { var1: true }],
  [`<pre><code>x = (x*x + 3)/y</code></pre>`, { var1: 13.266666666666667 }],
  [`<pre><code>x = x*(x + 1)/y</code></pre>`, { var1: 14 }],
  [`<pre><code>x += 2</code></pre>`, { var1: 16 }],
  [`<pre><code>x -= 2</code></pre>`, { var1: 12 }],
  [`<pre><code>x *= 2</code></pre>`, { var1: 28 }],
  [`<pre><code>x /= 2</code></pre>`, { var1: 7 }],
  [`<pre><code>x = abs(-6)</code></pre>`, { var1: 6 }],
  [`<pre><code>x = min(5, -y, 2.3)</code></pre>`, { var1: -15 }],
  [`<pre><code>x = max(5, -y, 2.3)</code></pre>`, { var1: 5 }],
  [`<pre><code>x = random()</code></pre>`, {}],
  [`<pre><code>x = roll(6)</code></pre>`, {}],
  [`<pre><code>x = roll(6, 5)</code></pre>`, {}],
  [`<pre><code>x = roll(y)</code></pre>`, {}],
  [`<pre><code>x = round(2.65)</code></pre>`, { var1: 3 }],
  [`<pre><code>show("x is ", x)</code></pre>`, {}, '<p>x is 14</p>'],
  [
    `<pre><code>y = 33</code></pre>
      <pre><code>reset(y)</code></pre>`,
    { var2: 15 },
  ],
  [
    `<pre><code>x = 16</code></pre>
      <pre><code>y = 33</code></pre>
      <pre><code>resetAll(y)</code></pre>`,
    { var1: 14, var2: 33 },
  ],
  [`<pre><code>$c5 = x</code></pre>`, { var5: 14 }],
  [
    `<pre><code>if (x==14) </code></pre>
        <pre><code>x=5</code></pre>
      <pre><code>endif</code></pre>`,
    { var1: 5 },
  ],
  [
    `<pre><code>if (x==11)</code></pre>
       <pre><code>x=5</code></pre>
       <pre><code>else</code></pre>
       <pre><code>x=7</code></pre>
       <pre><code>endif</code></pre>`,
    { var1: 7 },
  ],
  [
    `<pre><code>if x==3</code></pre>
        <pre><code>x=5</code></pre>
      <pre><code>elseif x==14</code></pre>
        <pre><code>x=2</code></pre>
      <pre><code>else</code></pre>
        <pre><code>x = 0</code></pre>
      <pre><code>endif</code></pre>`,
    { var1: 2 },
  ],
  [
    `<p>Mein gott!</p><pre><code>x = 1</code></pre><p>What is that?</p>`,
    { var1: 1 },
    `<p>Mein gott! What is that?</p>`,
  ],
  [
    `<p>Hello my dear</p>
        <pre><code>if x == 1</code></pre>
          <p>We might ride to the mountains.</p>
        <pre><code>endif</code></pre>`,
    {},
    `<p>Hello my dear</p>`,
  ],
  [
    `<p>You carry</p>
        <pre attr='hep'><code rem='jjk'>if x == 12</code></pre>
          <p>a small knife</p>
        <pre><code>elseif y == 12</code></pre>
          <p>a large sword</p>
        <pre><code>elseif z == 1</code></pre>
          <p>just a rotten tomato</p>
        <pre><code>else</code></pre>
          <p>nothing really</p>
        <pre><code>endif</code></pre>`,
    {},
    `<p>You carry nothing really</p>`,
  ],
  [
    `<p>How are you?</p>
       <pre><code>x = 1</code></pre>
       <p></p><p>I am fine, thank you.</p>`,
    {},
    `<p>How are you?  I am fine, thank you.</p>`,
  ],
  [`<pre><code>x = ((_a)) + 1</code></pre>`, { var1: 1 }],
  [
    `<pre><code>show("Hello friends:", x)</code></pre>`,
    {},
    '<p>Hello friends:14</p>',
  ],
  [
    ` <pre><code>_a = true</code></pre>
        <pre><code>if (((_a)))</code></pre>
          <pre><code>x = 1</code></pre>
        <pre><code>endif</code></pre>`,
    { var1: 1 },
  ],
];

const parseErrorCases = [
  // Variable does not exist
  [`<pre><code>p = 1</code></pre>`],
  [`<pre><code>x = p</code></pre>`],
  [`<pre><code>show(x, y, z, abc)</code></pre>`],
  // Wrong function
  ['<pre><code>testFunction(x, y)</code></pre>'],
  // Having semicolon
  [`<pre><code>x = 1;</code></pre>`],
  // Invalid syntax
  [`<pre><code>We want to be friends</code></pre>`],
  // Invalid number of arguments in function call
  [`<pre><code>x = sqr()</code></pre>`],
  [`<pre><code>x = random(2)</code></pre>`],
  [
    `<pre><code>y = 33</code></pre>
      <pre><code>reset(13)</code></pre>`,
    { var2: 15 },
  ],
  // Unexpected input
  [`<pre><code>ελληνικά</code></pre>`],
  // Mention element ID does not exist
  [
    `<pre><code>visits(<span class="mention mention-component" data-type="element" data-id="xyz">Untitled Comp</span>) == 9</code></pre>`,
  ],
];

const runtimeErrorCases = [
  // Invalid argument in function call
  [`<pre><code>x = sqrt(-3)</code></pre>`],
  // Invalid division by zero
  [`<pre><code>x = 3 / 0</code></pre>`],
  // Invalid type of arguments in function call
  [`<pre><code>x = roll("2")</code></pre>`],
];

const conditionCases = [
  [`<pre><code>x >= 14</code></pre>`, true],
  [`<pre><code>x == 14</code></pre>`, true],
  [`<pre><code>x is 14</code></pre>`, true],
  [`<pre><code>x == 45</code></pre>`, false],
  [`<pre><code>x is 45</code></pre>`, false],
  [`<pre><code>x == 14 && y == 15</code></pre>`, true],
  [`<pre><code>x == 14 and y == 15</code></pre>`, true],
  [`<pre><code>x == 3 || y != 0</code></pre>`, true],
  [`<pre><code>x == 3 or y != 0</code></pre>`, true],
  [`<pre><code>w == "Dummy text"</code></pre>`, true],
  [`<pre><code>w != "Dummy text"</code></pre>`, false],
  [`<pre><code>w is not "Dummy text"</code></pre>`, false],
  [`<pre><code>x is not "Dummy text"</code></pre>`, true],
];

const replaceVariablesCases = [
  [
    `<pre><code>x = x + 2 * sqrt(x)</code></pre>
      <pre><code>y = 5 + x</code></pre>`,
    { var1: 'zed' },
    `<pre><code>zed = zed + 2 * sqrt(zed)</code></pre>
      <pre><code>y = 5 + zed</code></pre>`,
  ],
  [
    `<pre><code>x = "x marks the spot"</code></pre>
      <pre><code>xy = 5 + x</code></pre>`,
    { var1: 'zed' },
    `<pre><code>zed = "x marks the spot"</code></pre>
      <pre><code>xy = 5 + zed</code></pre>`,
  ],
];

const mentionCases = [
  [`<pre><code>visits() == 1</code></pre>`, { a: 1, b: 1, c: 0 }, 'b', true],
  [
    `<pre><code>visits(<span class="mention mention-component" data-type="element" data-id="b">Untitled Comp</span>) == 9</code></pre>`,
    { a: 1, b: 1, c: 0 },
    'b',
    false,
  ],
];

describe('Interprete valid scripts', () => {
  test.each(cases)('Tests script: %p', (script, vars, shown = '') => {
    const interpreter = new Interpreter(varValues, varObjects);
    const { tree, changes, output } = interpreter.runScript(script);
    expect(changes).toMatchObject(vars);
    expect(output).toEqual(shown);
    expect(tree).not.toBeNull();
  });
});

describe('Interprete script with parse errors', () => {
  test.each(parseErrorCases)('Test error script: %p', script => {
    const interpreter = new Interpreter(varValues, varObjects);
    expect(() => {
      interpreter.parse(script);
    }).toThrow(ParseError);
  });
});

describe('Interprete script with runtime errors', () => {
  test.each(runtimeErrorCases)('Test error script: %p', script => {
    // Parse and interprete the script
    const interpreter = new Interpreter(varValues, varObjects);
    expect(() => {
      interpreter.runScript(script);
    }).toThrow(RuntimeError);
  });
});

describe('Interprete condition', () => {
  test.each(conditionCases)('Tests condition: %p', (condition, evaluation) => {
    // Parse and check the condition
    const interpreter = new Interpreter(varValues, varObjects);
    const { result } = interpreter.runScript(condition);

    // The given condition should match the expected evaluation
    expect(result.condition).toStrictEqual(evaluation);
  });
});

describe('Interprete mentions', () => {
  test.each(mentionCases)(
    'Tests mention case: %p',
    (script, elementVisits, currentElement, expected) => {
      const interpreter = new Interpreter(
        varValues,
        varObjects,
        elementVisits,
        currentElement
      );
      const { result } = interpreter.runScript(script);
      expect(result.condition).toStrictEqual(expected);
    }
  );
});

describe('Replace variables', () => {
  test.each(replaceVariablesCases)(
    'Tests replace: %p',
    (script, variables, expectedResult) => {
      // Parse and check the condition
      const interpreter = new Interpreter(varValues, varObjects);
      const result = interpreter.replaceVariables(script, variables);

      // The given condition should match the expected evaluation
      expect(result).toStrictEqual(expectedResult);
    }
  );
});

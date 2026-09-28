import { describe, expect, test } from 'vitest';
import { Interpreter } from '../index.js';
import type { ArcscriptStateDef, VarDef } from '../types.js';

const variable = (id: string, name: string, scope?: string | null): VarDef => ({
  id,
  name,
  type: 'integer',
  defaultValue: 0,
  ...(scope === undefined ? {} : { scope }),
});

const rewrite = (
  state: ArcscriptStateDef,
  code: string,
  replacements: Record<string, string>,
  scopeNames?: readonly string[]
) =>
  new Interpreter({ state }).rewriteLegacyVariableReferences(
    code,
    replacements,
    { scopeNames }
  );

describe('legacy variable reference rewriting', () => {
  test('rewrites invalid identifier shapes in raw Arcscript', () => {
    const state = {
      unicode: variable('unicode', 'Tariftyp_Gültig_ab'),
      apostrophe: variable('apostrophe', "Amise'sPower"),
      dollar: variable('dollar', '$ran$'),
      dot: variable('dot', 'score.pl'),
      whitespace: variable('whitespace', 'trucks destroyed'),
    };

    expect(
      rewrite(
        state,
        "Tariftyp_Gültig_ab + Amise'sPower + $ran$ + score.pl + trucks destroyed",
        {
          unicode: 'Tariftyp_Gultig_ab',
          apostrophe: 'Amise_sPower',
          dollar: '$ran',
          dot: 'score_pl',
          whitespace: 'trucks_destroyed',
        }
      )
    ).toEqual({
      code: 'Tariftyp_Gultig_ab + Amise_sPower + $ran + score_pl + trucks_destroyed',
      blockedVariableIds: [],
    });
  });

  test.each([
    ['participant-IL', 'participant_IL'],
    ['Mean/Nice', 'Mean_Nice'],
    ['pissTook?', 'pissTook'],
    ['Brief Description:', 'Brief_Description'],
    ['Sometimes connection is...', 'Sometimes_connection_is'],
    ['Clue_Example_HugoHatesSpeakeasies.', 'Clue_Example_HugoHatesSpeakeasies'],
    ['hospital.rooms.diagnosis', 'hospital_rooms_diagnosis'],
    ['team_-1', 'team_1'],
    ['max', 'max_variable'],
    ['roll', 'roll_variable'],
  ])('rewrites audited production name %s', (oldName, newName) => {
    expect(
      rewrite({ legacy: variable('legacy', oldName) }, `${oldName} == 1`, {
        legacy: newName,
      })
    ).toEqual({
      code: `${newName} == 1`,
      blockedVariableIds: [],
    });
  });

  test('rewrites raw Arcscript without changing strings or mentions', () => {
    const mention =
      '<span class="mention-element mention" data-id="element" data-label="round" data-type="element">round</span>';
    const code = `round &lt; 3 and message == "score.pl" and visits(${mention})`;

    expect(
      rewrite(
        {
          round: variable('round', 'round'),
          score: variable('score', 'score.pl'),
        },
        code,
        { round: 'round_variable', score: 'score_pl' }
      )
    ).toEqual({
      code: `round_variable &lt; 3 and message == "score.pl" and visits(${mention})`,
      blockedVariableIds: [],
    });
  });

  test('distinguishes reserved variable references from function calls', () => {
    expect(
      rewrite(
        { round: variable('round', 'round') },
        'round < 3 and round(2) == 2 and looked_around == true',
        { round: 'round_variable' }
      )
    ).toEqual({
      code: 'round_variable < 3 and round(2) == 2 and looked_around == true',
      blockedVariableIds: [],
    });
  });

  test('uses lexer string and mention ranges without losing apostrophe names', () => {
    const mention =
      '<span class="mention-element mention" data-label="Bob\'s cat">Bob\'s cat</span>';

    expect(
      rewrite(
        {
          apostrophe: variable('apostrophe', "Amise'sPower"),
          quoted: variable('quoted', 'score.pl'),
          reserved: variable('reserved', 'round'),
        },
        `Amise'sPower + Amise'sPower + "score.pl" + ${mention} + round`,
        {
          apostrophe: 'Amise_sPower',
          quoted: 'score_pl',
          reserved: 'round_variable',
        }
      )
    ).toEqual({
      code: `Amise_sPower + Amise_sPower + "score.pl" + ${mention} + round_variable`,
      blockedVariableIds: [],
    });
  });

  test('preserves single-quoted literals after apostrophe names', () => {
    const state = {
      apostrophe: variable('apostrophe', "Amise'sPower"),
      reserved: variable('reserved', 'round'),
    };
    const replacements = {
      apostrophe: 'Amise_sPower',
      reserved: 'round_variable',
    };

    expect(
      rewrite(state, "Amise'sPower + 'round' + round", replacements)
    ).toEqual({
      code: "Amise_sPower + 'round' + round_variable",
      blockedVariableIds: [],
    });
    expect(
      rewrite(state, `message == "Amise'sPower" and Amise'sPower`, replacements)
    ).toEqual({
      code: `message == "Amise'sPower" and Amise_sPower`,
      blockedVariableIds: [],
    });
  });

  test('preserves literals whose quotes are HTML encoded', () => {
    const state = { reserved: variable('reserved', 'round') };
    const replacements = { reserved: 'round_variable' };

    expect(
      rewrite(state, 'message == &quot;round&quot; and round', replacements)
    ).toEqual({
      code: 'message == &quot;round&quot; and round_variable',
      blockedVariableIds: [],
    });
    expect(
      rewrite(state, 'message == &#39;round&#39; and round', replacements)
    ).toEqual({
      code: 'message == &#39;round&#39; and round_variable',
      blockedVariableIds: [],
    });
    expect(
      rewrite(state, 'show("hello &quot;round&quot;") and round', replacements)
    ).toEqual({
      code: 'show("hello &quot;round&quot;") and round_variable',
      blockedVariableIds: [],
    });
    expect(
      rewrite(state, "show('hello &#39;round&#39;') and round", replacements)
    ).toEqual({
      code: "show('hello &#39;round&#39;') and round_variable",
      blockedVariableIds: [],
    });
  });

  test('decodes only the entity beginning at the current position', () => {
    expect(
      rewrite({ unicode: variable('unicode', 'é') }, 'true && é &gt; 1', {
        unicode: 'e',
      })
    ).toEqual({
      code: 'true && e &gt; 1',
      blockedVariableIds: [],
    });
  });

  test('does not let apostrophes in entity-delimited strings hide references', () => {
    expect(
      rewrite(
        {
          message: variable('message', 'message'),
          unicode: variable('unicode', 'é'),
          apostrophe: variable('apostrophe', "Amise'sPower"),
        },
        "message == &quot;Bob's cat&quot; and é > 0 and Amise'sPower",
        { unicode: 'e', apostrophe: 'Amise_sPower' }
      )
    ).toEqual({
      code: "message == &quot;Bob's cat&quot; and e > 0 and Amise_sPower",
      blockedVariableIds: [],
    });
  });

  test('preserves literal ranges after supplementary Unicode characters', () => {
    expect(
      rewrite({ unicode: variable('unicode', 'é') }, 'show("😀😀", "é", é)', {
        unicode: 'e',
      })
    ).toEqual({
      code: 'show("😀😀", "é", e)',
      blockedVariableIds: [],
    });
  });

  test('preserves escaped quotes when masking legacy matches', () => {
    expect(
      rewrite(
        {
          escaped: variable('escaped', 'foo\\'),
          reserved: variable('reserved', 'round'),
        },
        'show("foo\\"round") and round',
        { escaped: 'foo', reserved: 'round_variable' }
      )
    ).toEqual({
      code: 'show("foo\\"round") and round_variable',
      blockedVariableIds: [],
    });
  });

  test('preserves complete escape sequences when masking legacy matches', () => {
    expect(
      rewrite({ unicode: variable('unicode', 'nöm') }, 'show("\\nöm", nöm)', {
        unicode: 'nom',
      })
    ).toEqual({
      code: 'show("\\nöm", nom)',
      blockedVariableIds: [],
    });
  });

  test('does not create string delimiters while masking escaped quotes', () => {
    expect(
      rewrite(
        { escaped: variable('escaped', 'foo\\"bar') },
        'foo\\"bar + "foo\\"bar"',
        { escaped: 'foo_bar' }
      )
    ).toEqual({
      code: 'foo_bar + "foo\\"bar"',
      blockedVariableIds: [],
    });
  });

  test('rewrites scoped references and preserves dot whitespace', () => {
    const state = {
      first: variable('first', 'score:name', 'one'),
      second: variable('second', 'score:name', 'two'),
      global: variable('global', 'score:name'),
    };

    expect(
      rewrite(
        state,
        'one.score:name + two . score:name + score:name',
        {
          first: 'score_name',
          second: 'score_name_2',
          global: 'score_name',
        },
        ['one', 'two']
      )
    ).toEqual({
      code: 'one.score_name + two . score_name_2 + score_name',
      blockedVariableIds: [],
    });
  });

  test('does not rewrite global names as member-expression parts', () => {
    expect(
      rewrite(
        { round: variable('round', 'round') },
        'round.score + unknownScope.round + round',
        { round: 'round_variable' }
      )
    ).toEqual({
      code: 'round.score + unknownScope.round + round_variable',
      blockedVariableIds: [],
    });
  });

  test('blocks references that are valid Arcscript expressions', () => {
    const state = {
      score: variable('score', 'score'),
      assignment: variable('assignment', 'score=1'),
      words: variable('words', 'score is 1'),
      numeric: variable('numeric', '123'),
      expression: variable('expression', 'team_+1'),
      team: variable('team', 'team_'),
    };

    expect(
      rewrite(state, 'score=1; score is 1; 123 > 1; team_+1 == 2', {
        assignment: 'score_1',
        words: 'score_is_1',
        numeric: '_123',
        expression: 'team_1',
      })
    ).toEqual({
      code: 'score=1; score is 1; 123 > 1; team_+1 == 2',
      blockedVariableIds: ['assignment', 'expression', 'numeric', 'words'],
    });
  });

  test('blocks names that consume a surrounding syntax delimiter', () => {
    expect(
      rewrite(
        {
          score: variable('score', 'score'),
          closing: variable('closing', 'score)'),
        },
        'show(score)',
        { closing: 'score_value' }
      )
    ).toEqual({
      code: 'show(score)',
      blockedVariableIds: ['closing'],
    });
  });

  test('blocks names that consume an internal syntax delimiter', () => {
    expect(
      rewrite(
        {
          score: variable('score', 'score'),
          bonus: variable('bonus', 'bonus'),
          combined: variable('combined', 'score, bonus'),
        },
        'max(score, bonus)',
        { combined: 'score_bonus' }
      )
    ).toEqual({
      code: 'max(score, bonus)',
      blockedVariableIds: ['combined'],
    });
  });

  test('blocks names containing an unescaped double quote', () => {
    expect(
      rewrite(
        {
          message: variable('message', 'message'),
          legacy: variable('legacy', 'message = "hello'),
        },
        'message = "hello"',
        { legacy: 'message_hello' }
      )
    ).toEqual({
      code: 'message = "hello"',
      blockedVariableIds: ['legacy'],
    });
  });

  test('blocks names containing a single-quoted string delimiter', () => {
    expect(
      rewrite(
        { legacy: variable('legacy', "true is 'hello") },
        "true is 'hello'",
        { legacy: 'true_is_hello' }
      )
    ).toEqual({
      code: "true is 'hello'",
      blockedVariableIds: ['legacy'],
    });
  });

  test('blocks padded names that resolve to existing syntax', () => {
    expect(
      rewrite(
        {
          score: variable('score', 'score'),
          padded: variable('padded', 'score '),
          boolean: variable('boolean', 'true '),
        },
        'score + 1; true + 1',
        { padded: 'legacy_score', boolean: 'legacy_true' }
      )
    ).toEqual({
      code: 'score + 1; true + 1',
      blockedVariableIds: ['boolean', 'padded'],
    });
  });

  test('blocks scoped names that contain valid scoped expressions', () => {
    expect(
      rewrite(
        {
          score: variable('score', 'score', 'hero'),
          assignment: variable('assignment', 'score=1', 'hero'),
          team: variable('team', 'team_', 'hero'),
          expression: variable('expression', 'team_+1', 'hero'),
        },
        'hero.score=1; hero.team_+1',
        { assignment: 'score_1', expression: 'team_1' },
        ['hero']
      )
    ).toEqual({
      code: 'hero.score=1; hero.team_+1',
      blockedVariableIds: ['assignment', 'expression'],
    });
  });

  test('blocks a pending legacy name that is also a valid if clause', () => {
    expect(
      rewrite(
        {
          condition: variable('condition', 'has_key'),
          legacy: variable('legacy', 'if has_key'),
        },
        'if has_key',
        { legacy: 'if_has_key' }
      )
    ).toEqual({
      code: 'if has_key',
      blockedVariableIds: ['legacy'],
    });
  });

  test('does not rewrite a whitespace name inside a longer phrase', () => {
    expect(
      rewrite(
        { legacy: variable('legacy', 'Veteran Merc') },
        'Veteran Merc Background',
        { legacy: 'Veteran_Merc' }
      )
    ).toEqual({
      code: 'Veteran Merc Background',
      blockedVariableIds: [],
    });
  });

  test('does not rewrite a scoped whitespace name inside a longer phrase', () => {
    expect(
      rewrite(
        { legacy: variable('legacy', 'Veteran Merc', 'hero') },
        'hero.Veteran Merc Background',
        { legacy: 'Veteran_Merc' },
        ['hero']
      )
    ).toEqual({
      code: 'hero.Veteran Merc Background',
      blockedVariableIds: [],
    });
  });

  test('rewrites whitespace names next to Arcscript word operators', () => {
    expect(
      rewrite(
        {
          legacy: variable('legacy', 'trucks destroyed'),
          other: variable('other', 'other'),
        },
        'if trucks destroyed; not trucks destroyed; other and trucks destroyed; trucks destroyed or other',
        { legacy: 'trucks_destroyed' }
      )
    ).toEqual({
      code: 'if trucks_destroyed; not trucks_destroyed; other and trucks_destroyed; trucks_destroyed or other',
      blockedVariableIds: [],
    });
  });

  test('allows operator characters when they do not form a known expression', () => {
    expect(
      rewrite(
        {
          operator: variable('operator', 'team_+1'),
          ampersand: variable('ampersand', 'A&B'),
        },
        'team_+1 == 2 and A&amp;B == 1',
        { operator: 'team_1', ampersand: 'A_B' }
      )
    ).toEqual({
      code: 'team_1 == 2 and A_B == 1',
      blockedVariableIds: [],
    });
  });

  test('blocks duplicate names and ambiguous scoped variables', () => {
    expect(
      rewrite(
        {
          first: variable('first', 'score name'),
          second: variable('second', 'score name'),
          scoped: variable('scoped', 'health value', 'duplicate'),
        },
        'score name + duplicate.health value',
        {
          first: 'score_name',
          second: 'score_name_2',
          scoped: 'health_value',
        },
        ['duplicate', 'duplicate']
      )
    ).toEqual({
      code: 'score name + duplicate.health value',
      blockedVariableIds: ['first', 'scoped', 'second'],
    });
  });

  test('blocks invalid and reserved scope names', () => {
    expect(
      rewrite(
        {
          operator: variable('operator', 'score name', 'foo-bar'),
          reserved: variable('reserved', 'health value', 'round'),
        },
        'foo-bar.score name + round.health value',
        { operator: 'score_name', reserved: 'health_value' },
        ['foo-bar', 'round']
      )
    ).toEqual({
      code: 'foo-bar.score name + round.health value',
      blockedVariableIds: ['operator', 'reserved'],
    });
  });

  test('applies overlapping renames simultaneously without cascading', () => {
    expect(
      rewrite(
        {
          short: variable('short', 'a.b'),
          long: variable('long', 'a.b.c'),
          unicode: variable('unicode', 'ööö'),
          generated: variable('generated', 'ooo+1'),
        },
        'a.b.c + a.b + ööö+1',
        {
          short: 'a_b',
          long: 'a_b_c',
          unicode: 'ooo',
          generated: 'ooo_1',
        }
      )
    ).toEqual({
      code: 'a_b_c + a_b + ooo+1',
      blockedVariableIds: [],
    });
  });

  test('does not match Unicode names inside longer Unicode names', () => {
    expect(
      rewrite(
        {
          first: variable('first', 'é'),
          second: variable('second', 'àé'),
          third: variable('third', 'éà'),
        },
        'àé + éà + é',
        { first: 'e', second: 'ae', third: 'ea' }
      )
    ).toEqual({
      code: 'ae + ea + e',
      blockedVariableIds: [],
    });
  });

  test('blocks compound references to other legacy variables', () => {
    expect(
      rewrite(
        {
          component: variable('component', 'föo'),
          compound: variable('compound', 'föo+1'),
        },
        'föo+1',
        { component: 'foo', compound: 'foo_1' }
      )
    ).toEqual({
      code: 'föo+1',
      blockedVariableIds: ['compound'],
    });
    expect(
      rewrite(
        {
          component: variable('component', 'föo'),
          compound: variable('compound', 'föo+1'),
        },
        'föo+1',
        { compound: 'foo_1' }
      )
    ).toEqual({
      code: 'föo+1',
      blockedVariableIds: ['compound'],
    });
  });

  test('allows unreferenced legacy names but blocks invalid replacements', () => {
    expect(
      rewrite(
        {
          unreferenced: variable('unreferenced', 'missing name'),
          invalidReplacement: variable('invalidReplacement', 'present name'),
        },
        'present name',
        {
          unreferenced: 'missing_name',
          invalidReplacement: 'still invalid',
        }
      )
    ).toEqual({
      code: 'present name',
      blockedVariableIds: ['invalidReplacement'],
    });
  });
});

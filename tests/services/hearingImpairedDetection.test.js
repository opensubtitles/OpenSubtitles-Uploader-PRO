import { test, describe } from 'node:test';
import assert from 'node:assert';
import { SubtitleUploadService } from '../../src/services/subtitleUploadService.js';

const detect = name => SubtitleUploadService.detectFeaturesFromPath(name, () => {}).hearingimpaired;
const fromFilename = name => SubtitleUploadService.checkHearingImpairedFromFilename(name);
const fromString = name => SubtitleUploadService.checkHearingImpairedFromString(name);

describe('Hearing Impaired detection — TRUE POSITIVES (must detect)', () => {
  const positives = [
    'movie.hi.srt',
    'movie.HI.srt',
    'movie-hi-en.srt',
    'movie.sdh.srt',
    'movie.psdh.srt',
    'movie.hi-eng.srt',
    'movie_hi.srt',
    'movie.hearing.impaired.srt',
    'movie.hearingimpaired.srt',
    'show.s01e01.sdh.srt',
    'film-hi.srt',
    'film.hi',
    'a.HI.b.srt',
  ];
  for (const name of positives) {
    test(`detects HI in "${name}"`, () => {
      assert.strictEqual(fromFilename(name), true, `expected HI=true for ${name}`);
      assert.strictEqual(detect(name), '1', `expected detectFeaturesFromPath HI=1 for ${name}`);
    });
  }
});

describe('Hearing Impaired detection — FALSE POSITIVES (must NOT detect)', () => {
  // The forum-reported regression bucket. Every name here was being flagged HI
  // by older versions because the regex `[-.]hi[-.]?` had an OPTIONAL trailing
  // separator, so `.hi` inside `.high.` matched. Lock these in forever.
  const negatives = [
    'The.Man.In.The.High.Castle.S01E01.srt',
    'The.Man.In.High.Castle.srt',
    'High.School.Musical.srt',
    'Highlander.srt',
    'Highway.61.srt',
    'History.Channel.Documentary.srt',
    'Hill.Street.Blues.srt',
    'Hindi.Medium.2017.srt',
    'Hitman.2007.srt',
    'Hindenburg.2011.srt',
    'The.Hitchhikers.Guide.srt',
    'Chicago.PD.S01E01.srt',
    'Sushi.For.Beginners.srt',
    'Yudhishir.srt',
    // sdh false-positive surface
    'Sdhruv.Movie.srt',
    'Lordsdhammer.srt',
    // psdh false-positive surface
    'Apsdharma.srt',
    // explicit NOT-HI markers
    'movie.nonhi.srt',
    'movie.non-hi.srt',
    'movie.no-hi.srt',
    'movie.not.hi.srt',
  ];
  for (const name of negatives) {
    test(`does NOT detect HI in "${name}"`, () => {
      assert.strictEqual(
        fromFilename(name),
        false,
        `false positive — ${name} should NOT be flagged HI`
      );
      assert.strictEqual(
        detect(name),
        '0',
        `false positive in detectFeaturesFromPath — ${name} should NOT be flagged HI`
      );
    });
  }
});

describe('Hearing Impaired detection — path-part scanning', () => {
  test('flags HI when a parent directory clearly indicates it', () => {
    assert.strictEqual(detect('Movies/Hearing.Impaired/movie.srt'), '1');
    assert.strictEqual(detect('Movies/SDH/movie.srt'), '1');
  });

  test('does NOT flag HI when only "High" appears in path', () => {
    assert.strictEqual(detect('Movies/The.Man.In.High.Castle/S01E01.srt'), '0');
    assert.strictEqual(detect('Movies/Highlander/Highlander.srt'), '0');
  });

  test('does NOT flag HI from the standalone substring scanner', () => {
    assert.strictEqual(fromString('The.Man.In.High.Castle'), false);
    assert.strictEqual(fromString('Highlander'), false);
    assert.strictEqual(fromString('Chicago'), false);
  });
});

describe('Hearing Impaired detection — regression: forum.opensubtitles.org/p=54942', () => {
  // Reported 2026 — uploads of "The.Man.In.High.Castle"-style names were being
  // auto-flagged HI because `.hi` inside `.high.` matched the legacy pattern.
  test('forum-reported case: The.Man.In.The.High.Castle is NOT HI', () => {
    assert.strictEqual(fromFilename('The.Man.In.The.High.Castle.S01E01.srt'), false);
    assert.strictEqual(
      detect('The.Man.In.The.High.Castle.S01E01.srt'),
      '0',
      'release-name with .High. must not auto-set HI'
    );
  });
});

describe('Hearing Impaired detection — regression: forum-reported Hi-in-title false positives', () => {
  // User-reported 2026-06: bare `\bhi\b` and `.hi.` in mid-name release titles
  // were misclassifying ~500 episodes and ~100 movies as HI. Titles below all
  // contain `Hi` as part of the actual title, NOT as a hearing-impaired marker.
  const titleHiCases = [
    'The.Hi-Lo.Country.1998.1080p.USA.BluRay.AVC.DTS-HD.MA.5.1-rmHD.mkv',
    'The.King.of.Queens.S03E13.Hi.Def.Jam.1080p.NF.WEB-DL.AAC2.0.H.264-POWER.mkv',
    'For.All.Mankind.S01E07.Hi.Bob.1080p.WEB-DL.6CH.x265.HEVC-PSA.mkv',
    'The.Hi-Lo.Country.1998.1080p.USA.BluRay.AVC.DTS-HD.MA.5.1-rmHD.srt',
    'For.All.Mankind.S01E07.Hi.Bob.1080p.WEB-DL.6CH.x265.HEVC-PSA.srt',
    'Hi.School.Love.On.E01.srt',
    'Hi-Fi.Lounge.S01E01.srt',
  ];
  for (const name of titleHiCases) {
    test(`does NOT detect HI when "Hi" is part of the title: "${name}"`, () => {
      assert.strictEqual(
        fromFilename(name),
        false,
        `false positive — "${name}" has Hi in title, not as HI marker`
      );
      assert.strictEqual(
        detect(name),
        '0',
        `detectFeaturesFromPath false positive — "${name}" must not auto-set HI`
      );
      assert.strictEqual(
        fromString(name),
        false,
        `per-string scanner false positive — "${name}" has Hi in title, not as HI marker`
      );
    });
  }

  // Real HI markers near the extension must still fire — including for the same
  // episodes that previously misfired purely on title text.
  const stillDetected = [
    'For.All.Mankind.S01E07.Hi.Bob.1080p.WEB-DL.HEVC-PSA.eng.hi.srt',
    'The.Hi-Lo.Country.1998.eng.sdh.srt',
    'The.King.of.Queens.S03E13.Hi.Def.Jam.hi.srt',
  ];
  for (const name of stillDetected) {
    test(`still detects HI when marker is in the language-code slot: "${name}"`, () => {
      assert.strictEqual(fromFilename(name), true);
      assert.strictEqual(detect(name), '1');
    });
  }
});

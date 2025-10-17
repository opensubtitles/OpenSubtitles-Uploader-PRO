/**
 * Tests for release name cleaning utility
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { getReleaseFromSubFilename, cleanReleaseName } from '../../src/utils/releaseNameUtils.js';

describe('releaseNameUtils', () => {
  // Mock combined languages data
  const mockCombinedLanguages = {
    en: {
      iso639: 'eng',
      language_code: 'en',
      languageName: 'English',
      displayName: 'English'
    },
    es: {
      iso639: 'spa',
      language_code: 'es',
      languageName: 'Spanish',
      displayName: 'Spanish'
    },
    pt: {
      iso639: 'por',
      language_code: 'pt',
      languageName: 'Portuguese',
      displayName: 'Portuguese'
    },
    fr: {
      iso639: 'fre',
      language_code: 'fr',
      languageName: 'French',
      displayName: 'French'
    }
  };

  describe('getReleaseFromSubFilename', () => {
    test('should remove language code from end of filename', () => {
      const result = getReleaseFromSubFilename('Movie.Name.2024.eng.srt', mockCombinedLanguages, false);
      assert.strictEqual(result, ' Movie.Name.2024');
    });

    test('should remove language code with various separators', () => {
      const result1 = getReleaseFromSubFilename('Movie.Name-eng.srt', mockCombinedLanguages, false);
      const result2 = getReleaseFromSubFilename('Movie.Name_eng.srt', mockCombinedLanguages, false);
      assert.strictEqual(result1, ' Movie.Name');
      assert.strictEqual(result2, ' Movie.Name');
    });

    test('should remove CD1 pattern', () => {
      const result = getReleaseFromSubFilename('Movie.Name.CD1.eng.srt', mockCombinedLanguages, false);
      assert.strictEqual(result, ' Movie.Name');
    });

    test('should remove CD I pattern', () => {
      const result = getReleaseFromSubFilename('Movie.Name.CD I.eng.srt', mockCombinedLanguages, false);
      assert.strictEqual(result, ' Movie.Name');
    });

    test('should remove SDH suffix', () => {
      const result = getReleaseFromSubFilename('Movie.Name.eng.sdh.srt', mockCombinedLanguages, false);
      assert.strictEqual(result, ' Movie.Name');
    });

    test('should remove full language name', () => {
      const result = getReleaseFromSubFilename('Movie.Name.English.srt', mockCombinedLanguages, false);
      assert.strictEqual(result, ' Movie.Name');
    });

    test('should remove pt-br custom pattern', () => {
      const result = getReleaseFromSubFilename('Movie.Name.pt-br.srt', mockCombinedLanguages, false);
      assert.strictEqual(result, ' Movie.Name');
    });

    test('should handle multiple separators at end', () => {
      const result = getReleaseFromSubFilename('Movie.Name...eng.srt', mockCombinedLanguages, false);
      assert.strictEqual(result, ' Movie.Name');
    });

    test('should return false for too short results', () => {
      const result = getReleaseFromSubFilename('ab.eng.srt', mockCombinedLanguages, false);
      assert.strictEqual(result, false);
    });

    test('should handle filename without extension', () => {
      const result = getReleaseFromSubFilename('Movie.Name.eng', mockCombinedLanguages, false);
      assert.strictEqual(result, ' Movie.Name');
    });

    test('should not remove language code from middle of filename', () => {
      const result = getReleaseFromSubFilename('English.Patient.2024.srt', mockCombinedLanguages, false);
      assert.strictEqual(result, ' English.Patient.2024');
    });

    test('should handle release name mode (skip extension removal)', () => {
      const result = getReleaseFromSubFilename('Movie.Name.eng', mockCombinedLanguages, true);
      assert.strictEqual(result, ' Movie.Name');
    });

    test('should remove regional language variants (pt-PT)', () => {
      const result = getReleaseFromSubFilename('Movie.Name.2024.pt-PT.srt', mockCombinedLanguages, false);
      assert.strictEqual(result, ' Movie.Name.2024');
    });

    test('should remove regional language variants (pt-BR)', () => {
      const result = getReleaseFromSubFilename('Movie.Name.2024.pt-BR.srt', mockCombinedLanguages, false);
      assert.strictEqual(result, ' Movie.Name.2024');
    });

    test('should remove regional language variants (en-US)', () => {
      const result = getReleaseFromSubFilename('Movie.Name.en-US.srt', mockCombinedLanguages, false);
      assert.strictEqual(result, ' Movie.Name');
    });

    test('should remove regional language variants with SDH', () => {
      const result = getReleaseFromSubFilename('Movie.Name.en-GB.sdh.srt', mockCombinedLanguages, false);
      assert.strictEqual(result, ' Movie.Name');
    });

    test('should handle complex filename with regional variant (pt-PT)', () => {
      const result = getReleaseFromSubFilename('Prisoner.of.War.2025.1080p.AMZN.WEB-DL.DDP5.1.H.264.v2.pt-PT.srt', mockCombinedLanguages, false);
      assert.strictEqual(result, ' Prisoner.of.War.2025.1080p.AMZN.WEB-DL.DDP5.1.H.264.v2');
    });

    test('should handle complex filename with full language name (spanish)', () => {
      const result = getReleaseFromSubFilename('Prisoner.of.War.2025.1080p.AMZN.WEB-DL.DDP5.1.H.264.v2.spanish.srt', mockCombinedLanguages, false);
      assert.strictEqual(result, ' Prisoner.of.War.2025.1080p.AMZN.WEB-DL.DDP5.1.H.264.v2');
    });
  });

  describe('cleanReleaseName', () => {
    test('should clean release name and return without leading space', () => {
      const result = cleanReleaseName('Movie.Name.2024.eng', mockCombinedLanguages);
      assert.strictEqual(result, 'Movie.Name.2024');
    });

    test('should return original if cleaning fails', () => {
      const result = cleanReleaseName('ab', mockCombinedLanguages);
      assert.strictEqual(result, 'ab');
    });

    test('should handle complex filenames', () => {
      const result = cleanReleaseName('The.Movie.Name.2024.1080p.BluRay.x264.eng', mockCombinedLanguages);
      assert.strictEqual(result, 'The.Movie.Name.2024.1080p.BluRay.x264');
    });
  });
});

const {
  normalizePublicFormUrl,
  parsePublicFormToSuggestion
} = require('../services/surveyImportService');

describe('survey import service', () => {
  test('rejects private and localhost URLs', () => {
    expect(normalizePublicFormUrl('http://localhost:3000/form').ok).toBe(false);
    expect(normalizePublicFormUrl('http://127.0.0.1:8080/form').ok).toBe(false);
    expect(normalizePublicFormUrl('https://192.168.1.10/form').ok).toBe(false);
    expect(normalizePublicFormUrl('not-a-url').ok).toBe(false);
  });

  test('accepts public HTTPS URLs', () => {
    const result = normalizePublicFormUrl('https://example.com/public/form');
    expect(result.ok).toBe(true);
    expect(result.normalizedUrl).toBe('https://example.com/public/form');
  });

  test('parses common form fields into survey suggestion blocks', () => {
    const html = `
      <html>
        <head>
          <title>Volunteer Intake Form</title>
          <meta name="description" content="Tell us about your availability" />
        </head>
        <body>
          <h2>About You</h2>
          <form>
            <label for="full-name">Full name</label>
            <input id="full-name" name="full_name" type="text" required />

            <label for="email">Email</label>
            <input id="email" name="email" type="email" />

            <label for="bio">Tell us more</label>
            <textarea id="bio" name="bio"></textarea>

            <label for="shirt-size">Shirt Size</label>
            <select id="shirt-size" name="shirt_size">
              <option>Small</option>
              <option>Medium</option>
              <option>Large</option>
            </select>

            <label><input type="radio" name="experience" value="new" /> New Burner</label>
            <label><input type="radio" name="experience" value="veteran" /> Veteran</label>
          </form>
        </body>
      </html>
    `;

    const suggestion = parsePublicFormToSuggestion(html);
    expect(suggestion.title).toBe('Volunteer Intake Form');
    expect(suggestion.description).toBe('Tell us about your availability');
    expect(suggestion.blocks.length).toBeGreaterThan(3);

    const blockTypes = suggestion.blocks.map((block) => block.blockType);
    expect(blockTypes).toContain('short_answer');
    expect(blockTypes).toContain('paragraph');
    expect(blockTypes).toContain('dropdown');
    expect(blockTypes).toContain('multiple_choice');
  });

  test('preserves unsupported fields as warning blocks', () => {
    const html = `
      <form>
        <label for="upload">Upload attachment</label>
        <input id="upload" name="attachment" type="file" />
      </form>
    `;
    const suggestion = parsePublicFormToSuggestion(html);
    const unsupported = suggestion.blocks.filter((block) => block.blockType === 'unsupported');
    expect(unsupported.length).toBeGreaterThan(0);
    expect(suggestion.unsupportedCount).toBeGreaterThan(0);
    expect(suggestion.warnings.length).toBeGreaterThan(0);
  });
});

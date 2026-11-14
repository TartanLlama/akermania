import { load } from 'js-yaml'
import fs from 'fs'
import { marked } from 'marked'
import { format } from 'prettier'

function formatName(value) {
    if (!value) return '';

    const text = String(value).trim();
    if (!text) return '';

    if (text.includes(',')) {
        return text;
    }

    const parts = text.split(/\s+/);
    if (parts.length <= 1) {
        return text;
    }

    return `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(' ')}`;
}

function formatNameList(values) {
    const list = Array.isArray(values) ? values : [values];
    const formatted = list
        .filter(Boolean)
        .map(value => formatName(value));

    if (!formatted.length) return '';
    if (formatted.length === 1) return formatted[0];
    if (formatted.length === 2) return `${formatted[0]} and ${formatted[1]}`;

    return `${formatted.slice(0, -1).join(', ')}, and ${formatted[formatted.length - 1]}`;
}

function resolveContainer(item, refLookup) {
    if (!item || !item.in) return null;

    if (typeof item.in === 'string') {
        return refLookup.get(item.in) || null;
    }

    return item.in;
}

function formatBriefReference(item, refLookup) {
    const authors = item.author ? [item.author] : item.authors || [];
    const editors = item.editor ? [item.editor] : item.editors || [];
    const authorText = formatNameList(authors);
    const editorText = formatNameList(editors);
    const container = resolveContainer(item, refLookup);

    if (container) {
        const containerTitle = container.title || '';
        const containerEditors = container.editor
            ? [container.editor]
            : (container.editors || []);
        const containerEditorText = formatNameList(containerEditors);

        const clause = [];
        if (authorText) clause.push(authorText);

        const containerBits = [];
        if (containerTitle) containerBits.push(`<i>${containerTitle}</i>`);
        if (containerEditorText) containerBits.push(`edited by ${containerEditorText}`);
        if (container.year) containerBits.push(String(container.year));
        if (container.publisher) containerBits.push(container.publisher);

        if (containerBits.length) {
            clause.push(containerBits.join(', ') + '.');
        }

        if (item.pages) clause.push(`${item.pages}.`);
        return clause.join(' ');
    }

    let parts = [];

    if (authorText) {
        parts.push(authorText);
    }

    if (editorText) {
        parts.push(`Edited by ${editorText}.`);
    }

    if (item.year) {
        parts.push(`${item.year}.`);
    }

    if (item.pages) {
        parts.push(`${item.pages}.`);
    }

    if (item.publisher) {
        parts.push(`${item.publisher}.`);
    }

    if (item.url) {
        parts.push(`<a href="${item.url}" target="_blank" rel="noreferrer">${item.url}</a>.`);
    }

    return parts.join(' ');
}

function generateThemesHtml(themes) {
    if (!themes || !themes.length) return '';

    return `
      <div id="themes">
        ${themes.map((theme) => {
            const notesHtml = theme.notes
                ? `<ul>${theme.notes
                    .split('\n')
                    .filter(Boolean)
                    .map(note => `<li>${note.replace(/^[-*]\s*/, '')}</li>`)
                    .join('')}</ul>`
                : '';

            return `
              <article class="theme-card">
                <h3>${theme.name}</h3>
                <p>${theme.definition || ''}</p>
                ${notesHtml}
              </article>
            `;
        }).join('\n')}
      </div>
    `;
}

function generateResearchQuestionsHtml(questions) {
    if (!questions || !questions.length) return '';

    return `
      <ul class="research-questions">
        ${questions
            .map(question => `<li>${question}</li>`)
            .join('')}
      </ul>
    `;
}

function generateBibliographyHtml(bibliography, refLookup) {
    return bibliography.map((item) => {
        const notesHtml = item.notes
            ? `<details class="notes-panel">
                <summary>Notes</summary>
                <div class="notes">${marked.parse(item.notes)}</div>
              </details>`
            : '';

        const quotesHtml = item.quotes
            ? `<details class="quotes-panel">
                <summary>Quotes</summary>
                <ul class="quotes">${item.quotes
                .map(quote => `<li>“${quote.replace(/['"]/g, '')}”</li>`)
                .join('')}</ul>
              </details>`
            : '';

        const tagsHtml = item.tags
            ? `<span class="tags">Tags: ${item.tags.join(', ')}</span>`
            : '';
        const filmsHtml = item.films
            ? `<span class="films">Films: ${item.films.join(', ')}</span>`
            : '';

        const tagsData = item.tags ? item.tags.join('|') : '';
        const filmsData = item.films ? item.films.join('|') : '';

        return `
            <article class="entry" data-tags="${tagsData}" data-films="${filmsData}">
                <h2 class="title">${item.title}</h2>
                <p class="citation">${formatBriefReference(item, refLookup)}</p>
                ${tagsHtml}
                ${filmsHtml}
                ${notesHtml}
                ${quotesHtml}
            </article>
        `;
    }).join('\n');
}

try {
    console.log('Reading notes.yaml...');
    const fileContents = fs.readFileSync('notes.yaml', 'utf8');
    const notes = load(fileContents);

    let tags = new Set();
    let films = new Set();
    let bibliography = [];
    const refLookup = new Map();

    for (const item of notes.bibliography) {
        if (item.ref) {
            refLookup.set(item.ref, item);
        }
    }

    for (const item of notes.bibliography) {
        if (item.tags) {
            item.tags.forEach(tag => tags.add(tag));
        }
        if (item.films) {
            item.films.forEach(film => films.add(film));
        }
        bibliography.push(item);
    }
    bibliography.sort((a, b) => {
        const titleA = a.title ? a.title.toLowerCase() : '';
        const titleB = b.title ? b.title.toLowerCase() : '';
        return titleA.localeCompare(titleB);
    });

    console.log('Unique tags:', Array.from(tags));
    console.log('Unique films:', Array.from(films));
    console.log(`Found ${bibliography.length} bibliography items.`);

    console.log('Reading index.html...');
    const template = fs.readFileSync('src/templates/index.html', 'utf8');

    const tagHtml = `
        <div id="tag-list">
          ${Array.from(tags).map(tag => `<button type="button" class="tag" data-tag="${tag}">${tag}</button>`).join('\n')}
        </div>
    `;
    const filmHtml = `
        <div id="film-list">
          ${Array.from(films).map(film => `<button type="button" class="film" data-film="${film}">${film}</button>`).join('\n')}
        </div>
    `;
    const themesHtml = generateThemesHtml(Array.isArray(notes.themes_and_concepts) ? notes.themes_and_concepts : (notes.themes_and_concepts ? [notes.themes_and_concepts] : []));
    const researchQuestionsHtml = generateResearchQuestionsHtml(notes.research_questions || []);
    const bibliographyHtml = generateBibliographyHtml(bibliography, refLookup);

    fs.mkdirSync('dist', { recursive: true });
    fs.copyFileSync('src/style.css', 'dist/style.css');
    fs.copyFileSync('src/app.js', 'dist/app.js');

    const generated = template
        .replace('{{tags}}', tagHtml)
        .replace('{{films}}', filmHtml)
        .replace('{{themes}}', themesHtml)
        .replace('{{research_questions}}', researchQuestionsHtml)
        .replace('{{bibliography}}', bibliographyHtml);

    const formatted = await format(generated, { parser: 'html' });
    fs.writeFileSync('dist/index.html', formatted);
    console.log('index.html generated successfully.');
} catch (e) {
    console.error(e);
}
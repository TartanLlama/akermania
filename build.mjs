import { load } from 'js-yaml'
import fs from 'fs'
import { marked } from 'marked'
import { format } from 'prettier'

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

// In case I forget to format names properly, make sure they're in "Last, First" format
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

    // Oxford comma for life
    return `${formatted.slice(0, -1).join(', ')}, and ${formatted[formatted.length - 1]}`;
}

function resolveContainer(item, refLookup) {
    if (!item || !item.in) return null;

    if (typeof item.in === 'string') {
        return refLookup.get(item.in) || null;
    }

    return item.in;
}

// TODO: This doesn't strictly adhere to any particular style, but maybe I should make it do so
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
        if (authorText) clause.push(`${escapeHtml(authorText)}.`);

        const containerBits = [];
        if (containerTitle) containerBits.push(`<i>${escapeHtml(containerTitle)}</i>`);
        if (containerEditorText) containerBits.push(`edited by ${escapeHtml(containerEditorText)}`);
        if (container.publisher) containerBits.push(escapeHtml(container.publisher));

        let containerString = containerBits.join(', ');
        if (container.year) {
            containerString = `${containerString ? `${containerString} ` : ''}(${escapeHtml(container.year)})`;
        }

        if (containerString) {
            clause.push(containerString + '.');
        }

        if (item.pages) clause.push(`${escapeHtml(item.pages)}.`);
        return clause.join(' ');
    }

    let parts = [];

    if (authorText) {
        parts.push(escapeHtml(authorText));
    }

    if (item.year) {
        parts.push(`(${escapeHtml(item.year)})`);
    }

    if (editorText) {
        parts.push(`Edited by ${escapeHtml(editorText)}.`);
    }

    if (item.pages) {
        parts.push(`${escapeHtml(item.pages)}.`);
    }

    if (item.publisher) {
        parts.push(`${escapeHtml(item.publisher)}.`);
    }

    if (item.url) {
        const url = escapeHtml(item.url);
        parts.push(`<a href="${url}" target="_blank" rel="noreferrer">${url}</a>.`);
    }

    return parts.join(' ');
}

function generateThemesHtml(themes) {
    if (!themes || !themes.length) return '';

    return `
      <div id="themes">
        ${themes.map((theme) => {
        const notesHtml = theme.notes ? marked.parse(theme.notes) : '';

        return `
              <article class="theme-card">
                <h3>${escapeHtml(theme.name)}</h3>
                <p>${escapeHtml(theme.definition || '')}</p>
                ${notesHtml}
              </article>
            `;
    }).join('\n')}
      </div>
    `;
}

function generateFilmographyHtml(films) {
    if (!Array.isArray(films)) throw new Error('films must be a list');

    return films.map(film => {
        const title = escapeHtml(film.title);
        const tagsHtml = film.tags?.length
            ? `<p class="tags">Tags: ${film.tags.map(escapeHtml).join(', ')}</p>`
            : '';
        const notesHtml = film.notes ? marked.parse(film.notes) : '';
        return `
            <article class="film-record">
                <h3>${title} (${film.year})</h3>
                ${tagsHtml}
                ${notesHtml}
            </article>
        `;
    }).join('\n');
}

// I support two ways of specifying notes: `notes` and `notes_file`
function resolveEntryNotes(item) {
    if (item.notes_file) {
        return fs.readFileSync(item.notes_file, 'utf8').trim();
    }

    return item.notes || '';
}

function generateBibliographyHtml(bibliography, refLookup) {
    return bibliography.map((item) => {
        const entryNotes = resolveEntryNotes(item);
        const notesHtml = entryNotes
            ? `<details class="notes-panel">
                <summary>Notes</summary>
                <div class="notes">${marked.parse(entryNotes)}</div>
              </details>`
            : '';

        const tagsHtml = item.tags
            ? `<p class="tags">Tags: ${item.tags.map(escapeHtml).join(', ')}</p>`
            : '';
        const filmsHtml = item.films
            ? `<p class="films">Films: ${item.films.map(escapeHtml).join(', ')}</p>`
            : '';

        const tagsData = item.tags ? escapeHtml(item.tags.join('|')) : '';
        const filmsData = item.films ? escapeHtml(item.films.join('|')) : '';

        return `
            <article class="entry" data-tags="${tagsData}" data-films="${filmsData}">
                <h3 class="title">${escapeHtml(item.title)}</h3>
                <p class="citation">${formatBriefReference(item, refLookup)}</p>
                ${tagsHtml}
                ${filmsHtml}
                ${notesHtml}
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
        const titleA = a.title.toLowerCase();
        const titleB = b.title.toLowerCase();
        return titleA.localeCompare(titleB);
    });

    console.log('Unique tags:', Array.from(tags));
    console.log('Unique films:', Array.from(films));
    console.log(`Found ${bibliography.length} bibliography items.`);

    console.log('Reading index.html...');
    const template = fs.readFileSync('src/templates/index.html', 'utf8');

    const tagGroups = notes.tag_groups || [];
    const assignedTags = new Set(tagGroups.flatMap(group => group.tags));
    const unassignedTags = Array.from(tags).filter(tag => !assignedTags.has(tag));
    if (unassignedTags.length) {
        throw new Error(`Tags not assigned to a group: ${unassignedTags.join(', ')}`);
    }
    const tagHtml = `
        <div id="tag-list">
          ${tagGroups.map(group => `
            <section class="tag-group">
              <h4>${escapeHtml(group.name)}</h4>
              <div class="filter-list">
                ${group.tags
                    .filter(tag => tags.has(tag))
                    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
                    .map(tag => `<button type="button" class="tag" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`)
                    .join('\n')}
              </div>
            </section>
          `).join('\n')}
        </div>
    `;
    const filmHtml = `
        <div class="filter-list">
          ${Array.from(films).map(film => `<button type="button" class="film" data-film="${escapeHtml(film)}">${escapeHtml(film)}</button>`).join('\n')}
        </div>
    `;
    const themes = notes.themes_and_concepts;
    const themesHtml = generateThemesHtml(themes);
    const bibliographyHtml = generateBibliographyHtml(bibliography, refLookup);
    const filmographyHtml = generateFilmographyHtml(notes.films);

    fs.mkdirSync('dist', { recursive: true });
    fs.mkdirSync('dist/images', { recursive: true });

    // TODO: maybe make this less hardcoded
    fs.copyFileSync('src/style.css', 'dist/style.css');
    fs.copyFileSync('src/app.js', 'dist/app.js');
    fs.copyFileSync('src/images/je-tu-il-elle.jpg', 'dist/images/je-tu-il-elle.jpg');

    // TODO: this will do for now, but I should think about a more structured solution
    const generated = template
        .replace('{{tags}}', tagHtml)
        .replace('{{films}}', filmHtml)
        .replace('{{themes}}', themesHtml)
        .replace('{{concepts_count}}', `${themes.length} ${themes.length === 1 ? 'entry' : 'entries'}`)
        .replace('{{filmography}}', filmographyHtml)
        .replace('{{filmography_count}}', `${notes.films.length} ${notes.films.length === 1 ? 'film' : 'films'}`)
        .replace('{{bibliography}}', bibliographyHtml);

    const formatted = await format(generated, { parser: 'html' });
    fs.writeFileSync('dist/index.html', formatted);
    console.log('index.html generated successfully.');
} catch (e) {
    console.error(e);
    process.exitCode = 1;
}
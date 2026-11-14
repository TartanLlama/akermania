document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search');
    const expandAllButton = document.getElementById('expand-all');
    const collapseAllButton = document.getElementById('collapse-all');
    const clearFiltersButton = document.getElementById('clear-filters');
    const tagButtons = [...document.querySelectorAll('.tag')];
    const filmButtons = [...document.querySelectorAll('.film')];
    const entries = [...document.querySelectorAll('.entry')];
    const resultCount = document.getElementById('results-count');

    const state = {
        query: '',
        tags: new Set(),
        films: new Set(),
    };

    const normalize = (value = '') => String(value).trim().toLowerCase();

    function updateResultsCount(count) {
        if (!resultCount) return;
        resultCount.textContent = `${count} result${count === 1 ? '' : 's'}`;
    }

    function clearAllFilters() {
        state.query = '';
        state.tags.clear();
        state.films.clear();

        searchInput.value = '';

        for (const button of tagButtons) {
            button.classList.remove('active');
        }

        for (const button of filmButtons) {
            button.classList.remove('active');
        }

        applyFilters();
    }

    function matchesFilters(entry) {
        const entryText = entry.textContent.toLowerCase();
        const query = normalize(state.query);

        if (query && !entryText.includes(query)) return false;

        const entryTags = (entry.dataset.tags || '').split('|').filter(Boolean);
        const entryFilms = (entry.dataset.films || '').split('|').filter(Boolean);

        if (state.tags.size && ![...state.tags].every(tag => entryTags.includes(tag))) {
            return false;
        }

        if (state.films.size && ![...state.films].every(film => entryFilms.includes(film))) {
            return false;
        }

        return true;
    }

    function applyFilters() {
        let visible = 0;

        for (const entry of entries) {
            const visibleEntry = matchesFilters(entry);
            entry.classList.toggle('hidden', !visibleEntry);
            if (visibleEntry) visible += 1;
        }

        updateResultsCount(visible);
    }

    function toggleSetButton(buttons, value, setKey) {
        for (const button of buttons) {
            const currentValue = button.dataset[setKey];
            const isSelected = state[setKey === 'tag' ? 'tags' : 'films'].has(currentValue);
            button.classList.toggle('active', isSelected);
        }
    }

    searchInput.addEventListener('input', (event) => {
        state.query = event.target.value;
        applyFilters();
    });

    for (const button of tagButtons) {
        button.addEventListener('click', () => {
            const tag = button.dataset.tag;
            if (state.tags.has(tag)) {
                state.tags.delete(tag);
            } else {
                state.tags.add(tag);
            }
            button.classList.toggle('active', state.tags.has(tag));
            applyFilters();
        });
    }

    for (const button of filmButtons) {
        button.addEventListener('click', () => {
            const film = button.dataset.film;
            if (state.films.has(film)) {
                state.films.delete(film);
            } else {
                state.films.add(film);
            }
            button.classList.toggle('active', state.films.has(film));
            applyFilters();
        });
    }

    function setAllPanels(open) {
        const panels = document.querySelectorAll('details');
        for (const panel of panels) {
            panel.open = open;
        }
    }

    const expandAll = () => setAllPanels(true);
    const collapseAll = () => setAllPanels(false);

    clearFiltersButton.addEventListener('click', clearAllFilters);
    expandAllButton.addEventListener('click', expandAll);
    collapseAllButton.addEventListener('click', collapseAll);

    applyFilters();
});

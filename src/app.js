document.addEventListener('DOMContentLoaded', () => {
    // WHEEEEEEEE
    const searchInput = document.getElementById('search');
    const expandAllButton = document.getElementById('expand-all');
    const collapseAllButton = document.getElementById('collapse-all');
    const clearFiltersButton = document.getElementById('clear-filters');
    const sectionTabList = document.querySelector('.section-tabs');
    const sectionTabs = [...sectionTabList.querySelectorAll('[role="tab"]')];
    const tagButtons = [...document.querySelectorAll('.tag')];
    const filmButtons = [...document.querySelectorAll('.film')];
    const entries = [...document.querySelectorAll('.entry')];
    const resultCount = document.getElementById('results-count');
    const filterSidebar = document.querySelector('.filter-sidebar');
    const filterControls = document.querySelector('.filter-controls');
    const filterScrollbar = document.querySelector('.filter-scrollbar');
    const filterScrollbarThumb = document.querySelector('.filter-scrollbar-thumb');
    const filters = document.getElementById('filters');
    const filterToggle = document.querySelector('.filter-toggle');
    const filterClose = document.querySelector('.filter-close');
    const filterBackdrop = document.querySelector('.filter-backdrop');
    const mobileFilters = window.matchMedia('(max-width: 900px)');
    let previousOverflow = '';

    function closeFilterDrawer(restoreFocus = true) {
        if (!filters.classList.contains('is-open')) return;
        filters.classList.remove('is-open');
        filters.removeAttribute('role');
        filters.removeAttribute('aria-modal');
        filterToggle.setAttribute('aria-expanded', 'false');
        filterBackdrop.hidden = true;
        document.body.style.overflow = previousOverflow;
        if (restoreFocus) filterToggle.focus();
        filters.inert = mobileFilters.matches;
    }

    filterToggle.addEventListener('click', () => {
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        filterBackdrop.hidden = false;
        filters.inert = false;
        filters.classList.add('drawer-animated', 'is-open');
        filters.setAttribute('role', 'dialog');
        filters.setAttribute('aria-modal', 'true');
        filterToggle.setAttribute('aria-expanded', 'true');
        filterClose.focus();
        updateFilterScrollbar();
    });
    filterClose.addEventListener('click', () => closeFilterDrawer());
    filterBackdrop.addEventListener('click', () => closeFilterDrawer());
    mobileFilters.addEventListener('change', event => {
        if (!event.matches) {
            closeFilterDrawer(false);
            filters.classList.remove('drawer-animated');
        }
        updateFilterAvailability();
    });
    document.body.classList.add('mobile-filters-enabled');

    // This was cobbled together from various things I found online:
    // the basic idea is to both update the scrollbar thumb size
    // and position based on the content and the current scroll position,
    // and also to support dragging the thumb with the pointer.
    function updateFilterScrollbar() {
        const scrollRange = filterControls.scrollHeight - filterControls.clientHeight;
        filterScrollbar.hidden = scrollRange <= 0;
        if (scrollRange <= 0) return;

        const trackHeight = filterScrollbar.clientHeight;

        // If I ever get a sidebar this hits this, I've done something horribly wrong, but just in case
        const minHeight = 24;

        const visibleFraction = filterControls.clientHeight / filterControls.scrollHeight;
        const proportionalHeight = trackHeight * visibleFraction;
        const thumbHeight = Math.min(trackHeight, Math.max(minHeight, proportionalHeight));

        const scrollProgress = filterControls.scrollTop / scrollRange;
        const thumbTravel = trackHeight - thumbHeight;
        const thumbTop = thumbTravel * scrollProgress;
        filterScrollbarThumb.style.height = `${thumbHeight}px`;
        filterScrollbarThumb.style.top = `${thumbTop}px`;
    }

    let thumbOffset = 0;
    function scrollFiltersFromPointer(event) {
        const track = filterScrollbar.getBoundingClientRect();
        const thumbHeight = filterScrollbarThumb.offsetHeight;
        const thumbTravel = track.height - thumbHeight;
        if (thumbTravel <= 0) return;

        const pointerPosition = event.clientY - track.top;
        const desiredThumbTop = pointerPosition - thumbOffset;
        const thumbTop = Math.max(0, Math.min(thumbTravel, desiredThumbTop));

        const scrollProgress = thumbTop / thumbTravel;
        const scrollRange = filterControls.scrollHeight - filterControls.clientHeight;
        filterControls.scrollTop = scrollProgress * scrollRange;
    }

    filterScrollbar.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        event.preventDefault();
        // Preserve the grab point on the thumb, or center it on a track click.
        thumbOffset = event.target === filterScrollbarThumb
            ? event.clientY - filterScrollbarThumb.getBoundingClientRect().top
            : filterScrollbarThumb.offsetHeight / 2;
        filterScrollbar.setPointerCapture(event.pointerId);
        scrollFiltersFromPointer(event);
    });
    filterScrollbar.addEventListener('pointermove', event => {
        if (filterScrollbar.hasPointerCapture(event.pointerId)) {
            scrollFiltersFromPointer(event);
        }
    });
    filterControls.addEventListener('keydown', event => {
        if (event.target !== filterControls) return;
        const scrollRange = filterControls.scrollHeight - filterControls.clientHeight;
        switch (event.key) {
            case 'ArrowDown': filterControls.scrollTop += 40; break;
            case 'ArrowUp': filterControls.scrollTop -= 40; break;
            case 'PageDown': filterControls.scrollTop += filterControls.clientHeight; break;
            case 'PageUp': filterControls.scrollTop -= filterControls.clientHeight; break;
            case 'Home': filterControls.scrollTop = 0; break;
            case 'End': filterControls.scrollTop = scrollRange; break;
            default: return;
        }
        event.preventDefault();
    });
    filterControls.addEventListener('scroll', updateFilterScrollbar);
    window.addEventListener('resize', updateFilterScrollbar);
    if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(updateFilterScrollbar);
        observer.observe(filterControls);
        for (const child of filterControls.children) observer.observe(child);
    }
    filterSidebar.classList.add('has-custom-scrollbar');
    updateFilterScrollbar();

    const state = {
        query: '',
        tags: new Set(),
        films: new Set(),
    };

    const normalise = (value = '') => String(value).trim().toLowerCase();

    function updateResultsCount(count) {
        if (!resultCount) return;
        resultCount.textContent = `${count} results`;
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
        const query = normalise(state.query);

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

    function updateFilterAvailability() {
        const showFilters = document.getElementById('bibliography-tab').getAttribute('aria-selected') === 'true';
        filters.hidden = !showFilters && mobileFilters.matches;
        filters.inert = !showFilters || (mobileFilters.matches && !filters.classList.contains('is-open'));
        filters.classList.toggle('filters-inactive', !showFilters);
        filterToggle.hidden = !showFilters;
        if (!filters.hidden) updateFilterScrollbar();
    }

    function selectSection(selectedTab, reveal = false) {
        const changed = selectedTab.getAttribute('aria-selected') !== 'true';
        const showFilters = selectedTab.getAttribute('aria-controls') === 'bibliography';
        for (const tab of sectionTabs) {
            const selected = tab === selectedTab;
            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;
            document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
        }
        if (!showFilters) closeFilterDrawer(false);
        updateFilterAvailability();
        if (reveal && changed) {
            const contentTop = sectionTabList.parentElement.getBoundingClientRect().top;
            if (contentTop < 0) window.scrollBy(0, contentTop);
        }
    }

    for (const tab of sectionTabs) {
        tab.addEventListener('click', () => selectSection(tab, true));
        tab.addEventListener('keydown', event => {
            const index = sectionTabs.indexOf(tab);
            let nextIndex;
            switch (event.key) {
                case 'ArrowRight': nextIndex = (index + 1) % sectionTabs.length; break;
                case 'ArrowLeft': nextIndex = (index - 1 + sectionTabs.length) % sectionTabs.length; break;
                case 'Home': nextIndex = 0; break;
                case 'End': nextIndex = sectionTabs.length - 1; break;
                default: return;
            }
            event.preventDefault();
            const nextTab = sectionTabs[nextIndex];
            selectSection(nextTab, true);
            nextTab.focus();
        });
    }
    selectSection(sectionTabs[0]);
    sectionTabList.hidden = false;
});

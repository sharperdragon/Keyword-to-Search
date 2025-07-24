export function escapeRegex(term) {
    return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function regexWrap(term, field) {
    const safeTerm = escapeRegex(term);
    return `"${field}:re:\\b${safeTerm}\\b"`;
}

export function toggleSelection(selectAll, container = document) {
    const checkboxes = container.querySelectorAll("input[type='checkbox']");
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll;
        checkbox.dispatchEvent(new Event("change"));
    });
}
// Utility functions for Keyword-to-Search

export function debounce(func, delay = 300) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
}

export function createDropdown(id, optionsArray) {
    const select = document.createElement("select");
    select.id = id;
    optionsArray.forEach(optionText => {
        const option = document.createElement("option");
        option.value = optionText;
        option.textContent = optionText;
        select.appendChild(option);
    });
    return select;
}
export function buildSearchClause(field, word) {
    return `(${field}:*${word}*)`;
}

export function loadLocalStorage(key, fallback = []) {
    try {
        return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
        return fallback;
    }
}

export function saveLocalStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}
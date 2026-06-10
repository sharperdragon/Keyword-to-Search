import { debounce, regexWrap, toggleSelection } from './utils.js';

const DEFAULT_MODE = "keyword";
const MODE_STORAGE_KEY = "ankiSearchMode";
const KEYWORD_HISTORY_STORAGE_KEY = "keywordSearchHistory";
const UWORLD_HISTORY_STORAGE_KEY = "conversionHistory";
const UWORLD_SESSION_HISTORY_STORAGE_KEY = "sessionConversionHistory";
const EXAM_TYPE_STORAGE_KEY = "examType";
const REGEX_STORAGE_KEY = "useRegex";
const KEYWORD_HISTORY_LIMIT = 20;
const UWORLD_HISTORY_LIMIT = 10;
const UWORLD_TAG_TEMPLATES = {
    default: "tag:re:[^\\d]{id}$",
    COMLEX: "tag:#Zank::#Step1_v12::#UWorld::COMLEX::{id}",
    STEP: "tag:#Zank::#Step1_v12::#UWorld::Step::{id}"
};

const MODES = new Set(["keyword", "uworld"]);
const KEYWORD_FIELDS_WITH_REGEX = new Set(["Text", "Front", "Extra"]);

let activeMode = null;
let lastSavedKeywordInput = "";
const inputDrafts = {
    keyword: "",
    uworld: ""
};

const inputField = document.getElementById("input_ids");
const inputLabel = document.getElementById("input_label");
const questionList = document.getElementById("question_list");
const outputText = document.getElementById("output_text");
const selectAllButton = document.getElementById("select_all");
const deselectAllButton = document.getElementById("deselect_all");
const copyButton = document.getElementById("copy_button");
const historySelect = document.getElementById("history_select");
const historyLabel = document.getElementById("history_label");
const clearHistoryButton = document.getElementById("clear_history_button");
const regexToggle = document.getElementById("regex_toggle");
const regexToggleWrapper = document.getElementById("regex_toggle_wrapper");
const fieldOptionsSection = document.getElementById("mode_section");
const fieldSelect = document.getElementById("field_select");
const fieldOptions = document.querySelectorAll(".field_option");
const modeButtons = document.querySelectorAll(".tool-mode-button");
const uworldSourceSection = document.getElementById("uworld_source_section");
const examTypeInput = document.getElementById("exam_type");
const sourceButtons = document.querySelectorAll(".source-btn");

function normalizeMode(mode) {
    return MODES.has(mode) ? mode : DEFAULT_MODE;
}

function loadArray(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

function saveArray(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function restoreInitialDrafts() {
    const keywordHistory = loadArray(KEYWORD_HISTORY_STORAGE_KEY);
    const latestKeyword = keywordHistory[0];

    if (latestKeyword && typeof latestKeyword.input === "string" && latestKeyword.input.trim()) {
        inputDrafts.keyword = latestKeyword.input;
    }
}

function parseEntries(input, mode) {
    const entries = [];
    const regex = mode === "uworld" ? /"([^"]+)"|([^,\n\r]+)/g : /"([^"]+)"|([^,]+)/g;
    let match;

    while ((match = regex.exec(input)) !== null) {
        const item = match[1] ? match[1].trim() : match[2]?.trim();
        if (item) entries.push(item);
    }

    return entries;
}

function updateQuestionList() {
    questionList.innerHTML = "";
    const inputValue = inputField.value.trim();
    inputDrafts[activeMode] = inputField.value;

    if (!inputValue) {
        updateOutput();
        return;
    }

    parseEntries(inputValue, activeMode).forEach((entry, index) => {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        const number = document.createElement("span");
        const idText = document.createElement("span");

        checkbox.type = "checkbox";
        checkbox.value = entry;
        checkbox.checked = true;

        number.className = "number";
        number.textContent = `${index + 1})`;

        idText.className = "id";
        idText.textContent = entry;

        label.className = activeMode === "uworld" ? "question-label selected" : "";
        checkbox.addEventListener("change", () => {
            label.classList.toggle("selected", checkbox.checked);
        });

        label.append(checkbox, number, idText);
        questionList.appendChild(label);
    });

    updateOutput();
}

function getSelectedEntries() {
    return Array.from(questionList.querySelectorAll("input:checked"))
        .map(input => input.value)
        .filter(Boolean);
}

function getKeywordPlaceholder(selectedField) {
    const useRegex = regexToggle?.checked;

    if (selectedField === "Text" || selectedField === "Front" || selectedField === "Extra") {
        return useRegex
            ? `((${selectedField}:re:\\bjo1\\b) OR (${selectedField}:re:\\bantisaccromyces\\b) OR (${selectedField}:re:\\bpoopy\\b))`
            : `((${selectedField}:*jo1*) OR (${selectedField}:*antisaccromyces*) OR (${selectedField}:*poopy*))`;
    }

    if (selectedField === "CID" || selectedField === "NID") {
        return `((${selectedField}:jo1) OR (${selectedField}:antisaccromyces) OR (${selectedField}:poopy))`;
    }

    return "((jo1) OR (antisaccromyces) OR (poopy))";
}

function getUworldTemplate() {
    const examType = examTypeInput.value;
    return UWORLD_TAG_TEMPLATES[examType] || UWORLD_TAG_TEMPLATES.default;
}

function getUworldPlaceholder() {
    return getUworldTemplate().replace("{id}", "23456");
}

function updateOutput() {
    if (activeMode === "uworld") {
        updateUworldOutput();
        return;
    }

    updateKeywordOutput();
}

function updateKeywordOutput() {
    const selectedEntries = getSelectedEntries();
    const selectedField = fieldSelect.value || "Text";
    const useRegex = regexToggle?.checked;

    updateRegexVisibility();
    outputText.placeholder = getKeywordPlaceholder(selectedField);

    if (!selectedEntries.length) {
        outputText.value = "";
        return;
    }

    const fieldBehavior = {
        Text: true,
        Front: true,
        Extra: true,
        CID: false,
        NID: false
    };
    const needsWildcard = fieldBehavior[selectedField] ?? true;
    const outputParts = [];

    if (selectedField === "Any") {
        selectedEntries.forEach(entry => {
            outputParts.push(`(${entry})`);
        });
    } else if (KEYWORD_FIELDS_WITH_REGEX.has(selectedField)) {
        selectedEntries.forEach(entry => {
            const words = entry.trim().split(/\s+/).map(word => word.trim()).filter(Boolean);
            if (words.length) {
                const wordClauses = words.map(word =>
                    useRegex ? regexWrap(word, selectedField) : `"${selectedField}:*${word}*"`
                );
                outputParts.push(`(${wordClauses.join(" ")})`);
            }
        });
    } else {
        selectedEntries.forEach(entry => {
            const words = entry.trim().split(/\s+/).map(word => word.trim()).filter(Boolean);
            if (words.length === 1) {
                outputParts.push(needsWildcard ? `(${selectedField}:*${words[0]}*)` : `(${selectedField}:${words[0]})`);
            } else if (words.length > 1) {
                const wordClauses = words.map(word =>
                    needsWildcard ? `(${selectedField}:*${word}*)` : `(${selectedField}:${word})`
                );
                outputParts.push(`(${wordClauses.join(" ")})`);
            }
        });
    }

    outputText.value = `(${outputParts.join(" OR ")})`;
}

function updateUworldOutput() {
    const selectedEntries = getSelectedEntries();
    const template = getUworldTemplate();

    outputText.placeholder = getUworldPlaceholder();
    outputText.value = selectedEntries.length
        ? `(${selectedEntries.map(entry => template.replace("{id}", entry)).join(" OR ")})`
        : "";
}

function updateRegexVisibility() {
    const showRegex = activeMode === "keyword" && KEYWORD_FIELDS_WITH_REGEX.has(fieldSelect.value || "Text");
    regexToggleWrapper.style.display = showRegex ? "flex" : "none";
}

function syncSelectedFieldOption() {
    fieldOptions.forEach(option => {
        option.classList.toggle("selected_field_option", option.getAttribute("data-value") === fieldSelect.value);
    });
}

function updateHistoryDropdown() {
    historySelect.innerHTML = "";

    if (activeMode === "uworld") {
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "-- Select a past UWorld output --";
        historySelect.appendChild(placeholder);

        loadArray(UWORLD_HISTORY_STORAGE_KEY).forEach(item => {
            const output = item?.value || item?.output || (typeof item === "string" ? item : "");
            if (!output) return;

            const option = document.createElement("option");
            option.value = output;
            option.textContent = item?.label || output;
            historySelect.appendChild(option);
        });
        return;
    }

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "-- Select from keyword history --";
    historySelect.appendChild(placeholder);

    loadArray(KEYWORD_HISTORY_STORAGE_KEY).forEach(item => {
        if (!item?.input) return;

        const option = document.createElement("option");
        option.value = JSON.stringify(item);
        option.textContent = `${item.input} (Field: ${item.field || "Text"})`;
        historySelect.appendChild(option);
    });
}

function showHistoryFeedback() {
    const feedback = document.createElement("span");
    feedback.className = "history-feedback";
    feedback.textContent = "+1";
    historySelect.parentElement.appendChild(feedback);
    setTimeout(() => feedback.remove(), 1000);
}

function saveKeywordHistory(entry) {
    if (!entry || !entry.trim()) return;

    let history = loadArray(KEYWORD_HISTORY_STORAGE_KEY);
    history = history.filter(item => item.input !== entry);
    history.unshift({ input: entry, field: fieldSelect.value || "Text" });
    saveArray(KEYWORD_HISTORY_STORAGE_KEY, history.slice(0, KEYWORD_HISTORY_LIMIT));
    updateHistoryDropdown();
    showHistoryFeedback();
}

function saveUworldHistory(output) {
    if (!output || !output.trim()) return;

    const now = new Date();
    const label = `${now.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${output}`;
    const historyItem = { label, value: output };

    let history = loadArray(UWORLD_HISTORY_STORAGE_KEY).filter(item => item?.value !== output);
    history.unshift(historyItem);
    saveArray(UWORLD_HISTORY_STORAGE_KEY, history.slice(0, UWORLD_HISTORY_LIMIT));

    try {
        const sessionHistory = JSON.parse(sessionStorage.getItem(UWORLD_SESSION_HISTORY_STORAGE_KEY) || "[]");
        const nextSessionHistory = Array.isArray(sessionHistory)
            ? sessionHistory.filter(item => item?.value !== output)
            : [];
        nextSessionHistory.unshift(historyItem);
        sessionStorage.setItem(UWORLD_SESSION_HISTORY_STORAGE_KEY, JSON.stringify(nextSessionHistory.slice(0, UWORLD_HISTORY_LIMIT)));
    } catch {
        sessionStorage.setItem(UWORLD_SESSION_HISTORY_STORAGE_KEY, JSON.stringify([historyItem]));
    }

    updateHistoryDropdown();
    showHistoryFeedback();
}

function setMode(mode, { persist = true } = {}) {
    const nextMode = normalizeMode(mode);

    if (activeMode && activeMode !== nextMode) {
        inputDrafts[activeMode] = inputField.value;
    }

    activeMode = nextMode;
    if (persist) localStorage.setItem(MODE_STORAGE_KEY, activeMode);

    modeButtons.forEach(button => {
        const isActive = button.dataset.mode === activeMode;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });

    const keywordMode = activeMode === "keyword";
    fieldOptionsSection.hidden = !keywordMode;
    uworldSourceSection.hidden = keywordMode;
    inputLabel.textContent = keywordMode ? "Keywords (comma-separated):" : "Question IDs (comma-separated):";
    inputField.placeholder = keywordMode
        ? "e.g., anti-Jo1, coronary artery, BRCA1..."
        : "e.g., 23456, 278901, 23175";
    historyLabel.textContent = keywordMode ? "Keyword history:" : "UWorld history:";
    clearHistoryButton.textContent = keywordMode ? "Clear Keyword History" : "Clear UWorld History";
    inputField.value = inputDrafts[activeMode] || "";

    updateRegexVisibility();
    updateHistoryDropdown();
    updateQuestionList();
}

function setUworldSource(source) {
    const nextSource = UWORLD_TAG_TEMPLATES[source] ? source : "";
    examTypeInput.value = nextSource;

    if (nextSource) {
        localStorage.setItem(EXAM_TYPE_STORAGE_KEY, nextSource);
    } else {
        localStorage.removeItem(EXAM_TYPE_STORAGE_KEY);
    }

    sourceButtons.forEach(button => {
        const active = button.dataset.source === nextSource;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });

    updateOutput();
}

function clearActiveHistory() {
    if (activeMode === "uworld") {
        if (confirm("Are you sure you want to clear UWorld history?")) {
            localStorage.removeItem(UWORLD_HISTORY_STORAGE_KEY);
            sessionStorage.removeItem(UWORLD_SESSION_HISTORY_STORAGE_KEY);
            updateHistoryDropdown();
        }
        return;
    }

    if (confirm("Are you sure you want to clear keyword history?")) {
        localStorage.removeItem(KEYWORD_HISTORY_STORAGE_KEY);
        updateHistoryDropdown();
    }
}

inputField.addEventListener("input", debounce(updateQuestionList, 300));

selectAllButton.addEventListener("click", () => {
    toggleSelection(true, questionList);
    updateOutput();
});

deselectAllButton.addEventListener("click", () => {
    toggleSelection(false, questionList);
    updateOutput();
});

questionList.addEventListener("change", updateOutput);

copyButton.addEventListener("click", () => {
    outputText.select();
    outputText.setSelectionRange(0, 99999);

    navigator.clipboard.writeText(outputText.value).then(() => {
        if (activeMode === "uworld") {
            saveUworldHistory(outputText.value);
        } else {
            const value = inputField.value.trim();
            if (value && value !== lastSavedKeywordInput) {
                saveKeywordHistory(value);
                lastSavedKeywordInput = value;
            }
        }

        copyButton.textContent = "Copied!";
        setTimeout(() => {
            copyButton.textContent = "Copy to Clipboard";
        }, 1500);
    });
});

historySelect.addEventListener("change", () => {
    if (!historySelect.value) return;

    if (activeMode === "uworld") {
        outputText.value = historySelect.value;
        return;
    }

    try {
        const selected = JSON.parse(historySelect.value);
        inputField.value = selected.input || "";
        inputDrafts.keyword = inputField.value;
        fieldSelect.value = selected.field || "Text";
        syncSelectedFieldOption();
        updateQuestionList();
    } catch {
        inputField.value = historySelect.value;
        inputDrafts.keyword = inputField.value;
        updateQuestionList();
    }
});

clearHistoryButton.addEventListener("click", clearActiveHistory);

modeButtons.forEach(button => {
    button.addEventListener("click", () => {
        setMode(button.dataset.mode);
    });
});

fieldSelect.addEventListener("change", () => {
    syncSelectedFieldOption();
    updateOutput();
});

fieldOptions.forEach(option => {
    option.addEventListener("click", event => {
        fieldSelect.value = option.getAttribute("data-value");
        fieldSelect.dispatchEvent(new Event("change"));

        const ripple = document.createElement("span");
        const rect = option.getBoundingClientRect();
        ripple.className = "ripple";
        ripple.style.left = `${event.clientX - rect.left}px`;
        ripple.style.top = `${event.clientY - rect.top}px`;
        option.appendChild(ripple);
        setTimeout(() => ripple.remove(), 700);
    });
});

sourceButtons.forEach(button => {
    button.addEventListener("click", () => {
        const selectedSource = button.dataset.source;
        setUworldSource(examTypeInput.value === selectedSource ? "" : selectedSource);
    });
});

if (regexToggle) {
    regexToggle.checked = localStorage.getItem(REGEX_STORAGE_KEY) === "1";
    regexToggle.addEventListener("change", () => {
        localStorage.setItem(REGEX_STORAGE_KEY, regexToggle.checked ? "1" : "0");
        updateOutput();
    });
}

restoreInitialDrafts();
syncSelectedFieldOption();
setUworldSource(localStorage.getItem(EXAM_TYPE_STORAGE_KEY) || "");
setMode(localStorage.getItem(MODE_STORAGE_KEY), { persist: false });

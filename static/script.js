import { debounce, createDropdown, buildSearchClause, loadLocalStorage} from './utils.js';
let lastSavedInput = "";
const STORAGE_KEY = "keywordSearchHistory";

const inputField = document.getElementById("input_ids");
const questionList = document.getElementById("question_list");
const outputText = document.getElementById("output_text");
const selectAllButton = document.getElementById("select_all");
const deselectAllButton = document.getElementById("deselect_all");
const copyButton = document.getElementById("copy_button");
const historySelect = document.getElementById("history_select");

// Update the question list dynamically and save to history on input
inputField.addEventListener("input", debounce(() => {
    updateQuestionList(); // update displayed items only
}, 300));

// Event listener for Select All button
selectAllButton.addEventListener("click", () => {
    toggleSelection(true);
    updateOutput();
});

function saveToHistory(entry) {
    if (!entry || !entry.trim()) return;
    const fieldValue = document.getElementById("field_select") ? document.getElementById("field_select").value : "Text";
    let history = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    history = history.filter(e => e.input !== entry); // Remove duplicates
    history.unshift({input: entry, field: fieldValue}); // Add to top
    if (history.length > 20) history = history.slice(0, 20); // Limit size
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    updateHistoryDropdown();
    
    // Visual feedback
    const feedback = document.createElement("span");
    feedback.className = "history-feedback";
    feedback.textContent = "+1";
    const parent = historySelect.parentElement;
    parent.style.position = "relative";
    parent.appendChild(feedback);
    setTimeout(() => feedback.remove(), 1000);
}

function updateHistoryDropdown() {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    historySelect.innerHTML = '<option value="">-- Select from history --</option>';
    history.forEach(item => {
        const option = document.createElement("option");
        option.value = JSON.stringify(item);
        option.textContent = `${item.input} (Field: ${item.field})`;
        historySelect.appendChild(option);
    });
}

historySelect.addEventListener("change", () => {
    if (historySelect.value) {
        try {
            const selected = JSON.parse(historySelect.value);
            inputField.value = selected.input;
            const fieldSelect = document.getElementById("field_select");
            if(fieldSelect && selected.field) {
                fieldSelect.value = selected.field;
            }
            updateQuestionList();
        } catch(e) {
            // Fallback if parsing fails
            inputField.value = historySelect.value;
            updateQuestionList();
        }
    }
});

// Removed inline call to populateHistoryDropdown to avoid race conditions

// Event listener for Deselect All button
deselectAllButton.addEventListener("click", () => {
    toggleSelection(false);
    updateOutput();
});

function updateQuestionList() {
    questionList.innerHTML = ""; // Clear previous list
    const inputIDs = inputField.value.trim();

    if (!inputIDs) {
        if (lastSavedInput !== "") {
            saveToHistory("");
            lastSavedInput = "";
            updateHistoryDropdown();
        }
        return;
    }

    const ids = [];
    const regex = /"([^"]+)"|([^,]+)/g;
    let match;
    while ((match = regex.exec(inputIDs)) !== null) {
        const item = match[1] ? `"${match[1].trim()}"` : match[2].trim();
        if (item) ids.push(item);
    }

    ids.forEach((id, index) => {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = id;
        checkbox.checked = true;
        label.appendChild(checkbox);
        label.innerHTML += `
            <span class="number">${index + 1})</span>
            <span class="space"> </span> 
            <span class="id">${id}</span>`;
        questionList.appendChild(label);
        questionList.appendChild(document.createElement("br"));
    });
    updateOutput();
}

function toggleSelection(selectAll) {
    const checkboxes = questionList.querySelectorAll("input[type='checkbox']");
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll;
        checkbox.dispatchEvent(new Event("change"));
    });
}

function updateOutput() {
    const selectedIDs = Array.from(document.querySelectorAll("#question_list input:checked"))
                             .map(input => input.value);

    const selectedField = document.getElementById("field_select").value || "Text";

    if (!selectedIDs.length) {
        outputText.value = ""; // clear any text
        if (selectedField === "Text" || selectedField === "Front") {
            outputText.placeholder = `((${selectedField}:*jo1*) OR (${selectedField}:*antisaccromyces*) OR (${selectedField}:*poopy*))`;
        } else {
            outputText.placeholder = `((${selectedField}:jo1) OR (${selectedField}:antisaccromyces) OR (${selectedField}:poopy))`;
        }
        return;
    }
    function updatePlaceholderExample(selectedField) {
        const outputBox = document.getElementById("output_text");
        if (!outputBox) return;
    
        if (selectedField === "Text") {
            outputBox.placeholder = "((Text:*jo1*) OR (Text:*antisaccromyces*) OR (Text:*poopy*))";
        } else if (selectedField === "Front") {
            outputBox.placeholder = "((Front:*jo1*) OR (Front:*antisaccromyces*) OR (Front:*poopy*))";
        } else if (selectedField === "CID") {
            outputBox.placeholder = "((CID:jo1) OR (CID:antisaccromyces) OR (CID:poopy))";
        } else if (selectedField === "NID") {
            outputBox.placeholder = "((NID:jo1) OR (NID:antisaccromyces) OR (NID:poopy))";
        }
    }
    const outputParts = [];

    const fieldBehavior = {
        "Text": true,
        "Front": true,
        "CID": false,
        "NID": false
    };
    const needsWildcard = fieldBehavior[selectedField] ?? true;

    selectedIDs.forEach(entry => {
        const words = entry.trim().split(/\s+/).map(w => w.trim()).filter(w => w.length > 0);

        if (words.length === 1) {
            if (needsWildcard) {
                outputParts.push(`(${selectedField}:*${words[0]}*)`);
            } else {
                outputParts.push(`(${selectedField}:${words[0]})`);
            }
        } else if (words.length > 1) {
            const wordClauses = words.map(w => {
                if (needsWildcard) {
                    return `(${selectedField}:*${w}*)`;
                } else {
                    return `(${selectedField}:${w})`;
                }
            });
            outputParts.push(`(${wordClauses.join(" ")})`);
        }
    });

    outputText.value = `(${outputParts.join(" OR ")})`;
}

questionList.addEventListener("change", updateOutput);

copyButton.addEventListener("click", () => {
    outputText.select();
    outputText.setSelectionRange(0, 99999); // For mobile compatibility
    navigator.clipboard.writeText(outputText.value).then(() => {
        const val = inputField.value.trim();
        if (val && val !== lastSavedInput) {
            saveToHistory(val);
            lastSavedInput = val;
        }
        updateHistoryDropdown();
        
        copyButton.textContent = "Copied!";
        setTimeout(() => (copyButton.textContent = "Copy to Clipboard"), 1500);
    });
});

// Ensure dropdown loads on page open
document.addEventListener("DOMContentLoaded", () => {
    updateHistoryDropdown();
    // Load latest history and populate input/field if history exists, but only if input is meaningful
    const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (history.length > 0) {
        const latest = history[0];
        if (latest && typeof latest.input === "string" && latest.input.trim().length > 5) {
            inputField.value = latest.input;
            const fieldSelect = document.getElementById("field_select");
            if (fieldSelect && latest.field) {
                fieldSelect.value = latest.field;
            }
            updateQuestionList();
        } else {
            inputField.value = "";
        }
    }
    // --- BEGIN mode_section population ---
    const modeSection = document.getElementById("mode_section");
    if (modeSection) {
        const fieldSelect = document.getElementById("field_select");
        if (fieldSelect) {
            fieldSelect.addEventListener("change", updateOutput);
        }
        const fieldOptions = document.querySelectorAll(".field_option");
        fieldOptions.forEach(option => {
            option.addEventListener("click", (e) => {
                const selectedField = option.getAttribute("data-value");
                const fieldSelect = document.getElementById("field_select");
                if (fieldSelect) {
                    fieldSelect.value = selectedField;
                }
        
                // Clear previous selection
                fieldOptions.forEach(opt => opt.classList.remove("selected_field_option"));
                // Mark this option as selected
                option.classList.add("selected_field_option");
        
                updateOutput();
        
                // Ripple effect
                const ripple = document.createElement("span");
                ripple.className = "ripple";
        
                const rect = option.getBoundingClientRect();
                ripple.style.left = `${e.clientX - rect.left}px`;
                ripple.style.top = `${e.clientY - rect.top}px`;
        
                option.appendChild(ripple);
        
                setTimeout(() => {
                    ripple.remove();
                }, 700);
            });
        });
    }
    // --- END mode_section population ---
    // Insert Clear History button after history dropdown
    const historyParent = historySelect.parentElement;
    const clearButton = document.createElement("button");
    clearButton.id = "clear_history_button";
    clearButton.textContent = "Clear History";
    clearButton.addEventListener("click", () => {
        if (confirm("Are you sure you want to clear all history?")) {
            localStorage.removeItem(STORAGE_KEY);
            updateHistoryDropdown();
        }
    });
    historyParent.appendChild(clearButton);
});
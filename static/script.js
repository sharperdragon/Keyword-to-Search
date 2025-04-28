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


// Advanced options (Search Field dropdown) - modularized
function initializeAdvancedOptions() {
    // Avoid duplicate insertion
    if (document.getElementById("field_select")) return;

    const advancedWrapper = document.createElement("details");
    advancedWrapper.id = "advanced_options";
    const summary = document.createElement("summary");
    summary.textContent = "Advanced Options";
    advancedWrapper.appendChild(summary);

    const fieldLabel = document.createElement("label");
    fieldLabel.textContent = "Search Field:";
    fieldLabel.htmlFor = "field_select";
    fieldLabel.style.marginTop = "10px";

    const fieldSelect = createDropdown("field_select", ["Text", "Front", "NID", "CID"]);

    // Add placeholder update logic based on field selection
    fieldSelect.addEventListener("change", () => {
        const placeholder = (fieldSelect.value === "NID" || fieldSelect.value === "CID")
            ? "121314324, 32426532, 312413241..."
            : "e.g., anti-Jo1, coronary artery, BRCA1...";
        inputField.placeholder = placeholder;
    });

    advancedWrapper.appendChild(fieldLabel);
    advancedWrapper.appendChild(fieldSelect);

    const historyParent = document.querySelector('.input-history-wrapper');
    if (historyParent) {
        historyParent.appendChild(advancedWrapper);
    }
}

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
        label.innerHTML = `
            <input type="checkbox" value="${id}">
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
        outputText.value = "";
        return;
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
    if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([{input: "Apr 21, 10:00 → (Text:*test*)", field: "Text"}]));
    }
    updateHistoryDropdown();
    // Ensure advanced options are initialized on page load
    if (typeof initializeAdvancedOptions === "function") {
        initializeAdvancedOptions();
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
            option.addEventListener("click", () => {
                const selectedField = option.getAttribute("data-value");
                const fieldSelect = document.getElementById("field_select");
                fieldSelect.value = selectedField; // Update the hidden field select value
                updateOutput(); // Update the output based on the selected field
            });
        });
    }
    // --- END mode_section population ---
    // Insert Clear History button after history dropdown
    const historyParent = historySelect.parentElement;
    const clearButton = document.createElement("button");
    clearButton.id = "clear_history_button";
    clearButton.textContent = "Clear History";
    clearButton.style.marginTop = "5px";
    clearButton.style.marginLeft = "5px";
    // Improved subtle style for "Clear History"
    clearButton.style.backgroundColor = "#e0e7ff";
    clearButton.style.color = "#333";
    clearButton.style.fontSize = "90%";
    clearButton.style.padding = "6px 10px";
    clearButton.style.border = "1px solid #b0c4de";
    clearButton.style.borderRadius = "8px";
    clearButton.style.cursor = "pointer";
    clearButton.addEventListener("click", () => {
        if (confirm("Are you sure you want to clear all history?")) {
            localStorage.removeItem(STORAGE_KEY);
            updateHistoryDropdown();
        }
    });
    historyParent.appendChild(clearButton);
});
